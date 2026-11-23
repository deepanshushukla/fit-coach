# iOS native engine — squat, real build

`FormCoachSDK` (Swift Package Manager, `native/ios/Package.swift`) contains a pure-Swift,
zero-dependency port of `packages/core`'s pose-evaluation logic: `PoseTypes.swift`,
`Geometry.swift`, `OneEuroFilter.swift`, `StateHelpers.swift`, `ConfidenceGate.swift`,
`FeedbackController.swift`, `LandmarkValidation.swift`, `Evaluator.swift`, and
`SquatEvaluator.swift` — same constants, calibration heuristic, phase state machine and
form-issue rules as `packages/core/src/exercises/squat.ts` (the source of truth) and the
Kotlin port in `native/android`. `swift build` compiles this package standalone.

`FormCoachEngine.swift` defines the engine contract (camera capture, pose inference and
exercise evaluation happening natively), extended to cover the full
`packages/types/src/events.ts` event set (`ready`, `trackingUpdate`, `trackingLost`,
`calibrationRequired/Completed`, `phaseChanged`, `repCompleted`, `formIssue` with
`assessment`/`confidence`, `sessionCompleted`, `sessionError`).

## Why the MediaPipe-wrapping code isn't in this package

MediaPipe's own SPM manifest (`google-ai-edge/mediapipe`'s `Package.swift`) declares its
targets with `.unsafeFlags` (required for `REGISTER_CALCULATOR`'s static constructors to
survive linking). Apple's package resolver refuses to let *another Package.swift* depend
on a package with unsafe flags via normal version/branch resolution — only a top-level
Xcode project may add it directly. So `MediaPipePoseSource.swift`, `AVCaptureBridge.swift`
and `FormCoachEngineImpl.swift` (the camera + MediaPipe wiring) live in
`apps/demo-ios/FormCoachDemo/Sources/` instead of here — see that app's README.

## What's real vs. not yet verified

Verified on 2026-11-21: `swift build` compiles `FormCoachSDK` cleanly. The full demo app
(`apps/demo-ios`) builds via `xcodebuild` and launches on an iOS 26.2 Simulator
(iPhone 17 Pro) without crashing, showing the real camera-permission prompt and the
`SquatEvaluator`'s "Ready" status — proving the Swift port, the engine wiring, and the
real MediaPipeTasksVision dependency all compile and link correctly on a real Apple
toolchain (Xcode 26.2).

**Not yet verified**: camera → pose inference → evaluator behavior against a real human,
since the iOS Simulator has no camera hardware to feed real frames to MediaPipe — that
needs a physical iPhone/iPad. The code path (`AVCaptureBridge` → `MediaPipePoseSource` →
`SquatEvaluator`) is structurally complete and builds, but has only been exercised up to
the permission-prompt/session-start point in this environment.

## Known limitations

Squat only, side view only — same as `native/android/README.md`. The demo also assumes a
fixed 90° sensor rotation (portrait-locked) rather than reading `AVCaptureConnection`
orientation per frame — fine for a one-screen demo, not for a real app shipping both
orientations.
