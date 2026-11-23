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
| `apps/api` — identity, orgs/RBAC, apps/environments, plans/licences, signed entitlements (RS256 JWT), usage ingestion, audit log | **Real**, backed by a real Postgres database via Prisma, with 38 passing integration tests. Entitlement signing now sits behind a `SigningKeyProvider` seam with a **KMS-backed production option** (`SIGNING_KEY_PROVIDER=aws-kms`, private key never leaves AWS KMS) alongside the original Postgres-stored dev default — see `docs/security/entitlement-signing.md`. Plans now have an admin-gated create/update API (not seed-script-only), and usage/audit-log retention is a real opt-in sweep (`npm run usage:retention-sweep`). |
| `apps/portal` — onboarding, orgs, apps/environments, licences, plans, exercise catalogue, usage, audit log | **Real**, manually driven end-to-end in a browser against the real API (signup → org → app → environment → licence → catalogue → audit log), zero console errors. |
| `apps/docs` — public site: product overview, API reference, SDK reference, pricing | **Real**, Vite + React, hand-written from the actual routers/SDK exports. Pricing page fetches `GET /v1/plans` live rather than hardcoding plan contents. |
| `packages/react-native` — SDK facade: `initialize`/`getExercises`/`createSession`, `Session` lifecycle, typed events, entitlement caching + offline-first fallback | **Real facade logic**, 16 passing tests. The camera/pose-inference layer it would normally drive is a **documented simulator** (`SimulatorNativeBridge`) that runs the real `@formcoach/core` evaluators against synthetic pose data on a timer — this facade is not wired to either native engine below yet. |
| `apps/demo-react-native` | `src/cli.ts` is **runnable now** and was actually run against a live local API (output captured below). `src/App.tsx` is a real React Native screen that **has not been built or run** — no Xcode/Android Studio/device/simulator exists in this environment. |
| `native/android`, `apps/demo-android` — squat only | **Real, launch-verified.** CameraX + MediaPipe Pose Landmarker + a hand-ported `SquatEvaluator` (Kotlin), built with Gradle and run on a Pixel 9 Pro API 35 emulator: camera opens, inference runs, the evaluator's own calibration guidance renders in the UI. **Not yet verified against a real human** (rep counting, form-issue detection) — needs a physical device; the emulator proved the pipeline doesn't crash, not that it tracks real movement correctly. |
| `native/ios`, `apps/demo-ios` — squat only | **Real, launch-verified.** AVFoundation + MediaPipe Pose Landmarker + the same evaluator ported to Swift, built with Xcode and run on an iOS 26.2 Simulator: app launches, shows the real camera-permission prompt and evaluator status. **Camera pipeline unverified** — the iOS Simulator has no camera hardware at all (unlike Android's emulator), so this needs a physical iPhone/iPad. |
| `native/flutter` | **Interface contracts only** (real Dart source, matching `packages/types` field-for-field). No camera code, no pose inference, nothing compiled. |
| `packages/expo`, `packages/web-client`, `packages/exercise-definitions`, infra/model dirs | **Deliberately deferred** — each has a README explaining why, per the spec's own "don't build everything in parallel" guidance (section 24). |

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
  docs/                Vite + React public site: overview, API/SDK reference, pricing
  demo-react-native/   CLI harness (runnable) + RN app scaffold (not run)
  demo-android/        Real Gradle app, squat-only, launch-verified on an emulator
  demo-ios/            Real Xcode app, squat-only, launch-verified on a simulator
  demo-flutter/        README only — depends on native/flutter
packages/
  types/               Shared TS contracts (events, errors, entitlement, catalogue)
  core/                 Exercise intelligence engine (geometry, state machines, evaluators)
  react-native/        SDK facade + simulator native bridge
  expo/, web-client/, exercise-definitions/   README only — deferred
native/
  android/             Real Kotlin squat evaluator + CameraX/MediaPipe wiring
  ios/                 Real Swift squat evaluator + AVFoundation/MediaPipe wiring
  flutter/             Interface contracts only, not implemented
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

Tests: `npm run test --workspaces --if-present` (93 tests across `apps/api`,
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

1. ~~Is the native camera/pose pipeline the next thing to build~~ — **done for squat**, on a device/toolchain that turned out to be available after all (Xcode + Android Studio). See the `native/android`/`native/ios`/`apps/demo-*` rows above. **Still open**: verifying rep-counting/form-issue behavior against a real human on a physical device (no emulator/simulator can substitute), and porting push-up/lunge the same way.
2. ~~Which pose model/runtime?~~ (spec 24 #1) — **decided: MediaPipe Pose Landmarker**, used on both platforms. Licence/redistribution terms for shipping it in a production app haven't been separately reviewed.
3. ~~Device/platform floor?~~ (spec 24 #2) — set for this first native pass (Android `minSdk 26`, iOS deployment target in `native/ios`/`apps/demo-ios`'s project config) but not yet a considered commercial decision about your actual target market.
4. **Does Expo or Flutter ship in v1, or later?** (spec 24 #4) Currently both are stubs only.
5. ~~Is the KMS gap acceptable for your next milestone?~~ — **a production option now exists** (`SIGNING_KEY_PROVIDER=aws-kms`), but IAM policy, rotation scheduling/alerting, and non-AWS KMS backends are still undone — see `docs/security/entitlement-signing.md`.
6. **Entitlement validity period / offline grace duration** (spec 24 #6) — currently defaults to a 1-year licence with a 3-day (259200s) offline grace in the seed/API default; not a considered commercial decision.
7. **Billing provider, self-serve vs. invoiced** (spec 24 #7) — still nothing implemented. `apps/docs`'s pricing page deliberately shows no numbers and says so; `plans` now have an admin API (see `apps/api` row above) but still no price/currency fields.
8. **Is the Vite/React SPA portal the right call long-term**, or do you want it rebuilt on whatever your team already standardizes on (Next.js, Remix, etc.)? (`apps/docs` followed the same pattern for consistency — same question applies to it.)
9. ~~Usage data retention / export policy?~~ (spec 24 #8) — **a retention sweep now exists** (`npm run usage:retention-sweep`, opt-in via `USAGE_RETENTION_DAYS`/`AUDIT_LOG_RETENTION_DAYS`, unset = keep forever by default). What the actual numbers should be is still your call.
10. Anything in the "scope decisions" list above you'd have made differently — flag it and I'll change it.
