# Flutter plugin — not implemented

Status: **interface contract only**. No pubspec, no native Android/iOS bridge code, no
pose inference, nothing that has been built or run.

## What this would take (spec 8.6)

- Dart public API backed by the *same* native Android Kotlin / iOS Swift engines in
  `native/android` and `native/ios` — not a reimplementation. Flutter should be a third
  consumer of those engines, exactly like the React Native bridge is.
- A platform view or texture for the camera preview (not a method-channel image
  stream — that would mean transferring frame buffers across the channel, which spec
  8.6/8.7 explicitly rules out).
- Method channels for commands, event channels for the typed event stream — or a
  Pigeon-generated contract for compile-time safety across Dart/Kotlin/Swift.
- Published with documented minimum Flutter/Dart and platform versions.

## `form_coach_engine.dart`

Defines the Dart-side contract, mirroring `packages/types/src` field-for-field. The
actual plugin would implement this by delegating to platform channels backed by the
native engines above — that glue code does not exist here.
