# iOS native module — not implemented

Status: **interface contract only**. No Xcode project, no AVFoundation integration, no
pose inference, nothing that has been compiled or run.

## What this would take (spec 8.5)

- Swift implementation using AVFoundation for capture.
- A chosen on-device inference runtime (spec 24, decision #1 — not yet selected) and a
  pixel-buffer path that avoids unnecessary copies (`CVPixelBuffer` handling matters for
  latency at 24–30 FPS).
- Correct handling of: camera permission (`AVCaptureDevice` authorization), device
  orientation, front-camera mirroring, interruptions (phone calls, Control Center
  camera access, multitasking), app lifecycle (background/foreground), and thermal
  state (`ProcessInfo.thermalState`).
- Deterministic release of the capture session and model resources on `stop()`/
  `dispose()`.
- Minimum iOS deployment target must be decided and published (spec 24, decision #2).
- Distribution via Swift Package Manager, per spec 8.1/8.5.

## `FormCoachEngine.swift`

Defines the protocol the Swift implementation must satisfy, mirroring
`packages/types/src` field-for-field.
