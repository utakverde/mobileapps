# TODO - Replace Mock Data With SQLite

Last updated: 2026-05-15

## Goal

Make production screens read from the active `database.db` through repository functions instead of `src/constants/mockData.ts`. Keep mock data only for local demos, tests, and fallback examples.

## SQL Upload/Download Sync Status

The mobile app cannot yet complete full SQL upload/download sync with the desktop project at:

`C:\Users\SAMELCO II\Documents\with collection report_updated - android -no GPS\Source Code (FUBCS)`

What exists:

- Mobile SQLite import/export exists in `src/lib/databaseFiles.ts`.
- The mobile app can import the newest `Import/*.db` into active `SQLite/database.db`.
- The mobile app can export active SQLite to `Download/database.db` for ADB pull.
- Desktop FUBCS has upload/download forms that create and read `C:\FubcsAndroid\Export\database.db` and `C:\FubcsAndroid\Import\database.db`.
- Desktop FUBCS download reads `billhistory` and `reading_pay` from the returned SQLite database and applies those records to MySQL.

What is missing or mismatched:

- `src/lib/sync.ts` calls `POST /api/mobile/sync`; the local API now mounts an acknowledgement route, but row-level upload/download is still not implemented.
- `getLocalSyncQueue()` returns an empty array and `runSyncQueue()` sends only module counts, not actual dirty row payloads.
- Local rows are marked with `is_synced = 0`, but there is no row-level uploader/downloader and no `markSynced` result handling.
- Desktop ADB commands were updated to `run-as com.powerread.mobile`; the old App Inventor commands are kept as commented rollback lines in the desktop VB files.
- Cloudflare Worker proxy constants are placeholders, so the mobile app cannot safely reach a production local SQL bridge yet.

## TODO - Enable Desktop SQL Upload/Download

- [ ] Decide the primary transfer mode: file-based SQLite transfer through ADB, online API sync, or both.
- [x] Update desktop FUBCS Android paths from `appinventor.ai_ramcompany10152022.RAM` to `com.powerread.mobile`, or document/use the generated `run-as com.powerread.mobile` commands from `getAdbTransferInfo()`.
- [ ] Confirm desktop can push `C:\FubcsAndroid\Export\database.db` into the mobile app `files/Import/database.db`.
- [ ] Confirm mobile can import that file and load `reading`, `billhistory`, `billhistory_arrears`, `reading_pay`, `collectors`, and rate/setup tables.
- [ ] Confirm mobile can export active SQLite to `files/Download/database.db`.
- [ ] Confirm desktop can pull the exported database into `C:\FubcsAndroid\Import\database.db`.
- [ ] Verify desktop download applies mobile-generated `billhistory`, `billhistory_arrears`, and `reading_pay` rows correctly to MySQL.
- [x] Add a real `POST /api/mobile/sync` route if online sync is required.
- [ ] Implement mobile pending-row extraction for `reading`, `invoices`, `billhistory`, `billhistory_arrears`, `reading_pay`, `complaints`, and disconnection tables.
- [ ] Return per-row sync results from the API and mark only confirmed rows as `is_synced = 1`.
- [ ] Add conflict/idempotency keys using account number, bill month, local row id/code, OR number, and updated timestamp.
- [ ] Move Cloudflare Worker API key, local API URL, internal secret, and allowed origins to environment variables/secrets.
- [ ] Add a test checklist using one small route/book assignment: desktop upload, mobile import, reading/payment save, mobile export, desktop download, MySQL verification.

## Online Mode API Login

- [x] Add local API route `POST /api/auth/login` for the mobile Online login button.
- [x] Authenticate Online login against the documented MySQL `tblusers` table.
- [x] Return mobile-compatible `ok`, `displayName`, `username`, and `collectorId` fields from the API.
- [x] Send optional `EXPO_PUBLIC_API_KEY` from the mobile API helper for Cloudflare Worker calls.
- [x] Send optional `EXPO_PUBLIC_INTERNAL_API_SECRET` for direct local API testing only.
- [ ] Configure production `.env` with `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_API_KEY`, then restart Expo with cache clear.
- [ ] Avoid shipping `EXPO_PUBLIC_INTERNAL_API_SECRET` in production APKs; use the Worker gateway for field devices.
- [ ] Test Online login against a copy of the live `tblusers` table.
- [ ] Replace plain-text password comparison if production `tblusers.password` is hashed.

## Local API App Link

