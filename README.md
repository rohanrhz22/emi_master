# EMI Planner

Open `login.html` for local profiles, or `emi-app.html` for the standalone planner. No backend, build step or development server is required. Both dashboards use `loan-model.js`, `planner.js` and `planner.css`.

## Publish With GitHub Pages

This repository includes `.github/workflows/pages.yml`, which deploys the static site whenever `main` is pushed.

1. In the GitHub repository, open **Settings > Pages**.
2. Under **Build and deployment**, select **GitHub Actions** as the source.
3. Commit and push the site files to `main`.
4. Open **Actions > Deploy to GitHub Pages** and wait for the deployment to finish.
5. Visit `https://rohanrhz22.github.io/emi_master/`.

GitHub Pages is the host, not an application backend. Each browser stores its own copy of the data in `localStorage`. Data saved while opening the files locally does not automatically move to the Pages URL: export a JSON backup from the local app, open the hosted app, and import that backup once.

The loan defaults are present in `loan-model.js` and are therefore readable by anyone who can access the published site or repository. The profile/login screen is only a local browser convenience; it does not provide server authentication, encryption, synchronization, recovery or private multi-device accounts. A real backend and authentication service are required for those features.

## Saved Data And Dates

- The five supplied loans have an immutable financial baseline of 30 September 2026. The saved installment counts are original tenures, not decrementing counters.
- On the first visit after this update, older records for the current profile are archived under the storage key ending in `_beforeSeptember2026`, and replaced with the five supplied loans. Existing income and expense settings are retained. Other profiles are untouched until opened.
- Subsequent visits retain edits and deletions. Completed loans remain in the records. Date previews never rewrite loan records.
- Automatic mode follows the device's local calendar date, checks again on focus and visibility changes, and checks every 30 seconds while open. The analysis date cannot precede the baseline. On a due date, that installment becomes scheduled elapsed, not confirmed paid. Month-end due days are clamped to the last valid day of the month.
- The overview shows next calendar month's EMI budget. Timeline shows all remaining monthly payments, including any remaining payments this month. Balances shows each future installment's principal, interest and closing balance.
- Data is stored in `localStorage` for this browser/profile and origin. Browser data clearing, private browsing, moving files, changing browsers or changing hosting origins may lose access to it. Export a backup. Current-format JSON exports can be imported; the previous-records export is an archival copy of the older format.
- Local profiles are not server authentication or encrypted storage. The default loan figures are also present in the source file: do not publish this workspace publicly unless you intend to share them.

## Accuracy

The source is the supplied text summary, not independently inspected lender documents. September principal is approximately INR 581,962.48; October scheduled EMIs total INR 28,919.69. Remaining scheduled payments total INR 670,859.79, excluding extra charges and taxes.

PLCC principal is saved as an estimate of INR 135,646 because exact paise were missing. Axis's 13% is user-provided, and the ICICI 16% rates are inferred. These are not treated as lender-verified rates.

IDFC's reduced final installment and final principal/interest split, Axis's reduced final installment, both ICICI final adjustments, all five remaining Flipkart splits, and the Bajaj principal-only schedule are retained. Bajaj's final ADVEMI is included pending confirmation of whether it was collected in advance.

Where individual rows are unavailable, monthly splits are explicitly model estimates. A constant monthly rate is fitted to the baseline principal and remaining payment stream, respecting a known final principal where supplied. It is not a quoted lender rate. Baseline aggregate amounts are retained without reconstructing principal from an unverified annual rate. Financial edits replace those row assumptions with user-entered estimates; name-only edits preserve supplied rows.

Projections assume on-time payments, unchanged terms and no prepayments. Taxes, insurance, late fees, penalties and foreclosure charges are unknown or excluded. Exact foreclosure savings are unavailable without lender terms and quotes. Payment confirmation cannot be inferred from the calendar.

## Verification

Run `node loan-model.test.js` for baseline counts, due-date boundaries, leap/month-end dates, reduced final EMIs, zero end balances and immutable records. No dependencies are needed.