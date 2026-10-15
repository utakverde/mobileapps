# Development Logs

## 2026-05-21 - Local API Root Route Fix

### Scope

- Fixed the browser-facing `Cannot GET /` response from the local API.

### Changes

- Added `GET /` in `apiconnect/local-api/server.js`.
- Reused the same API status response for `GET /health`.
- The status response now lists the main local API endpoints for quick manual testing.

### Verification

- `node --check apiconnect\local-api\server.js` passed.
- `npm run typecheck` passed.
- Verified the patched root route on temporary port 3001 because an older local API process was already using port 3000.
- `GET http://localhost:3001/` returned 200 with endpoint metadata.
- `GET http://localhost:3001/health` returned 200 with endpoint metadata.

## 2026-05-21 - Local API App Link

### Scope

- Linked the mobile app directly to `apiconnect/local-api` for local development.
- Filled the missing sync endpoint used by the mobile Sync screen.

### Changes

- Updated mobile `.env` to use `http://10.0.2.2:3000` with `EXPO_PUBLIC_INTERNAL_API_SECRET=change-this-secret`.
- Added `apiconnect/local-api/.env` with local MySQL, API port, and internal secret defaults.
- Enabled Android cleartext HTTP traffic in `app.json` and the generated Android manifest for local API testing.
- Added `apiconnect/local-api/routes/mobileRoutes.js`.
- Added `apiconnect/local-api/controllers/mobileController.js`.
- Mounted `POST /api/mobile/sync` in the local API.
- Updated Sync screen copy from Worker-specific text to local API text.
- Fixed `postPayment` result handling in `apiconnect/local-api/controllers/paymentController.js`.

### Verification

- Installed local API dependencies with `npm --prefix apiconnect\local-api install`.
- `npm run typecheck` passed.
- `npm run test:invoice` passed with 12/12 tests.
- `node --check` passed for the new mobile sync controller/route, updated payment controller, and server.
- `npm run lint` passed with the existing unrelated warnings in payment, reading, sqlite, and printer service files.
- Started `apiconnect/local-api` and confirmed:
  - `GET /health` returned 200.
  - `POST /api/mobile/sync` returned a module acknowledgement with `x-internal-secret: change-this-secret`.
  - `POST /api/mobile/sync` returned 403 without the internal secret.

## 2026-05-21 - Online Mode API Login Fix

### Scope

- Fixed the mobile Online login path and local API route expected by `src/lib/auth.ts`.
- Added documentation trail for follow-up production configuration and testing.

### Changes

- Added `apiconnect/local-api/routes/authRoutes.js`.
- Added `apiconnect/local-api/controllers/authController.js`.
- Mounted `POST /api/auth/login` in `apiconnect/local-api/server.js`.
- The endpoint validates username/password against `tblusers` and returns mobile-compatible login fields.
- Updated `src/lib/api.ts` to send optional `EXPO_PUBLIC_API_KEY` for Worker requests.
- Added optional `EXPO_PUBLIC_INTERNAL_API_SECRET` support for direct local API testing only.
- Updated Online login response handling in `src/lib/auth.ts` to accept `success` and `collectorId`.

### Verification

- `npm run typecheck` passed.
- `npm run test:invoice` passed with 12/12 tests.
- `node --check` passed for the new local API auth controller, auth route, and updated server.
- `npm run lint` passed with existing warnings only in unrelated files:
  - `app/(drawer)/payment/[id].tsx`
  - `app/(drawer)/reading/[id].tsx`
  - `app/(drawer)/sqlite.tsx`
  - `services/printerService.js`
- Live Online login was not tested because no MySQL/API server credentials were provided in this workspace.

## 2026-05-18 - Lifeline and Senior Pre-Implementation Bug Review

### Scope

- Reviewed mobile lifeline/senior billing before adding any larger `lifeline_history` implementation.
- Checked `services/invoiceCalculator.js`, `database/invoiceRepository.js`, desktop export references, and invoice tests.

### Bugs Logged

- Added `database_ui_development_logs/lifeline_senior_bug_log_2026-05-18.md`.
- Found that desktop exports `flagLifeline`, while mobile only recognized `flaglifeline`/`flag_lifeline`.
- Found that senior subsidy may arrive as either `senior_subsidy` or `senior_subsid`.
- Confirmed no current mobile `lifeline_history` table implementation exists; current storage is invoice/billhistory based.

### Changes

- `services/invoiceCalculator.js` now recognizes `flagLifeline` and uses the resolved lifeline/senior flags for printable invoice booleans.
- `database/invoiceRepository.js` now maps `senior_citizen_subsidy` from either `senior_subsidy` or `senior_subsid`.
- Added an invoice test for desktop `flagLifeline` compatibility.

### Verification

- `npm run test:invoice` passed with 12/12 tests.
- `npm run typecheck` passed.

## 2026-05-16 - Desktop Net Metering Pending Fix

### Scope

- Reviewed desktop/source logs and the active FUBCS source under:
  - `C:\Users\SAMELCO II\Documents\with collection report_updated - android -no GPS\Source Code (FUBCS)`

### Changes

- Updated `FUBCS BAPA\frmBilling_ManualPosting.vb` so net-metering export credit now uses only the base generation system rate, matching the mobile rule `Rate_GenSysCharge`.
- Tightened previous month credit lookup to select only earlier bill months for the same account, instead of any negative bill month except the current one.
- Kept previous credit negative and defensively normalizes a positive value if one is ever returned.
- Mapped the desktop net-metering post-save update to the live `billhistory_net` output columns:
  - `PresentReadingKWHout`
  - `PreviousReadingKWHout`
  - `DiffOut`
  - `KilowattHourOut`
  - `KilowattUsedOut`
  - `PreviousMonthCredit`
  - `GenSysChargeOut`
  - `GrandTotal`
