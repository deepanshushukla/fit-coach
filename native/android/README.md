# Android native module — not implemented

Status: **interface contract only**. No Gradle project, no CameraX integration, no pose
inference, nothing that has been compiled or run.

## What this would take (spec 8.4)

- Kotlin module using CameraX for camera lifecycle/frame acquisition.
- A chosen on-device inference runtime (spec 24, decision #1 — not yet selected).
- Background processing on dedicated executors — never block the main thread or the
  CameraX analysis thread with inference.
- Correct handling of: camera permission, device rotation, front-camera mirroring,
  Activity/Fragment lifecycle, thermal throttling (`PowerManager` thermal APIs), and
  device capability tiers.
- Deterministic release of the camera, the inference session, and any native buffers on
  `stop()`/`dispose()` — verified with a leak test (spec 17.5 release gate).
- Minimum SDK level and supported ABIs must be decided and published (spec 24,
  decision #2) before this can be built for real.

## `FormCoachEngine.kt`

Defines the interface the Kotlin implementation must satisfy. Field names and shapes
mirror `packages/types/src` exactly (`PosePoint`, `TrackingStatus`, the event payloads)
so a future implementation can be checked against the TypeScript contracts by hand
until a shared-schema codegen step exists (spec section 24, decision #10 territory).
