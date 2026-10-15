# Android Team Prompt Examples

## Native Android feature

```text
Use $android-team-workflow.

Implement: [DESCRIBE THE FEATURE].

Spawn android_planner and android_analyzer first. Wait for both and consolidate
the architecture, state, data, permission, lifecycle, and test plan.

Then assign:
- android_ui_developer for Compose/XML screens and navigation;
- android_platform_developer for lifecycle, services, WorkManager, permissions,
  notifications, and Android APIs;
- offline_data_engineer for Room/SQLite and migrations;
- sync_engineer for API synchronization and duplicate prevention;
- device_integration_engineer for Bluetooth, printer, camera, GPS, USB, or
  serial hardware;
- android_tester for independent verification;
- mobile_security_reviewer and android_release_reviewer for final review.

Do not let two agents edit the same file concurrently.
```

## Offline meter-reading application

```text
Use $android-team-workflow and $offline-first-sync.

Implement reliable offline meter reading, payment capture, upload retry, and
duplicate prevention. Preserve existing billing calculations. Define local
schema changes, idempotency keys, conflict rules, reconciliation, WorkManager
behavior, and user-visible sync states before coding.
```
