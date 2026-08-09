# Stocktake

A lightweight internal stock-management tool for Josie Coffee, styled to sit beside the CoffeeCalc staff app.

The project is ready for Codex Sites with a dedicated D1 database, plus a local development runtime that uses the same server routes and storage binding.

## Run locally

Use Node.js 22 or later, then run:

```sh
npm install
npm run dev
```

Open the address shown in the terminal. The local runtime includes a temporary D1 database, so you can test staff sign-in and shared-state saving before publishing.

## What it covers

- Supplier book with a required supplier code and name; ordering method, order days, delivery-issue contact and staff notes are optional. A blank order-days value means ordering is possible any day.
- Product library with automatic `JC-` SKUs, supplier ID, par, minimum, current stock, unit and location; products can be removed individually or in a selected group.
- Separate Excel templates and exports for suppliers and products. Product uploads use the supplier ID, while existing SKUs are updated and blank SKUs are generated.
- Full, low-use and supplier stocktakes. Count differences are retained as usage records.
- Supplier-grouped order list for products below minimum, including the quantity needed to restore par level and the supplier's ordering instructions.
- Long-term usage history, weekly movement, and data-driven par-level recommendations.

## Data and staff access

Stocktake now follows CoffeeCalc’s persistence pattern:

- A shared state record is stored in a Sites-provisioned Cloudflare D1 database by the server-side `app/api/state` endpoint.
- Staff use a password-protected account. The first person to open a D1-backed deployment creates the initial administrator account.
- Every browser retains a local cache under `josieCoffeeStockroom.v2`. It keeps working while offline and queues the next change to be saved when the staff member reconnects.
- Old `josieCoffeeStockroom.v1` browser data is migrated automatically to separate suppliers and product `supplierId` references.
- A new shared stockroom begins empty. The sample inventory is only for the browser-only demo and is never uploaded into D1.

Codex Sites provisions the dedicated D1 database through the logical `DB` binding in `.openai/hosting.json`. Do not connect Stocktake to the CoffeeCalc database.

## Working with GitHub

Use `main` for stable, working code. Make future changes on a new branch, run `npm run check`, then open a pull request back into `main`. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full workflow.

## Deploy with Sites

Open the project in Codex Sites and ask it to prepare and publish the current app. Sites adds the project identifier to `.openai/hosting.json`, packages the generated D1 migration, and gives you a production URL once the deployment is ready. Keep the site restricted to the intended staff audience while you review the first deployment.
