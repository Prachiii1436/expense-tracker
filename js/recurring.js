"use strict";

/**
 * Expense Tracker — recurring expense processor.
 * Generates transactions from recurring definitions without duplicating
 * them on each app open (tracks a `nextRun` date per recurring expense).
 */
window.App = window.App || {};

(function (ns) {
  const U = ns.utils;
  const DB = ns.db;
  const state = ns.state;

  const FREQ_DAYS = { daily: 1, weekly: 7, monthly: null, yearly: null };

  function nextOccurrence(fromISO, frequency) {
    const d = U.strToDate(fromISO);
    const days = FREQ_DAYS[frequency];
    if (days) {
      return U.dateToStr(U.addDays(d, days));
    }
    if (frequency === "monthly") {
      const next = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate());
      return U.dateToStr(next);
    }
    if (frequency === "yearly") {
      const next = new Date(d.getFullYear() + 1, d.getMonth(), d.getDate());
      return U.dateToStr(next);
    }
    return null;
  }

  /**
   * Process all recurring expenses. For each one, while nextRun <= today
   * and within endDate, create a transaction, then advance nextRun.
   */
  ns.recurring = {
    processDue: async function () {
      const today = U.todayStr();
      const toSave = [];
      const toCreate = [];
      const existingKeys = new Set();

      // build set of already-created recurring tx keys to avoid duplicates
      for (const t of state.transactions) {
        if (t.recurringId) existingKeys.add(`${t.recurringId}:${t.date}`);
      }

      for (const rec of state.recurringExpenses) {
        let nextRun = rec.nextRun || rec.startDate;
        let guard = 0;
        const maxIterations = 400; // safety valve

        while (nextRun && nextRun <= today && guard < maxIterations) {
          guard++;

          if (rec.endDate && nextRun > rec.endDate) {
            break;
          }
          if (rec.startDate && nextRun < rec.startDate) {
            nextRun = nextOccurrence(nextRun, rec.frequency);
            continue;
          }

          // generate transaction for this occurrence
          const key = `${rec.id}:${nextRun}`;
          if (!existingKeys.has(key)) {
            existingKeys.add(key);
            toCreate.push({
              id: U.uid(),
              type: "expense",
              amount: rec.amount,
              category: rec.category,
              description: rec.name,
              date: nextRun,
              time: rec.time || "00:00",
              paymentMethod: rec.paymentMethod || "",
              month: nextRun.slice(0, 7),
              recurringId: rec.id,
              createdAt: new Date().toISOString()
            });
          }

          const next = nextOccurrence(nextRun, rec.frequency);
          if (!next || next === nextRun) break;
          nextRun = next;
        }

        // persist advanced nextRun
        const updated = Object.assign({}, rec, { nextRun });
        toSave.push(updated);
        // update in-memory too
        const idx = state.recurringExpenses.indexOf(rec);
        if (idx !== -1) state.recurringExpenses[idx] = updated;
      }

      if (toCreate.length) {
        await DB.bulkPut(DB.STORES.transactions, toCreate);
      }
      if (toSave.length) {
        for (const s of toSave) await DB.put(DB.STORES.recurringExpenses, s);
      }

      if (toCreate.length) {
        await ns.refreshData();
        return toCreate.length;
      }
      return 0;
    }
  };
})(window.App);