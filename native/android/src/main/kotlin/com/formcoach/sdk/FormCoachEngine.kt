package com.formcoach.sdk

/**
 * Contract for the native Android engine: camera capture, pose inference and exercise
 * evaluation all happen behind this interface (spec 7.2/8.4). No frame buffers cross
 * into any bridge — only the compact types below do.
 *
 * NOT IMPLEMENTED. This file defines the contract only; see native/android/README.md.
 * It intentionally has no Gradle build file and has never been compiled.
 */

data class PosePoint(
    val x: Float,
    val y: Float,
    val z: Float? = null,
    val visibility: Float? = null,
    val presence: Float? = null,
)

enum class TrackingStatus { READY, TRACKING, PARTIAL, LOST, CALIBRATING }

enum class CameraFacing { FRONT, BACK }

enum class BodyView { FRONT, SIDE, BACK }

data class InitializeConfig(
    val appId: String,
    val environment: String,
    val targetFps: Int = 24,
    val processingResolution: String = "720p",
)

data class CreateSessionConfig(
    val exercise: String,
    val cameraFacing: CameraFacing,
    val requiredView: BodyView,
)

sealed class FormCoachEvent {
    data class TrackingUpdate(val sessionId: String, val timestampMs: Long, val status: TrackingStatus) : FormCoachEvent()
    data class PhaseChanged(val sessionId: String, val timestampMs: Long, val fromPhase: String, val toPhase: String) : FormCoachEvent()
    data class RepCompleted(val sessionId: String, val timestampMs: Long, val repCount: Int, val quality: String) : FormCoachEvent()
    data class FormIssue(val sessionId: String, val timestampMs: Long, val issueId: String, val severity: String, val message: String) : FormCoachEvent()
    data class SessionError(val sessionId: String, val code: String, val message: String, val recoverable: Boolean) : FormCoachEvent()
}

interface FormCoachEngineListener {
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
}
