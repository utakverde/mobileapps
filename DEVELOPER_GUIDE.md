# SAMELCO II Mobile Developer Guide

This guide maps each app module to the files a developer should edit, explains where data currently comes from, and gives a simple database analogy for moving from prototype data to production SQLite/API data.

## Project Map

- App routes: `app/`
- Shared UI components: `src/components/`
- Shared constants and mock data: `src/constants/`
- API/auth/sync/permission services: `src/lib/`
- Bundled SQLite asset: `assets/database/database.db`
- Root provider setup: `app/_layout.tsx`
- Drawer route setup: `app/(drawer)/_layout.tsx`
- Drawer menu items: `src/components/layout/DrawerContent.tsx`
- Theme/colors: `src/constants/theme.ts`, `src/constants/colors.ts`

## Quality Commands

- TypeScript: `npm run typecheck`
- Lint: `npm run lint`
- Dev server: `npm start`

Current note: the `G:` drive has reported filesystem repair warnings. If npm or Metro behaves strangely, repair the drive or move the project to a healthy disk before debugging app code.

## Module Editing Guide

| Module | User Screen | Main Files To Edit | Data/Service Files |
| --- | --- | --- | --- |
| Splash | Loading screen | `app/splash.tsx` | `app/index.tsx` |
| Login/Auth | Login screen | `app/login.tsx` | `src/lib/auth.ts`, `src/lib/api.ts`, `.env.example` |
| Drawer/Menu | Navigation drawer | `app/(drawer)/_layout.tsx`, `src/components/layout/DrawerContent.tsx` | `src/constants/mockData.ts` for displayed reader/area |
| Dashboard | Main field dashboard | `app/(drawer)/dashboard.tsx` | `src/constants/mockData.ts`, `src/components/common/ConsumerCard.tsx` |
| Search | Consumer search | `app/(drawer)/search.tsx` | `src/constants/mockData.ts`, future consumer repository |
| Reading | Meter reading form | `app/(drawer)/reading/[id].tsx` | `src/constants/mockData.ts`, `src/lib/devicePermissions.ts` |
| Payment | Payment form | `app/(drawer)/payment/[id].tsx` | `src/constants/types.ts`, future payment repository |
| Bill | Bill preview | `app/(drawer)/bill/[id].tsx` | `src/constants/mockData.ts` |
| Receipt | Receipt preview | `app/(drawer)/receipt/[id].tsx` | `src/constants/mockData.ts` |
| Map/GPS | GPS view/capture | `app/(drawer)/map/[id].tsx` | `src/lib/devicePermissions.ts`, future GPS repository |
| Complaint | Field report | `app/(drawer)/complaint/[id].tsx` | `src/constants/types.ts`, future complaint repository |
| Reports | Summary reports | `app/(drawer)/reports.tsx` | `src/constants/mockData.ts`, future SQL aggregate queries |
| Disconnection | Disconnection list/action | `app/(drawer)/disconnection.tsx` | future disconnection repository |
| Bluetooth | Printer management | `app/(drawer)/bluetooth.tsx` | future Bluetooth printer service |
| SQLite | Database manager | `app/(drawer)/sqlite.tsx` | `expo-sqlite`, `expo-file-system`, `expo-sharing` |
| Sync | Online sync | `app/(drawer)/sync.tsx` | `src/lib/sync.ts`, `src/lib/api.ts` |
| Settings | App preferences | `app/(drawer)/settings.tsx` | `src/constants/types.ts`, future settings storage |

## Data Flow Today

Current prototype data comes from:

- `MOCK_CONSUMERS`
- `MOCK_PAYMENTS`
- `MOCK_SYNC_LOGS`
- `MOCK_COMPLAINTS`
- `REPORT_STATS`
- `READING_AREA`

These are all in `src/constants/mockData.ts`.

Type definitions live in `src/constants/types.ts`. If you add a new field to a consumer, payment, complaint, sync item, or setting, update the type first, then update mock data and screens.

## Recommended Production Data Flow

