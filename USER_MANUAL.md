# SAMELCO II Mobile User Manual

This manual explains each app module from an operator point of view. The app is built for field work: meter reading, payment reference, complaints, GPS capture, SQLite offline use, and online synchronization.

## Login

Purpose: Enter the field operations workspace.

How to use:

1. Open the app and wait for the splash screen to finish.
2. Select Reading Mode or Disconnection.
3. Enter username and password.
4. Optional: enter Official Receipt No.
5. Choose Offline or Online mode.
6. Tap Login.

Notes:

- Offline mode is intended for field work when internet is unavailable.
- Online mode requires the API server URL to be configured by the developer/admin.
- Demo credentials are only intended for development builds.

## Dashboard

Purpose: View the current reading area and quickly open assigned consumer records.

What you can see:

- Area, book number, bill month, and reader information.
- Reading progress and summary counters.
- Consumer list with account status.
- Quick actions for profile photo, gallery, camera, search, and record opening.

Typical workflow:

1. Open Dashboard after login.
2. Review reading progress.
3. Select a consumer record.
4. Continue to Reading, Payment, Map, Receipt, or Complaint screens as needed.

## Search

Purpose: Find a consumer by account number, name, meter number, or address.

How to use:

1. Open Search from the drawer.
2. Type at least two characters.
3. Select the matching consumer card.
4. Open the needed action from the consumer record.

## Meter Reading

Purpose: Record the present meter reading and calculate estimated consumption.

How to use:

1. Open a consumer reading record.
2. Review consumer, meter, GPS, and billing details.
3. Enter the present kWh reading.
4. Review calculated kWh used and estimated bill.
5. Add remarks when needed.
6. Capture meter or house photo if required.
7. Tap Save Reading.

Validation:

- Present reading must not be lower than the previous reading.
- Camera permission is requested when photo capture is triggered.

## Payment

Purpose: Record or preview consumer payment information.

How to use:

1. Open Payment from a consumer record.
2. Enter OR number.
3. Enter amount paid.
4. Select payment method: Cash, Check, GCash, Maya, or Others.
5. Review change or balance warning.
6. Save payment.

Notes:

- Current payment data is still prototype/local logic.
- Production payment save should write to SQLite and queue sync.

## Bill Preview

Purpose: Preview a printable consumer bill.

How to use:

1. Open Bill from a consumer record.
2. Review consumer information, readings, amount due, penalty, and due date.
3. Tap Print Bill when a printer is connected.

## Receipt Preview

Purpose: Preview a printable payment receipt.

How to use:

1. Open Receipt from a paid consumer or after payment.
2. Review OR number, amount, change, bill month, and collector details.
3. Print or reprint as needed.

## GPS Map

Purpose: View or capture consumer GPS coordinates.

How to use:

1. Open Map from a consumer record.
2. If GPS exists, review coordinates and tap Navigate to open map directions.
3. Tap Update GPS to capture the phone's current location.
4. Tap Capture to request camera permission for location/photo evidence.

Notes:

- Location permission is requested only when GPS capture is triggered.
- Current map display is a placeholder until a map package is integrated.

## Complaint / Field Report

Purpose: Create a field issue report for a consumer or new incident.

Report types:

- Dead meter
- Rotten pole
- Leaning pole
- Illegal connection
- Wrong serial
- Low clearance
- Update GPS
- Not registered
- Others

How to use:

1. Open Complaint from a consumer record or drawer.
2. Select report type.
3. Enter remarks.
4. Add photo or GPS evidence when available.
5. Save or queue the report for upload.

## Reports

Purpose: View operational summaries.

Available summaries:

- Total records
- Read records
- Unread records
- Paid records
- Disconnected records
- Problem reports
- Collection totals
- Amount due

Use this screen to review daily/monthly field progress.

## Disconnection

Purpose: Manage consumers marked for disconnection or with overdue penalties.

How to use:

1. Open Disconnection from the drawer.
2. Review listed consumers.
3. Select a consumer to view details.
4. Confirm disconnection action when appropriate.

Notes:

- Production use should write the action to SQLite and queue it for sync.

## Bluetooth Printer

Purpose: Pair/select a Bluetooth printer and send print jobs.

How to use:

1. Open Bluetooth Printer.
2. Scan/select a printer.
3. Connect to the printer.
4. Use print actions for bill, receipt, or disconnection notice.

Notes:

- Current printer devices/actions are prototype placeholders.
- Real printing requires a native Bluetooth printer library and tested printer command templates.

## SQLite Database Manager

Purpose: Inspect and export the local offline database.

What you can see:

- SQLite engine version.
- Sampled table list.
- Row counts by table.
- Active database file size.
- Last modified metadata when available.

Operations:

- Export SQLite: shares the active app database file.
- Backup Database: shares a copy of the active database file.
- Import, restore, download, upload, and compression are guarded until the file-picker/backend implementation is added.

## Online Sync

Purpose: Upload/download queued local changes when the API server is available.

How to use:

1. Configure API URL before using online sync.
2. Open Online Sync.
3. Tap Test API connection.
4. Tap Sync Now, Retry Failed, Force Upload, or Force Download.

Notes:

- Sync requires `EXPO_PUBLIC_API_URL`.
- Sync posts queue metadata to the server endpoint and shows real errors instead of silent success.

## Settings

Purpose: Configure app behavior.

Common settings:

- Print setting
- Record view
- Sort order
- Printer type
- Show/hide report, pay, and print buttons
- Auto-next record
- GPS, camera, auto-sync, offline, and online toggles
- Server URL
- Developer mode

## Logout

Purpose: End the active app session.

How to use:

1. Open the drawer.
2. Tap Logout.
3. The app returns to Login.
