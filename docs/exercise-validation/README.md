# Exercise validation — not performed

Spec section 17.4 requires, before any exercise is published for real: consented
recordings under controlled conditions, qualified-reviewer annotation of movement
phases and form issues, participant-split precision/recall/abstention-rate
measurement, and a published report with dataset limitations.

None of that has happened. `packages/core`'s squat/push-up/lunge evaluators are
unit- and replay-tested against **synthetic, parametrically generated** pose
sequences (see the warning in `packages/core/src/fixtures/generate.ts`) — that proves
the state machine, rep-counting and abstention *logic* is internally consistent, not
that the evaluators work on real human movement. Treat every exercise in this build as
`testing`/unvalidated (the seed data marks `lunge` as `TESTING` and `squat`/`push_up`
as `PUBLISHED` only to exercise the portal's publication-status UI — that published
status is not a real accuracy claim).