- Previous credit lookup now reads the latest prior negative `GrandTotal`, falling back to `TotalBill` when `GrandTotal` is zero.

### Verification

- Built `FUBCS BAPA.sln` with Visual Studio 2022 MSBuild.
- Build passed and generated `FUBCS BAPA\bin\Debug\FUBCS BAPA.exe`.
- Existing warnings remain unrelated to this net-metering change:
  - `copy_db_device_to_pc` missing return on all paths.
  - `sql_Route` may be used before assignment.
  - unused local variable `sql_status`.

## 2026-05-15 - Desktop Net Metering Credit Implementation

### Scope

- Implemented the desktop VB side of the net-metering credit rule in:
  - `frmBilling_ManualPosting.vb`
  - `frmBilling_ManualPosting_Net.vb`

### Changes

- Added backup folder in the desktop source:
  - `backup_netmetering_credit_20260515`
- Added desktop rollback/change log:
  - `netmetering_credit_change_log_2026-05-15.md`
- Net-metering desktop manual posting now:
  - bills incoming/import kWh through the existing regular billing computation,
  - subtracts outgoing/export kWh using only the generation system rate,
  - carries the latest prior negative `TotalBill` as previous month credit,
  - preserves negative totals for next-month credit,
  - updates `GrossKilowattHour` and `LessKilowattHour` in `billhistory_net`.
- Added desktop validation so import/export present readings cannot be lower than their previous readings.

### Verification

- Static source verification only.
- No Visual Basic build was run.
- No live MySQL posting test was run.
- Next required check: post one known `master_net` / `billhistory_net` sample and compare the statement of account total.

## 2026-05-15 - Net Metering Credit Billing Implementation

### Scope

- Implemented mobile net-metering billing behavior based on the provided statement-of-account sample.
- Confirmed the target MySQL net-metering tables listed by the user:
  - `billhistory_net`
  - `changemeter_net`
  - `changename_net`
  - `disconnection_net`
  - `reconnection_net`
  - `master_net`
  - `transferarea_net`

### Changes

- Net-metering invoices now bill incoming/import kWh using the regular consumer billing calculation.
- Net-metering `computedKwh`/billhistory reading values now stay on incoming/import kWh; net kWh remains available as a separate net-metering value.
- Outgoing/export kWh is now applied as a negative generation credit instead of reducing all bill components.
- Previous month credit is treated as a negative amount; positive entry values are normalized to negative credit.
- Previous month credit can be entered on the net-metering screen and is saved locally on the `reading` row.
- When no credit is entered, mobile attempts to use the latest prior negative `TotalBill` for the same account as the previous month credit.
- Net-metering printable invoice data now includes import kWh, export kWh, net kWh, outgoing generation credit, previous month credit, and total net-metering credit.

### Verification

- `npm run test:invoice` passed.
- No MySQL migration was applied.
- No live `billhistory_net` sample was imported in this pass.

## 2026-05-15 - Billing Gap TODO Review

### Scope

- Reviewed mobile and desktop references for:
  - net metering
  - bill adjustments
  - late bills
  - non-power bill payments
  - Create Schedule invoice/export flow

### Findings

- Mobile has a basic net-metering calculator and maps import/export kWh to `GrossKilowattHour` and `LessKilowattHour`.
- Desktop billhistory schema already contains late-bill, net-metering, tender/change, OR collection, and report grouping fields.
- Power-bill payment exists in mobile, but non-power bill collection is not implemented yet.
- Create Schedule/export logic is in desktop `modSystem.vb` and should be schema-tested against the mobile `reading` table before live use.
- Potential schedule/export column inconsistencies were noted for follow-up, including `senior_subsid` vs `senior_subsidy` and `Rate_TrueUpy` vs `Rate_TrueUp`.

### Changes

- Added a detailed TODO section to `TODO.md` for the billing fixes and MySQL database verification/additions.

### Verification

- Static source review only.
- No MySQL migration was applied.
- No mobile or desktop build was run.

## 2026-05-15 - Desktop Mobile Transfer Path Implementation

### Scope

- Updated legacy desktop FUBCS upload/download ADB commands under:
  - `C:\Users\SAMELCO II\Documents\with collection report_updated - android -no GPS\Source Code (FUBCS)`

### Changes

- Created backups before editing:
  - `backup_mobile_transfer_20260515_210018`
- Added a desktop-side rollback log:
  - `mobile_transfer_change_log_2026-05-15.md`
- Updated desktop Android transfer commands to target the current mobile package:
  - `com.powerread.mobile`
- Kept the old App Inventor upload/download commands as commented rollback lines in the VB files.
- Updated normal and disconnection upload/download paths:
  - `frmDataTransfer_Upload.vb`
  - `frmDataTransfer_Download.vb`
  - `frmDataTransfer_Upload_Disco.vb`
  - `frmDataTransfer_Download_Disco.vb`
  - `modSystem.vb`

### Verification

- Static source verification only.
- No Visual Basic build was run.
- No ADB transfer test was run in this pass.
- Note: the new commands use `run-as com.powerread.mobile`; if the installed APK does not allow `run-as`, test with a debuggable APK or add an external-storage bridge.

## 2026-05-15 - SAMELCO Logo Asset Update

### Scope

- Used source logo: `C:\Users\SAMELCO II\Pictures\logosamelco icon.png`.
- Updated app branding assets:
  - `assets/icon.png`
  - `assets/adaptive-icon.png`
  - `assets/splash-icon.png`
  - `assets/logosamelco-icon.png`

### Changes

