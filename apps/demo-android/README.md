# Native Android demo — not implemented

Depends on `native/android/FormCoachEngine.kt` having a real implementation, which it
does not (see `native/README.md`). No Gradle project exists here. Once the native
engine is implemented, this should be a minimal single-Activity app that calls it
directly (no React Native/Flutter bridge) to validate the native engine in isolation,
per spec section 25's Sprint group A.
