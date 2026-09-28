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
- Full, low-use, supplier and section stocktakes, with resumable local drafts and explicit counted/skipped choices. Count differences are retained as usage records.
- Supplier-grouped order list for products below minimum, including the quantity needed to restore par level and the supplier's ordering instructions.
- Long-term usage history, weekly movement, and data-driven par-level recommendations.
- Daily assigned tasks, optional in-app/browser reminders, global product and action search, and a manager exception queue.
- Invoice-photo receiving with on-device text recognition and a required quantity review before stock changes.
- Durable receipt and staff-issue photos stored separately from the shared stock data.

## Data and staff access

Stocktake now follows CoffeeCalc’s persistence pattern:

- A shared state record is stored in a Sites-provisioned Cloudflare D1 database by the server-side `app/api/state` endpoint.
- Staff use a password-protected account. The first person to open a D1-backed deployment creates the initial administrator account.
- Every browser retains a local cache under `josieCoffeeStockroom.v2`. It keeps working while offline and queues the next change to be saved when the staff member reconnects.
- Old `josieCoffeeStockroom.v1` browser data is migrated automatically to separate suppliers and product `supplierId` references.
- A new stockroom begins empty. Staff add their own suppliers and products; sample inventory is not shown or uploaded.

Codex Sites provisions the dedicated D1 database and receipt-photo storage through the logical `DB` and `FILES` bindings in `.openai/hosting.json`. Do not connect Stocktake to the CoffeeCalc database.

## Working with GitHub

Use `main` for stable, working code. Make future changes on a new branch, run `npm run check`, then open a pull request back into `main`. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full workflow.

## Deploy with Sites

Open the project in Codex Sites and ask it to prepare and publish the current app. Sites adds the project identifier to `.openai/hosting.json`, packages the generated D1 migration, and gives you a production URL once the deployment is ready. Keep the site restricted to the intended staff audience while you review the first deployment.

## Staff workflow

- Home highlights counting, receiving deliveries, and checking what needs ordering. Reports and stock setup remain available in the secondary navigation.
- Start with a shelf/section count. A product's optional shelf position controls counting order within its location.
- Counts save a draft on the current device for the current signed-in user. Use **Save and exit** and **Resume** when interrupted. Drafts are not shared between devices.
- Enter a quantity (including **0** for no stock), or leave it blank and tap **Next** to skip. **Skip** also advances immediately. Review changes before saving. Skipped items do not update stock or count toward a completed full stocktake.
- Today's handover shows which sections have been checked and which still need counting.
- The dashboard combines system-generated work with manually assigned daily tasks. Reminder settings are stored on each device.
- Search from the header to find products, shelf locations, suppliers or common actions from any screen.
- Exceptions bring together skipped counts, large stock changes, delivery shortages, overdue deliveries and staff photo reports.
- Review order quantities, copy the supplier order, send it through the usual supplier channel, then choose **I've sent this order**. Stocktake does not contact suppliers automatically.
- Receive the quantity that actually arrived. Shortages stay on order unless explicitly closed. The immediate receipt confirmation offers an undo, provided the affected stock has not changed.
- On Deliveries, photograph an invoice to read and match its product lines. Review every proposed quantity, then confirm once to update stock. Invoice recognition runs in the browser and does not consume AI credits.
- Archive unused products or suppliers instead of deleting them. Restore them from the archived view. Receive or cancel outstanding orders before archiving.
- **Easy access** provides the current app link, home-screen instructions, and a locally generated printable QR code. Print it from the deployed staff URL, not a localhost preview.

## Validation and staff trial

`npm run check` runs syntax checks, storage/workflow tests, a simulated-DOM staff journey, and the production build. QR assets are generated locally during the build.

Before rollout, have three staff members count a section and receive a partial delivery on their normal devices. Check the time taken, whether they can resume after an interruption, and any corrections needed. Agree who counts each section during the shift handover. Browser layout and printing still need a real-device check; automated tests do not replace it.
