# Field Drawer Restoration

## Objective
Restore the screenshot-style field drawer for the four supported login modes:
Reading, Disconnection, Net Metering, and Large Load.

## Current behavior
The login and session already support exactly the four modes. The custom drawer
currently exposes the full utility-management suite and contains duplicate Net
Metering and Complaints labels. Mode filtering already exists.

## Desired behavior
Every mode shows Dashboard, Reports, Search, GPS Map, Complaints, Bluetooth
Printer, Import/Export SQLite, Online Sync, Settings, and Logout. Disconnection
adds one Disconnection row. Net Metering adds one Net Metering row. Reading and
Large Load use Dashboard/Search without an extra row, matching the supplied
screenshots.

## Scope
Included: visible custom drawer entries and ordering. Excluded: deleting routes,
changing calculations, storage, sync, authentication, permissions, or native
configuration.

## Architecture and ownership
`drawer_restore_ui` owns `src/components/layout/DrawerContent.tsx`. The primary
agent owns integration, verification, and review.

## Interfaces and contracts
The existing `ReadingMode` values and routes remain unchanged. This is navigation
visibility, not an authorization boundary. All registered routes remain available
for internal workflows and deep links.

## Implementation sequence
1. Replace the oversized drawer lists with the screenshot-aligned common and
   mode-specific entries.
2. Remove SMS Center from visible system links while retaining its route.
3. Run static checks and verify the four mode projections.
4. Complete independent test, security, and release reviews.

## Risks
Hidden routes remain programmatically reachable. Active mode remains an in-memory
session value and resets to Reading after process recreation until login runs.
Large font/device behavior requires device verification.

## Testing
Assert exact item order for all four modes, no duplicate keys, route correctness,
typecheck, lint, invoice regression tests, and Android build checks. Report device
and lifecycle checks as blocked when no emulator/device is connected.

## Rollback
Revert the drawer file and this plan. No data rollback or migration is required.

## Definition of done
The drawer matches the supplied screenshots in every mode, checks pass or are
explicitly blocked, and independent reviews find no new code blocker.
