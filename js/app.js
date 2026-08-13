"use strict";

/**
 * Expense Tracker — application core.
 * Shared in-memory state, navigation, bootstrapping, theme and app lock.
 */
window.App = window.App || {};

(function (ns) {
  const U = ns.utils;
  const DB = ns.db;
  const state = ns.state;
  const cache = ns.cache;

  /* ---------- data loading / refresh ---------- */
  ns.refreshData = async function (notifyCallback) {
    const [transactions, categories, incomeSources, budgets, recurringExpenses, paymentMethods, prefs] =
      await Promise.all([
        DB.getAll(DB.STORES.transactions),
        DB.getAll(DB.STORES.categories),
        DB.getAll(DB.STORES.incomeSources),
        DB.getAll(DB.STORES.budgets),
        DB.getAll(DB.STORES.recurringExpenses),
        DB.get(DB.STORES.settings, "paymentMethods"),
        DB.get(DB.STORES.settings, "prefs")
      ]);
    state.transactions = transactions;
    state.categories = categories;
    state.incomeSources = incomeSources;
    state.budgets = budgets;
    state.recurringExpenses = recurringExpenses;
    state.paymentMethods = (paymentMethods && paymentMethods.value) || [];
    state.prefs = prefs || { theme: "system", currency: "₹", budget: 0 };

    cache.txList = transactions.slice().sort((a, b) => (b.date + (b.time || "")) < (a.date + (a.time || "")) ? -1 : 1);
    cache.byId = {};
    transactions.forEach((t) => (cache.byId[t.id] = t));

    if (typeof notifyCallback === "function") notifyCallback();
  };

  /* ---------- helpers over state ---------- */
  ns.categoriesForType = function (type) {
    return type === "income" ? state.incomeSources : state.categories;
  };
  ns.getCategoryIcon = function (name, type) {
    if (type === "income") {
      const s = state.incomeSources.find((x) => x.name === name);
      return s ? s.icon : "💰";
    }
    const c = state.categories.find((x) => x.name === name);
    return c ? c.icon : "📦";
  };

  /* ---------- navigation ---------- */
  const NAV = {
    dashboard: { label: "Dashboard", el: () => document.querySelector("[data-view='dashboard']") },
    transactions: { label: "Transactions", el: () => document.querySelector("[data-view='transactions']") },
    analytics: { label: "Analytics", el: () => document.querySelector("[data-view='analytics']") },
    settings: { label: "Settings", el: () => document.querySelector("[data-view='settings']") }
  };

  ns.currentView = ns.currentView || "dashboard";

  ns.navigate = function (viewName) {
    if (!NAV[viewName]) viewName = "dashboard";
    ns.currentView = viewName;
    U.$$(".view").forEach((v) => v.classList.remove("active"));
    const viewEl = document.getElementById(`view-${viewName}`);
    viewEl.classList.add("active");

    U.$$(".side-link, .bnav-item").forEach((b) => {
      b.classList.toggle("active", b.dataset.view === viewName);
    });

    const title = document.getElementById("topbar-title");
    if (title) title.textContent = NAV[viewName].label;

    // close mobile drawer
    const drawer = document.getElementById("drawer");
    if (drawer && !drawer.hidden) drawer.hidden = true;

    // render view
    const renderer = ns.viewRenderers && ns.viewRenderers[viewName];
    if (renderer) {
      try {
        renderer();
      } catch (err) {
        console.error(`Failed to render ${viewName}:`, err);
      }
    }
    window.scrollTo(0, 0);
    if (document.querySelector(".main")) document.querySelector(".main").scrollTop = 0;
  };

  /* ---------- theme ---------- */
  ns.applyTheme = function () {
    const prefsTheme = state.prefs.theme || "system";
    let resolved = prefsTheme;
    if (prefsTheme === "system") {
      resolved = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", resolved);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", resolved === "dark" ? "#0d0f16" : "#6366f1");
    // data-theme also on body for Chart references
    document.body.setAttribute("data-theme", resolved);
    // refresh charts that depend on theme colors
    if (typeof ns.charts !== "undefined" && ns.afterThemeChange) ns.afterThemeChange();
    if (!state.loading && ns.viewRenderers && ns.currentView) ns.navigate(ns.currentView);
  };

  /* ---------- App lock ---------- */
  const lock = (ns.lock = {
    enabled: false,
    salt: "",
    hash: "",
    setupNeeded: false,
    _pin: "",

    load: async function () {
      const rec = await DB.get(DB.STORES.settings, "appLock");
      if (rec) {
        lock.enabled = !!rec.enabled;
        lock.salt = rec.salt || "";
        lock.hash = rec.hash || "";
      }
      return lock.enabled;
    },

    save: async function () {
      await DB.put(DB.STORES.settings, {
        id: "appLock",
        enabled: lock.enabled,
        salt: lock.salt,
        hash: lock.hash
      });
    },

    show: function () {
      const screen = document.getElementById("lock-screen");
      if (screen) screen.hidden = false;
      lock._pin = "";
      lock.renderDots();
      const err = document.getElementById("lock-error");
      if (err) err.textContent = "";
    },

    hide: function () {
      const screen = document.getElementById("lock-screen");
      if (screen) screen.hidden = true;
    },

    renderDots: function () {
      const wrap = document.getElementById("lock-dots");
      if (!wrap) return;
      wrap.innerHTML = "";
      for (let i = 0; i < 4; i++) {
        const d = document.createElement("div");
        d.className = "lock-dot" + (i < lock._pin.length ? " filled" : "");
        wrap.appendChild(d);
      }
    },

    handleKey: async function (key) {
      if (key === "back") {
        lock._pin = lock._pin.slice(0, -1);
        lock.renderDots();
        return;
      }
      if (!/^\d$/.test(key)) return;
      if (lock._pin.length >= 4) return;
      lock._pin += key;
      lock.renderDots();
      if (lock._pin.length === 4) {
        const attempt = U.hashPin(lock._pin, lock.salt);
        if (attempt === lock.hash) {
          lock.hide();
          lock._pin = "";
          if (ns.pendingAfterUnlock) {
            const fn = ns.pendingAfterUnlock;
            ns.pendingAfterUnlock = null;
            fn();
          }
        } else {
          lock._pin = "";
          lock.renderDots();
          const dots = U.$$("#lock-dots .lock-dot");
          dots.forEach((d) => d.classList.add("error"));
          const err = document.getElementById("lock-error");
          if (err) err.textContent = "Incorrect PIN. Try again.";
          setTimeout(() => { dots.forEach((d) => d.classList.remove("error")); if (err) err.textContent = ""; }, 600);
        }
      }
    },

    setPin: async function (pin) {
      lock.salt = U.randomSalt();
      lock.hash = U.hashPin(pin, lock.salt);
      lock.enabled = true;
      await lock.save();
    },

    verify: function (pin) {
      return U.hashPin(pin, lock.salt) === lock.hash;
    },

    disable: async function () {
      lock.enabled = false;
      lock.salt = "";
      lock.hash = "";
      await lock.save();
    }
  });

  /* ---------- boot ---------- */
  ns.boot = async function () {
    U.setupModalClose();

    try {
      await DB.seedIfNeeded();
      await ns.refreshData(() => {});
    } catch (err) {
      console.error("Failed to initialise database:", err);
      U.openModal(
        "Storage unavailable",
        `<div class="confirm-box">
          <div class="confirm-ico danger">!</div>
          <h3 class="confirm-title">Unable to access local storage</h3>
          <p class="confirm-msg">Please check your browser settings (private mode / storage permissions) and try again.</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-primary" data-modal-close>OK</button>
          </div>
        </div>`,
        { hideClose: true }
      );
      return;
    }

    ns.applyTheme();

    // recurring expenses processing
    if (ns.recurring) await ns.recurring.processDue();

    await ns.refreshData(() => {});

    // event listeners
    document.addEventListener("click", (e) => {
      const viewBtn = e.target.closest("[data-view]");
      if (viewBtn && viewBtn.dataset.view) {
        ns.navigate(viewBtn.dataset.view);
        return;
      }
      const addBtn = e.target.closest("#side-add-btn, #bnav-add");
      if (addBtn) {
        ns.openAddModal && ns.openAddModal();
        return;
      }
      const menuBtn = e.target.closest("#topbar-menu");
      if (menuBtn) {
        const drawer = document.getElementById("drawer");
        if (drawer) drawer.hidden = !drawer.hidden;
        return;
      }
      const closeDrawer = e.target.closest("[data-close-drawer]");
      if (closeDrawer) {
        const drawer = document.getElementById("drawer");
        if (drawer) drawer.hidden = true;
      }
    });

    // lock screen keypad
    const numpad = document.getElementById("lock-numpad");
    if (numpad && !numpad.dataset.wired) {
      numpad.dataset.wired = "1";
      numpad.addEventListener("click", (e) => {
        const key = e.target.closest(".lock-key");
        if (key) lock.handleKey(key.dataset.key);
      });
    }

    // lock screen: reset / disable PIN
    const lockReset = document.getElementById("lock-reset");
    if (lockReset && !lockReset.dataset.wired) {
      lockReset.dataset.wired = "1";
      lockReset.addEventListener("click", async () => {
        const ok = await U.confirm({
          title: "Reset app lock?",
          message: "The PIN will be removed. Your data stays safe on this device; you can set a new PIN later in Settings.",
          confirmText: "Remove PIN",
          danger: false,
          icon: "info"
        });
        if (!ok) return;
        try {
          await lock.disable();
          lock.hide();
          U.toast("App lock removed");
          if (ns.pendingAfterUnlock) {
            const fn = ns.pendingAfterUnlock;
            ns.pendingAfterUnlock = null;
            fn();
          }
        } catch (err) {
          console.error("Reset lock failed:", err);
          U.error("Could not reset app lock.");
        }
      });
    }

    // app lock on startup
    await lock.load();
    if (lock.enabled) {
      lock.show();
    }

    ns.pendingAfterUnlock = null;

    // check for deep-link action from manifest shortcut
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");
    if (action === "expense" || action === "income") {
      const afterLock = () => { ns.navigate("transactions"); ns.openAddModal && ns.openAddModal(action); };
      if (lock.enabled) ns.pendingAfterUnlock = afterLock;
      else afterLock();
    } else {
      ns.navigate("dashboard");
    }

    state.loading = false;

    // service worker registration
    if ("serviceWorker" in navigator) {
      try {
        navigator.serviceWorker.register("./service-worker.js");
      } catch (err) {
        console.warn("Service worker registration failed:", err);
      }
    }

    // visibility change → auto-lock (privacy)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        ns.lockLastHiddenAt = Date.now();
        return;
      }
      if (lock.enabled && ns.lockLastHiddenAt) {
        const elapsed = Date.now() - ns.lockLastHiddenAt;
        const idleLimit = (state.prefs.autoLockSeconds || 30) * 1000;
        if (elapsed > idleLimit) lock.show();
      }
    });
    window.addEventListener("pagehide", () => (ns.lockLastHiddenAt = Date.now()));

    // device theme changes while in "system" mode
    if (state.prefs.theme === "system" && window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => ns.applyTheme());
    }

    console.info("Expense Tracker ready.");
  };
})(window.App);