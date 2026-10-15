# Mobile App Improvement TODO

Created: 2026-05-19  
Project: `C:\mobileapp` / `powerread-mobile`

## Review Summary

The app is now mostly SQLite-backed for field operations, billing, payments, printing, and local database transfer. The biggest remaining production gaps are sync, live schema validation, field testing, security hardening, and cleanup of prototype/demo paths.

Verification during this review:

- `npm run typecheck` passed.
- `npm run test:invoice` passed: 12/12 tests.
- `npm run lint` passed with 2 warnings.

## P0 - Must Fix Before Production Field Rollout

- [ ] Implement real mobile sync payloads.
  - Current `src/lib/sync.ts` posts to `/api/mobile/sync`.
  - Current `apiconnect/local-api` does not provide `/api/mobile/sync`.
  - `getLocalSyncQueue()` still returns an empty array.
  - Add payload extraction for `reading`, `invoices`, `billhistory`, `billhistory_arrears`, `reading_pay`, `complaints`, GPS updates, and disconnection tables.

- [ ] Add sync result handling and idempotency.
  - Mark rows `is_synced = 1` only after confirmed server success.
  - Store failed reason, retry count, and last attempt time.
  - Use stable keys: account number, bill month, OR number, local row id, and updated timestamp.

- [ ] Add the missing local API sync route.
  - Add `apiconnect/local-api/routes/mobileRoutes.js`.
  - Add controller support for upload/download batches.
  - Mount it in `apiconnect/local-api/server.js`.
  - Return per-row success/failure results instead of only module summaries.

- [ ] Validate the production SQLite schema against repository assumptions.
  - Current code defensively checks many possible field names.
  - Confirm exact fields from the desktop-generated `database.db`.
  - Write a schema compatibility report for `reading`, `billhistory`, `billhistory_arrears`, `reading_pay`, `collectors`, rates, and disconnection tables.

- [ ] Complete desktop round-trip transfer testing.
  - Desktop export to mobile import.
  - Mobile billing/payment/disconnection.
  - Mobile export to desktop import.
  - Desktop MySQL update verification.
  - Test normal, BAPA main, BAPA individual, disconnection, and net-metering accounts.

- [ ] Remove hardcoded Worker secrets before any online deployment.
  - `apiconnect/cloudflare-worker/src/index.js` contains placeholder constants:
    - `PUBLIC_API_KEY`
    - `LOCAL_API_BASE_URL`
    - `INTERNAL_API_SECRET`
    - `ALLOWED_ORIGINS`
  - Move these to Cloudflare Worker environment variables/secrets.

- [ ] Confirm authentication model.
  - Offline login currently checks `collectors.Username` and plaintext `collectors.Password`.
  - Online login points to `/api/auth/login`, but local API does not currently mount an auth route.
  - Decide whether collector passwords remain desktop-compatible plaintext or need a migration/hashing path.

## P1 - Billing And Payment Correctness

- [ ] Field-check mobile invoice totals against desktop FUBCS for real production rows.
  - At minimum: residential, commercial, high voltage/demand, BAPA, lifeline, senior, with arrears, and net metering.

- [ ] Verify net-metering output against a real `billhistory_net` sample.
  - Confirm import kWh, export kWh, previous month credit, generation credit, and negative carry-forward totals.

- [ ] Implement or explicitly defer `lifeline_history`.
  - Confirm desktop schema and expected sync direction.
  - Decide whether mobile should read, write, upload, or only display history.

- [ ] Add adjustment workflow.
  - Store original bill values.
  - Require reason/operator.
  - Recompute billhistory safely.
  - Sync adjustment audit rows to desktop/MySQL.

- [ ] Add late-bill workflow.
  - Preserve `BillMonth_latebill` and `flag_latebill`.
  - Prevent accidental overwrite of normal bill rows.
  - Print late-bill status on bill/payment screens.

- [ ] Add non-power payment workflow.
  - Membership, service fees, materials, reconnection, penalties, other collections.
  - Support mixed OR allocation if one OR pays both power and non-power charges.

- [ ] Revisit payment table updates for all customer modes.
  - `database/invoiceRepository.js` uses dynamic mode tables locally.
  - `apiconnect/local-api/controllers/paymentController.js` updates the selected MySQL `billhistory` table only.
  - Confirm BAPA, disconnection, and net-metering online payment behavior before enabling online posting.

## P1 - Reliability And Field Safety

- [ ] Add a real app-level migration/version check for SQLite.
  - Current repositories add columns opportunistically.
  - Add a migration table with version, timestamp, and migration name.
  - Fail clearly if a required production table is missing.

- [ ] Improve import safety for user-selected databases.
  - Validate required table set before staging.
  - Show a readable compatibility report before replacing active DB.
  - Keep automatic rollback to the previous DB if the app cannot reopen the selected DB.

- [ ] Save camera/photo URIs for field evidence.
  - Several screens still show camera placeholder alerts.
  - Connect camera capture to saved file paths under the app image folders.
  - Sync photo metadata and files or document file-transfer-only behavior.