- Generated padded square app icon and adaptive icon assets using the provided SAMELCO lightning logo.
- Generated a splash image asset from the same logo.
- Kept `app.json` unchanged because it already points to the standard Expo asset names.

### Verification

- `npx expo config --type public` passed and confirmed:
  - app icon: `./assets/icon.png`
  - Android adaptive foreground: `./assets/adaptive-icon.png`
  - splash image: `./assets/splash-icon.png`

## 2026-05-15 - Reading Screen Negative KWH Trap

### Scope

- Updated `app/(drawer)/reading/[id].tsx`.
- Added `services/readingValidation.js`.
- Updated `services/invoiceCalculator.js`.
- Updated `tests/invoiceCalculator.test.js`.

### Changes

- Hid the `Present Reading` row from the top `Meter Reading` summary card so the screen no longer shows that highlighted row in the bill summary area.
- Added reusable reading validation for:
  - invalid numeric input
  - present reading lower than previous reading
  - negative computed kWh
  - explicit meter rollover calculation when rollover is intentionally enabled
- The reading screen now shows an inline warning and disables save when the present reading would create negative kWh.
- `computeInvoice` now carries reading validation warnings so `computeAndSaveInvoice` blocks invalid readings before saving billhistory/invoice rows.
- Added tests for wrong lower readings and explicit rollover calculation.

### Verification

- `npm run test:invoice` passed.
- `npm run typecheck` passed.
- `npm run lint` is still blocked by pre-existing lint errors in `apiconnect/cloudflare-worker/src/index.js` for Worker globals such as `URL`, `Response`, `Headers`, `Request`, and `addEventListener`.
- Android debug rebuild was attempted with reduced Gradle memory and workers, but Kotlin/Gradle still crashed on this machine. The earlier error was Windows paging memory; the later retry ended with the Gradle daemon disappearing during native module compilation.

### Notes

- The emulator can keep running, but the installed release APK does not include these latest JavaScript changes until a new APK/dev build is produced.
- To build locally, increase Windows virtual memory/page file or build on a machine with more available RAM.

## 2026-05-15 - SQLite Transfer And API Connect Review

### Scope

- Reviewed the mobile SQLite file manager and sync surface:
  - `src/lib/databaseFiles.ts`
  - `app/(drawer)/sqlite.tsx`
  - `app/(drawer)/sync.tsx`
  - `src/lib/sync.ts`
  - `database/consumerRepository.js`
  - `database/invoiceRepository.js`
- Reviewed local API bridge under `apiconnect/local-api`.
- Reviewed Cloudflare Worker proxy under `apiconnect/cloudflare-worker`.
- Compared the mobile SQLite paths against the legacy desktop upload/download flow in `Source Code (FUBCS)`.

### Current Architecture

- The mobile app uses Expo SQLite with active database path `SQLite/database.db` under app document storage.
- Import candidates are staged under app `Import/`.
- Export/download copies are written under app `Download/`.
- Backups are written under app `Download/Backup/`.
- The app package configured in mobile helper code is `com.powerread.mobile`.
- The legacy desktop app still pushes/pulls `database.db` to the old App Inventor package path.

### Good Progress

- `src/lib/databaseFiles.ts` now has real file operations for:
  - validating a selected SQLite file with `PRAGMA quick_check`
  - staging imports
  - backing up the active database
  - exporting dated database copies
  - creating an ADB-compatible `Download/database.db`
  - importing the newest file from `Import/`
- `app/(drawer)/sqlite.tsx` is no longer only a mock UI; it reads live SQLite tables, file size, modified time, and supports backup/import/export actions.
- `database/invoiceRepository.js` maps computed invoices back into local `billhistory` and `billhistory_arrears`, which fits the legacy desktop download model.
- `database/consumerRepository.js` exposes pending sync counts from tables that include `is_synced`.

### Critical Findings

1. Desktop ADB paths do not match the current React Native package.
   - Desktop legacy path: `/sdcard/Android/data/appinventor.ai_ramcompany10152022.RAM/files/...`
   - Mobile app helper package: `com.powerread.mobile`
   - Risk: upload/download can move the database to the wrong Android app folder.
   - Action: update desktop transfer paths or standardize around the `run-as com.powerread.mobile` commands generated by `getAdbTransferInfo()`.

2. Mobile sync calls an endpoint that does not exist.
   - Mobile call: `POST /api/mobile/sync` in `src/lib/sync.ts`
   - Local API routes mounted: `/api/consumers`, `/api/bills`, `/api/payments`, `/api/reports`
   - Risk: the Sync screen will fail once it attempts real upload/download.
   - Action: add a `mobileRoutes.js` route with `/sync`, or change the mobile app to call existing explicit endpoints.

3. `apiconnect/local-api/controllers/paymentController.js` has a result-shape bug.
   - `db.query()` already returns rows.
   - `postPayment` uses `const [existing] = await db.query(...)`, then treats `existing` like an array.
   - Risk: payment posting can fail or read the bill row incorrectly.
   - Action: use `const existing = await db.query(...)`, then `const bill = existing[0]`.

4. Cloudflare Worker secrets are hard-coded placeholders.
   - `PUBLIC_API_KEY`, `LOCAL_API_BASE_URL`, and `INTERNAL_API_SECRET` are constants in `cloudflare-worker/src/index.js`.
   - Risk: production deploys can accidentally use placeholder values or checked-in secrets.
   - Action: move these to Worker environment variables/secrets.

5. Cloudflare Worker CORS is duplicated and inconsistent.
   - Top-level `ALLOWED_ORIGINS` and `corsHeaders()` each define allowed origins separately.
   - Risk: a valid origin can pass one check and fail another.
   - Action: keep one environment-driven allowlist.

