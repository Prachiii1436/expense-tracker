"use strict";

/**
 * Expense Tracker — analytics view.
 * Monthly overview, category spending doughnut, and spending trend
 * with day/week/month/custom range selectors.
 */
window.App = window.App || {};

(function (ns) {
  const U = ns.utils;
  const C = ns.charts;
  const state = ns.state;
  const cache = ns.cache;

  const viewState = {
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
    range: "30d", // 7d | 30d | thisMonth | prevMonth | custom
    from: "",
    to: ""
  };

  function monthRange(year, month) {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    return { startIso: U.dateToStr(start), endIso: U.dateToStr(end) };
  }

  /* ---------- render ---------- */
  function render() {
    const view = document.getElementById("view-analytics");
    const { startIso, endIso } = monthRange(viewState.year, viewState.month);
    const monthTxs = state.transactions.filter((t) => t.date >= startIso && t.date <= endIso);
    const mTotals = { income: 0, expense: 0 };
    monthTxs.forEach((t) => (t.type === "income" ? (mTotals.income += t.amount) : (mTotals.expense += t.amount)));
    const net = mTotals.income - mTotals.expense;

    const noData = monthTxs.length === 0;

    view.innerHTML = `
      <div class="month-nav">
        <button type="button" class="month-nav-btn" id="mn-prev" aria-label="Previous month">
          <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span class="month">${U.monthLabel(viewState.year, viewState.month)}</span>
        <button type="button" class="month-nav-btn" id="mn-next" aria-label="Next month">
          <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
        </button>
      </div>

      <div class="stat-grid" style="margin-bottom:16px">
        <div class="card"><div class="balance-stat income" style="padding:0">
          <div class="lbl">Income</div><div class="val" style="font-size:1.25rem">${U.fmtMoney(mTotals.income)}</div>
        </div></div>
        <div class="card"><div class="balance-stat expense" style="padding:0">
          <div class="lbl">Expenses</div><div class="val" style="font-size:1.25rem">${U.fmtMoney(mTotals.expense)}</div>
        </div></div>
        <div class="card"><div class="balance-stat" style="padding:0">
          <div class="lbl">Net</div><div class="val" style="font-size:1.25rem;color:${net >= 0 ? "var(--green)" : "var(--red)"}">${net >= 0 ? "+" : ""}${U.fmtMoney(net)}</div>
        </div></div>
      </div>

      <div class="card section-gap">
        <div class="card-head"><h3 class="card-title">Category Spending</h3></div>
        ${noData
          ? `<div class="empty-state" style="padding:20px"><p>No data for this month yet.</p></div>`
          : `<div class="chart-wrap" id="ac-cat" style="margin:0 auto;max-width:320px"></div>`}
      </div>

      <div class="card section-gap">
        <div class="card-head"><h3 class="card-title">Spending Trend</h3></div>
        <div class="range-row" id="ac-ranges">
          <button type="button" class="chip ${viewState.range === "7d" ? "active" : ""}" data-range="7d">7 Days</button>
          <button type="button" class="chip ${viewState.range === "30d" ? "active" : ""}" data-range="30d">30 Days</button>
          <button type="button" class="chip ${viewState.range === "thisMonth" ? "active" : ""}" data-range="thisMonth">This Month</button>
          <button type="button" class="chip ${viewState.range === "prevMonth" ? "active" : ""}" data-range="prevMonth">Prev Month</button>
          <button type="button" class="chip ${viewState.range === "custom" ? "active" : ""}" data-range="custom">Custom</button>
        </div>
        <div class="range-inputs ${viewState.range === "custom" ? "show" : ""}" id="ac-custom-range">
          <div><label class="form-label" for="ac-from">From</label><input type="date" id="ac-from" class="form-input" value="${viewState.from}" /></div>
          <div><label class="form-label" for="ac-to">To</label><input type="date" id="ac-to" class="form-input" value="${viewState.to}" /></div>
        </div>
        <div class="chart-wrap" id="ac-trend" style="margin-top:12px"></div>
      </div>`;

    wireMonthNav();
    wireRanges();

    if (!noData) drawCategoryChart();
    drawTrendChart();
  }

  function wireMonthNav() {
    const prev = document.getElementById("mn-prev");
    const next = document.getElementById("mn-next");
    if (!prev) return;
    prev.addEventListener("click", () => {
      const d = new Date(viewState.year, viewState.month - 1, 1);
      viewState.year = d.getFullYear();
      viewState.month = d.getMonth();
      render();
    });
    next.addEventListener("click", () => {
      const d = new Date(viewState.year, viewState.month + 1, 1);
      if (d > new Date()) return; // don't go past current month
      viewState.year = d.getFullYear();
      viewState.month = d.getMonth();
      render();
    });
  }

  function wireRanges() {
    U.$$("#ac-ranges .chip").forEach((c) => {
      c.addEventListener("click", () => {
        viewState.range = c.dataset.range;
        U.$$("#ac-ranges .chip").forEach((x) => x.classList.toggle("active", x === c));
        const customInputs = document.getElementById("ac-custom-range");
        if (customInputs) customInputs.classList.toggle("show", viewState.range === "custom");
        if (viewState.range !== "custom") drawTrendChart();
      });
    });

    const from = document.getElementById("ac-from");
    const to = document.getElementById("ac-to");
    if (from && to) {
      from.addEventListener("change", () => {
        viewState.from = from.value;
        if (viewState.range === "custom") drawTrendChart();
      });
      to.addEventListener("change", () => {
        viewState.to = to.value;
        if (viewState.range === "custom") drawTrendChart();
      });
    }
  }

  /* ---------- charts ---------- */
  function drawCategoryChart() {
    const wrap = document.getElementById("ac-cat");
    if (!wrap) return;
    const { startIso, endIso } = monthRange(viewState.year, viewState.month);
    const byCat = {};
    state.transactions.forEach((t) => {
      if (t.type !== "expense" || t.date < startIso || t.date > endIso) return;
      byCat[t.category] = (byCat[t.category] || 0) + t.amount;
    });
    const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const items = sorted.map(([name, value], i) => ({ label: name, value, color: C.PALETTE[i % C.PALETTE.length] }));
    if (!items.length) {
      wrap.innerHTML = "";
      return;
    }
    C.renderDoughnut(wrap, items, { centerLabel: "Spent" });
    C.observe(wrap, drawCategoryChart);
  }

  function drawTrendChart() {
    const wrap = document.getElementById("ac-trend");
    if (!wrap) return;
    const today = new Date();
    const { labels, expenses, incomes } = buildTrend(today);
    if (!labels.length) {
      wrap.innerHTML = `<div class="empty-state" style="padding:24px"><p>No spending in this range.</p></div>`;
      return;
    }
    const series = [
      { name: "Expenses", values: expenses },
      { name: "Income", values: incomes }
    ];
    C.renderLine(wrap, series, labels, {
      height: 230,
      colors: [C.PALETTE[0], C.PALETTE[4]],
      area: true,
      ariaLabel: "Spending trend"
    });
    C.observe(wrap, drawTrendChart);
  }

  function buildTrend(today) {
    const labels = [];
    const expenses = [];
    const incomes = [];
    let fromIso, toIso;

    switch (viewState.range) {
      case "7d": {
        for (let i = 6; i >= 0; i--) {
          const d = U.addDays(today, -i);
          const iso = U.dateToStr(d);
          labels.push(U.dayLabel(iso));
          const dayTx = state.transactions.filter((t) => t.date === iso);
          expenses.push(Math.round(dayTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)));
          incomes.push(Math.round(dayTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)));
        }
        break;
      }
      case "30d": {
        for (let i = 29; i >= 0; i--) {
          const d = U.addDays(today, -i);
          const iso = U.dateToStr(d);
          labels.push(d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }));
          const dayTx = state.transactions.filter((t) => t.date === iso);
          expenses.push(Math.round(dayTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)));
          incomes.push(Math.round(dayTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)));
        }
        break;
      }
      case "thisMonth": {
        const { startIso: s, endIso: e } = monthRange(today.getFullYear(), today.getMonth());
        const days = Math.round((U.strToDate(e) - U.strToDate(s)) / 86400000) + 1;
        for (let i = 0; i < days; i++) {
          const d = U.addDays(U.strToDate(s), i);
          const iso = U.dateToStr(d);
          labels.push(iso.slice(8, 10));
          const dayTx = state.transactions.filter((t) => t.date === iso);
          expenses.push(Math.round(dayTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)));
          incomes.push(Math.round(dayTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)));
        }
        break;
      }
      case "prevMonth": {
        const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const { startIso: s, endIso: e } = monthRange(prev.getFullYear(), prev.getMonth());
        const days = Math.round((U.strToDate(e) - U.strToDate(s)) / 86400000) + 1;
        for (let i = 0; i < days; i++) {
          const d = U.addDays(U.strToDate(s), i);
          const iso = U.dateToStr(d);
          labels.push(iso.slice(8, 10));
          const dayTx = state.transactions.filter((t) => t.date === iso);
          expenses.push(Math.round(dayTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)));
          incomes.push(Math.round(dayTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)));
        }
        break;
      }
      case "custom": {
        fromIso = viewState.from;
        toIso = viewState.to;
        if (!fromIso || !toIso) {
          return { labels: [], expenses: [], incomes: [] };
        }
        const start = U.strToDate(fromIso);
        const end = U.strToDate(toIso);
        if (start > end) {
          return { labels: [], expenses: [], incomes: [] };
        }
        const days = Math.round((end - start) / 86400000) + 1;
        const limit = 62;
        if (days <= limit) {
          for (let i = 0; i < days; i++) {
            const d = U.addDays(start, i);
            const iso = U.dateToStr(d);
            labels.push(d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }));
            const dayTx = state.transactions.filter((t) => t.date === iso);
            expenses.push(Math.round(dayTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)));
            incomes.push(Math.round(dayTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)));
          }
        } else {
          // aggregate weekly
          const buckets = [];
          let cursor = start;
          while (cursor <= end) {
            const wEnd = U.addDays(cursor, 6);
            const wEndIso = U.dateToStr(wEnd);
            const wStartIso = U.dateToStr(cursor);
            const weekTx = state.transactions.filter((t) => t.date >= wStartIso && t.date <= wEndIso);
            expenses.push(Math.round(weekTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)));
            incomes.push(Math.round(weekTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)));
            labels.push(cursor.toLocaleDateString("en-IN", { day: "numeric", month: "short" }));
            cursor = U.addDays(wEnd, 1);
            buckets.push(0);
          }
        }
        break;
      }
    }

    return { labels, expenses, incomes };
  }

  ns.viewRenderers = ns.viewRenderers || {};
  ns.viewRenderers.analytics = render;
})(window.App);