# @formcoach/exercise-definitions — deferred

Spec section 18 lists this as "versioned evaluator metadata" distinct from the
evaluator logic itself. In this build, each evaluator (`packages/core/src/exercises/*`)
declares its own id/version/limitations as code and the backend's `Exercise` /
`ExerciseVersion` tables (`apps/api/prisma/schema.prisma`) hold the publishable
metadata (supported views, limitations, evaluator version, validation report).

Splitting that metadata into its own versioned package makes sense once there are
enough exercises, and backend/evaluator release cycles, that keeping them in sync by
hand becomes error-prone (spec section 19's versioning concerns). With three exercises
and one evaluator release so far, that package would currently just duplicate the
Prisma schema and the evaluator source for no benefit — so it was left empty rather
than filled with a premature abstraction.
