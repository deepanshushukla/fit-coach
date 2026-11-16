# Native platform modules — status

This directory holds the native Android, iOS and Flutter integration points described
in the spec (sections 8.4–8.6, 18). **None of the camera-capture or pose-inference code
here is implemented or has been run.** Building and validating it requires:

- Xcode + an iOS simulator or device (for `ios/`)
- Android Studio + the Android SDK/NDK + an emulator or device (for `android/`)
- A selected, licence-checked pose model/runtime (spec section 24, open decision #1) —
  nothing has been integrated or benchmarked
- A Flutter SDK install (for `flutter/`)

None of that tooling is available in this environment, so this directory contains:

1. The **public interface contract** each platform must implement, as real Kotlin/Swift/
   Dart source, matching `@formcoach/types` field-for-field so the three platforms and
   the TypeScript facade cannot silently drift apart.
2. A README per platform describing the specific native APIs to use (CameraX/
   AVFoundation), lifecycle responsibilities, and what "done" looks like.
3. No camera pipeline, no pose inference, no build files (Gradle/Xcodeproj/pubspec are
   intentionally omitted — generating them without being able to build or run them would
   create files that look finished but have never compiled).

## What actually works today

`@formcoach/core` (the exercise geometry, state machines and evaluators) is pure,
dependency-free TypeScript/Kotlin-portable logic, fully unit- and replay-tested. The
**first real native milestone** (spec section 25, Sprint group A) is: prove camera
capture + pose inference on one Android and one iOS device, render landmarks, and
confirm the coordinate convention in `@formcoach/types` (`PoseFrame`, normalised
image coordinates, explicit rotation/mirroring) matches what the chosen pose runtime
actually outputs on both platforms. Until that's done, don't write the real
`FormCoachEngine` implementation — the interface below is deliberately a contract, not
a guess at the implementation.

## Directory map

```
native/
├── android/   Kotlin interface + README (CameraX, target API level TBD)
├── ios/       Swift interface + README (AVFoundation, target deployment TBD)
└── flutter/   Dart plugin interface + README (method/event channel contract)
```