- [x] Point mobile `.env` to local API at `http://10.0.2.2:3000` for Android emulator testing.
- [x] Add `EXPO_PUBLIC_INTERNAL_API_SECRET` to mobile `.env` for direct local API testing.
- [x] Add `apiconnect/local-api/.env` with local MySQL/API defaults.
- [x] Enable Android cleartext traffic for local HTTP API development.
- [x] Add `POST /api/mobile/sync` so the Sync screen no longer calls a missing route.
- [x] Fix local API payment result handling in `postPayment`.
- [ ] For physical phone testing, replace `10.0.2.2` with the PC LAN IP in mobile `.env`.
- [ ] Replace placeholder MySQL password/internal secret before field use.

## TODO - Net Metering, Adjustments, Late Bills, Non-Power Payments, and Schedule Invoice Creation

Status: planning/checklist only. Do not change production MySQL tables until the live schema is backed up and compared with the desktop FUBCS schema.

Desktop references found:

- `FUBCS BAPA\Billing_ManualPosting_Query_adjust.vb` is the desktop adjustment reference.
- `FUBCS BAPA\Billing_ManualPosting_Query_late.vb` is the desktop late-bill reference.
- `FUBCS BAPA\billhistory.xsd` and `billhistory.Designer.vb` already include `BillMonth_latebill`, `flag_latebill`, `GrossKilowattHour`, `LessKilowattHour`, `amt_tendered`, `amt_change`, `ORCollection`, and `grpReport`.
- `FUBCS BAPA\modSystem.vb` creates the mobile schedule/export database and reads schedule fields such as `PrevRdngDate`, `PresRdngDate`, `DueDate`, `DisconnectionDate`, and `schedrdingid`.

Mobile references found:

- `services/netMeteringCalculator.js` computes import kWh, export kWh, net kWh, and credit kWh.
- `services/invoiceCalculator.js` has `computeNetMeteringInvoice(...)`, but export credit/banking rules still need validation against the desktop net-metering process.
- `database/invoiceRepository.js` maps net-metering import/export values to `GrossKilowattHour` and `LessKilowattHour`.
- `app/(drawer)/payment/[id].tsx` and `database/invoiceRepository.js` handle power-bill payment only.
- `apiconnect/local-api/controllers/paymentController.js` only updates `billhistory` payments and should be fixed before it is used for online sync.

### Lifeline and Senior History

- [x] Review current mobile lifeline/senior billing before adding a `lifeline_history` implementation.
- [x] Fix desktop/mobile lifeline flag mismatch by accepting `flagLifeline`, `flaglifeline`, and `flag_lifeline`.
- [x] Fix senior subsidy mapping to accept both `senior_subsidy` and `senior_subsid`.
- [ ] Confirm the production schema and expected sync behavior for `lifeline_history`.
- [ ] Decide whether `lifeline_history` should be mobile-local only, downloaded from desktop, uploaded to MySQL, or all three.
- [ ] Add `lifeline_history` only after the live schema is backed up and the exact desktop fields are confirmed.

### Net Metering Fixes

- [x] Update mobile net-metering billing to follow the statement-of-account logic: bill incoming/import kWh like a regular consumer, then subtract outgoing/export kWh only as a generation credit.
- [ ] Confirm whether net-metering accounts should use `tblschedrdng`, `tblschedrdng_bm`, or a dedicated net-metering schedule table in `apiconnect/local-api/config/dbRouter.js`.
- [x] Add validation warnings for negative import/export kWh caused by wrong readings.
- [x] Add explicit fields in mobile invoice output for gross import kWh, less/export kWh, net kWh, outgoing generation credit, previous month credit, and total net-metering credit.
- [x] Implement previous month credit as the negative total of the prior negative net-metering bill.
- [x] Save net-metering previous credit locally on the `reading` row.
- [x] Add tests for incoming billing, outgoing generation credit, negative carry-forward bills, positive credit normalization, and invalid lower readings.
- [x] Print net-metering gross/less/net values and credit lines on the mobile bill/receipt.
- [x] Implement the matching desktop VB net-metering posting rule for `billhistory_net`.
- [ ] Field-check the mobile result against a real `billhistory_net` sample from MySQL before live use.
- [ ] Build/run the desktop FUBCS app and post one known `master_net` sample to verify desktop SOA totals.

### Adjustments Fixes

- [ ] Port the desktop adjustment workflow from `Billing_ManualPosting_Query_adjust.vb` into a mobile-safe repository function.
- [ ] Add an adjustment screen or admin-only action for bill correction, with required reason and operator/collector id.
- [ ] Store original bill values before any adjustment is applied.
- [ ] Recompute totals and update `billhistory` only after an adjustment audit row is saved.
- [ ] Include adjusted bills in mobile export/download so desktop MySQL can apply the same correction.
- [ ] Add tests that adjustment totals match the desktop form for at least one residential, BAPA, and net-metering sample.

