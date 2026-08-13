"use strict";

/**
 * Expense Tracker — IndexedDB layer.
 * Provides object stores for transactions, categories, incomeSources,
 * budgets, recurringExpenses and settings, wrapped in promises.
 */
window.App = window.App || {};

(function (ns) {
  const DB = (ns.db = {});
  const NAME = "expense-tracker";
  const VERSION = 1;

  const STORES = ns.STORES = DB.STORES = {
    transactions: "transactions",
    categories: "categories",
    incomeSources: "incomeSources",
    budgets: "budgets",
    recurringExpenses: "recurringExpenses",
    settings: "settings"
  };

  let dbInstance = null;
  let openPromise = null;

  DB.open = function () {
    if (openPromise) return openPromise;
    openPromise = new Promise((resolve, reject) => {
      let req;
      try {
        if (!window.indexedDB) throw new Error("IndexedDB not supported");
        req = window.indexedDB.open(NAME, VERSION);
      } catch (err) {
        reject(err);
        return;
      }
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORES.transactions)) {
          const s = db.createObjectStore(STORES.transactions, { keyPath: "id" });
          s.createIndex("byDate", "date");
          s.createIndex("byType", "type");
          s.createIndex("byCategory", "category");
          s.createIndex("byMonth", "month");
        }
        if (!db.objectStoreNames.contains(STORES.categories)) {
          db.createObjectStore(STORES.categories, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORES.incomeSources)) {
          db.createObjectStore(STORES.incomeSources, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORES.budgets)) {
          db.createObjectStore(STORES.budgets, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORES.recurringExpenses)) {
          const s = db.createObjectStore(STORES.recurringExpenses, { keyPath: "id" });
          s.createIndex("byNextRun", "nextRun");
        }
        if (!db.objectStoreNames.contains(STORES.settings)) {
          db.createObjectStore(STORES.settings, { keyPath: "id" });
        }
      };
      req.onsuccess = (e) => {
        dbInstance = e.target.result;
        dbInstance.onerror = (ev) => console.error("IndexedDB error:", ev.target.error);
        resolve(dbInstance);
      };
      req.onerror = (e) => {
        openPromise = null;
        reject(e.target.error);
      };
    });
    return openPromise;
  };

  DB.close = function () {
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
      openPromise = null;
    }
  };

  DB.request = function (storeName, mode) {
    return DB.open().then((db) => {
      const tx = db.transaction(storeName, mode || "readonly");
      return tx.objectStore(storeName);
    });
  };

  DB.getAll = function (storeName) {
    return DB.open().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, "readonly");
          const req = tx.objectStore(storeName).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        })
    );
  };

  DB.get = function (storeName, key) {
    return DB.open().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, "readonly");
          const req = tx.objectStore(storeName).get(key);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        })
    );
  };

  DB.put = function (storeName, value) {
    return DB.open().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, "readwrite");
          const req = tx.objectStore(storeName).put(value);
          req.onsuccess = () => resolve(value);
          req.onerror = () => reject(req.error);
          tx.oncomplete = () => resolve(value);
        })
    );
  };

  DB.bulkPut = function (storeName, values) {
    return DB.open().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, "readwrite");
          const store = tx.objectStore(storeName);
          (values || []).forEach((v) => store.put(v));
          tx.oncomplete = () => resolve(values);
          tx.onerror = () => reject(tx.error);
        })
    );
  };

  DB.delete = function (storeName, key) {
    return DB.open().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, "readwrite");
          const req = tx.objectStore(storeName).delete(key);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
    );
  };

  DB.clear = function (storeName) {
    return DB.open().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, "readwrite");
          const req = tx.objectStore(storeName).clear();
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
    );
  };

  /* ---------- Default seed data ---------- */
  DB.getDefaultCategories = function () {
    return [
      { id: "cat-food", name: "Food", icon: "🍔" },
      { id: "cat-travel", name: "Travel", icon: "🚗" },
      { id: "cat-shopping", name: "Shopping", icon: "🛍️" },
      { id: "cat-bills", name: "Bills", icon: "🧾" },
      { id: "cat-rent", name: "Rent", icon: "🏠" },
      { id: "cat-recharge", name: "Recharge", icon: "📱" },
      { id: "cat-education", name: "Education", icon: "📚" },
      { id: "cat-entertainment", name: "Entertainment", icon: "🎬" },
      { id: "cat-health", name: "Health", icon: "💊" },
      { id: "cat-personal", name: "Personal", icon: "✨" },
      { id: "cat-other", name: "Other", icon: "📦" }
    ];
  };

  DB.getDefaultIncomeSources = function () {
    return [
      { id: "src-salary", name: "Salary", icon: "💼" },
      { id: "src-freelance", name: "Freelance", icon: "💻" },
      { id: "src-pocket", name: "Pocket Money", icon: "💵" },
      { id: "src-gift", name: "Gift", icon: "🎁" },
      { id: "src-business", name: "Business", icon: "🏢" },
      { id: "src-other", name: "Other", icon: "📦" }
    ];
  };

  DB.getDefaultPaymentMethods = function () {
    return [
      { id: "pm-cash", name: "Cash", icon: "💵" },
      { id: "pm-upi", name: "UPI", icon: "📲" },
      { id: "pm-debit", name: "Debit Card", icon: "💳" },
      { id: "pm-credit", name: "Credit Card", icon: "💳" },
      { id: "pm-bank", name: "Bank Transfer", icon: "🏦" },
      { id: "pm-other", name: "Other", icon: "🗃️" }
    ];
  };

  /* ---------- Seeding on first run ---------- */
  DB.seedIfNeeded = async function () {
    const categories = await DB.getAll(STORES.categories);
    if (!categories.length) {
      await DB.bulkPut(STORES.categories, DB.getDefaultCategories());
    }
    const sources = await DB.getAll(STORES.incomeSources);
    if (!sources.length) {
      await DB.bulkPut(STORES.incomeSources, DB.getDefaultIncomeSources());
    }
    const payments = await DB.get(STORES.settings, "paymentMethods");
    if (!payments) {
      await DB.put(STORES.settings, { id: "paymentMethods", value: DB.getDefaultPaymentMethods() });
    }
    const prefs = await DB.get(STORES.settings, "prefs");
    if (!prefs) {
      await DB.put(STORES.settings, {
        id: "prefs",
        theme: "system",
        currency: "₹",
        budget: 0
      });
    }
  };
})(window.App);