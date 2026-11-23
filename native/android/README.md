# Android native module — squat only

Status: **real, built and run on an emulator**. CameraX + MediaPipe Pose Landmarker +
a hand-ported `SquatEvaluator` run natively, with no JS/RN bridge involved.

## What's here

- `PoseTypes.kt`, `Geometry.kt`, `OneEuroFilter.kt`, `StateHelpers.kt`, `ConfidenceGate.kt`,
  `FeedbackController.kt`, `LandmarkValidation.kt`, `Evaluator.kt` — Kotlin ports of the
  corresponding `packages/core/src/*.ts` files. Same constants, same formulas, same branch
  logic as the TypeScript originals (which remain the source of truth — any evaluator
  change there should be mirrored here by hand until a shared-schema/codegen step exists).
- `SquatEvaluator.kt` — port of `packages/core/src/exercises/squat.ts`: identical
  calibration heuristic (side-pick + front-view rejection via `normalizedShoulderWidth > 0.4`),
  identical phase state machine (`ready → descending → bottom → ascending → ready`) with the
  tracking-loss reacquisition-baseline guard, identical two form issues
  (`back_rounding` warning, `insufficient_depth` info) with the same priority/cooldown
  arbitration.
- `MediaPipePoseSource.kt` — wraps `com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker`
  in `LIVE_STREAM` mode, maps its 33 landmarks down to the 21 `LandmarkId`s FormCoach uses.
  Converts CameraX's YUV_420_888 frames to a `Bitmap` via NV21 + JPEG re-encode — this
  assumes contiguous U/V planes with pixel stride 1 (true on most devices, not guaranteed on
  every device; a production build should branch on `planes[1].pixelStride`).
- `CameraXBridge.kt` — binds CameraX `Preview` + `ImageAnalysis`, runs inference on a
  dedicated executor (never the CameraX analysis thread), deterministically tears down the
  camera + inference session on `dispose()`.
- `FormCoachEngineImpl.kt` — implements `FormCoachEngine`, wiring
  `CameraXBridge → MediaPipePoseSource → SquatEvaluator → FormCoachEngineListener`.
- `FormCoachEngine.kt` — the public contract, extended to cover the full
  `packages/types/src/events.ts` `FormCoachEventMap` (was previously missing `ready`,
  `trackingLost`, `calibrationRequired/Completed`, `sessionCompleted`, and
  `formIssue.assessment`/`confidence`).

## Verified (2026-11-21)

Built with Gradle 8.9 / AGP 8.5.2 / Kotlin 1.9.24, `compileSdk`/`minSdk` 26, against
`com.google.mediapipe:tasks-vision:0.10.14` and the `pose_landmarker_lite` model bundled in
`apps/demo-android/app/src/main/assets/pose_landmarker_lite.task`. `./gradlew assembleDebug`
builds clean. Installed and launched on a Pixel 9 Pro API 35 emulator: MediaPipe's TFLite
runtime initializes (XNNPACK delegate, both pose-detector and pose-landmarker subgraphs
loaded), the emulator's virtual camera opens, and the evaluator correctly reports
`calibrationRequired` ("Required leg and hip landmarks are not visible.") against the
emulator's virtual room scene, which has no person in frame — i.e. the full pipeline
(camera → pose inference → landmark mapping → SquatEvaluator → UI) is proven to run
without crashing. **Not yet verified against a real human performing real squats** — that
needs a physical device with a real camera, which this environment's emulator can't provide.

## Known limitations (same as the TS evaluator)

- Squat only; push-up/lunge are not ported.
- Side view only — no front/3-4 view support.
- `minSdk 26` / untested below that; device/platform floor is still an open product
  decision (see repo README's open questions).
- YUV→Bitmap conversion in `MediaPipePoseSource` doesn't handle non-contiguous U/V planes.