6. The mobile app can mark local rows dirty, but no uploader serializes changed rows yet.
   - `is_synced = 0` is set for readings, payments, complaints, and GPS/disconnection updates.
   - `getLocalSyncQueue()` currently returns an empty array.
   - `runSyncQueue()` sends only module counts, not changed row payloads.
   - Action: implement row-level pending payload extraction per table.

### Recommended Transfer Contract

Use one contract for desktop and mobile:

- Desktop creates SQLite assignment: `C:\FubcsAndroid\Export\database.db`
- Device import target: app private `files/Import/database.db`
- Mobile imports newest `Import/*.db` into active `SQLite/database.db` on launch/import action.
- Mobile exports current `SQLite/database.db` to `files/Download/database.db`.
- Desktop pulls `files/Download/database.db` into `C:\FubcsAndroid\Import\database.db`.
- Desktop validates and applies downloaded rows to MySQL.

### Suggested API Work

- Add `POST /api/mobile/sync`.
- For upload direction, accept rows from:
  - `reading` dirty rows
  - `billhistory` generated rows
  - `billhistory_arrears`
  - `reading_pay`
  - `complaints`
  - disconnection tables when applicable
- Return per-row results so the app can set `is_synced = 1` only for confirmed rows.
- Make all payment/posting writes transactional.
- Add idempotency keys using account number, bill month, entry/code, OR number, and local updated timestamp.

### Verification Performed

- Static source review only.
- No mobile or API code was modified in this pass.
- No database files were opened or changed.

## 2026-05-13 - Project Review

### Project Snapshot

- App: SAMELCO II Mobile / PowerRead Mobile
- Stack: Expo 52, React Native 0.76.5, Expo Router, React Native Paper, Expo SQLite
- Current app version: `1.0.4`
- Current Android version code: `5`
- Main app areas reviewed: authentication, drawer navigation, SQLite manager, online sync, API helper, app configuration, mock data

### Review Commands

- `Get-ChildItem -Force`
- `rg --files`
- `npx tsc --noEmit`
- Targeted source review under `app/`, `src/`, and project config files

### Current Status

- The project appears to be a working Expo mobile prototype with field-operation screens for meter reading, disconnection, payment, complaints, reports, Bluetooth printing, SQLite inspection, and sync.
- Most business workflows currently use mock data or simulated progress rather than persisted live operations.
- The bundled SQLite file is configured through `SQLiteProvider` and inspected on the SQLite manager screen.
- API configuration is present through `EXPO_PUBLIC_API_URL`, but the app only performs a health check at this stage.
- This folder is not currently a git repository.

### Confirmed Build / Environment Issues

- `npx tsc --noEmit` fails. The first class of errors reports missing core `react-native` exports such as `View`, `StyleSheet`, `ScrollView`, `TouchableOpacity`, `FlatList`, `Platform`, and `Text`.
- `rg --files` encountered Windows filesystem errors under `node_modules/react-native`, including `The file or directory is corrupted and unreadable. (os error 1392)`.
- Because the TypeScript failures align with the corrupted `node_modules/react-native` tree, dependency integrity should be fixed before treating each TypeScript import error as an application-code defect.

### Review Findings

1. Demo login credentials are hard-coded and shown to users on login failure.
   - Location: `app/login.tsx`
   - Evidence: `DEMO_USERNAME = 'test'`, `DEMO_PASSWORD = 'test'`, and the failed-login alert prints both values.
   - Risk: Anyone with the app can discover and use the demo account. This is acceptable only for local demos, not field deployment.
   - Recommended next step: Replace demo auth with API-backed or SQLite-backed role validation, and remove credential disclosure from alerts.

2. Android cleartext HTTP traffic is enabled globally.
   - Location: `app.json`
   - Evidence: `"usesCleartextTraffic": true`
   - Risk: Production builds can send traffic over plain HTTP. This is useful for local testing but should not be the default release posture.
   - Recommended next step: Gate this by build profile or remove it for production once the Cloudflare Worker HTTPS endpoint is final.

3. Sync actions simulate success without writing data or calling the API.
   - Location: `app/(drawer)/sync.tsx`
   - Evidence: `handleSyncNow` only advances a timer and then shows `Sync Complete`; module counts come from `MOCK_SYNC_LOGS`.
   - Risk: Operators may believe records have synced when no upload/download happened.
   - Recommended next step: Implement a sync queue table, call real API endpoints, persist per-module sync state, and surface exact failure messages.

4. SQLite import/export/download/upload controls are UI-only.
   - Location: `app/(drawer)/sqlite.tsx`
   - Evidence: database operation tiles call `Alert.alert(action.label, action.desc)`; USB transfer uses simulated progress.
   - Risk: Administrative data-transfer actions appear available but do not move or protect the database file.
   - Recommended next step: Wire import/export to `expo-file-system` / document picker flows, add backup naming, validate database schema, and require confirmation before destructive restores.

5. Live database state and displayed database summary can diverge.
   - Location: `app/(drawer)/sqlite.tsx`, `src/constants/mockData.ts`
   - Evidence: table inspection reads from live `database.db`, while record count, size, sync status, and modified date come from `DB_INFO`.
   - Risk: The SQLite manager may show stale summary data even when the live database content changes.
   - Recommended next step: Calculate record count, file size, and last modified metadata from the actual database/file where possible.

6. API helper has no authentication, retry, timeout, or error-normalization layer.
   - Location: `src/lib/api.ts`
   - Evidence: `apiFetch` sets `Accept: application/json` and forwards `fetch`; no auth token, request timeout, response parsing, or standardized errors are included.
   - Risk: Real sync/auth workflows will duplicate network handling or fail inconsistently under poor field connectivity.
   - Recommended next step: Add a small API client wrapper with timeout, JSON parsing, typed errors, optional bearer token support, and retry rules for idempotent requests.

