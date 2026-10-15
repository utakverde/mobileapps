# Testing

## Quality Commands

- `npm run typecheck`
- `npm run lint`

## Manual Smoke Test

Run this pass before handing an APK to field users:

1. Launch the app and confirm the splash screen routes to login.
2. Offline login: use configured development credentials only in dev builds, then confirm the dashboard opens.
3. Online login: set `EXPO_PUBLIC_API_URL`, choose Online, and confirm failed credentials do not disclose demo values.
4. Open these drawer routes: Dashboard, Search, Reports, SQLite Manager, Online Sync, Settings, Bluetooth, Disconnection.
5. Open a consumer from Search and verify Reading, Payment, Bill, Receipt, Complaint, and Map routes render.
6. SQLite Manager: confirm live SQLite version/table counts load and Export SQLite opens the platform share sheet.
7. Sync: with no API URL, confirm sync is blocked and records remain queued; with API URL, confirm server errors are shown.
8. Permissions: trigger GPS capture and photo capture, then confirm Android permission prompts appear only at action time.
9. Release config: verify production builds keep `usesCleartextTraffic` false unless explicitly overridden for development.
