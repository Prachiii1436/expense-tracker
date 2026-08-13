"use strict";

/**
 * Expense Tracker — dashboard view.
 * Shows greeting, balance, summary cards, spending overview chart,
 * budget progress, insights and recent transactions.
 */
window.App = window.App || {};

(function (ns) {
  const U = ns.utils;
  const C = ns.charts;
  const state = ns.state;
  const cache = ns.cache;

  let overviewFilter = "Daily"; // Daily | Weekly | Monthly

  /* ---------- aggregate helpers ---------- */
  function totals(txs) {
    let income = 0;
    let expense = 0;
    for (const t of txs) {
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    }
    return { income, expense };
  }

  /* ---------- render ---------- */
  function render() {
    const view = document.getElementById("view-dashboard");
    const now = new Date();
    const thisMonthKey = U.monthKey(now);
    const mtx = state.transactions.filter((t) => ns.monthKeyOf(t) === thisMonthKey || (t.date && String(t.date).slice(0, 7) === thisMonthKey));
    const mTotals = totals(mtx);
    const allTotals = totals(state.transactions);
    const balance = allTotals.income - allTotals.expense;

    const budget = state.prefs.budget || 0;
    const spent = mTotals.expense;
    const budgetPct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
    const budgetClass = budget > 0 && budgetPct >= 100 ? "danger" : budget > 0 && budgetPct >= 80 ? "warn" : "";

    // breakdown by type for month
    const monthIncome = mTotals.income;
    const monthExpense = mTotals.expense;

    // segment by month for spending overview
    const segments = buildOverview();

    view.innerHTML = `
      <div class="hero-text stagger">
        <h2>${U.greeting()} 👋</h2>
        <p>${U.monthLabel(now.getFullYear(), now.getMonth())}</p>
      </div>

      <div class="dashboard-grid">
        <div class="col">
          <div class="balance-card">
            <div class="balance-label">
              <svg viewBox="0 0 24 24"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Total Balance
            </div>
            <div class="balance-amount">${U.fmtMoney(balance)}</div>
            <div class="balance-stats">
              <div class="balance-stat income">
                <div class="lbl">Income · this month</div>
                <div class="val">${U.fmtMoney(monthIncome)}</div>
              </div>
              <div class="balance-stat expense">
                <div class="lbl">Expenses · this month</div>
                <div class="val">${U.fmtMoney(monthExpense)}</div>
              </div>
            </div>
          </div>

          ${
            budget > 0
              ? `<div class="card section-gap">
                  <div class="card-head">
                    <h3 class="card-title">Monthly Budget</h3>
                    <span class="card-link" data-goto="settings">Manage</span>
                  </div>
                  <div class="progress-wrap">
                    <div class="progress-bar">
                      <div class="progress-fill ${budgetClass}" style="width:${budgetPct}%"></div>
                    </div>
                    <span class="progress-pct">${Math.round(budgetPct)}%</span>
                  </div>
                  <div class="progress-caption">
                    <span>${U.fmtMoney(spent)} spent</span>
                    <span>${U.fmtMoney(Math.max(budget - spent, 0))} left</span>
                  </div>
                </div>`
              : ""
          }

          <div class="card section-gap">
            <div class="card-head">
              <h3 class="card-title">Spending Overview</h3>
            </div>
            <div class="segmented" id="ov-filter" role="group" aria-label="Spending timeframe">
              <button type="button" class="${overviewFilter === "Daily" ? "active" : ""}" data-ov="Daily">Daily</button>
              <button type="button" class="${overviewFilter === "Weekly" ? "active" : ""}" data-ov="Weekly">Weekly</button>
              <button type="button" class="${overviewFilter === "Monthly" ? "active" : ""}" data-ov="Monthly">Monthly</button>
            </div>
            <div class="chart-wrap" id="ov-chart" style="margin-top:12px"></div>
            <div id="ov-legend"></div>
          </div>

          ${renderInsights(monthExpense, now)}
        </div>

        <div class="col">
          <div class="card section-gap">
            <div class="card-head">
              <h3 class="card-title">Recent Transactions</h3>
              ${state.transactions.length ? `<button type="button" class="card-link" data-goto="transactions">View All</button>` : ""}
            </div>
            <div id="recent-list">${renderRecent()}</div>
          </div>

          ${renderBudgetCard(now)}
        </div>
      </div>`;

    // wire up seg buttons
    U.$$("#ov-filter button").forEach((b) => {
      b.addEventListener("click", () => {
        overviewFilter = b.dataset.ov;
        U.$$("#ov-filter button").forEach((x) => x.classList.toggle("active", x === b));
        drawOverview();
      });
    });

    drawOverview();
  }

  function renderBudgetCard(now) {
    const cats = state.categories;
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthBudget = state.budgets.find((b) => b.id === `month-${U.monthKey(now)}`) || { id: "none", categories: {} };
    const catBudgets = monthBudget.categories || {};

    let html = "";
    cats.forEach((cat) => {
      const target = catBudgets[cat.name];
      if (!target) return;
      const spentCat = state.transactions
        .filter((t) => t.type === "expense" && t.category === cat.name && t.date >= U.dateToStr(start) && t.date <= U.dateToStr(end))
        .reduce((s, t) => s + t.amount, 0);
      const pct = target > 0 ? Math.min((spentCat / target) * 100, 100) : 0;
      const cls = target > 0 && pct >= 100 ? "danger" : target > 0 && pct >= 80 ? "warn" : "";
      html += `
        <div style="margin:12px 0 4px">
          <div class="progress-caption">
            <span>${cat.icon} ${U.escapeHtml(cat.name)} · ${U.fmtMoney(spentCat)}</span>
            <span>of ${U.fmtMoney(target)}</span>
          </div>
          <div class="progress-bar" style="margin-top:6px">
            <div class="progress-fill ${cls}" style="width:${pct}%"></div>
          </div>
        </div>`;
    });

    if (!html) return "";
    return `<div class="card section-gap"><div class="card-head"><h3 class="card-title">Category Budgets</h3></div><div style="margin-top:6px">${html}</div></div>`;
  }

  function renderRecent() {
    if (!state.transactions.length) {
      return emptyState("No transactions yet", "Start tracking your spending today.");
    }
    const recent = cache.txList.slice(0, 6);
    return `
      <div>
        ${recent.map(txCard).join("")}
      </div>`;
  }

  function txCard(t) {
    const icon = ns.getCategoryIcon(t.category, t.type);
    const amountCol = t.type === "income" ? "income" : "expense";
    const sign = t.type === "income" ? "+" : "-";
    return `
      <div class="tx-item" data-open-tx="${t.id}">
        <div class="tx-icon ${amountCol}">${icon}</div>
        <div class="tx-body">
          <div class="tx-cat">${U.escapeHtml(t.category)}</div>
          ${t.description ? `<div class="tx-desc">${U.escapeHtml(t.description)}</div>` : ""}
          <div class="tx-meta">${U.formatDate(t.date)}${t.time ? " · " + t.time : ""}</div>
        </div>
        <div class="tx-amount ${amountCol}">${sign}${U.fmtMoney(t.amount)}</div>
      </div>`;
  }

  function emptyState(title, sub, actionHTML) {
    return `
      <div class="empty-state">
        <div class="empty-ico">🪙</div>
        <h3>${U.escapeHtml(title)}</h3>
        <p>${U.escapeHtml(sub)}</p>
        ${actionHTML || ""}
      </div>`;
  }

  /* ---------- spending overview chart ---------- */
  function buildOverview() {
    const now = new Date();
    if (overviewFilter === "Daily") {
      const labels = [];
      const values = [];
      for (let i = 6; i >= 0; i--) {
        const d = U.addDays(now, -i);
        const iso = U.dateToStr(d);
        labels.push(U.dayLabel(iso));
        const sum = state.transactions
          .filter((t) => t.type === "expense" && t.date === iso)
          .reduce((s, t) => s + t.amount, 0);
        values.push(Math.round(sum));
      }
      return { labels, values };
    }
    if (overviewFilter === "Weekly") {
      const labels = [];
      const values = [];
      for (let i = 5; i >= 0; i--) {
        const endOfWeek = U.addDays(now, -i * 7);
        const startOfWeek = U.addDays(endOfWeek, -(endOfWeek.getDay() + 1) + 1);
        const startIso = U.dateToStr(startOfWeek);
        const endIso = U.dateToStr(U.addDays(startOfWeek, 6));
        labels.push(startOfWeek.toLocaleDateString("en-IN", { day: "numeric", month: "short" }));
        const sum = state.transactions
          .filter((t) => t.type === "expense" && t.date >= startIso && t.date <= endIso)
          .reduce((s, t) => s + t.amount, 0);
        values.push(Math.round(sum));
      }
      return { labels, values };
    }
    // Monthly — last 6 months
    const labels = [];
    const values = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = U.monthKey(d);
      labels.push(d.toLocaleDateString("en-IN", { month: "short" }));
      const sum = state.transactions
        .filter((t) => t.type === "expense" && t.date && String(t.date).slice(0, 7) === key)
        .reduce((s, t) => s + t.amount, 0);
      values.push(Math.round(sum));
    }
    return { labels, values };
  }

  function drawOverview() {
    const wrap = document.getElementById("ov-chart");
    if (!wrap) return;
    const { labels, values } = buildOverview();
    C.renderBar(wrap, labels, values, {
      height: 200,
      color: (v, i) => (i === values.length - 1 ? C.PALETTE[0] : C.PALETTE[0] + "88"),
      ariaLabel: "Spending overview"
    });
    C.observe(wrap, drawOverview);
  }

  /* ---------- insights (from real data) ---------- */
  function renderInsights(monthExpense, now) {
    const year = now.getFullYear();
    const month = now.getMonth();
    const prev = new Date(year, month - 1, 1);
    const curKey = `${year}-${String(month + 1).padStart(2, "0")}`;
    const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;

    const nowTxs = state.transactions.filter((t) => t.type === "expense" && t.date && String(t.date).slice(0, 7) === curKey);
    const prevTxs = state.transactions.filter((t) => t.type === "expense" && t.date && String(t.date).slice(0, 7) === prevKey);

    const insightRows = [];

    // On track / overspent budget
    const budget = state.prefs.budget || 0;
    if (budget > 0) {
      const pct = budget > 0 ? Math.round((monthExpense / budget) * 100) : 0;
      insightRows.push({
        icon: pct >= 90 ? "⚠️" : "🎯",
        text: pct >= 100
          ? `You have <b>exceeded your monthly budget</b> by ${U.fmtMoney(monthExpense - budget)}.`
          : pct >= 90
          ? `You have spent <b>${pct}% of your budget</b>. Keep an eye out.`
          : `You have spent <b>${pct}% of your monthly budget</b>.`
      });
    }

    // Highest spending category this month
    if (nowTxs.length) {
      const byCat = {};
      nowTxs.forEach((t) => (byCat[t.category] = (byCat[t.category] || 0) + t.amount));
      const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
      const icon = ns.getCategoryIcon(topCat[0], "expense");
      insightRows.push({
        icon,
        text: `Your highest spending category this month is <b>${U.escapeHtml(topCat[0])}</b> (${U.fmtMoney(topCat[1])}).`
      });

      // vs previous month
      const prevTop = prevTxs.reduce((s, t) => s + t.amount, 0);
      const diff = nowTxs.reduce((s, t) => s + t.amount, 0) - prevTop;
      if (prevTop > 0 && Math.abs(diff) >= 1) {
        insightRows.push({
          icon: diff > 0 ? "📈" : "📉",
          text: diff > 0
            ? `You spent <b>${U.fmtMoney(diff)} more</b> than last month.`
            : `You spent <b>${U.fmtMoney(Math.abs(diff))} less</b> than last month.`
        });
      }
    }

    // Average daily spending this month
    const daysElapsed = now.getDate();
    if (monthExpense > 0) {
      const avg = monthExpense / daysElapsed;
      insightRows.push({
        icon: "📅",
        text: `Your average daily spending this month is <b>${U.fmtMoney(avg)}</b>.`
      });
    }

    // Single largest expense
    const expenses = nowTxs.length ? nowTxs.slice().sort((a, b) => b.amount - a.amount) : [];
    if (expenses.length) {
      const biggest = expenses[0];
      insightRows.push({
        icon: "🔝",
        text: `Biggest expense: <b>${U.escapeHtml(biggest.description || biggest.category)}</b> at ${U.fmtMoney(biggest.amount)}.`
      });
    }

    if (!insightRows.length) {
      return `<div class="card section-gap"><div class="card-head"><h3 class="card-title">Insights</h3></div><div class="empty-state" style="padding:24px"><p>Add some transactions to unlock insights.</p></div></div>`;
    }

    return `
      <div class="card section-gap">
        <div class="card-head"><h3 class="card-title">Insights</h3></div>
        <div>
          ${insightRows
            .slice(0, 4)
            .map(
              (r) => `<div class="insight-row"><div class="insight-ico">${r.icon}</div><div class="insight-text">${r.text}</div></div>`
            )
            .join("")}
        </div>
      </div>`;
  }

  ns.viewRenderers = ns.viewRenderers || {};
  ns.viewRenderers.dashboard = render;
})(window.App);