7. Test and quality scripts are missing.
   - Location: `package.json`
   - Evidence: scripts only include `start`, `android`, `ios`, and `web`.
   - Risk: There is no standard command for type checks, linting, formatting, or tests.
   - Recommended next step: Add at least `typecheck`, then add lint/test tooling once the dependency tree is healthy.

### Development Priorities

1. Repair the local dependency install.
   - Remove and reinstall `node_modules` after checking disk health, then rerun `npm install` and `npx tsc --noEmit`.

2. Add a reliable quality baseline.
   - Add `npm run typecheck`.
   - Add linting after TypeScript passes.
   - Add a minimal smoke test strategy for critical routes.

3. Replace demo-only flows in order of operational risk.
   - Authentication
   - Sync queue and API upload/download
   - SQLite import/export/backup/restore
   - Bluetooth print integration
   - Camera and GPS capture persistence

4. Separate demo data from production data.
   - Keep mock data available for demos, but make production screens read from SQLite/API-backed repositories.

5. Tighten release configuration.
   - Disable cleartext traffic for production.
   - Confirm Android permissions are required at runtime and request them contextually.
   - Add environment-specific build profiles before release packaging.

### Notes For Next Session

- Start by repairing `node_modules/react-native`; current TypeScript output is too noisy to separate real source errors from corrupted dependency typings.
- After dependency repair, rerun `npx tsc --noEmit` and update this log with the remaining real application errors.
- The current APK in `dist/` should be treated as a build artifact, not source of truth.

## 2026-05-13 - Priority Implementation Pass

### Completed

- Checked drive health before dependency repair.
  - `Get-Volume -DriveLetter G` reported `HealthStatus: Warning` and `OperationalStatus: Full Repair Needed`.
  - `wmic diskdrive get model,status` reported the attached drives as `OK`.
- Attempted to remove `node_modules`; Windows blocked removal because corrupted/unreadable files remained.
- Ran `npm install` over the damaged install.
  - Install completed and restored enough of `react-native` for TypeScript to pass.
  - npm still reported cleanup warnings for corrupted/locked temporary folders.
- Attempted `npx expo install --fix`.
  - Expo identified newer SDK-compatible package versions.
  - The install could not complete because the corrupted npm temp folder blocked a `react-native` rename.
  - Version declarations were kept aligned with the currently installed packages until disk repair makes a clean install possible.
- Added quality scripts:
  - `npm run typecheck`
  - `npm run lint`
- Installed and configured Expo ESLint.
- Added `TESTING.md` with a manual smoke-test checklist for critical routes and release checks.
- Reworked login:
  - Removed hard-coded credential disclosure from the failed-login alert.
  - Added `src/lib/auth.ts`.
  - Online mode now posts to `/api/auth/login`.
  - Offline demo login is limited to development builds and can be configured through `.env`.
- Hardened API access:
  - Added request timeout handling.
  - Added `apiJson` for JSON parsing and normalized HTTP errors.
- Reworked sync:
  - Added `src/lib/sync.ts`.
  - Sync now requires `EXPO_PUBLIC_API_URL`.
  - Sync actions post queue metadata to `/api/mobile/sync` instead of always simulating success.
- Improved SQLite manager:
  - Replaced static `DB_INFO` display with live table row totals and file metadata where available.
  - Wired Export/Backup to share the active SQLite database file through `expo-sharing`.
  - Left import/download/upload/restore guarded until file-picker/backend implementation is added.
- Added contextual device permission helpers:
  - `src/lib/devicePermissions.ts`
  - Reading photo actions request camera permission at action time.
  - Map GPS update requests location permission at action time and reads current coordinates.
- Tightened release configuration:
  - `app.json` now defaults Android `usesCleartextTraffic` to `false`.
  - `app.config.js` enables cleartext only when `EXPO_PUBLIC_ALLOW_CLEARTEXT=true` or `APP_ENV=development`.
- Added `eas.json` with development, preview, and production build profiles.
- Cleaned lint warnings in touched and simple-warning files.
- Added Metro ignore rules for damaged npm temp folders such as `node_modules/.react-native-*` and `node_modules/.sucrase-*`.
- Started the Expo dev server at `http://localhost:8081`.

### Verification

- `npm run typecheck` passes.
- `npm run lint` passes with zero warnings.
- `npm ls react react-native expo-sqlite expo-sharing --depth=0` is internally consistent with the installed package versions.
- `npm audit --audit-level=moderate` still reports 8 vulnerabilities from transitive Expo dependencies.
- Expo dev server still warns that several packages should be updated for best SDK compatibility, but package updates are currently blocked by drive/filesystem corruption.

### Remaining Work

- Run Windows disk repair / `chkdsk` on drive `G:` or move the project to a healthy drive, then fully delete and reinstall `node_modules`.
- Implement real backend endpoints:
  - `POST /api/auth/login`
  - `POST /api/mobile/sync`
  - SQLite database download/upload endpoints if those operations remain server-backed.
- Add a document-picker dependency before enabling SQLite import/restore from user-selected files.
- Replace remaining mock consumer/payment/report reads with SQLite/API repositories after the bundled database schema is confirmed.
- Connect Bluetooth printing to an actual React Native Bluetooth printer package and tested device commands.
- Persist captured GPS/photo results to SQLite and include them in the sync queue.

## 2026-05-13 - Documentation Pass

### Completed

- Added `USER_MANUAL.md` with user-facing instructions per module.
- Added `DEVELOPER_GUIDE.md` with:
  - module-to-file edit map,
  - current data source map,
  - recommended production data flow,
  - database analogy,
  - suggested SQLite tables,
  - common modification guide,
  - mock-data-to-repository migration checklist,
  - draft API contract.