### Late Bill Fixes

- [ ] Port the desktop late-bill workflow from `Billing_ManualPosting_Query_late.vb`.
- [ ] Preserve and sync `BillMonth_latebill` and `flag_latebill`.
- [ ] Decide whether late bills should create a separate billhistory row, update an existing row, or be stored as an arrears row.
- [ ] Show late-bill status in payment summary and printable invoice when applicable.
- [ ] Add validation so a late bill cannot overwrite a normal bill for the same account/month without audit history.

### Non-Power Bill Payments

- [ ] Inspect desktop non-power payment forms such as membership, service fees, materials, reconnection, penalties, and other collections before building the mobile UI.
- [ ] Add a mobile non-power payment flow separate from power-bill `reading_pay`.
- [ ] Support non-power charge type, reference number, account/member id, amount due, amount paid, OR number, collector, tendered amount, change, payment method, and remarks.
- [ ] Add payment allocation records when one OR pays both power and non-power balances.
- [ ] Print non-power OR/receipt details without forcing a billhistory power-bill record.
- [ ] Include non-power payments in mobile export/download and local sync payloads.

### MySQL Database Changes To Verify Or Add

- [ ] Confirm these existing fields in every relevant billhistory table: `billhistory`, `billhistory_net`, `billhistory_bm`, and `billhistory_bi`:
  - `GrossKilowattHour`
  - `LessKilowattHour`
  - `BillMonth_latebill`
  - `flag_latebill`
  - `ORCollection`
  - `grpReport`
  - `amt_tendered`
  - `amt_change`
  - `check_flag`
  - `check_franchise_tax`
- [ ] Add only if missing: `net_kwh`, `net_metering_credit_amount`, `net_metering_credit_kwh`, and `net_metering_credit_balance`.
- [ ] Add an audit table for bill adjustments, for example `bill_adjustments`, with original values, new values, reason, adjusted_by, adjusted_at, source device, and source local id.
- [ ] Add a net-metering ledger table, for example `net_metering_credits`, if export credits must carry forward between bill months.
- [ ] Add non-power collection tables if no desktop tables already exist, for example:
  - `non_power_charges`
  - `non_power_payments`
  - `payment_allocations`
- [ ] Add unique/idempotency keys for mobile download:
  - billhistory: account number, bill month, bill number, and source local id
  - payments: OR number, account number, payment date, and source local id
  - adjustments: original billhistory entry and adjustment timestamp/source id
- [ ] Back up MySQL before applying any schema change and save the exact migration SQL beside the backup.

### Create Schedule / Invoice Creation Checks

- [ ] Review `FUBCS BAPA\modSystem.vb` schedule export before field use.
- [ ] Verify schedule export always finds a `tblschedrdng*` row before reading `Rows(0)`.
- [ ] Confirm schedule dates are copied into mobile SQLite as `Sched_PrevRdngDate`, `Sched_PresRdngDate`, `Sched_DueDate`, `Sched_DisconnectionDate`, and `Sched_ID`.
- [ ] Validate generated SQLite `reading` columns against the mobile repository fields used by `database/invoiceRepository.js`.
- [ ] Check column-name inconsistencies seen in generated insert strings, especially `senior_subsid` vs `senior_subsidy` and `Rate_TrueUpy` vs `Rate_TrueUp`.
- [ ] Create one test export for normal, BAPA, net-metering, and late-bill accounts, then import into mobile and compute invoices.
- [ ] Compare mobile-created invoices with desktop-created invoices for the same schedule before enabling live collection.

### Acceptance Checklist

- [ ] Net-metering bills match desktop totals and preserve gross/less/net values.
- [ ] Adjusted bills keep the original bill and record who/why/when the adjustment happened.
- [ ] Late bills keep `BillMonth_latebill` and `flag_latebill` through mobile export and desktop download.
- [ ] Non-power payments can be collected and printed without creating fake power-bill rows.
- [ ] MySQL migrations are backed up, reversible, and tested on a copy of the database.
- [ ] Create Schedule export produces a SQLite database the mobile app can import, bill, pay, export, and return to desktop without manual repair.

## Completed In Current Pass