- [ ] Harden reading/payment duplicate prevention.
  - Ensure `billhistory`, `reading_pay`, and local `invoices` cannot duplicate by account/bill month/OR.
  - Add unique local indexes where safe after schema validation.

- [ ] Add better offline error reporting.
  - Capture last failed sync payload and response.
  - Show actionable messages in the Sync screen instead of generic failures.

## P2 - Code Quality And Maintainability

- [ ] Fix lint warning in `app/(drawer)/payment/[id].tsx`.
  - `displayArrearsRows` should be wrapped in `useMemo`.
  - Current warning: dependency may change on every render.

- [ ] Fix lint warning in `services/printerService.js`.
  - Remove or use the unused `reading` variable around `createDisconnectionNoticePrintText`.

- [ ] Reduce `any` usage in route screens.
  - Priority files:
    - `app/(drawer)/reading/[id].tsx`
    - `app/(drawer)/payment/[id].tsx`
    - `app/(drawer)/reports.tsx`
    - `app/(drawer)/search.tsx`
    - `database/invoiceRepository.js`
    - `database/consumerRepository.js`

- [ ] Split large screens into smaller components/hooks.
  - `dashboard.tsx`, `payment/[id].tsx`, `sqlite.tsx`, `login.tsx`, and `settings.tsx` are large enough to slow maintenance.
  - Extract data-loading hooks and repeated header/card components.

- [ ] Move JavaScript repositories/services toward TypeScript.
  - Start with `services/invoiceCalculator.js` only after current billing tests are expanded.
  - Type the SQLite row shapes and printable invoice model.

- [ ] Update `DEVELOPER_GUIDE.md`.
  - It still describes several screens as mock-data driven even though many are now SQLite-backed.
  - Keep it aligned with the current repository architecture.

- [ ] Remove generated or crash artifacts from working tree.
  - Examples: `hs_err_pid*.log`, `android/replay_pid*.log`, built `dist`, and nested project build outputs.
  - Add/confirm `.gitignore` entries if this project becomes a git repo.

## P2 - API And Security Cleanup

- [ ] Replace default MySQL fallback password.
  - `apiconnect/local-api/config/db.js` falls back to `MYSQL_PASSWORD || 'secret'`.
  - Require env configuration for production.

- [ ] Add request validation to local API controllers.
  - Validate body/query parameters before SQL execution.
  - Normalize database selector values.
  - Return consistent error shapes.

- [ ] Add audit consistency across API actions.
  - Payment controller inserts a billhistory log opportunistically.
  - Add structured audit for sync uploads, adjustments, and failed writes.

- [ ] Add integration tests for `apiconnect/local-api`.
  - Health route.
  - Auth secret enforcement.
  - Consumer lookup.
  - Bill lookup.
  - Payment conflict/idempotency.
  - Future mobile sync endpoint.

## P2 - Printing And Hardware Testing

- [ ] Field-test Bluetooth printing on actual paired printers.
  - Woosim.
  - Generic ESC/POS.
  - Reconnect after app restart.
  - Test offline/low battery/device sleep cases.

- [ ] Add print preview snapshots or golden text tests.
  - Bill.
  - Receipt.
  - Disconnection notice.
  - Complaint report.
  - Daily report.

- [ ] Confirm printed bill format with production sample.
  - Arrears lines.
  - Lifeline/senior lines.
  - Net-metering gross/less/net lines.
  - Due/disconnection dates.

## P3 - UX Improvements

- [ ] Make Sync screen counts fully live.
  - The “Synced” count currently displays a hardcoded `12`.
  - Use values from `getSyncSummary`.

- [ ] Persist Settings screen preferences.
  - Some settings are UI state only.
  - Store record view, sort order, auto-next, GPS/camera toggles, and online/offline preference in SQLite config.

- [ ] Add route-aware empty states.
  - Reading assignment missing.
  - No collector logged in.
  - Imported DB has no expected tables.
  - Printer not configured.
  - API URL missing.

- [ ] Add admin-only diagnostics screen.
  - Show app version, DB version, package id, active DB path, last sync attempt, printer config, and API URL status.

- [ ] Improve performance on large route assignments.
  - Add pagination or virtualized lists for search/dashboard/disconnection.
  - Avoid loading 10,000 rows into summary screens unless needed.

## P3 - Test Coverage

- [ ] Add repository tests using a small fixture SQLite DB.
  - `getReadingRecord`
  - `saveInvoice`
  - `savePayment`
  - `getPaymentSummary`
  - disconnection updates
  - complaint saves

- [ ] Add sync unit tests before building live sync.
  - payload extraction
  - conflict handling
  - mark synced
  - retry/failure state

- [ ] Add UI smoke tests for critical screens.
  - login
  - search
  - reading
  - invoice
  - payment
  - receipt
  - sqlite manager
  - sync

## Suggested Next Sprint

1. Fix the two lint warnings.
2. Update `DEVELOPER_GUIDE.md` so it matches current SQLite-backed behavior.
3. Implement `/api/mobile/sync` skeleton with validation and mock response.
4. Implement pending-row extraction locally for `reading`, `invoices`, `reading_pay`, and `complaints`.
5. Run one full desktop-mobile-desktop SQLite transfer using a small test route.