### Verification

- `npm run typecheck` passes.
- `npm run lint` passes.

## 2026-05-14 - Mock Data Migration Audit

### Reason

- Some screens now read from the bundled/live SQLite database, but several visible app areas still use mock constants from `src/constants/mockData.ts`.
- Added `TODO.md` to make the remaining SQLite migration work explicit and trackable.

### Current Verification

- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run doctor` passes with 16/16 checks.
- `npm run test:invoice` passes with 7/7 tests.

### Current SQLite-Backed Areas

- `app/(drawer)/search.tsx`
  - Uses `listReadingRecords(db, ...)` from `database/invoiceRepository.js`.
  - Searches the active SQLite `reading` table.
- `database/invoiceRepository.js`
  - Supports reading lookup, invoice computation/save, latest invoice lookup, payment summary, and payment save.
- `app/(drawer)/sqlite.tsx`
  - Reads live SQLite table names, row counts, SQLite version, file size, and modified time.
- Payment/invoice/net-metering flows
  - Have repository-backed paths for saving and loading billing/payment records.

### Mock Data Still Used

- `app/(drawer)/dashboard.tsx`
  - Uses `MOCK_CONSUMERS`, `READING_AREA`, and `REPORT_STATS`.
  - TODO: Replace profile assignment, recent list, filters, and dashboard counts with SQLite repository queries.

- `app/(drawer)/reports.tsx`
  - Uses `READING_AREA` and `REPORT_STATS`.
  - TODO: Build report cards, progress bars, pie chart, collection totals, and schedule info from SQLite.

- `app/(drawer)/disconnection.tsx`
  - Uses `MOCK_CONSUMERS`.
  - TODO: Query overdue/unpaid accounts from SQLite instead of static sample consumers.

- `app/(drawer)/map/[id].tsx`
  - Uses `MOCK_CONSUMERS`.
  - TODO: Load GPS fields from SQLite and persist captured coordinates for sync.

- `app/(drawer)/bill/[id].tsx`
  - Uses `MOCK_CONSUMERS` and `READING_AREA`.
  - TODO: Load bill details from saved invoice/billhistory records.

- `app/(drawer)/receipt/[id].tsx`
  - Uses `MOCK_CONSUMERS`, `MOCK_PAYMENTS`, and `READING_AREA`.
  - TODO: Load receipt/payment details from `reading_pay` and payment summary helpers.

- `app/(drawer)/complaint/[id].tsx`
  - Uses `MOCK_CONSUMERS`.
  - TODO: Load consumer details from SQLite and save complaint reports locally.

- `src/components/layout/DrawerContent.tsx` and `src/components/layout/TopBar.tsx`
  - Use `READING_AREA`.
  - TODO: Replace with collector/session/assignment data from login context or SQLite assignment metadata.

- `src/lib/sync.ts`
  - Uses `MOCK_SYNC_LOGS`.
  - TODO: Count actual unsynced rows and post real local changes to the API.

- `app/(drawer)/bluetooth.tsx`
  - Uses `MOCK_DEVICES`.
  - TODO: Replace with native Bluetooth printer discovery and connection state.

### Added TODO Tracking

- Created `TODO.md` with:
  - current SQLite-backed areas,
  - screen-by-screen mock usage,
  - repository functions needed,
  - suggested migration order,
  - acceptance checklist for removing production mock data.

### Next Development Priorities

1. Add a SQLite consumer/report repository layer.
   - `getDashboardSummary(db)`
   - `listRecentConsumers(db, filters)`
   - `getConsumerById(db, id)`
   - `getReadingAssignment(db)`
   - `getReadingStats(db)`
   - `getCollectionStats(db)`
   - `getDisconnectionCandidates(db)`

2. Migrate mock-heavy screens in this order:
   - Dashboard
   - Reports
   - Disconnection
   - Map
   - Bill
   - Receipt
   - Complaint
   - Drawer/topbar assignment labels

3. Replace sync mock counts.
   - Read `is_synced = 0` rows from local tables.
   - Upload real payloads.
   - Store last sync status and failure messages.

4. Keep `src/constants/mockData.ts` only for demo/test fallback.
   - Production screens should not import mock constants directly.

## 2026-05-14 - SQLite Mock Data Migration Implementation

### Completed

- Added `database/consumerRepository.js`.
  - Normalizes SQLite `reading` rows into the app's consumer shape.
  - Adds dashboard/report/disconnection summary helpers.
  - Adds current assignment helper using `reading` and `collectors` where available.
  - Adds GPS persistence through `app_gps_lat`, `app_gps_lng`, `is_synced`, and `updated_at`.
  - Adds local `complaints` table creation and `saveComplaintReport`.
  - Adds sync summary counts for local tables that expose `is_synced`.

- Removed production screen dependencies on `src/constants/mockData.ts`.
  - `app/(drawer)/dashboard.tsx` now reads consumers, assignment labels, and report stats from SQLite.
  - `app/(drawer)/reports.tsx` now reads schedule metadata, status counts, and collection totals from SQLite.
  - `app/(drawer)/disconnection.tsx` now reads disconnection candidates from SQLite.
  - `app/(drawer)/map/[id].tsx` now loads consumers from SQLite and saves captured GPS coordinates.
  - `app/(drawer)/bill/[id].tsx` now loads consumer and latest invoice/billhistory data from SQLite.
  - `app/(drawer)/receipt/[id].tsx` now loads payment data through `getPaymentSummary`.
  - `app/(drawer)/complaint/[id].tsx` now loads consumer details from SQLite and saves complaints locally.
  - `app/(drawer)/reading/[id].tsx` no longer falls back to `MOCK_CONSUMERS`.
  - `app/(drawer)/payment/[id].tsx` no longer uses `READING_AREA` for collector name.
  - `src/components/layout/DrawerContent.tsx` and `src/components/layout/TopBar.tsx` now read assignment labels from SQLite.
  - `app/(drawer)/sync.tsx` now displays sync counts from local SQLite tables instead of `MOCK_SYNC_LOGS`.

- Updated Bluetooth screen.
  - Removed fake static printer devices from the UI.
  - Screen now clearly indicates that native Bluetooth discovery/transport still needs to be installed and wired.

- Updated `TODO.md`.
  - Marked SQLite migration work completed.
  - Left remaining production work around confirmed schema, real sync payloads, Bluetooth native transport, and photo persistence.

### Verification

- `npm run typecheck` passes.
- `npm run lint` passes with zero warnings.
- `npm run test:invoice` passes with 7/7 tests.
- `npm run doctor` passes with 16/16 checks.
- `rg` confirms no production app screen imports `src/constants/mockData.ts`; the mock constants remain only in `src/constants/mockData.ts`.

### Important Notes

- The bundled `assets/database/database.db` available in this workspace currently exposes only an empty `RATES` table during local inspection.
- The new repository layer is intentionally defensive so the app does not crash when optional production tables/columns are missing.
- Once the real field SQLite database is supplied, tighten the summary/report/disconnection queries around confirmed schema and indexes.

## 2026-05-14 - Reading Mode, Protected Readings, and Printer Profiles

### Completed

- Added lightweight session mode handling.
  - New file: `src/lib/session.ts`.
  - Login now stores the selected reading mode before routing to the dashboard.
  - Dashboard title and main action now respond to the selected mode.

- Updated dashboard behavior by login mode.
  - Reading mode keeps normal reading/search flow.
  - Net metering mode opens the net metering reading flow from recent rows.
  - Disconnection mode loads disconnection candidates and points the floating action button to the disconnection workflow.
  - In disconnection mode, recent rows go to payment/collection, while the dedicated disconnection list still owns the disconnect confirmation action.

- Protected previous reading visibility in field-facing screens.
  - Previous reading remains available internally for invoice computation from the SQLite `reading` table.
  - Removed previous reading display from:
    - `app/(drawer)/reading/[id].tsx`
    - `src/components/common/ConsumerCard.tsx`
    - `screens/InvoicePreviewScreen.js`
    - `app/(drawer)/bill/[id].tsx`
    - `app/(drawer)/receipt/[id].tsx`
  - Updated invalid reading messaging so it does not reveal the protected previous reading value.
  - Print text now omits previous reading by default; it can still be included only by passing `showPreviousReading: true`.

- Expanded printer profile support.
  - `PrinterType` now supports `woosim`, `generic_escpos`, and `other`.
  - Settings now includes `Generic ESC/POS Thermal`.
  - `services/printerService.js` now builds transport payloads for:
    - Woosim text mode
    - Generic ESC/POS text mode
    - Plain text fallback
  - Bluetooth screen copy now states that Woosim and generic ESC/POS payloads are ready, while native Bluetooth discovery/transport still needs to be wired.

### Verification

- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run test:invoice` passes with 7/7 tests.

