# Safe APK Export

## Objective

Produce an installable internal Android APK without embedding customer records,
collector passwords, environment secrets, or signing credentials.

## Current behavior

The Expo/React Native application bundles `assets/database/database.db` into the
APK. The Android release variant is configured with the debug signing key, so a
production release artifact is outside this task's scope.

## Desired behavior

Create a debug APK that uses a schema-compatible database containing no rows,
verify the packaged artifact, and restore the local database byte-for-byte after
the build.

## Scope

Included: pre-build checks, temporary database sanitization, debug assembly,
APK inspection, checksum, and optional emulator installation when available.

Excluded: Play Store signing, production credentials, production database data,
API deployment, schema migrations, and application feature changes.

## Architecture and ownership

- Primary agent: build orchestration, temporary data handling, and integration.
- Android planner/analyzer: independent build and safety review.
- Android tester: APK and available runtime verification.
- Security and release reviewers: final artifact risk review.

## Interfaces and contracts

The temporary database keeps the existing SQLite schema while deleting all table
rows. No API, data-model, synchronization, or persisted-schema contract changes
are introduced.

## Implementation sequence

1. Record the source database checksum and create a private temporary backup.
2. Create a sanitized database copy and confirm every user table is empty.
3. Temporarily place the sanitized copy at the asset path.
4. Run TypeScript, lint, unit, Gradle build, and APK inspection checks.
5. Restore the original database in a `finally` step and verify its checksum.
6. Copy the verified APK to a clearly named output path.

## Risks

- A failed restoration could disrupt the local development database; checksum
  verification and an independent temporary backup mitigate this.
- A debug-signed APK is suitable only for internal testing.
- An empty database may limit functional testing until approved data is imported.

## Testing

Run typecheck, lint, invoice tests, Gradle debug assembly/lint/unit tests where
the environment permits, inspect the APK contents, check signing metadata and
hash the final artifact. Device-only lifecycle, permissions, Bluetooth, camera,
GPS, offline, and accessibility checks are reported as blocked if no device is
available.

## Rollback

Restore the exact database backup and verify its SHA-256 checksum. Delete only
temporary sanitized files; retain the final APK artifact.

## Definition of done

The APK exists, installs when a device is available, contains no populated
database tables or `.env`, has a recorded checksum/signature, and the original
local database is restored byte-for-byte. Any blocked checks are listed.
