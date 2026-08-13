# Expense Tracker — Personal PWA

A private, offline-first **personal expense tracker** that runs entirely in your browser. Built for one user (you) and works beautifully on Android phones and desktop browsers. Your financial data never leaves your device.

## What it does

- Dashboard with balance, monthly income/expenses, spending overview chart, budget progress, insights (computed from your real data) and recent transactions
- Add / edit / delete **expenses and income**
- Transactions page with search, date/category/payment filters and sorting
- Charts: category spending (doughnut) and spending trend (line) with day/week/month/custom ranges
- **Monthly budget** with a warning bar, and **per-category budgets** with progress
- **Recurring expenses** (daily, weekly, monthly, yearly) that auto-create transactions without duplicates
- Backup/restore to **JSON**, export to **CSV**, and clear-all-data
- Themes: light / dark / system
- **App Lock** — a 4-digit local PIN (stored only as a SHA-256 hash on device)
- Fully **offline**: installable as a Progressive Web App on Android

## Technology

- HTML5, CSS3, Vanilla JavaScript (ES6+)
- IndexedDB (local, in-browser storage)
- Service Worker + Web App Manifest (PWA)
- Custom lightweight SVG charts — no external chart library, no network dependencies
- No backend, no accounts, no tracking, no ads

## Project structure

```
expense-tracker/
├── index.html            # Single-page app shell (views, nav, modals, lock screen)
├── manifest.json         # PWA manifest (icons, display, shortcuts)
├── service-worker.js     # Offline caching
├── css/
│   └── style.css         # Design system, light/dark themes, responsive
├── js/
│   ├── utils.js          # Formatting, toasts, modals, SHA-256, DOM helpers
│   ├── database.js       # IndexedDB wrapper + default seed data
│   ├── charts.js         # SVG line/bar/doughnut chart renderers
│   ├── app.js            # Bootstrap, navigation, theme, app lock, SW registration
│   ├── dashboard.js      # Dashboard view
│   ├── transactions.js   # History, filters, add/edit modal
│   ├── analytics.js      # Monthly overview, category doughnut, trend
│   ├── recurring.js      # Recurring-expense transaction generator
│   ├── backup.js         # JSON backup/restore, CSV export, clear
│   └── settings.js       # Settings view
├── assets/
│   └── icons/            # Generated PWA icons (192/512, maskable)
└── README.md
```

## Run it locally

Because the app uses IndexedDB and a Service Worker, serve it over HTTP (not by double-clicking the file). Any static server works:

```bash
# Python 3
python -m http.server 8080

# or Node
npx serve .
```

Then open `http://localhost:8080` on desktop, or on your phone open `http://<your-computer-ip>:8080` (same Wi-Fi) to try it before installing.

## How IndexedDB works

All data lives inside your browser's own storage in this database called `expense-tracker`:

| Object store | Purpose |
|---|---|
| `transactions` | Every expense & income record |
| `categories` | Expense categories (customizable) |
| `incomeSources` | Income sources (customizable) |
| `budgets` | Monthly & per-category budget limits |
| `recurringExpenses` | Recurring expense definitions |
| `settings` | Preferences, payment methods, app lock |

Totals like “balance” and chart numbers are **calculated on the fly** from the transactions — nothing derived is stored, so data can never get inconsistent.

## Backup / Restore

- **Export Backup (JSON)** — downloads `expense-tracker-backup-YYYY-MM-DD.json` containing every store.
- **Import Backup (JSON)** — validates the file structure, then replaces your current data. Backups are validated before import (id, type, amount, date checked).
- **Export CSV** — writes transactions with a BOM so they open correctly in Excel / Google Sheets.
- **Clear All Data** — asks for a strong confirmation, then wipes everything and re-seeds default categories.

Keep backups safe — they are the only way to move data between devices, since nothing is stored online.

## Install the PWA on Android

1. Serve the app over HTTPS or localhost (necessary for Service Workers on mobile).
2. Open the URL in **Chrome** on Android.
3. Open the browser menu (⋮) → **Add to Home screen** / **Install app**.
4. It launches standalone in its own window, with your icon, and works offline.

> On desktop Chrome the same install prompt appears via the address-bar install icon.

## Testing offline

1. Open the app once while online so assets are cached.
2. Enable **Airplane mode** (or turn off Wi-Fi).
3. Reload — the app still opens, and add/edit/delete/view/analytics all keep working because everything is stored locally.

## Privacy

- **No** data is sent anywhere, ever.
- **No** analytics, ads, accounts or backend.
- Your financial data is stored locally on this device.

> Built with vanilla tech on purpose — it is simple, fast, private and easy to audit.