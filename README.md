# SAMELCO II Mobile

Expo/React Native Android application for field meter reading, billing,
collection, receipt printing, synchronization, and related utility workflows.

## Requirements

- Node.js and npm
- Android Studio with Android SDK
- JDK 17 or newer for Android Gradle builds

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and provide the environment-specific values.
3. Provision `assets/database/database.db` from an approved, protected source.
4. Run `npm start` or `npm run android`.

## Checks

- `npm run typecheck`
- `npm run lint`
- `npm run test:invoice`
- `npm run doctor`

## Sensitive local data

The repository intentionally excludes `.env`, signing keys, operational
exports, and `assets/database/database.db`. The database schema is documented in
`assets/database/database.schema.sql`; do not commit production customer data or
collector credentials.

The `other apps` directory in the local workspace contains separate projects
and is not part of this repository.
