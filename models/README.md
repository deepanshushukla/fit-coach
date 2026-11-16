# Pose model manifests & evaluation — deferred

Spec section 24, open decision #1: the actual pose model/runtime (e.g. MediaPipe Pose
Landmarker, spec 10.2) has not been selected, licensed, or benchmarked in this
environment — that requires real devices and is explicitly called out as a
feasibility-phase task (spec section 25, Sprint group A), not something to guess at.

`packages/core`'s evaluators consume a `PoseFrame`/`Landmarks` shape
(`packages/types/src/pose.ts`) that is intentionally model-agnostic, so whichever model
is chosen later only needs an adapter that maps its output into that shape — it should
not require changes to the evaluator logic itself.
