"use strict";

/**
 * Expense Tracker — backup & restore.
 * Export all IndexedDB data to JSON, import & validate backups,
 * export transactions to CSV, and clear all data.
 */
window.App = window.App || {};

(function (ns) {
  const U = ns.utils;
  const DB = ns.db;

  /* ---------- JSON backup ---------- */
  async function exportBackup() {
    try {
      const data = {
        app: "expense-tracker",
        version: 1,
        exportedAt: new Date().toISOString(),
        stores: {}
      };
      for (const store of Object.values(DB.STORES)) {
        data.stores[store] = await DB.getAll(store);
      }
      const json = JSON.stringify(data, null, 2);
      const date = U.todayStr();
      U.downloadFile(`expense-tracker-backup-${date}.json`, json, "application/json");
      U.toast("Backup exported");
    } catch (err) {
      console.error("Export failed:", err);
      U.error("Could not export backup.");
    }
  }

  function validateBackup(data) {
    if (!data || typeof data !== "object") return "Not a valid backup file.";
    if (data.app !== "expense-tracker") return "This file is not an Expense Tracker backup.";
    if (!data.stores || typeof data.stores !== "object") return "Backup is missing data stores.";

    const allowed = Object.values(DB.STORES);
    const invalidStores = Object.keys(data.stores).filter((k) => !allowed.includes(k));
    if (invalidStores.length === data.stores.length) return "Unknown store names in backup.";

    // validate transactions entries
    if (Array.isArray(data.stores.transactions)) {
      for (const tx of data.stores.transactions) {
        if (!tx || typeof tx !== "object") return "Invalid transaction record.";
        if (!tx.id || typeof tx.id !== "string") return "Transaction record is missing a valid id.";
        if (!["expense", "income"].includes(tx.type)) return `Transaction has an invalid type: ${tx.type}`;
        if (!(tx.amount > 0) || typeof tx.amount !== "number") return "Transaction must have a positive numeric amount.";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(tx.date || "")) return `Transaction has an invalid date: ${tx.date}`;
      }
    }
    return null;
  }

  async function importBackup(file) {
    let text;
    try {
      text = await file.text();
    } catch (err) {
      U.error("Could not read the selected file.");
      return;
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      U.error("Invalid JSON file.");
      return;
    }

    const errMsg = validateBackup(data);
    if (errMsg) {
      U.error(errMsg);
      return;
    }

    const ok = await U.confirm({
      title: "Import backup?",
      message: `This will <strong>replace current data</strong> with the backup contents. This cannot be undone.`,
      confirmText: "Import",
      danger: true
    });
    if (!ok) return;

    try {
      // clear all, then restore
      for (const store of Object.values(DB.STORES)) {
        await DB.clear(store);
      }
      for (const store of Object.keys(data.stores)) {
        const entries = data.stores[store];
        if (Array.isArray(entries) && entries.length) {
          // sanitize each entry to plain objects
          const clean = entries.map((e) => (e && typeof e === "object" ? { ...e } : null)).filter(Boolean);
          await DB.bulkPut(store, clean);
        }
      }
      await ns.refreshData();
      ns.applyTheme();
      U.toast("Backup imported successfully");
      ns.navigate(ns.currentView);
    } catch (err) {
      console.error("Import failed:", err);
      U.error("Could not import backup. Data may be incomplete.");
    }
  }

  /* ---------- CSV export ---------- */
  async function exportCSV() {
    const txs = await DB.getAll(DB.STORES.transactions);
    if (!txs.length) {
      U.info("No transactions to export yet.");
      return;
    }
    const sort = txs.slice().sort((a, b) => (a.date + (a.time || "")) < (b.date + (b.time || "")) ? -1 : 1);

    const escapeCSV = (v) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const headers = ["ID", "Type", "Amount", "Category", "Description", "Date", "Time", "Bank", "Payment Method", "Created At"];
    const rows = sort.map((t) =>
      [
        t.id,
        t.type === "income" ? "Income" : "Expense",
        (t.type === "income" ? "" : "-") + t.amount,
        t.category,
        t.description || "",
        t.date,
        t.time || "",
        t.bank || "",
        t.paymentMethod || "",
        t.createdAt || ""
      ]
        .map(escapeCSV)
        .join(",")
    );
    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    U.downloadFile(`expense-tracker-transactions-${U.todayStr()}.csv`, csv, "text/csv;charset=utf-8");
    U.toast("CSV exported");
  }

  /* ---------- clear all data ---------- */
  async function clearAllData() {
    const ok = await U.confirm({
      title: "Clear all data?",
      message: `This will <strong>permanently delete all transactions, budgets, categories and settings</strong> on this device. Consider exporting a backup first.`,
      confirmText: "Erase everything",
      danger: true
    });
    if (!ok) return;

    try {
      for (const store of Object.values(DB.STORES)) {
        await DB.clear(store);
      }
      await DB.seedIfNeeded();
      await ns.refreshData();
      U.toast("All data cleared");
      ns.navigate(ns.currentView);
    } catch (err) {
      console.error("Clear failed:", err);
      U.error("Could not clear data.");
    }
  }

  /* ---------- wiring ---------- */
  function wireBackupTriggers() {
    U.delegate("click", "[data-backup-action]", (e, el) => {
      const action = el.dataset.backupAction;
      if (e.target.closest("input[data-backup-import]")) return; // avoid re-trigger on the input itself
      if (action === "export-json") exportBackup();
      else if (action === "export-csv") exportCSV();
      else if (action === "clear") clearAllData();
      else if (action === "import-json") {
        const input = el.querySelector("input[data-backup-import]");
        if (input) input.click();
      }
    });

    U.delegate("change", "input[data-backup-import]", (e, el) => {
      const file = el.files && el.files[0];
      if (file) importBackup(file);
      el.value = "";
    });
  }

  ns.backup = {
    exportJSON: exportBackup,
    importJSON: importBackup,
    exportCSV,
    clearAll: clearAllData
  };

  wireBackupTriggers();
})(window.App);
