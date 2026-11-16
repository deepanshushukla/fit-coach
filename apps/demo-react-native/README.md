# FormCoach React Native demo

Two ways to exercise `@formcoach/react-native`:

## 1. CLI demo (runnable now)

A Node script that drives the real facade — `FormCoach.initialize()`, `createSession()`,
the full `Session` lifecycle and typed events — against a live FormCoach API, using the
simulator native bridge (synthetic pose data through the real `@formcoach/core`
evaluators, since no camera/ML runtime exists in this environment).

```bash
# 1. Start apps/api (see its README), seed exercises/plans, then in the portal create
#    an application + environment + licence.
# 2. Copy the environment's public identifier, then:
FORMCOACH_ENV_ID=fc_env_xxxxx npm run demo:cli
```

This has been run against a real local instance and correctly: bootstraps, resolves the
licensed exercise set from the signed entitlement, counts reps via the real squat
evaluator, and prints a session summary.

## 2. React Native app (`src/App.tsx`, not runnable in this environment)

A full screen matching the spec's integration example: `FormCoachCamera`, session
controls (start/pause/resume/stop/dispose), and a live event log. It imports the same
facade as the CLI demo, plus `FormCoachCamera`, which needs the actual React Native
runtime (Metro, a native build, and iOS/Android/a device or simulator) to execute.

This environment has no Xcode, Android Studio, device, or simulator, so this app has
**not** been built or run — only typechecked (`npm run typecheck`). Before running it
for real:

1. `npx react-native run-ios` / `run-android` from a machine with the native toolchains
   installed (this scaffold's `babel.config.js`/`metro.config.js` assume
   `@react-native/babel-preset` and `@react-native/metro-config`, which are not
   installed here — add them when you actually build).
2. Set `ENVIRONMENT_PUBLIC_IDENTIFIER` in `src/App.tsx` to a real environment's public
   identifier from the portal.
3. Point `API_BASE_URL` at your running `apps/api` instance.