Use this direction when replacing mock data:

1. Screen calls a repository function.
2. Repository reads/writes SQLite first.
3. Repository creates a sync queue entry for changes.
4. Sync service uploads queued changes to the API.
5. API confirms success.
6. App marks local queue entries as synced.

Suggested future files:

- `src/lib/database.ts`: opens DB and runs migrations.
- `src/repositories/consumers.ts`: list/search/get/update consumer records.
- `src/repositories/readings.ts`: save reading, remarks, photos.
- `src/repositories/payments.ts`: save payment and OR number.
- `src/repositories/complaints.ts`: save field reports.
- `src/repositories/syncQueue.ts`: enqueue, retry, mark synced/failed.
- `src/repositories/settings.ts`: persist app settings.

## Database Analogy

Think of the mobile app like a field notebook with a dispatch desk.

- Consumers table: the master list of pages in the notebook.
- Readings table: new meter readings written by the field reader.
- Payments table: OR/payment entries written by the collector.
- Complaints table: issue reports attached to a consumer.
- Photos table: photo evidence attached to readings, GPS, or complaints.
- GPS table: meter/location updates.
- Sync queue table: sticky notes telling the app what still needs to be sent to the server.
- Settings table: the reader's local preferences.

The SQLite database is the notebook. The API server is the main office. Sync is the courier carrying new sticky notes from the notebook to the office and bringing back approved updates.

## Suggested SQLite Tables

Use actual existing database table names if `assets/database/database.db` already has a legacy schema. If creating or migrating schema, these names are a clean target:

