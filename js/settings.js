"use strict";

/**
 * Expense Tracker — settings view.
 * Appearance, currency, budget, categories, payment methods,
 * income sources, recurring expenses, app lock, backup & about.
 */
window.App = window.App || {};

(function (ns) {
  const U = ns.utils;
  const DB = ns.db;
  const state = ns.state;

  /* ---------- theme ---------- */
  function applyThemeSetting(theme) {
    state.prefs.theme = theme;
    DB.put(DB.STORES.settings, state.prefs);
  }

  /* ---------- render ---------- */
  function render() {
    const view = document.getElementById("view-settings");
    const prefs = state.prefs;
    const lockEnabled = ns.lock && ns.lock.enabled;

    view.innerHTML = `
      <div class="settings-group">
        <div class="settings-group-title">Appearance</div>
        <div class="settings-card">
          <div class="settings-row">
            <div class="s-label">
              <span class="s-ico">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
              </span>
              <div><div class="s-title">Theme</div><div class="s-sub">Light, dark or follow device</div></div>
            </div>
          </div>
          <div class="settings-hint">
            <div class="segment-pills" id="s-theme">
              <button type="button" class="${prefs.theme === "light" ? "active" : ""}" data-theme-opt="light">Light</button>
              <button type="button" class="${prefs.theme === "dark" ? "active" : ""}" data-theme-opt="dark">Dark</button>
              <button type="button" class="${prefs.theme === "system" ? "active" : ""}" data-theme-opt="system">System</button>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">Money</div>
        <div class="settings-card">
          ${settingsItem(
            "Currency",
            "Indian Rupee (₹)",
            "₹",
            "s-currency"
          )}
          ${settingsItem(
            "Monthly Budget",
            prefs.budget ? U.fmtMoney(prefs.budget) : "Not set",
            "🎯",
            "s-budget"
          )}
          ${settingsItem(
            "Category Budgets",
            "Set limits per category",
            "📊",
            "s-cat-budget"
          )}
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">Categories</div>
        <div class="settings-card">
          ${settingsItem("Expense Categories", `${state.categories.length} categories`, "🗂️", "s-categories")}
          ${settingsItem("Income Sources", `${state.incomeSources.length} sources`, "💰", "s-sources")}
          ${settingsItem("Payment Methods", `${state.paymentMethods.length} methods`, "💳", "s-payments")}
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">Recurring</div>
        <div class="settings-card">
          ${settingsItem("Recurring Expenses", `${state.recurringExpenses.length} active`, "🔁", "s-recurring")}
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">Privacy & Security</div>
        <div class="settings-card">
          ${settingsItem("App Lock", lockEnabled ? "PIN enabled" : "Off", "🔒", "s-lock")}
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">Data Management</div>
        <div class="settings-card">
          ${settingsItem("Export Backup (JSON)", "Save a backup of all your data", "📤", "s-backup-export", { action: "export-json", btnText: "Export" })}
          ${settingsItem("Import Backup (JSON)", "Restore from a backup file", "📥", "s-backup-import", { action: "import-json", btnText: "Import" })}
          ${settingsItem("Export CSV", "Export transactions for Excel / Sheets", "📄", "s-backup-csv", { action: "export-csv", btnText: "Export" })}
          ${settingsItem("Clear All Data", "Erase everything on this device", "🗑", "s-backup-clear", { action: "clear", btnText: "Clear", danger: true })}
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">About</div>
        <div class="settings-card">
          ${settingsItem("About Expense Tracker", "Version 1.0 · Offline-first PWA", "ℹ️", "s-about")}
        </div>
        <p style="text-align:center;color:var(--text-3);font-size:.8rem;padding:14px 8px">Your financial data is stored locally on this device.<br>No data is ever sent to any server.</p>
      </div>`;

    wireTheme();
    wireSettingsClicks();
  }

  function settingsItem(title, sub, icon, id, opt) {
    const actionHTML = opt ? `
      <button type="button" class="btn ${opt.danger ? "btn-danger" : "btn-primary"}" style="padding:9px 16px;border-radius:11px;font-size:.84rem" data-backup-action="${opt.action}">${opt.btnText}</button>` : "";
    const fileInput = opt && opt.action === "import-json"
      ? `<input type="file" accept="application/json,.json" data-backup-import style="display:none" aria-hidden="true" />`
      : "";
    return `
      <div class="settings-row ${opt ? "btn-row" : ""}" id="${id}" ${opt ? `data-backup-action="${opt.action}"` : ""}>
        <div class="s-label" ${opt ? `style="pointer-events:none"` : ""}>
          <span class="s-ico ${opt && opt.danger ? "warn" : opt && opt.action === "export-csv" ? "green" : ""}">${icon}</span>
          <div><div class="s-title">${title}</div><div class="s-sub">${sub}</div></div>
        </div>
        ${actionHTML}
        ${fileInput}
      </div>`;
  }

  /* ---------- wiring ---------- */
  function wireTheme() {
    U.delegate("click", "#s-theme [data-theme-opt]", (e, btn) => {
      const theme = btn.dataset.themeOpt;
      applyThemeSetting(theme);
      U.$$("#s-theme [data-theme-opt]").forEach((x) => x.classList.toggle("active", x === btn));
      ns.applyTheme();
      U.toast("Theme updated");
    });
  }

  function wireSettingsClicks() {
    U.delegate("click", "#s-currency", () => openCurrencyModal());
    U.delegate("click", "#s-budget", () => openBudgetModal());
    U.delegate("click", "#s-cat-budget", () => openCategoryBudgetModal());
    U.delegate("click", "#s-categories", () => openCategoriesModal("expense"));
    U.delegate("click", "#s-sources", () => openCategoriesModal("income"));
    U.delegate("click", "#s-payments", () => openPaymentsModal());
    U.delegate("click", "#s-recurring", () => openRecurringModal());
    U.delegate("click", "#s-lock", () => openLockModal());
    U.delegate("click", "#s-about", () => openAboutModal());
  }

  /* ---------- currency ---------- */
  function openCurrencyModal() {
    const currencies = [
      ["₹", "Indian Rupee (INR)"],
      ["$", "US Dollar (USD)"],
      ["€", "Euro (EUR)"],
      ["£", "British Pound (GBP)"]
    ];
    const body = `
      <div class="picker-grid">
        ${currencies
          .map(
            ([sym, label]) => `
          <button type="button" class="picker-item ${state.prefs.currency === sym ? "active" : ""}" data-currency="${sym}">
            <span class="em" style="font-size:1.5rem">${sym}</span>
            <span>${label}</span>
          </button>`
          )
          .join("")}
      </div>`;
    U.openModal("Currency", body);
    U.delegate("click", "[data-currency]", async (e, btn) => {
      const sym = btn.dataset.currency;
      state.prefs.currency = sym;
      await DB.put(DB.STORES.settings, state.prefs);
      U.$$("[data-currency]").forEach((x) => x.classList.toggle("active", x === btn));
      U.toast("Currency updated");
      U.closeModal();
      render();
      ns.applyTheme();
    });
  }

  /* ---------- monthly budget ---------- */
  function openBudgetModal() {
    const body = `
      <div class="form-group">
        <label class="form-label" for="b-amount">Monthly Budget</label>
        <div class="amount-input-wrap">
          <span class="cur">${U.currencySymbol()}</span>
          <input type="text" id="b-amount" inputmode="decimal" value="${state.prefs.budget || ""}" placeholder="0" />
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-modal-close>Cancel</button>
        <button type="button" class="btn btn-primary" id="b-save">Save</button>
      </div>`;
    U.openModal("Monthly Budget", body);
    document.getElementById("b-save").addEventListener("click", async () => {
      const val = U.parseAmount(document.getElementById("b-amount").value);
      if (isNaN(val) || val < 0) {
        U.error("Please enter a valid budget amount.");
        return;
      }
      state.prefs.budget = val;
      await DB.put(DB.STORES.settings, state.prefs);
      U.closeModal();
      U.toast("Budget saved");
      render();
    });
  }

  /* ---------- category budgets ---------- */
  function openCategoryBudgetModal() {
    const currentMonth = new Date();
    const budgetId = `month-${U.monthKey(currentMonth)}`;
    const monthBudget = state.budgets.find((b) => b.id === budgetId) || { id: budgetId, categories: {} };

    const rows = state.categories
      .map(
        (c) => `
        <div class="settings-row">
          <div class="s-label">
            <span class="s-ico">${c.icon}</span>
            <div class="s-title">${U.escapeHtml(c.name)}</div>
          </div>
          <div class="amount-input-wrap" style="max-width:140px;padding:0 10px">
            <span class="cur" style="font-size:1rem">${U.currencySymbol()}</span>
            <input type="text" class="cat-budget" data-cat="${U.escapeHtml(c.name)}" inputmode="decimal" style="font-size:1rem;padding:8px 0" value="${monthBudget.categories[c.name] || ""}" placeholder="0" />
          </div>
        </div>`
      )
      .join("");

    const body = `
      <p class="settings-hint" style="border-bottom:none;border-radius:12px">Budgets apply to <b>${U.monthLabel(currentMonth.getFullYear(), currentMonth.getMonth())}</b>. Set 0 to remove.</p>
      <div style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <h3 class="card-title">Monthly Budget: <b>${state.prefs.budget ? U.fmtMoney(state.prefs.budget) : "not set"}</b></h3>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
          ${rows}
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-modal-close>Cancel</button>
        <button type="button" class="btn btn-primary" id="cb-save">Save Category Budgets</button>
      </div>`;
    U.openModal("Category Budgets", body);

    document.getElementById("cb-save").addEventListener("click", async () => {
      const cats = {};
      U.$$(".cat-budget").forEach((input) => {
        const name = input.dataset.cat;
        const val = U.parseAmount(input.value);
        cats[name] = isNaN(val) || val <= 0 ? 0 : val;
      });
      monthBudget.categories = cats;
      try {
        await DB.put(DB.STORES.budgets, monthBudget);
        await ns.refreshData();
        U.closeModal();
        U.toast("Category budgets saved");
        render();
      } catch (err) {
        console.error("Save budgets failed:", err);
        U.error("Could not save budgets.");
      }
    });
  }

  /* ---------- categories / sources manager ---------- */
  function openCategoriesModal(type) {
    const list = type === "income" ? state.incomeSources : state.categories;
    const title = type === "income" ? "Income Sources" : "Expense Categories";
    const baseId = type === "income" ? "src" : "cat";

    const body = `
      <div style="display:flex;gap:10px;margin-bottom:16px">
        <input type="text" id="new-name" class="form-input" placeholder="Category name" />
        <input type="text" id="new-icon" class="form-input" placeholder="Emoji" maxlength="4" style="max-width:80px" />
        <button type="button" class="btn btn-primary" id="new-add" style="padding:0 18px">Add</button>
      </div>
      <div id="cat-list">
        ${list
          .map(
            (c) => `
          <div class="cat-manager-item">
            <span class="em">${c.icon}</span>
            <span class="nm">${U.escapeHtml(c.name)}</span>
            <button type="button" class="mini-btn" data-del-cat="${c.id}" aria-label="Delete ${U.escapeHtml(c.name)}">
              <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
            </button>
          </div>`
          )
          .join("")}
      </div>`;

    U.openModal(title, body);

    const addCategory = async () => {
      const name = document.getElementById("new-name").value.trim();
      const icon = document.getElementById("new-icon").value.trim() || "📦";
      if (!name) {
        U.error("Please enter a name.");
        return;
      }
      if (list.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
        U.error("That name already exists.");
        return;
      }
      const record = { id: `${baseId}-${U.uid()}`, name, icon };
      try {
        await DB.put(type === "income" ? DB.STORES.incomeSources : DB.STORES.categories, record);
        await ns.refreshData();
        U.closeModal();
        U.toast(`${title} updated`);
        render();
      } catch (err) {
        console.error("Add category failed:", err);
        U.error("Could not add category.");
      }
    };

    document.getElementById("new-add").addEventListener("click", addCategory);
    document.getElementById("new-name").addEventListener("keydown", (e) => {
      if (e.key === "Enter") addCategory();
    });

    U.$$("[data-del-cat]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const id = btn.dataset.delCat;
        const item = list.find((c) => c.id === id);
        if (!item) return;
        const ok = await U.confirm({
          title: `Delete "${item.name}"?`,
          message: `Existing transactions will keep this label, but it will no longer appear as an option.`,
          confirmText: "Delete"
        });
        if (!ok) return;
        try {
          await DB.delete(type === "income" ? DB.STORES.incomeSources : DB.STORES.categories, id);
          await ns.refreshData();
          U.closeModal();
          U.toast("Category removed");
          render();
        } catch (err) {
          console.error("Delete category failed:", err);
          U.error("Could not delete category.");
        }
      })
    );
  }

  /* ---------- payment methods ---------- */
  function openPaymentsModal() {
    const body = `
      <div style="display:flex;gap:10px;margin-bottom:16px">
        <input type="text" id="new-pay" class="form-input" placeholder="Payment method" />
        <button type="button" class="btn btn-primary" id="new-pay-add" style="padding:0 18px">Add</button>
      </div>
      <div>
        ${state.paymentMethods
          .map(
            (p) => `
          <div class="cat-manager-item">
            <span class="em">${p.icon}</span>
            <span class="nm">${U.escapeHtml(p.name)}</span>
            <button type="button" class="mini-btn" data-del-pay="${p.name}" aria-label="Delete ${U.escapeHtml(p.name)}">
              <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
            </button>
          </div>`
          )
          .join("")}
      </div>`;

    U.openModal("Payment Methods", body);

    const addPay = async () => {
      const name = document.getElementById("new-pay").value.trim();
      if (!name) {
        U.error("Please enter a name.");
        return;
      }
      if (state.paymentMethods.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        U.error("That method already exists.");
        return;
      }
      state.paymentMethods.push({ id: `pm-${U.uid()}`, name, icon: "💳" });
      try {
        await DB.put(DB.STORES.settings, { id: "paymentMethods", value: state.paymentMethods });
        U.closeModal();
        U.toast("Payment method added");
        render();
      } catch (err) {
        console.error("Add payment method failed:", err);
        U.error("Could not add payment method.");
      }
    };

    document.getElementById("new-pay-add").addEventListener("click", addPay);
    document.getElementById("new-pay").addEventListener("keydown", (e) => {
      if (e.key === "Enter") addPay();
    });

    U.$$("[data-del-pay]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const name = btn.dataset.delPay;
        const ok = await U.confirm({
          title: `Delete "${name}"?`,
          message: `Existing transactions will keep this label.`,
          confirmText: "Delete"
        });
        if (!ok) return;
        state.paymentMethods = state.paymentMethods.filter((p) => p.name !== name);
        try {
          await DB.put(DB.STORES.settings, { id: "paymentMethods", value: state.paymentMethods });
          U.closeModal();
          U.toast("Payment method removed");
          render();
        } catch (err) {
          console.error("Delete payment method failed:", err);
          U.error("Could not delete payment method.");
        }
      })
    );
  }

  /* ---------- recurring expenses ---------- */
  function openRecurringModal() {
    const freqSel = `
      <select id="r-freq" class="form-select">
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
        <option value="yearly">Yearly</option>
      </select>`;

    const listHTML = state.recurringExpenses.length
      ? state.recurringExpenses
          .map(
            (r) => `
        <div class="cat-manager-item">
          <span class="em">${ns.getCategoryIcon(r.category, "expense")}</span>
          <span class="nm">
            <span style="font-weight:600">${U.escapeHtml(r.name)}</span>
            <span style="display:block;color:var(--text-3);font-size:.76rem">${U.fmtMoney(r.amount)} · ${r.frequency} · next: ${r.nextRun || "—"}</span>
          </span>
          <button type="button" class="mini-btn" data-del-recurring="${r.id}" aria-label="Delete recurring">
            <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
          </button>
        </div>`
          )
          .join("")
      : `<div class="empty-state" style="padding:24px"><p>No recurring expenses yet.</p></div>`;

    const body = `
      ${listHTML}
      <div style="border-top:1px solid var(--border);margin-top:14px;padding-top:14px">
        <div class="form-group">
          <label class="form-label" for="r-name">Name</label>
          <input type="text" id="r-name" class="form-input" placeholder="e.g. Netflix" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="r-amount">Amount</label>
            <input type="text" id="r-amount" class="form-input" inputmode="decimal" />
          </div>
          <div class="form-group">
            <label class="form-label" for="r-freq">Frequency</label>
            ${freqSel}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="r-cat">Category</label>
          <select id="r-cat" class="form-select">
            ${state.categories.map((c) => `<option value="${U.escapeHtml(c.name)}">${c.icon} ${U.escapeHtml(c.name)}</option>`).join("")}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="r-start">Start date</label>
            <input type="date" id="r-start" class="form-input" value="${U.todayStr()}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="r-end">End date (optional)</label>
            <input type="date" id="r-end" class="form-input" />
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-modal-close>Close</button>
          <button type="button" class="btn btn-primary" id="r-add">Add Recurring Expense</button>
        </div>
      </div>`;

    U.openModal("Recurring Expenses", body);

    const addRecurring = async () => {
      const name = document.getElementById("r-name").value.trim();
      const amount = U.parseAmount(document.getElementById("r-amount").value);
      const frequency = document.getElementById("r-freq").value;
      const category = document.getElementById("r-cat").value;
      const startDate = document.getElementById("r-start").value;
      const endDate = document.getElementById("r-end").value;

      if (!name) { U.error("Please enter a name."); return; }
      if (!(amount > 0)) { U.error("Please enter a valid amount."); return; }
      if (!startDate) { U.error("Please pick a start date."); return; }

      const rec = {
        id: `rec-${U.uid()}`,
        name,
        amount,
        frequency,
        category,
        startDate,
        endDate: endDate || null,
        nextRun: startDate,
        time: "00:00",
        createdAt: new Date().toISOString()
      };
      try {
        await DB.put(DB.STORES.recurringExpenses, rec);
        await ns.refreshData();
        await ns.recurring.processDue();
        U.closeModal();
        U.toast("Recurring expense added");
        render();
      } catch (err) {
        console.error("Add recurring failed:", err);
        U.error("Could not add recurring expense.");
      }
    };

    document.getElementById("r-add").addEventListener("click", addRecurring);
    document.getElementById("r-name").addEventListener("keydown", (e) => {
      if (e.key === "Enter") addRecurring();
    });

    U.$$("[data-del-recurring]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const id = btn.dataset.delRecurring;
        const rec = state.recurringExpenses.find((r) => r.id === id);
        if (!rec) return;
        const ok = await U.confirm({
          title: "Remove recurring expense?",
          message: `"${U.escapeHtml(rec.name)}" will no longer create new transactions. Past transactions are kept.`,
          confirmText: "Remove"
        });
        if (!ok) return;
        try {
          await DB.delete(DB.STORES.recurringExpenses, id);
          await ns.refreshData();
          U.closeModal();
          U.toast("Recurring expense removed");
          render();
        } catch (err) {
          console.error("Delete recurring failed:", err);
          U.error("Could not remove recurring expense.");
        }
      })
    );
  }

  /* ---------- app lock ---------- */
  function openLockModal() {
    const lock = ns.lock;
    const options = lock && lock.enabled
      ? `
        <button type="button" class="btn btn-ghost btn-block" id="l-change">Change PIN</button>
        <button type="button" class="btn btn-danger btn-block" id="l-disable">Disable App Lock</button>`
      : `
        <button type="button" class="btn btn-primary btn-block" id="l-enable">Enable App Lock</button>`;

    const body = `
      <div class="confirm-box">
        <div class="confirm-ico ${lock && lock.enabled ? "info" : ""}">${lock && lock.enabled ? "🔒" : "🔓"}</div>
        <h3 class="confirm-title">${lock && lock.enabled ? "App Lock is ON" : "Protect your data"}</h3>
        <p class="confirm-msg">Set a 4-digit PIN to unlock the app when it opens. The PIN is stored only as a hash on this device.</p>
        ${options}
        <div id="lock-modal-area" style="margin-top:12px"></div>
      </div>`;

    U.openModal("App Lock", body);

    const showSetup = async (mode, title) => {
      // mode: "enable" | "change" | "disable"
      const verifyCurrent = mode !== "enable";
      const area = document.getElementById("lock-modal-area");
      area.innerHTML = `
        ${verifyCurrent ? `
          <div class="form-group">
            <label class="form-label" for="l-old">Current PIN</label>
            <input type="password" id="l-old" class="form-input" inputmode="numeric" maxlength="4" autocomplete="off" />
          </div>` : ""}
        ${mode !== "disable" ? `
        <div class="form-group">
          <label class="form-label" for="l-new">New PIN</label>
          <input type="password" id="l-new" class="form-input" inputmode="numeric" maxlength="4" autocomplete="off" />
        </div>
        <div class="form-group">
          <label class="form-label" for="l-confirm">Confirm PIN</label>
          <input type="password" id="l-confirm" class="form-input" inputmode="numeric" maxlength="4" autocomplete="off" />
        </div>` : `<p class="confirm-msg">Enter your current PIN to confirm and disable App Lock.</p>`}
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-modal-close>Cancel</button>
          <button type="button" class="btn ${mode === "disable" ? "btn-danger" : "btn-primary"}" id="l-set">${U.escapeHtml(title)}</button>
        </div>`;

      const finish = async () => {
        if (verifyCurrent) {
          const old = document.getElementById("l-old").value;
          if (!lock.verify(old)) {
            U.error("Current PIN is incorrect.");
            return;
          }
        }
        if (mode === "disable") {
          try {
            await lock.disable();
            U.closeModal();
            U.toast("App lock disabled");
            render();
          } catch (err) {
            console.error("Disable lock failed:", err);
            U.error("Could not disable app lock.");
          }
          return;
        }
        const p1 = document.getElementById("l-new").value;
        const p2 = document.getElementById("l-confirm").value;
        if (!/^\d{4}$/.test(p1)) {
          U.error("PIN must be exactly 4 digits.");
          return;
        }
        if (p1 !== p2) {
          U.error("PINs do not match.");
          return;
        }
        try {
          await lock.setPin(p1);
          U.closeModal();
          U.toast("App lock updated");
          render();
        } catch (err) {
          console.error("Set PIN failed:", err);
          U.error("Could not set PIN.");
        }
      };
      document.getElementById("l-set").addEventListener("click", finish);
      const newInput = document.getElementById("l-new");
      if (newInput) {
        newInput.addEventListener("keydown", (e) => { if (e.key === "Enter") finish(); });
      } else {
        const oldInput = document.getElementById("l-old");
        if (oldInput) oldInput.addEventListener("keydown", (e) => { if (e.key === "Enter") finish(); });
      }
    };

    const enable = document.getElementById("l-enable");
    if (enable) enable.addEventListener("click", () => showSetup("enable", "Enable Lock"));
    const change = document.getElementById("l-change");
    if (change) change.addEventListener("click", () => showSetup("change", "Change PIN"));

    const disable = document.getElementById("l-disable");
    if (disable) disable.addEventListener("click", () => showSetup("disable", "Disable Lock"));
  }

  /* ---------- about ---------- */
  function openAboutModal() {
    const body = `
      <div class="confirm-box">
        <div class="brand-logo" style="width:80px;height:80px;font-size:2.4rem;margin:0 auto 16px;border-radius:22px">₹</div>
        <h3 class="confirm-title">Expense Tracker</h3>
        <p class="confirm-msg">A private personal expense tracker that works offline and installs as an app on your phone.</p>
        <div class="detail-grid">
          <div class="detail-cell"><div class="dl">Version</div><div class="dv">1.0.0</div></div>
          <div class="detail-cell"><div class="dl">Storage</div><div class="dv">On-device</div></div>
          <div class="detail-cell full"><div class="dl">Tech</div><div class="dv">HTML · CSS · Vanilla JS · IndexedDB · PWA</div></div>
        </div>
        <p style="margin-top:16px;font-size:.85rem;color:var(--text-3)">
          🔒 Your financial data is stored locally on this device.<br>No accounts, no tracking, no ads. Built for one person — you.
        </p>
      </div>`;
    U.openModal("About", body);
  }

  ns.viewRenderers = ns.viewRenderers || {};
  ns.viewRenderers.settings = render;
  ns.afterThemeChange = () => {
    // charts re-render happens through view re-render in applyTheme (navigate)
  };
})(window.App);