### Remaining Work

- Wire a native Bluetooth transport package so Woosim and generic ESC/POS payloads can be sent to real paired printers.
- Persist printer type and paired device selection instead of keeping settings as screen-local state.
- If supervisors need audit printouts that include previous reading, call print helpers with `showPreviousReading: true` only from an authorized/admin path.

## 2026-05-14 - Actual Thermal Invoice Print Source Mapping

### Context

- Actual printed SAMELCO invoice samples were provided.
- Print rules:
  - rate values must come from the active `reading` row,
  - peso amount values for a newly saved reading must come from `billhistory`,
  - arrears/payment details must come from `billhistory_arrears`,
  - arrears fallback/filter details can also come from the reading breakdown field containing bill month and amount pairs.

### Completed

- Added `getPrintableInvoiceForReading(db, id)` in `database/invoiceRepository.js`.
  - Loads `reading`, latest matching `billhistory`, `billhistory_arrears`, payment row, and parsed reading breakdown together for printing.
  - Keeps existing invoice shape while attaching `printSources` for print-only table source control.
- Updated bill screen to use the print-specific invoice loader.
- Updated `services/printerService.js`.
  - Added actual invoice print formatter matching the provided thermal receipt structure.
  - Generation/transmission, distribution, others, government revenues, and universal charges now print with:
    - rate column from `reading`,
    - amount column from `billhistory`.
  - Previous unpaid bills now print from `billhistory_arrears`, with reading breakdown as fallback.
  - Footer includes total bill, VAT sales summary, due/disconnection dates, and payment/disconnection notice.
- Updated payment receipt printing to include arrears paid rows from `billhistory_arrears`.

### Verification

- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run test:invoice` passes with 7/7 tests.

### Notes

- Some production database column labels may still need exact mapping if the live SQLite uses names different from the current desktop/mobile mappings.
- APK was not rebuilt after this print-format-only change.

## 2026-05-14 - Native Bluetooth Thermal Printing

### Context

- Woosim and generic ESC/POS payloads were prepared, but the app still needed the native Bluetooth Classic transport to discover, connect, and write to real paired thermal printers.

### Completed

- Installed `react-native-bluetooth-classic`.
- Added `src/lib/bluetoothPrinter.ts`.
  - Requests runtime Android Bluetooth permissions.
  - Prompts to enable Bluetooth when disabled.
  - Lists paired/bonded Bluetooth printers.
  - Connects to a selected or saved printer.
  - Sends Woosim/generic ESC/POS payload text over Bluetooth Classic.
- Updated Bluetooth screen.
  - Scans paired Android Bluetooth devices.
  - Connects to a selected printer.
  - Saves successful connection details to SQLite `config`.
  - Sends a real Bluetooth test print.
- Updated Settings test print to use the saved printer from `config`.
- Updated bill and receipt print actions to send payloads to the saved Bluetooth printer.
- Built a fresh release APK:
  - `dist/SAMELCO-II-Mobile-1.0.8-bluetooth.apk`

### Verification

- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run test:invoice` passes with 7/7 tests.
- `android/gradlew assembleRelease` passes.

