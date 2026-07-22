# Stocktake

A lightweight internal stock-management tool for Josie Coffee, styled to sit beside the CoffeeCalc staff app.

The project is ready for GitHub. It has a local Git repository, `.gitignore`, a Node runtime declaration, and a GitHub Actions check that validates the JavaScript on every push and pull request.

## Run locally

Use Node.js 20 or later, then run:

```sh
npm run dev
```

Open the address shown in the terminal. The app is deliberately dependency-light: it uses browser storage for its data and loads SheetJS only when spreadsheet import/export is used.

## What it covers

- Product library with automatic `JC-` SKUs, supplier, par, minimum, current stock, unit and location.
- Excel template download, product export, and XLSX/XLS/CSV bulk import. Existing SKUs are updated; blank SKUs are generated.
- Full, low-use and supplier stocktakes. Count differences are retained as usage records.
- Supplier-grouped order list for products below minimum, including the quantity needed to restore par level.
- Long-term usage history, weekly movement, and data-driven par-level recommendations.

## Data and rollout note

This first build saves data in the current browser profile (`localStorage`), which makes it usable immediately and retains usage history on that device. A shared staff rollout should move the same data model to the CoffeeCalc-style authenticated API and D1 database, so all staff work from one central stock record.