- Added `database/consumerRepository.js` for SQLite-backed consumer, assignment, dashboard, report, disconnection, GPS, complaint, and sync summary helpers.
- Dashboard now loads recent accounts, filters, profile assignment, and counts from SQLite.
- Reports now loads schedule metadata, record totals, status distribution, and collection totals from SQLite.
- Disconnection now loads candidates from SQLite instead of `MOCK_CONSUMERS`.
- Map now loads the selected consumer from SQLite and saves captured GPS coordinates locally.
- Bill preview now loads consumer and latest invoice/billhistory data from SQLite.
- Receipt preview now loads payment details from `getPaymentSummary`.
- Complaint screen now loads consumer details from SQLite and saves reports into a local `complaints` table.
- Drawer and top bar assignment labels now come from SQLite assignment/collector data.
- Sync screen now counts local tables with `is_synced` instead of using `MOCK_SYNC_LOGS`.
- Reading and payment screens no longer use `READING_AREA` / `MOCK_CONSUMERS` as production fallback data.
- Bluetooth screen no longer shows fake devices; it now presents an integration-needed state until a native printer package is wired.
- Login now requires an OR number, stores the active login session, and uses the authenticated collector name on Dashboard, Drawer, Payment, and Receipt screens.
- Login OR number is now saved to the SQLite `config` table and recovered by Payment when the active in-memory session has no OR value.
- Bluetooth printer id/name/address/type/connection state now reads from the SQLite `config` table for print preparation.
- Native Bluetooth Classic transport is now installed and wired for paired Android thermal printers.
- Invoice printout now uses `reading` for rates, `billhistory` for peso amounts, and `billhistory_arrears` / reading breakdown for arrears detail.

## Current SQLite-Backed Areas

- Search screen uses `listReadingRecords(db, ...)` from `database/invoiceRepository.js`.
- Reading, invoice, payment, and net-metering flows have repository support for reading records, computing invoices, saving payments, and loading latest invoices.
- SQLite manager reads live SQLite version, table names, row counts, file size, and modified date.
- Dashboard, Reports, Disconnection, Map, Bill, Receipt, Complaint, DrawerContent, TopBar, and Sync now use SQLite repository helpers.

## Mock Data Status

- No production app screen currently imports `src/constants/mockData.ts`.
- `src/constants/mockData.ts` remains in the repo as demo/reference data only.
- Bluetooth still needs a real native discovery/printing package before it can list actual devices.

## Repository Work Completed

- Added a dedicated SQLite repository module:
  - `getDashboardSummary(db)`
  - `listConsumers(db, filters)`
  - `getConsumerById(db, id)`
  - `getReadingAssignment(db)`

- Added report/disconnection helpers:
  - `getReportSummary(db)`
  - `getDisconnectionCandidates(db)`

- Added local queue helper:
  - `getSyncSummary(db)`

- Added complaint/GPS helpers:
  - `saveComplaintReport(db, input)`
  - `updateConsumerGps(db, id, lat, lng)`
  - local `complaints` table creation
  - `app_gps_lat`, `app_gps_lng`, `is_synced`, and `updated_at` tracking for GPS changes

## Remaining Production Work

- Confirm the real field SQLite schema includes all expected production tables and columns. The bundled `assets/database/database.db` currently only exposes an empty `RATES` table in this workspace.
- Replace the current defensive/fallback query logic with tighter schema-specific queries after the production SQLite file is confirmed.
- Confirm production field names for desktop billing branches that depend on demand kWh and BAPA senior/lifeline columns. The mobile calculator now follows the supplied desktop billing rules and reads rates directly from the `reading` row.
- Implement real sync payload extraction, upload/download, conflict handling, and `markSynced` / failure tracking.
- Field-test Woosim and generic ESC/POS print output on actual paired Bluetooth printers.
- Compare the new thermal invoice printout against production printer samples and adjust any live SQLite column names that differ from the mapped names.
- Confirm production APK signing before broad deployment.
- Keep previous reading hidden in field-facing screens. It is still used internally from SQLite for computation; only authorized/admin print paths should opt into previous-reading output.
- Connect camera capture to saved file URIs and sync those photo records.

## Acceptance Checklist

- No production screen imports `MOCK_CONSUMERS`, `MOCK_PAYMENTS`, `READING_AREA`, `REPORT_STATS`, or `MOCK_SYNC_LOGS`.
- `src/constants/mockData.ts` remains only for demos/tests, or is moved under a clearly named demo folder.
- Dashboard totals match SQLite Manager row counts and payment/read flags.
- Disconnection list changes when SQLite payment status changes.
- Receipts and bills render from saved SQLite invoice/payment records.
- Logged-in collector name appears consistently after login instead of falling back to the first collector row in SQLite.
- Payment collection pre-fills the OR number entered during login and still validates OR before saving.
- Bluetooth printer status uses the saved successful connection data from `config`.
- Bluetooth screen lists paired Android devices, connects to the selected printer, saves config, and can send a real test print.
- Printed arrears/payment detail itemizes previous bill months from `billhistory_arrears`.
- Sync screen counts match actual unsynced local rows.
