# Contributing to Stocktake

## Before you begin

- Work from an up-to-date `main` branch.
- Use Node.js 20 or later.
- Run `npm run dev` to work locally.

## Making a change

1. Create a branch with a clear name, for example `feature/bulk-import-notes` or `fix/order-export`.
2. Make and test the change locally.
3. Run `npm run check` before committing.
4. Push the branch and open a pull request into `main`.

The GitHub Actions workflow runs the same check for each push and pull request. Keep product data, supplier data, secrets, and browser exports out of the repository.
