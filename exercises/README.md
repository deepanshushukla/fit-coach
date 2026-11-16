# Exercise definitions vs. evaluator code

Spec section 18 separates `exercises/<id>/` (the exercise's product definition:
supported views, calibration requirements, known limitations, validation data) from
the evaluator *implementation* in `packages/core/src/exercises/`.

In this build those two things are not yet split apart — each evaluator file
(`squat.ts`, `push-up.ts`, `lunge.ts`) carries its own view/limitation declarations
inline, and `apps/api/prisma/seed.ts` carries the publishable metadata. The `squat/`,
`push-up/`, `lunge/` subdirectories here are placeholders for what spec 17.4 actually
requires before an exercise can be called "supported": a written test protocol,
consented annotated recordings, and a trainer-reviewed validation report. None of that
exists yet — see `docs/exercise-validation/`.
