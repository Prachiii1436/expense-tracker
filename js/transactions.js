"use strict";

/**
 * Expense Tracker — transactions view.
 * Full history with type tabs, search, filters, sort, and the
 * add/edit transaction modal used by the whole app.
 */
window.App = window.App || {};

(function (ns) {
  const U = ns.utils;
  const DB = ns.db;
  const state = ns.state;
  const cache = ns.cache;

  const filterState = {
    type: "all", // all | expense | income
    search: "",
    from: "",
    to: "",
    category: "",
    payment: "",
    sort: "newest" // newest | oldest | amount-desc | amount-asc
  };

  /* ---------- open add modal (shared w/ app manifest shortcuts) ---------- */
  ns.openAddModal = function (defaultType) {
    openEditor({ type: defaultType === "income" ? "income" : "expense" });
  };

  function openEditor(tx) {
    const isEdit = !!tx;
    const type = tx ? tx.type : "expense";
    const categories = tx && tx.type === "income" ? state.incomeSources : state.categories;
    const payments = state.paymentMethods;

    const pickerHTML = (list, selected) =>
      `<div class="picker-grid">${list
        .map((c, idx) => `
          <button type="button" class="picker-item ${(c.name === selected) || (!selected && idx === 0) ? "active" : ""}" data-pick="${U.escapeHtml(c.name)}">
            <span class="em">${c.icon}</span>
            <span>${U.escapeHtml(c.name)}</span>
          </button>`)
        .join("")}</div>`;

    const body = `
      <div class="segmented" id="editor-type" style="margin-bottom:16px">
        <button type="button" data-editor-type="expense" class="${type === "expense" ? "active" : ""}">Expense</button>
        <button type="button" data-editor-type="income" class="${type === "income" ? "active" : ""}">Income</button>
      </div>

      <div class="form-group">
        <label class="form-label" for="ed-amount">Amount</label>
        <div class="amount-input-wrap">
          <span class="cur">${U.currencySymbol()}</span>
          <input type="text" id="ed-amount" inputmode="decimal" autocomplete="off" placeholder="0" value="${tx ? tx.amount : ""}" />
        </div>
        <div class="error-text" id="ed-amount-error">Enter a valid amount greater than zero.</div>
      </div>

      <div id="editor-category-wrap" class="form-group">
        <label class="form-label" id="ed-cat-label">Category</label>
        ${pickerHTML(categories, tx ? tx.category : "")}
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="ed-date">Date</label>
          <input type="date" id="ed-date" class="form-input" value="${tx ? tx.date : U.todayStr()}" />
        </div>
        <div class="form-group">
          <label class="form-label" for="ed-time">Time</label>
          <input type="time" id="ed-time" class="form-input" value="${tx ? tx.time || "00:00" : U.nowTime()}" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="ed-payment">Payment Method</label>
        <select id="ed-payment" class="form-select">
          ${payments.map((p) => `<option value="${U.escapeHtml(p.name)}" ${tx && tx.paymentMethod === p.name ? "selected" : ""}>${p.icon} ${U.escapeHtml(p.name)}</option>`).join("")}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label" for="ed-desc">${type === "income" ? "Note" : "Description / Note"}</label>
        <input type="text" id="ed-desc" class="form-input" placeholder="Optional" value="${tx ? U.escapeHtml(tx.description || "") : ""}" />
      </div>

      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-modal-close>Cancel</button>
        <button type="button" class="btn btn-primary" id="ed-save">${isEdit ? "Save Changes" : "Add " + (type === "income" ? "Income" : "Expense")}</button>
      </div>`;

    U.openModal(isEdit ? "Edit Transaction" : type === "income" ? "Add Income" : "Add Expense", body);

    const editorType = (t) => {
      U.$$("#editor-type button").forEach((b) => b.classList.toggle("active", b.dataset.editorType === t));
      const catsHTML = t === "income" ? state.incomeSources : state.categories;
      const selected = t === "income"
        ? (state.incomeSources[0] || {}).name
        : (state.categories[0] || {}).name;
      document.getElementById("ed-cat-label").textContent = t === "income" ? "Source" : "Category";
      document.getElementById("editor-category-wrap").lastElementChild.remove();
      const wrap = document.getElementById("editor-category-wrap");
      wrap.insertAdjacentHTML("beforeend", pickerHTML(catsHTML, selected));
      const saveBtn = document.getElementById("ed-save");
      saveBtn.textContent = "Add " + (t === "income" ? "Income" : "Expense");
    };

    document.getElementById("editor-category-wrap").addEventListener("click", (e) => {
      const pick = e.target.closest("[data-pick]");
      if (!pick) return;
      U.$$("#editor-category-wrap .picker-item").forEach((x) => x.classList.remove("active"));
      pick.classList.add("active");
    });

    U.$$("#editor-type button").forEach((b) =>
      b.addEventListener("click", () => editorType(b.dataset.editorType))
    );

    // exp/inc helpers
    let currentType = type;
    document.getElementById("editor-type").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-editor-type]");
      if (btn) currentType = btn.dataset.editorType;
    });

    async function save() {
      const amountRaw = document.getElementById("ed-amount").value;
      const amount = U.parseAmount(amountRaw);

      // validation
      const errEl = document.getElementById("ed-amount-error");
      if (!(amount > 0)) {
        errEl.classList.add("show");
        document.getElementById("ed-amount").focus();
        return;
      }
      errEl.classList.remove("show");

      const pick = document.querySelector("#editor-category-wrap .picker-item.active");
      if (!pick) {
        U.error("Please choose a category.");
        return;
      }
      const category = pick.dataset.pick;
      const date = document.getElementById("ed-date").value;
      const time = document.getElementById("ed-time").value;
      const paymentMethod = document.getElementById("ed-payment").value;
      const description = document.getElementById("ed-desc").value.trim();

      if (!date) {
        U.error("Please pick a valid date.");
        return;
      }
      const d = U.strToDate(date);
      if (isNaN(d)) {
        U.error("Please pick a valid date.");
        return;
      }

      const record = isEdit ? tx : {};
      record.type = currentType;
      record.amount = amount;
      record.category = category;
      record.date = date;
      record.time = time || "";
      record.paymentMethod = paymentMethod;
      record.description = description;
      record.month = String(date).slice(0, 7);
      const nowISO = new Date().toISOString();
      if (!record.id) {
        record.id = U.uid();
        record.createdAt = nowISO;
      }
      record.updatedAt = nowISO;

      try {
        await DB.put(DB.STORES.transactions, record);
        await ns.refreshData();
        U.closeModal();
        U.toast(isEdit ? "Transaction updated" : currentType === "income" ? "Income added" : "Expense added");
        ns.navigate(ns.currentView);
      } catch (err) {
        console.error("Save failed:", err);
        U.error("Could not save. Please try again.");
      }
    }

    document.getElementById("ed-save").addEventListener("click", save);

    // allow enter key in amount → save
    ["ed-amount", "ed-desc"].forEach((id) => {
      document.getElementById(id).addEventListener("keydown", (e) => {
        if (e.key === "Enter") save();
      });
    });
  }

  /* ---------- view detail + edit/delete ---------- */
  async function showDetail(id) {
    const t = cache.byId[id];
    if (!t) return;
    const amountCol = t.type === "income" ? "income" : "expense";
    const sign = t.type === "income" ? "+" : "-";
    const icon = ns.getCategoryIcon(t.category, t.type);
    const catLabel = t.type === "income" ? "Source" : "Category";

    const body = `
      <div class="confirm-box" style="text-align:left">
        <div class="tx-item" style="padding:4px;border-bottom:none">
          <div class="tx-icon ${amountCol}" style="width:52px;height:52px;font-size:1.5rem">${icon}</div>
          <div class="tx-body">
            <div class="tx-cat">${U.escapeHtml(t.category)}</div>
            ${t.description ? `<div class="tx-desc">${U.escapeHtml(t.description)}</div>` : ""}
            <div class="tx-amount ${amountCol}" style="font-size:1.3rem;margin-top:2px">${sign}${U.fmtMoney(t.amount)}</div>
          </div>
        </div>
        <div class="detail-grid" style="margin-top:8px">
          <div class="detail-cell"><div class="dl">Type</div><div class="dv">${t.type === "income" ? "Income" : "Expense"}</div></div>
          <div class="detail-cell"><div class="dl">${catLabel}</div><div class="dv">${icon} ${U.escapeHtml(t.category)}</div></div>
          <div class="detail-cell"><div class="dl">Date</div><div class="dv">${U.formatDate(t.date)}</div></div>
          <div class="detail-cell"><div class="dl">Time</div><div class="dv">${t.time || "—"}</div></div>
          <div class="detail-cell"><div class="dl">Payment</div><div class="dv">${U.escapeHtml(t.paymentMethod || "—")}</div></div>
          <div class="detail-cell"><div class="dl">Amount</div><div class="dv">${sign}${U.fmtMoney(t.amount)}</div></div>
          <div class="detail-cell full"><div class="dl">Note</div><div class="dv">${t.description ? U.escapeHtml(t.description) : "—"}</div></div>
          <div class="detail-cell full"><div class="dl">Added</div><div class="dv" style="font-size:.85rem">${t.createdAt ? new Date(t.createdAt).toLocaleString("en-IN") : "—"}</div></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="tx-edit">✏️ Edit</button>
          <button type="button" class="btn btn-danger" id="tx-delete">🗑 Delete</button>
        </div>
      </div>`;

    U.openModal("Transaction", body);

    document.getElementById("tx-edit").addEventListener("click", () => {
      U.closeModal();
      openEditor(t);
    });
    document.getElementById("tx-delete").addEventListener("click", async () => {
      const ok = await U.confirm({
        title: "Delete transaction?",
        message: `This will permanently remove<br><strong>${U.escapeHtml(t.category)} — ${U.fmtMoney(t.amount)}</strong>.<br>This cannot be undone.`,
        confirmText: "Delete",
        danger: true
      });
      if (!ok) return;
      try {
        await DB.delete(DB.STORES.transactions, t.id);
        await ns.refreshData();
        U.toast("Transaction deleted");
        ns.navigate(ns.currentView);
      } catch (err) {
        console.error("Delete failed:", err);
        U.error("Could not delete transaction.");
      }
    });
  }

  /* ---------- list render ---------- */
  function applyFilters() {
    let list = cache.txList;
    if (filterState.type !== "all") list = list.filter((t) => t.type === filterState.type);
    if (filterState.category) list = list.filter((t) => t.category === filterState.category);
    if (filterState.payment) list = list.filter((t) => t.paymentMethod === filterState.payment);
    if (filterState.from) list = list.filter((t) => t.date >= filterState.from);
    if (filterState.to) list = list.filter((t) => t.date <= filterState.to);
    if (filterState.search) {
      const q = filterState.search.toLowerCase();
      list = list.filter((t) =>
        `${t.description || ""} ${t.category} ${t.paymentMethod || ""} ${t.amount}`.toLowerCase().includes(q)
      );
    }
    if (filterState.sort === "oldest") list = list.slice().reverse();
    else if (filterState.sort === "amount-desc") list = list.slice().sort((a, b) => b.amount - a.amount);
    else if (filterState.sort === "amount-asc") list = list.slice().sort((a, b) => a.amount - b.amount);
    return list;
  }

  function render() {
    const view = document.getElementById("view-transactions");
    const list = applyFilters();
    const hasAny = state.transactions.length > 0;
    const activeFilters = filterState.category || filterState.payment || filterState.from || filterState.to || filterState.search;

    view.innerHTML = `
      <div class="toolbar">
        <div class="segmented" id="tx-tabs" role="group" aria-label="Transaction type">
          <button type="button" class="${filterState.type === "all" ? "active" : ""}" data-tab="all">All</button>
          <button type="button" class="${filterState.type === "expense" ? "active" : ""}" data-tab="expense">Expenses</button>
          <button type="button" class="${filterState.type === "income" ? "active" : ""}" data-tab="income">Income</button>
        </div>
        <div class="toolbar-row">
          <div class="search-box">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
            <input type="search" id="tx-search" placeholder="Search" value="${U.escapeHtml(filterState.search)}" />
          </div>
          <button type="button" class="icon-btn ${activeFilters ? "active" : ""}" id="tx-filters" aria-label="Filters" style="${activeFilters ? "background:var(--primary-soft);color:var(--primary)" : ""}">
            <svg viewBox="0 0 24 24"><path d="M22 3H2l8 9.46V19l4 2v-8.54z"/></svg>
          </button>
        </div>
        ${activeFilters ? renderFilterChips() : ""}
      </div>

      ${
        !hasAny
          ? `<div class="card"><div class="empty-state">${emptyHTML()}</div></div>`
          : !list.length
          ? `<div class="card"><div class="empty-state">${noResultsHTML()}</div></div>`
          : `<div class="card" id="tx-list">${listHTML(list)}</div>`
      }`;
      attachSearch();
  }

  function emptyHTML() {
    return `
      <div class="empty-ico">🪙</div>
      <h3>No transactions yet</h3>
      <p>Start tracking your spending today.</p>
      <button type="button" class="btn btn-primary" id="empty-add">+ Add Transaction</button>`;
  }
  function noResultsHTML() {
    return `
      <div class="empty-ico">🔍</div>
      <h3>No results found</h3>
      <p>Try different search terms or filters.</p>
      <button type="button" class="btn btn-ghost" id="clear-filters">Clear filters</button>`;
  }

  function renderFilterChips() {
    let chips = "";
    if (filterState.category) chips += chipHTML(filterState.category, "cat");
    if (filterState.payment) chips += chipHTML(filterState.payment, "pay");
    if (filterState.from || filterState.to) chips += chipHTML(`${filterState.from || "…"} → ${filterState.to || "…"}`, "date");
    if (filterState.search) chips += chipHTML(`"${filterState.search}"`, "src");
    return `<div class="chip-row">${chips}<button type="button" class="btn-outline" style="font-size:.8rem;padding:8px 14px;border-radius:999px;border:1px solid var(--border);color:var(--text-2)" id="reset-all-filters">Reset</button></div>`;
  }
  function chipHTML(text, key) {
    return `<button type="button" class="chip active" data-filter-chip="${key}">${U.escapeHtml(text)} ✕</button>`;
  }

  function listHTML(list) {
    // group by date
    const groups = {};
    list.forEach((t) => {
      const key = t.date || "unknown";
      (groups[key] = groups[key] || []).push(t);
    });
    const keys = Object.keys(groups).sort().reverse();

    let html = "";
    // desktop header
    html += `<div class="tx-list-head" style="display:${window.innerWidth >= 1024 ? "grid" : "none"}"></div>`;
    keys.forEach((dateKey) => {
      html += `<div class="tx-group-date">${U.formatDate(dateKey)}</div>`;
      const items = groups[dateKey].sort((a, b) => (b.time || "").localeCompare(a.time || ""));
      html += items.map((t) => rowHTML(t, dateKey)).join("");
    });
    return html;
  }

  function rowHTML(t, dateKey) {
    const icon = ns.getCategoryIcon(t.category, t.type);
    const amountCol = t.type === "income" ? "income" : "expense";
    const sign = t.type === "income" ? "+" : "-";
    const isDesktop = window.innerWidth >= 1024;
    const timeHtml = isDesktop ? `<div class="tx-meta d-cell-time">${t.time || "—"}</div>` : "";
    const dateHtml = isDesktop ? `<div class="tx-meta d-cell-date">${U.formatDate(t.date)}</div>` : "";
    const payHtml = isDesktop ? `<div class="tx-meta d-cell-pay">${U.escapeHtml(t.paymentMethod || "—")}</div>` : "";
    return `
      <div class="tx-item" data-open-tx="${t.id}">
        <div class="tx-icon ${amountCol}">${icon}</div>
        <div class="tx-body">
          <div class="tx-cat">${U.escapeHtml(t.category)}</div>
          ${t.description ? `<div class="tx-desc">${U.escapeHtml(t.description)}</div>` : ""}
          <div class="tx-meta">${U.formatDate(t.date)}${t.time ? " · " + t.time : ""}</div>
        </div>
        ${dateHtml}
        ${payHtml}
        <div class="tx-amount ${amountCol}">${sign}${U.fmtMoney(t.amount)}</div>
      </div>`;
  }

  /* ---------- wiring ---------- */
  function attachSearch() {
    const input = document.getElementById("tx-search");
    if (!input) return;
    input.addEventListener("input", U.debounce((e) => {
      const wasFocused = document.activeElement === input;
      filterState.search = e.target.value.trim();
      render();
      if (wasFocused) {
        const newInput = document.getElementById("tx-search");
        if (newInput) {
          newInput.focus();
          newInput.setSelectionRange(newInput.value.length, newInput.value.length);
        }
      }
    }, 180));
  }

  function wireList() {
    U.delegate("click", "[data-open-tx]", (e, el) => {
      showDetail(el.dataset.openTx);
    });

    U.delegate("click", "#tx-tabs button", (e, btn) => {
      filterState.type = btn.dataset.tab;
      render();
    });

    U.delegate("click", "[data-goto]", (e, el) => {
      ns.navigate(el.dataset.goto);
    });

    U.delegate("click", "[data-filter-chip]", (e, el) => {
      const key = el.dataset.filterChip;
      if (key === "cat") filterState.category = "";
      else if (key === "pay") filterState.payment = "";
      else if (key === "date") { filterState.from = ""; filterState.to = ""; }
      else if (key === "src") filterState.search = "";
      render();
    });

    U.delegate("click", "#reset-all-filters, #clear-filters", () => {
      Object.assign(filterState, { search: "", from: "", to: "", category: "", payment: "" });
      render();
    });

    U.delegate("click", "#empty-add", () => ns.openAddModal("expense"));
  }

  wireList();
  attachSearch();

  // search + filter modal
  U.delegate("click", "#tx-filters", () => {
    const catsHTML = state.categories.map((c) => `<option value="${U.escapeHtml(c.name)}">${c.icon} ${U.escapeHtml(c.name)}</option>`).join("");
    const paymentsHTML = (state.paymentMethods || []).map((p) => `<option value="${U.escapeHtml(p.name)}">${p.icon} ${U.escapeHtml(p.name)}</option>`).join("");
    const body = `
      <div class="form-group">
        <label class="form-label">Date range</label>
        <div class="form-row">
          <input type="date" id="f-from" class="form-input" value="${filterState.from}" />
          <input type="date" id="f-to" class="form-input" value="${filterState.to}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Category</label>
        <select id="f-category" class="form-select">
          <option value="">All categories</option>
          ${catsHTML}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Payment method</label>
        <select id="f-payment" class="form-select">
          <option value="">All methods</option>
          ${paymentsHTML}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Sort by</label>
        <select id="f-sort" class="form-select">
          <option value="newest" ${filterState.sort === "newest" ? "selected" : ""}>Newest first</option>
          <option value="oldest" ${filterState.sort === "oldest" ? "selected" : ""}>Oldest first</option>
          <option value="amount-desc" ${filterState.sort === "amount-desc" ? "selected" : ""}>Amount: high → low</option>
          <option value="amount-asc" ${filterState.sort === "amount-asc" ? "selected" : ""}>Amount: low → high</option>
        </select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-modal-close>Cancel</button>
        <button type="button" class="btn btn-primary" id="f-apply">Apply</button>
      </div>`;
    U.openModal("Filters", body);

    document.getElementById("f-category").value = filterState.category;
    document.getElementById("f-payment").value = filterState.payment;

    document.getElementById("f-apply").addEventListener("click", () => {
      filterState.from = document.getElementById("f-from").value;
      filterState.to = document.getElementById("f-to").value;
      filterState.category = document.getElementById("f-category").value;
      filterState.payment = document.getElementById("f-payment").value;
      filterState.sort = document.getElementById("f-sort").value;
      U.closeModal();
      render();
    });
  });

  ns.viewRenderers = ns.viewRenderers || {};
  ns.viewRenderers.transactions = render;
})(window.App);