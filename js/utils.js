"use strict";

/**
 * Expense Tracker — shared utilities, formatting, DOM helpers,
 * toast + modal system, and a small SHA-256 for PIN hashing.
 */
window.App = window.App || {};

(function (ns) {
  const U = (ns.utils = {});

  /* ---------- DOM helpers ---------- */
  U.$ = function (sel, root) { return (root || document).querySelector(sel); };
  U.$$ = function (sel, root) { return Array.from((root || document).querySelectorAll(sel)); };
  U.el = function (html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };

  /* ---------- Formatting ---------- */
  U.currencySymbol = function () {
    return (ns.settings && ns.settings.get("currency")) || "₹";
  };

  U.fmtMoney = function (amount) {
    const n = Number(amount) || 0;
    const symbol = U.currencySymbol();
    const str = Math.abs(n).toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: n % 1 === 0 ? 0 : 2
    });
    const sign = n < 0 ? "-" : "";
    return sign + symbol + str;
  };

  U.fmtNumber = function (n) {
    return (Number(n) || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  };

  U.parseAmount = function (str) {
    if (typeof str === "number") return str;
    const cleaned = String(str || "").replace(/[^0-9.,]/g, "");
    const compact = cleaned.replace(/,/g, "");
    const n = parseFloat(compact);
    return isNaN(n) ? NaN : n;
  };

  /* ---------- Dates ---------- */
  U.todayStr = function () {
    return U.dateToStr(new Date());
  };
  U.dateToStr = function (d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  U.strToDate = function (s) {
    const parts = String(s || "").split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2] || 1);
  };
  U.nowTime = function () {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  U.formatDate = function (iso) {
    if (!iso) return "";
    const d = U.strToDate(iso);
    const today = U.strToDate(U.todayStr());
    const diff = Math.round((today - d) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
  };
  U.monthKey = function (d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  U.monthLabel = function (year, monthIndex) {
    return new Date(year, monthIndex, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  };
  U.dayLabel = function (iso) {
    return U.strToDate(iso).toLocaleDateString("en-IN", { weekday: "short" });
  };
  U.greeting = function () {
    const h = new Date().getHours();
    if (h < 5) return "Good Night";
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    if (h < 21) return "Good Evening";
    return "Good Night";
  };
  U.addDays = function (d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  };

  /* ---------- Misc ---------- */
  U.uid = function () {
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  };
  U.escapeHtml = function (str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };
  U.debounce = function (fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  };
  U.downloadFile = function (filename, content, mime) {
    const blob = new Blob([content], { type: mime || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /* ---------- Toast notifications ---------- */
  U.toast = function (message, type) {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = U.el(`
      <div class="toast toast-${type || "success"}">
        <span class="toast-icon">${type === "error" ? "!" : type === "info" ? "i" : "✓"}</span>
        <span class="toast-text">${U.escapeHtml(message)}</span>
      </div>`);
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 350);
    }, 2800);
  };
  U.error = (m) => U.toast(m, "error");
  U.info = (m) => U.toast(m, "info");

  /* ---------- Modal system ---------- */
  U.closeModal = function () {
    const root = document.getElementById("modal-root");
    if (root) root.innerHTML = "";
    document.body.style.overflow = "";
  };

  U.openModal = function (title, bodyHTML, opts) {
    opts = opts || {};
    const root = document.getElementById("modal-root");
    const closeBtn = opts.hideClose ? "" : `
      <button type="button" class="icon-btn modal-close" data-modal-close aria-label="Close">
        <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>`;
    root.innerHTML = `
      <div class="modal-backdrop" data-modal-close>
        <div class="modal" role="dialog" aria-modal="true" aria-label="${U.escapeHtml(title)}" data-modal-stop>
          <div class="modal-head">
            <h2 class="modal-title">${U.escapeHtml(title)}</h2>
            ${closeBtn}
          </div>
          ${bodyHTML}
        </div>
      </div>`;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      const first = root.querySelector("input, select, textarea, button:not([data-modal-close])");
      if (first) first.focus();
    });
  };

  /* Confirmation dialog (returns Promise<boolean>) */
  U.confirm = function (opts) {
    return new Promise((resolve) => {
      const {
        title = "Are you sure?",
        message = "",
        confirmText = "Delete",
        danger = true,
        icon = "danger"
      } = opts || {};
      const body = `
        <div class="confirm-box">
          <div class="confirm-ico ${danger ? "danger" : "info"}">${danger ? "🗑" : "?"}</div>
          <h3 class="confirm-title">${U.escapeHtml(title)}</h3>
          <p class="confirm-msg">${message}</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-confirm="no">Cancel</button>
            <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-confirm="yes">${U.escapeHtml(confirmText)}</button>
          </div>
        </div>`;
      U.openModal(title, body, { hideClose: true });
      const root = document.getElementById("modal-root");
      root.querySelectorAll("[data-confirm]").forEach((btn) =>
        btn.addEventListener("click", () => {
          const val = btn.getAttribute("data-confirm") === "yes";
          U.closeModal();
          resolve(val);
        })
      );
      root.querySelector("[data-modal-close]").addEventListener("click", () => { U.closeModal(); resolve(false); });
    });
  };

  U.setupModalClose = function () {
    document.addEventListener("click", (e) => {
      const modal = e.target.closest(".modal");
      if (!modal) {
        // click outside the modal (backdrop)
        if (e.target.closest(".modal-backdrop")) U.closeModal();
        return;
      }
      // inside the modal: only close buttons close it
      if (e.target.closest(".modal-close, [data-modal-close]:not(.modal-backdrop)")) U.closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") U.closeModal();
    });
  };

  /* ---------- SHA-256 (pure JS, for PIN hashing) ---------- */
  U.sha256 = function (ascii) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    let result = "";
    const words = [];
    const asciiBitLength = ascii.length * 8;
    let hash = U.sha256.h || (U.sha256.h = []);
    const k = U.sha256.k || (U.sha256.k = []);
    let primeCounter = k.length;
    const isComposite = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += "\x80";
    while ((ascii.length % 64) - 56) ascii += "\x00";
    for (let i = 0; i < ascii.length; i++) {
      const j = ascii.charCodeAt(i);
      if (j >> 8) return "";
      words[i >> 2] |= j << (((3 - i) % 4) * 8);
    }
    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength;

    for (let j = 0; j < words.length; ) {
      const w = words.slice(j, (j += 16));
      const oldHash = hash;
      hash = hash.slice(0, 8);
      for (let i = 0; i < 64; i++) {
        const w15 = w[i - 15];
        const w2 = w[i - 2];
        const a = hash[0];
        const e = hash[4];
        const temp1 =
          hash[7] +
          (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
          ((e & hash[5]) ^ (~e & hash[6])) +
          k[i] +
          (w[i] =
            i < 16
              ? w[i]
              : (w[i - 16] +
                  (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                  w[i - 7] +
                  (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
                0);
        const temp2 =
          (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
          ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (let i = 0; i < 8; i++) {
      for (let j = 3; j + 1; j--) {
        const b = (hash[i] >> (j * 8)) & 255;
        result += (b < 16 ? "0" : "") + b.toString(16);
      }
    }
    return result;
  };

  U.hashPin = function (pin, salt) {
    return U.sha256(salt + ":" + pin);
  };

  U.randomSalt = function () {
    const bytes = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  };

  /* ---------- Global click delegation for common actions ---------- */
  U.delegate = function (eventName, selector, handler) {
    document.addEventListener(eventName, (e) => {
      const el = e.target.closest(selector);
      if (el && el.isConnected) handler(e, el);
    });
  };

  /* ---------- shared state (defined here so every module can capture it) ---------- */
  ns.state = {
    transactions: [],
    categories: [],
    incomeSources: [],
    budgets: [],
    recurringExpenses: [],
    paymentMethods: [],
    prefs: { theme: "system", currency: "₹", budget: 0 },
    loading: true
  };
  ns.cache = { txList: [], byId: {}, brokenRecordSeen: false };
  ns.currentView = "dashboard";
  ns.viewRenderers = {};

  ns.monthKeyOf = function (tx) {
    return tx.month || (tx.date ? String(tx.date).slice(0, 7) : "");
  };
})(window.App);