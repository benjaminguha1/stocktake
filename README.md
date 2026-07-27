# Stocktake

A lightweight internal stock-management tool for Josie Coffee, styled to sit beside the CoffeeCalc staff app.

The project is ready for GitHub. It has a local Git repository, `.gitignore`, a Node runtime declaration, and a GitHub Actions check that validates the JavaScript on every push and pull request.

## Run locally

Use Node.js 20 or later, then run:

```sh
npm run dev
```

Open the address shown in the terminal. The local preview deliberately runs in offline mode, using browser storage and loading SheetJS only when spreadsheet import/export is used.

## What it covers

- Supplier book with a unique supplier ID, name, ordering method, order days, delivery-issue contact and staff notes.
- Product library with automatic `JC-` SKUs, supplier ID, par, minimum, current stock, unit and location; products can be removed individually or in a selected group.
- Separate Excel templates and exports for suppliers and products. Product uploads use the supplier ID, while existing SKUs are updated and blank SKUs are generated.
- Full, low-use and supplier stocktakes. Count differences are retained as usage records.
- Supplier-grouped order list for products below minimum, including the quantity needed to restore par level and the supplier's ordering instructions.
- Long-term usage history, weekly movement, and data-driven par-level recommendations.

## Data and staff access

Stocktake now follows CoffeeCalc’s persistence pattern:

- A shared state record is stored in a Cloudflare D1 database by the server-side `functions/api/state.js` endpoint.
- Staff use a password-protected account. The first person to open a D1-backed deployment creates the initial administrator account.
- Every browser retains a local cache under `josieCoffeeStockroom.v2`. It keeps working while offline and queues the next change to be saved when the staff member reconnects.
- Old `josieCoffeeStockroom.v1` browser data is migrated automatically to separate suppliers and product `supplierId` references.

The static GitHub Pages address remains useful as a demo, but GitHub Pages cannot run the secure API or D1 database. It therefore remains browser-only by design. Deploy the same repository to a Cloudflare Pages/Workers runtime with a D1 binding called `DB` for the shared internal tool; the `functions/` directory supplies the protected sign-in and state endpoints.

When creating the database binding, give it a new, dedicated D1 database for Stocktake. Do not point this project at the CoffeeCalc database.

## Working with GitHub

Use `main` for stable, working code. Make future changes on a new branch, run `npm run check`, then open a pull request back into `main`. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full workflow.

## Live demo

The `Deploy live demo` workflow publishes the static app to GitHub Pages whenever `main` changes. In the repository’s **Settings → Pages**, select **GitHub Actions** as the publishing source to activate the first deployment.
