# Native Android demo — squat, real build

Single-Activity app (`MainActivity.kt`) calling `native/android`'s `FormCoachEngineImpl`
directly — no React Native/Flutter bridge — per spec section 25's Sprint group A: prove one
exercise end-to-end on a real device/emulator before anything else.

## Running it

```bash
cd apps/demo-android
echo "sdk.dir=$ANDROID_HOME" > local.properties   # if not already present
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell pm grant com.formcoach.demo android.permission.CAMERA
adb shell am start -n com.formcoach.demo/.MainActivity
```

Requires the MediaPipe pose model at `app/src/main/assets/pose_landmarker_lite.task`
(already included; re-fetch from
`https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task`
if missing).

## What's real vs. not yet verified

Verified on 2026-11-21 against a Pixel 9 Pro API 35 emulator: builds clean, installs,
launches without crashing, opens the camera, runs MediaPipe pose inference, and the
on-screen status text shows the real `SquatEvaluator`'s calibration guidance
("Calibrating: Required leg and hip landmarks are not visible.") against the emulator's
virtual room — proving the full native pipeline (camera → pose inference → evaluator → UI)
executes without crashing.

**Not yet verified**: behavior against a real human performing real squats (rep counting,
`back_rounding`/`insufficient_depth` feedback) — that needs a physical device with a real
camera pointed at a person, which no emulator can substitute for. Try it on a real device
to see those in action.

## Known limitations

Squat only, side view only — see `native/android/README.md` for the full list.
