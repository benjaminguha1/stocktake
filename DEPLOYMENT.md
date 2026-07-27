# Shared Stocktake deployment

The GitHub Pages workflow publishes a browser-only demo. For one stockroom shared by the Josie team, deploy this repository to a Cloudflare Pages or Workers runtime with Cloudflare D1 enabled.

## One-time setup

1. Create a new D1 database named something clear, such as `josie-stocktake`.
2. Create a Pages project from this GitHub repository. Use the repository root as the static output directory; there is no build command for this version.
3. In the project’s Functions or D1 bindings, add the database as `DB`.
4. Deploy the project. Cloudflare serves the static app and the `functions/` API routes together.
5. Open the deployed app. The first staff member creates the administrator username and password. That account protects all shared stock data.

## What is stored

The database contains one shared Stocktake payload plus staff accounts, secure sessions and login-attempt protection. The payload contains supplier records, products, stocktake records and usage history. Browsers keep an offline cache, but the D1 record is the shared source of truth.

## Important

- Do not bind Stocktake to the CoffeeCalc D1 database; use a separate database.
- Keep the GitHub Pages deployment as a demo only. It cannot process `functions/` or securely store shared data.
- Export the supplier and product lists periodically as an additional operational backup.
