# Android Development Project Instructions

## Default platform

Edit to match the repository:

- Preferred native stack: Kotlin, Gradle, Android SDK, Jetpack Compose.
- Alternative stacks may include XML Views, Java, React Native, Expo, or
  Flutter; preserve the existing stack rather than forcing a rewrite.
- Record minimum SDK, target SDK, supported devices, and required hardware.
- For offline applications, document the local schema and synchronization
  protocol before changing them.

## Team workflow

For multi-screen, architectural, data, synchronization, Bluetooth, camera,
location, permission, or release work:

1. Spawn `android_planner` and `android_analyzer`.
2. Consolidate architecture, state, data, permission, and test contracts.
3. Assign non-overlapping modules to implementation agents.
4. Integrate before independent device and lifecycle testing.
5. Run mobile security and release review after stabilization.

## Android engineering rules

- Respect lifecycle and process recreation.
- Avoid blocking the main thread.
- Keep UI state explicit and restorable.
- Handle permission denial and permanent denial.
- Treat offline, retry, duplicate, and partial-sync behavior as normal states.
- Use migrations for persisted data changes.
- Never log credentials, tokens, exact sensitive location, or personal data.
- Do not claim emulator/device tests passed unless they actually ran.
- Preserve accessibility, font scaling, orientation, and tablet behavior where
  required.

## Completion gates

A task is complete only when relevant build, lint, unit, instrumentation,
emulator/device, offline, lifecycle, permission, and security checks have been
run or explicitly reported as blocked.
