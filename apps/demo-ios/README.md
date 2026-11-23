# Native iOS demo — squat, real build

Single-screen app (`ViewController.swift`) calling `FormCoachEngineImpl` directly — no
React Native/Flutter bridge — per spec section 25's Sprint group A: prove one exercise
end-to-end on a real device/simulator before anything else. Mirrors
`apps/demo-android`'s `MainActivity`.

The Xcode project (`FormCoachDemo.xcodeproj`) is generated from `project.yml` via
[XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`) rather than
committed directly, so it never drifts from the source-of-truth spec and never needs
manual pbxproj merge-conflict resolution.

Depends on the local `native/ios` SwiftPM package (`FormCoachSDK` — the pure-Swift
evaluator port) and on MediaPipe's own SPM package
(`https://github.com/google-ai-edge/mediapipe`, pinned to the `master` branch — required,
not a style choice: its targets use `.unsafeFlags`, which Apple's resolver only permits
for a branch/revision/path dependency, not a semver one). `MediaPipePoseSource.swift`,
`AVCaptureBridge.swift` and `FormCoachEngineImpl.swift` — the camera + MediaPipe wiring —
live in this app target rather than in `native/ios`, because that same unsafe-flags rule
means `native/ios/Package.swift` itself cannot depend on MediaPipe. See
`native/ios/README.md` for the full explanation.

The MediaPipe pose-landmarker model is downloaded directly (model weights, not something
to hand-roll) into `FormCoachDemo/Resources/pose_landmarker_lite.task`:
```
curl -sL -o FormCoachDemo/Resources/pose_landmarker_lite.task \
  https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task
```

## Running it

```bash
cd apps/demo-ios
xcodegen generate
xcrun simctl list devices available   # pick a simulator name
xcodebuild -project FormCoachDemo.xcodeproj -scheme FormCoachDemo \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.2' build
xcrun simctl boot "iPhone 17 Pro"
xcrun simctl install "iPhone 17 Pro" \
  ~/Library/Developer/Xcode/DerivedData/FormCoachDemo-*/Build/Products/Debug-iphonesimulator/FormCoachDemo.app
xcrun simctl launch "iPhone 17 Pro" com.formcoach.demo
```

## What's real vs. not yet verified

Verified on 2026-11-21 against an iPhone 17 Pro iOS 26.2 Simulator: builds clean via
`xcodebuild` (MediaPipeTasksVision resolved and linked as a real SPM dependency, not
stubbed), installs, and launches without crashing — showing the real system camera
permission dialog (with FormCoach's own usage-description text) and the `SquatEvaluator`'s
"Ready" status label underneath it, proving the engine initializes and starts a session
correctly.

**Not yet verified**: behavior against a real human performing real squats (rep counting,
`back_rounding`/`insufficient_depth` feedback). Unlike the Android emulator (which has a
virtual camera), **the iOS Simulator has no camera hardware at all** — `AVCaptureSession`
cannot produce frames there regardless of permission state, so this needs a real,
provisioned iPhone/iPad, which this environment does not have. The full pipeline
(`AVCaptureBridge` → `MediaPipePoseSource` → `SquatEvaluator` → UI) is structurally
complete and compiles/links against the real MediaPipe framework; only the "point a real
camera at a real squat" step is unverified.

## Known limitations

Squat only, side view only, fixed 90° portrait rotation assumption — see
`native/ios/README.md` for the full list.