### Notes

- Printers must be paired in Android Bluetooth settings first, then selected inside the app.
- Release APK is still signed with the current project release config; confirm production signing before store or field-wide deployment.

## 2026-05-14 - Config-Backed OR and Printer State

### Context

- The production SQLite `config` table stores successful Bluetooth printer connection data.
- The OR number entered during login should also be saved there so payment collection can recover it even when the in-memory session is empty.

### Completed

- Added `database/configRepository.js`.
  - Supports existing `config` table layouts defensively:
    - key/value style tables,
    - single-row config tables with named columns,
    - app-added fallback columns when a specific setting column is missing.
  - Reads/writes login OR number.
  - Reads/writes Bluetooth printer id, name, address, printer type, and connected flag.
- Updated `app/login.tsx` to save successful login OR number into `config`.
- Updated `app/(drawer)/payment/[id].tsx` to recover the saved OR number from `config` if the active session has no OR value.
- Updated `app/(drawer)/bluetooth.tsx` to show the saved printer from `config` and persist connect/disconnect state when a device is selected.
- Updated `app/(drawer)/settings.tsx` to load and save the printer type from `config`.
- Updated bill and receipt print actions to read saved printer data from `config` before preparing Woosim or generic ESC/POS print payloads.

### Verification

- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run test:invoice` passes with 7/7 tests.

### Notes

- Native Bluetooth discovery/transport is still not installed in this project, so print actions now prepare the correct printer payload using saved config data but still need the native Bluetooth layer to physically send bytes to the paired printer.

## 2026-05-14 - Login OR and Active Collector Session Fix

### Context

- Login must require an Official Receipt number before the field user can enter the app.
- Dashboard and drawer were sometimes showing the wrong collector name because assignment labels were loaded from the first collector row in SQLite instead of the authenticated login session.

### Completed

- Added required OR number input to `app/login.tsx`.
  - Login now rejects empty username, password, or OR number.
  - Successful login stores reading mode, display name, username, and OR number in the active session.
- Extended `src/lib/session.ts` with active collector/session helpers.
  - `setActiveSession(...)`
  - `getActiveCollectorName()`
  - `getActiveUsername()`
  - `getActiveOrNumber()`
- Updated offline/online auth result data in `src/lib/auth.ts`.
  - Offline collector login now returns the matched collector username/id and full name.
  - Online and demo login also return the active username.
- Updated session-sensitive screens to use the logged-in collector instead of the first SQLite collector:
  - `app/(drawer)/dashboard.tsx`
  - `src/components/layout/DrawerContent.tsx`
  - `app/(drawer)/payment/[id].tsx`
  - `app/(drawer)/receipt/[id].tsx`
- Payment collection now pre-fills the OR number from login while still letting the field user edit it before saving.

### Verification

- `npm run typecheck` passes.
- `npm run test:invoice` passes with 7/7 tests.
- `npm run lint` passes.

## 2026-05-14 - Desktop Billing Logic Port

### Context

- Desktop Visual Basic `amount_rate_kwh`, `amount_rate_kwh_evat`, `sum_total_amt`, and `sum_total_bill` logic was provided as the billing source of truth.
- Requirement confirmed: mobile invoice creation should use the rates already stored in the SQLite `reading` table; field users only enter present reading.

### Completed

- Updated `services/invoiceCalculator.js` to use a desktop-style billing breakdown.
  - Keeps previous reading internal through `Reading_KWH_Prev`.
  - Computes kWh from present reading and multiplier.
  - Computes generation, system loss, transmission, distribution, universal, OCC/arrears, and VAT subtotals from rate columns on the `reading` row.
  - Adds desktop-style RPPD behavior:
    - residential/BAPA multiply by kWh,
    - other rate codes treat RPPD as fixed.
  - Adds demand-charge hook for `H` and `V` rate codes using demand fields when present.
  - Adds desktop-style lifeline handling:
    - lifeline accounts under or equal 50 kWh receive the full lifeline adjustment,
    - above 50 kWh uses per-kWh lifeline amount,
    - non-lifeline residential accounts carry the per-kWh lifeline amount as in the desktop routine.
  - Adds desktop-style senior discount handling:
    - residential senior accounts up to 100 kWh get 5 percent of eligible charge groups,
    - lifeline senior cases follow the desktop offset rule,
    - BAPA senior amount can come from BAPA senior fields.
  - Adds VAT category formulas for generation, system loss, transmission, distribution, and other VAT.

- Updated `tests/invoiceCalculator.test.js`.
  - Test expectations now pin the desktop billing behavior instead of the older simplified calculator rules.
  - Net metering test still passes with the updated billing core.

### Verification

- `npm run test:invoice` passes with 7/7 tests.
- `npm run typecheck` passes.
- `npm run lint` passes.

### Notes

- Some desktop branches depend on values that must exist in the `reading` table, such as demand kWh for high-voltage rate classes and BAPA-specific senior/lifeline fields.
- If those field names differ in the production SQLite database, map them in `services/invoiceCalculator.js` once the real schema is confirmed.
