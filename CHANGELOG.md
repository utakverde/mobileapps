# Changelog

## 2026-05-21

- Linked the mobile app to the local API at `http://10.0.2.2:3000` for Android emulator development.
- Added local API `.env` defaults and enabled Android local HTTP support.
- Added `POST /api/mobile/sync` to satisfy the mobile Sync screen.
- Fixed local API payment posting row handling.
- Fixed Online login wiring by adding `POST /api/auth/login` to the local API.
- Mobile API requests can now include `EXPO_PUBLIC_API_KEY` for the Cloudflare Worker gateway.
- Added local-test support for `EXPO_PUBLIC_INTERNAL_API_SECRET`.
- Documented remaining Online login production checks in `TODO.md` and `DEVELOPMENT_LOGS.md`.
