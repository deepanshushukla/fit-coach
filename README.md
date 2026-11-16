# FormCoach

An implementation of the product described in `FORMCOACH_COMPLETE_SPEC.md`, built
following that document's own recommendation (section 27): prove the native
exercise-intelligence pipeline and the licensing backend first, rather than building
every platform and every portal feature in parallel.

**Read this before anything else**: what's real here, what's a documented stand-in,
and what was deliberately left out — see [What's real vs. simulated](#whats-real-vs-simulated)
below. Everything under "real" has been run and its tests pass; everything under
"simulated/stubbed" says so in its own code comments and READMEs, not just here.

## What's real vs. simulated

| Layer | Status |
|---|---|
| `packages/types` — shared contracts (events, errors, entitlement claims, catalogue) | **Real.** Pure TypeScript, no stubs. |
| `packages/core` — geometry, smoothing, confidence/abstention, state machines, squat/push-up/lunge evaluators | **Real logic**, tested against **synthetic** pose sequences (not recorded human movement — see `packages/core/src/fixtures/generate.ts`). 39 passing tests. |
| `apps/api` — identity, orgs/RBAC, apps/environments, plans/licences, signed entitlements (RS256 JWT), usage ingestion, audit log | **Real**, backed by a real Postgres database via Prisma, with 25 passing integration tests. One deliberate gap: the entitlement **private signing key lives in Postgres, not a KMS/HSM** — spec sections 11.2/14.2 require a KMS; see `docs/security/entitlement-signing.md`. |
| `apps/portal` — onboarding, orgs, apps/environments, licences, plans, exercise catalogue, usage, audit log | **Real**, manually driven end-to-end in a browser against the real API (signup → org → app → environment → licence → catalogue → audit log), zero console errors. |
| `packages/react-native` — SDK facade: `initialize`/`getExercises`/`createSession`, `Session` lifecycle, typed events, entitlement caching + offline-first fallback | **Real facade logic**, 16 passing tests. The camera/pose-inference layer it would normally drive is a **documented simulator** (`SimulatorNativeBridge`) that runs the real `@formcoach/core` evaluators against synthetic pose data on a timer — there is no camera and no ML model anywhere in this build. |
| `apps/demo-react-native` | `src/cli.ts` is **runnable now** and was actually run against a live local API (output captured below). `src/App.tsx` is a real React Native screen that **has not been built or run** — no Xcode/Android Studio/device/simulator exists in this environment. |
| `native/android`, `native/ios`, `native/flutter` | **Interface contracts only** (real Kotlin/Swift/Dart source, matching `packages/types` field-for-field). No camera code, no pose inference, nothing compiled. |
| `packages/expo`, `packages/web-client`, `packages/exercise-definitions`, infra/docs/model dirs | **Deliberately deferred** — each has a README explaining why, per the spec's own "don't build everything in parallel" guidance (section 24). |

## Proof it actually works

```
$ FORMCOACH_ENV_ID=fc_env_xxxxx npm run demo:cli   # from apps/demo-react-native
Initializing against http://localhost:4000 as environment fc_env_xxxxx...
Initialized.
Catalogue: [ { id: 'squat', ..., entitlement: 'included' }, { id: 'push_up', ..., entitlement: 'included' } ]
Session created: sim_session_1_...
[phaseChanged] ready -> descending
[phaseChanged] descending -> bottom
[phaseChanged] bottom -> ascending
[phaseChanged] ascending -> ready
[repCompleted] rep #1 (valid)
...
Session summary: { ..., repCount: 2, formIssueCounts: {}, ... }
```

That run exercised the real chain: portal-created licence → backend-issued signed
entitlement → SDK bootstrap → entitlement-based exercise gating (`lunge` was correctly
*not* in the catalogue because the assigned plan didn't include it) → real rep counting
via `SquatEvaluator`.

## Repository layout

```
apps/
  api/                 Node.js + TypeScript + Express + Prisma/Postgres backend
  portal/              Vite + React management portal (SPA)
  demo-react-native/   CLI harness (runnable) + RN app scaffold (not run)
  demo-android/        README only — depends on native/android
  demo-ios/            README only — depends on native/ios
  demo-flutter/        README only — depends on native/flutter
  docs/                README only — deferred docs site
packages/
  types/               Shared TS contracts (events, errors, entitlement, catalogue)
  core/                 Exercise intelligence engine (geometry, state machines, evaluators)
  react-native/        SDK facade + simulator native bridge
  expo/, web-client/, exercise-definitions/   README only — deferred
native/
  android/, ios/, flutter/   Interface contracts only, not implemented
exercises/              Placeholders for the per-exercise validation protocol (spec 17.4)
contracts/fixtures/     Synthetic pose sequences used by packages/core's tests
docs/security/          Entitlement-signing KMS gap writeup
models/, infrastructure/ README only — deferred
```

## Running it locally

Requires Node 20+, PostgreSQL, and `npm`.

```bash
# 1. Install everything
npm install

# 2. Database (once)
createdb formcoach_dev
createdb formcoach_test      # for apps/api's integration tests
cp apps/api/.env.example apps/api/.env   # edit DATABASE_URL if needed
cd apps/api && npx prisma migrate deploy && npx tsx prisma/seed.ts && cd ../..

# 3. Build the packages the apps depend on
npm run build --workspaces --if-present

# 4. Run the backend
cd apps/api && npm run dev   # http://localhost:4000

# 5. Run the portal (separate terminal)
cd apps/portal && npm run dev   # http://localhost:5173

# 6. Try the SDK facade for real (separate terminal, after creating an
#    application/environment/licence in the portal)
cd apps/demo-react-native && FORMCOACH_ENV_ID=fc_env_xxxxx npm run demo:cli
```

Tests: `npm run test --workspaces --if-present` (80 tests across `apps/api`,
`packages/core`, `packages/react-native`). `apps/api` needs `apps/api/.env.test`
pointed at `formcoach_test` with its migrations applied.

## Scope decisions made while building this

The spec leaves several things as "open decisions" (section 24) or proposals to refine.
Concrete choices made to get a working system, flagged here rather than silently:

- **Portal framework**: Vite + React SPA, not Next.js or anything server-rendered. The
  spec doesn't mandate a framework; this was the fastest path to a real, testable app.
- **Entitlement signing key storage**: Postgres, not a KMS/HSM. Explicitly a gap, not a
  final answer — see `docs/security/entitlement-signing.md`.
- **Initial exercise set**: squat, push-up, lunge — side view only for all three (no
  front/3-4 view rules implemented, unlike the spec's squat table entry which allows
  "side or supported 3/4 view"). Lunge is marked `TESTING`, not `PUBLISHED`, and only
  tracks one leg per session (documented limitation).
- **"Published" status in the seed data does not mean validated.** Spec 17.4's real
  validation protocol (consented recordings, trainer review, measured precision/recall)
  was not run — see `docs/exercise-validation/README.md`. Treat every exercise here as
  unvalidated regardless of its `publicationStatus` value.
- **Password reset / team invitations have no email provider.** Both flows return the
  token/link directly in the API response (and the portal surfaces it) instead of
  sending email, clearly labeled as a dev-only behavior gated on `NODE_ENV !== 'production'`
  where applicable.
- **SDK → backend auth bootstrap** uses a `POST /v1/sdk/bootstrap` call keyed on the
  environment's public identifier (not a spec-mandated shape — section 12.4 just lists
  the endpoint). It returns a short-lived HS256 "SDK session token" (for
  refresh/usage/status calls) plus the RS256-signed entitlement.
- **Entitlement signature verification in the TypeScript SDK facade is decode-only**,
  not cryptographically verified — spec 11.2 expects verification against an embedded
  public key, which is a native-layer concern in a real build (no native layer exists
  here). See the warning in `packages/react-native/src/jwt.ts`.

## Open questions for you

These are the decisions that matter most for what happens next, roughly in priority
order:

1. **Is the native camera/pose pipeline the next thing to build, or is more backend/portal breadth more valuable right now?** The spec's own recommendation (section 27) is to prove native camera + pose inference + one exercise on a real Android and iOS device *before* anything else — that's Sprint group A, and it genuinely cannot be done in this environment (no Xcode, no Android Studio, no device, no simulator, no chosen pose model). If that's the real next step, it needs a different environment/session.
2. **Which pose model/runtime?** (spec 24 #1) MediaPipe Pose Landmarker is the spec's suggested candidate but its licence/redistribution terms, on-device benchmarks, and Android/iOS output consistency haven't been checked.
3. **Device/platform floor?** (spec 24 #2) Minimum Android API level, iOS deployment target, device matrix — all unset.
4. **Does Expo or Flutter ship in v1, or later?** (spec 24 #4) Currently both are stubs only.
5. **Is the KMS gap (entitlement signing key in Postgres) acceptable for your next milestone, or does it block you before you'd even demo this to a customer?**
6. **Entitlement validity period / offline grace duration** (spec 24 #6) — currently defaults to a 1-year licence with a 3-day (259200s) offline grace in the seed/API default; not a considered commercial decision.
7. **Billing provider, self-serve vs. invoiced** (spec 24 #7) — nothing implemented; `plans` are currently free-form Postgres rows created only via the seed script, with no portal UI to create new plans.
8. **Is the Vite/React SPA portal the right call long-term**, or do you want it rebuilt on whatever your team already standardizes on (Next.js, Remix, etc.)?
9. **Usage data retention / export policy** (spec 24 #8) — usage events are stored indefinitely right now; no retention job exists.
10. Anything in the "scope decisions" list above you'd have made differently — flag it and I'll change it.
