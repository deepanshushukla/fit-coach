package com.formcoach.sdk

import androidx.camera.core.CameraSelector
import java.util.concurrent.ExecutorService

/**
 * Contract for the native Android engine: camera capture, pose inference and exercise
 * evaluation all happen behind this interface (spec 7.2/8.4). No frame buffers cross
 * into any bridge — only the compact types below do.
 *
 * Implemented by FormCoachEngineImpl, wiring CameraXBridge -> MediaPipePoseSource ->
 * SquatEvaluator. See native/android/README.md for what's real vs. still a known limitation.
 */

enum class TrackingStatus { READY, TRACKING, PARTIAL, LOST, CALIBRATING }

enum class CameraFacing { FRONT, BACK }

enum class BodyView { FRONT, SIDE, BACK }

/** Target resolution class for both the preview and the analysis stream. AUTO leaves it to CameraX's own default. */
enum class CameraResolution { AUTO, P480, P720, P1080 }

/**
 * Every camera knob a host app might want control over, so this SDK doesn't force one
 * opinion about capture setup on every integrator. Everything has a sensible default —
 * only `facing` was previously configurable; the rest are new escape hatches.
 */
data class CameraConfig(
    val facing: CameraFacing = CameraFacing.FRONT,
    val resolution: CameraResolution = CameraResolution.AUTO,
    /** Null leaves the frame rate to the device/CameraX default. */
    val targetFps: Int? = null,
    /** Full override for camera selection (e.g. a specific physical/external camera). Takes precedence over `facing` when set. */
    val cameraSelector: CameraSelector? = null,
    /** Supply a shared executor if the host app wants to control analysis threading itself; otherwise the bridge owns and shuts down its own. */
    val analysisExecutor: ExecutorService? = null,
)

data class InitializeConfig(
    val appId: String,
    val environment: String,
    val targetFps: Int = 24,
    val processingResolution: String = "720p",
)

data class CreateSessionConfig(
    val exercise: String,
    val camera: CameraConfig = CameraConfig(),
    val requiredView: BodyView,
)

/** Mirrors packages/types/src/events.ts's FormCoachEventMap, flattened for the Kotlin bridge. */
sealed class FormCoachEvent {
    data class Ready(val sessionId: String, val timestampMs: Long, val exerciseId: String, val evaluatorVersion: String) : FormCoachEvent()
    data class TrackingUpdate(val sessionId: String, val timestampMs: Long, val status: TrackingStatus, val visibleLandmarkCount: Int) : FormCoachEvent()
    data class TrackingLost(val sessionId: String, val timestampMs: Long, val reason: String) : FormCoachEvent()
    data class CalibrationRequired(val sessionId: String, val timestampMs: Long, val requiredView: BodyView, val guidance: String) : FormCoachEvent()
    data class CalibrationCompleted(val sessionId: String, val timestampMs: Long, val requiredView: BodyView) : FormCoachEvent()
    data class PhaseChanged(val sessionId: String, val timestampMs: Long, val exerciseId: String, val fromPhase: String, val toPhase: String) : FormCoachEvent()
    data class RepCompleted(val sessionId: String, val timestampMs: Long, val exerciseId: String, val repCount: Int, val quality: String) : FormCoachEvent()
    data class FormIssue(
        val sessionId: String,
        val timestampMs: Long,
        val exerciseId: String,
        val issueId: String,
        val severity: String,
        val message: String,
        val assessment: String,
        val confidence: Float,
    ) : FormCoachEvent()
    data class SessionCompleted(
        val sessionId: String,
        val timestampMs: Long,
        val exerciseId: String,
        val evaluatorVersion: String,
        val startedAtMs: Long,
        val endedAtMs: Long,
        val repCount: Int,
        val formIssueCounts: Map<String, Int>,
    ) : FormCoachEvent()
    data class SessionError(val sessionId: String, val code: String, val message: String, val recoverable: Boolean) : FormCoachEvent()
}

fun interface FormCoachEngineListener {
    fun onEvent(event: FormCoachEvent)
}

interface FormCoachEngine {
    fun initialize(config: InitializeConfig)

    /** Returns an opaque session ID. Does not start the camera. */
    fun createSession(config: CreateSessionConfig): String

    fun start(sessionId: String)
    fun pause(sessionId: String)
    fun resume(sessionId: String)
    fun stop(sessionId: String)

    /** Must deterministically release the camera, inference session and any native buffers. */
    fun dispose(sessionId: String)

    fun addListener(sessionId: String, listener: FormCoachEngineListener)
    fun removeListener(sessionId: String, listener: FormCoachEngineListener)

    /** Runtime zoom; returns false if the session's camera isn't currently running or rejects the ratio. */
    fun setZoomRatio(sessionId: String, ratio: Float): Boolean

    /** Runtime torch toggle; returns false if the session's camera isn't running or has no flash unit. */
    fun setTorchEnabled(sessionId: String, enabled: Boolean): Boolean
}