```sql
consumers (
  id TEXT PRIMARY KEY,
  account_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  serial_number TEXT,
  sequence_number INTEGER,
  meter_number TEXT,
  rate_code TEXT,
  pole_number TEXT,
  transformer TEXT,
  previous_reading REAL NOT NULL DEFAULT 0,
  current_reading REAL,
  multiplier REAL NOT NULL DEFAULT 1,
  kwh_used REAL,
  bill_amount REAL NOT NULL DEFAULT 0,
  penalty REAL NOT NULL DEFAULT 0,
  total_due REAL NOT NULL DEFAULT 0,
  due_date TEXT,
  disconnection_date TEXT,
  status TEXT NOT NULL,
  gps_lat REAL,
  gps_lng REAL,
  remarks TEXT,
  book_number TEXT,
  area_code TEXT,
  bill_month TEXT,
  meter_photo TEXT,
  house_photo TEXT,
  updated_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

readings (
  id TEXT PRIMARY KEY,
  consumer_id TEXT NOT NULL,
  account_number TEXT NOT NULL,
  previous_reading REAL NOT NULL,
  present_reading REAL NOT NULL,
  multiplier REAL NOT NULL,
  kwh_used REAL NOT NULL,
  estimated_bill REAL,
  remarks TEXT,
  meter_photo TEXT,
  house_photo TEXT,
  created_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

payments (
  id TEXT PRIMARY KEY,
  consumer_id TEXT NOT NULL,
  account_number TEXT NOT NULL,
  or_number TEXT NOT NULL,
  bill_month TEXT,
  amount_paid REAL NOT NULL,
  total_due REAL NOT NULL,
  change_amount REAL NOT NULL,
  payment_method TEXT NOT NULL,
  payment_date TEXT NOT NULL,
  collector_name TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

complaints (
  id TEXT PRIMARY KEY,
  consumer_id TEXT,
  account_number TEXT,
  report_type TEXT NOT NULL,
  remarks TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  gps_lat REAL,
  gps_lng REAL,
  photo_uri TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

sync_queue (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## Which Part To Edit For Common Changes

Add a new drawer item:

1. Add the route screen under `app/(drawer)/`.
2. Register it in `app/(drawer)/_layout.tsx`.
3. Add menu item in `src/components/layout/DrawerContent.tsx`.

Change colors or branding:

1. Edit `src/constants/colors.ts`.
2. Edit `src/constants/theme.ts`.
3. Check splash/login/drawer styles.

Change login behavior:

1. Edit UI in `app/login.tsx`.
2. Edit credential logic in `src/lib/auth.ts`.
3. Edit API request behavior in `src/lib/api.ts`.
4. Update `.env.example` if new environment variables are required.

Change API endpoint paths:

1. Login endpoint: `src/lib/auth.ts`.
2. Sync endpoint: `src/lib/sync.ts`.
3. Shared base URL and timeout: `src/lib/api.ts`.

Change consumer fields:

1. Update `Consumer` in `src/constants/types.ts`.
2. Update `MOCK_CONSUMERS` in `src/constants/mockData.ts`.
3. Update screens that display the field.
4. Update SQLite schema/migrations and repositories when production DB code exists.

Change reading calculation:

1. Edit `RATE_PER_KWH` and calculation logic in `app/(drawer)/reading/[id].tsx`.
2. Later, move rate logic to a billing/rates repository if rates vary by rate code.

Change report types:

1. Update `ReportType` in `src/constants/types.ts`.
2. Update `REPORT_TYPES` in `app/(drawer)/complaint/[id].tsx`.

Change payment methods:

1. Update `PaymentMethod` in `src/constants/types.ts`.
2. Update `PAYMENT_METHODS` in `app/(drawer)/payment/[id].tsx`.

Change sync behavior:

1. Edit user screen in `app/(drawer)/sync.tsx`.
2. Edit sync request logic in `src/lib/sync.ts`.
3. Edit API error/timeout behavior in `src/lib/api.ts`.
4. Add repository queue functions when moving beyond mock sync logs.

Change SQLite export/import:

1. Edit `app/(drawer)/sqlite.tsx`.
2. Use `expo-file-system` for paths and copies.
3. Use `expo-sharing` for export/share.
4. Add a document-picker package before enabling import/restore.

Change permissions:

1. Edit shared helpers in `src/lib/devicePermissions.ts`.
2. Call helpers from feature screens only when the user triggers that feature.
3. Keep Android/iOS permission config in `app.json` and `app.config.js`.

## Mock Data To Repository Migration Checklist

Use this when converting one module from prototype to production:

1. Create a repository file for the module.
2. Move the screen's `MOCK_*` lookup into repository calls.
3. Add loading and error states to the screen.
4. Write changes to SQLite.
5. Add a `sync_queue` entry for every local mutation.
6. Update `src/lib/sync.ts` to upload that queue item.
7. Keep mock data only for demo or fallback mode.

## API Contract Draft

Suggested endpoints:

- `GET /health`
- `POST /api/auth/login`
- `GET /api/mobile/bootstrap?areaCode=A01&bookNumber=03&billMonth=2026-05`
- `POST /api/mobile/sync`
- `POST /api/mobile/photos`
- `GET /api/mobile/database/download`
- `POST /api/mobile/database/upload`

Suggested `POST /api/mobile/sync` payload:

```json
{
  "direction": "sync",
  "modules": [
    {
      "module": "Readings",
      "pendingCount": 3,
      "failedCount": 0,
      "lastSync": "May 10, 2026 08:45 AM"
    }
  ]
}
```

Suggested response:

```json
[
  {
    "module": "Readings",
    "pendingCount": 0,
    "syncedCount": 3,
    "failedCount": 0,
    "lastSync": "2026-05-13T04:30:00.000Z",
    "status": "synced"
  }
]
```

## Release Configuration

- Default Android cleartext traffic is `false` in `app.json`.
- `app.config.js` enables cleartext only when `EXPO_PUBLIC_ALLOW_CLEARTEXT=true` or `APP_ENV=development`.
- Build profiles are in `eas.json`.
- Environment examples are in `.env.example`.

## Documentation Files

- `USER_MANUAL.md`: operator/user manual by module.
- `DEVELOPER_GUIDE.md`: developer modification map and database analogy.
- `TESTING.md`: smoke test checklist.
- `DEVELOPMENT_LOGS.md`: project history and review notes.
