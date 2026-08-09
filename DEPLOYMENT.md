# Shared Stocktake deployment

Deploy this repository through Codex Sites. It is configured with a dedicated D1 binding named `DB`, a Sites-compatible worker build, and generated database migrations.

## One-time setup

1. Open the repository in Codex Sites and ask it to deploy the current project.
2. Keep the initial deployment restricted to the intended staff audience while it is reviewed.
3. Open the deployment. The first staff member creates the administrator username and password. That account protects all shared stock data.

## What is stored

The database contains one shared Stocktake payload plus staff accounts, secure sessions and login-attempt protection. The payload contains supplier records, products, stocktake records and usage history. Browsers keep an offline cache, but the D1 record is the shared source of truth.

## Important

- Do not bind Stocktake to the CoffeeCalc D1 database; Sites creates a dedicated database through `DB`.
- A local browser cache is available offline, but shared data requires the Sites deployment.
- Export the supplier and product lists periodically as an additional operational backup.
