package com.formcoach.sdk

import android.content.Context
import androidx.camera.view.PreviewView
import androidx.lifecycle.LifecycleOwner
import java.util.UUID

private enum class RunState { CREATED, RUNNING, PAUSED, STOPPED, DISPOSED }

private class Session(
    val id: String,
    val config: CreateSessionConfig,
    val evaluator: ExerciseEvaluator,
) {
    var runState = RunState.CREATED
    var cameraBridge: CameraXBridge? = null
    val listeners = mutableSetOf<FormCoachEngineListener>()
    var startedAtMs: Long? = null
    var lastTrackingStatus: TrackingStatus = TrackingStatus.CALIBRATING
    var repCount = 0
    val formIssueCounts = mutableMapOf<String, Int>()
    var debugPoseFrameListener: ((PoseFrame) -> Unit)? = null
}

/**
 * Wires CameraXBridge -> MediaPipePoseSource -> SquatEvaluator -> FormCoachEngineListener.
 * The FormCoachEngine contract has no UI types (by design — no frame buffers cross the
 * bridge), so the hosting Activity must call `attachPreview` for a session before
 * `start(sessionId)` binds the camera.
 */
class FormCoachEngineImpl(private val context: Context) : FormCoachEngine {
    private val sessions = mutableMapOf<String, Session>()
    private val previewAttachments = mutableMapOf<String, Pair<LifecycleOwner, PreviewView>>()

    override fun initialize(config: InitializeConfig) {
        // No global state to set up beyond per-session construction today.
    }

    override fun createSession(config: CreateSessionConfig): String {
        val evaluator = when (config.exercise) {
            "squat" -> SquatEvaluator()
            else -> throw IllegalArgumentException("Unknown exercise id '${config.exercise}'. Only 'squat' is implemented natively.")
        }
        val validation = evaluator.validateConfiguration(
            EvaluatorConfig(requiredView = config.requiredView, minLandmarkConfidence = 0.5f),
        )
        if (!validation.valid) {
            throw IllegalArgumentException("Invalid session config: ${validation.errors.joinToString()}")
        }

        val sessionId = "android_session_${UUID.randomUUID()}"
        sessions[sessionId] = Session(id = sessionId, config = config, evaluator = evaluator)
        return sessionId
    }

    /** Must be called before `start(sessionId)` so the camera has somewhere to render. */
    fun attachPreview(sessionId: String, lifecycleOwner: LifecycleOwner, previewView: PreviewView) {
        previewAttachments[sessionId] = lifecycleOwner to previewView
    }

    /**
     * Debug-only hook exposing the raw PoseFrame per frame, for UI overlays (e.g. a skeleton
     * renderer). Deliberately not part of the FormCoachEngine contract — that interface has no
     * frame/landmark types by design (spec 7.2/8.4) — so this only exists on the concrete impl.
     */
    fun setDebugPoseFrameListener(sessionId: String, listener: ((PoseFrame) -> Unit)?) {
        requireSession(sessionId).debugPoseFrameListener = listener
    }

    override fun start(sessionId: String) {
        val session = requireSession(sessionId)
        check(session.runState == RunState.CREATED || session.runState == RunState.PAUSED) {
            "Cannot start a session in state ${session.runState}"
        }
        val (lifecycleOwner, previewView) = previewAttachments[sessionId]
            ?: error("attachPreview() must be called before start()")

        session.runState = RunState.RUNNING
        session.startedAtMs = session.startedAtMs ?: System.currentTimeMillis()
        emit(session, FormCoachEvent.Ready(sessionId, System.currentTimeMillis(), session.evaluator.id, session.evaluator.version))

        val bridge = CameraXBridge(
            context = context,
            lifecycleOwner = lifecycleOwner,
            previewView = previewView,
            camera = session.config.camera,
            onPoseFrame = { frame -> onPoseFrame(session, frame) },
        )
        session.cameraBridge = bridge
        bridge.start()
    }

    override fun pause(sessionId: String) {
        val session = requireSession(sessionId)
        if (session.runState == RunState.PAUSED) return
        check(session.runState == RunState.RUNNING) { "Cannot pause a session in state ${session.runState}" }
        session.runState = RunState.PAUSED
        session.cameraBridge?.dispose()
        session.cameraBridge = null
    }

    override fun resume(sessionId: String) {
        val session = requireSession(sessionId)
        check(session.runState == RunState.PAUSED) { "Cannot resume a session in state ${session.runState}" }
        start(sessionId)
    }

    override fun stop(sessionId: String) {
        val session = requireSession(sessionId)
        session.cameraBridge?.dispose()
        session.cameraBridge = null
        session.runState = RunState.STOPPED

        val now = System.currentTimeMillis()
        emit(
            session,
            FormCoachEvent.SessionCompleted(
                sessionId = sessionId,
                timestampMs = now,
                exerciseId = session.evaluator.id,
                evaluatorVersion = session.evaluator.version,
                startedAtMs = session.startedAtMs ?: now,
                endedAtMs = now,
                repCount = session.repCount,
                formIssueCounts = session.formIssueCounts.toMap(),
            ),
        )
    }

    override fun dispose(sessionId: String) {
        val session = sessions.remove(sessionId) ?: return
        session.cameraBridge?.dispose()
        session.listeners.clear()
        previewAttachments.remove(sessionId)
    }

    override fun addListener(sessionId: String, listener: FormCoachEngineListener) {
        requireSession(sessionId).listeners.add(listener)
    }

    override fun removeListener(sessionId: String, listener: FormCoachEngineListener) {
        sessions[sessionId]?.listeners?.remove(listener)
    }

    override fun setZoomRatio(sessionId: String, ratio: Float): Boolean =
        requireSession(sessionId).cameraBridge?.setZoomRatio(ratio) ?: false

    override fun setTorchEnabled(sessionId: String, enabled: Boolean): Boolean =
        requireSession(sessionId).cameraBridge?.setTorchEnabled(enabled) ?: false

    private fun onPoseFrame(session: Session, frame: PoseFrame) {
        if (session.runState != RunState.RUNNING) return
        session.debugPoseFrameListener?.invoke(frame)
        val output = session.evaluator.update(frame)

        if (output.trackingStatus != session.lastTrackingStatus) {
            if (output.trackingStatus == TrackingStatus.LOST) {
                emit(session, FormCoachEvent.TrackingLost(session.id, frame.timestampMs, "unknown"))
            }
            session.lastTrackingStatus = output.trackingStatus
        }
        emit(
            session,
            FormCoachEvent.TrackingUpdate(
                sessionId = session.id,
                timestampMs = frame.timestampMs,
                status = output.trackingStatus,
                visibleLandmarkCount = if (output.trackingStatus == TrackingStatus.LOST) 0 else frame.landmarks.size,
            ),
        )

        for (event in output.events) {
            when (event) {
                is EvaluatorEvent.PhaseChanged ->
                    emit(session, FormCoachEvent.PhaseChanged(session.id, frame.timestampMs, session.evaluator.id, event.fromPhase, event.toPhase))
                is EvaluatorEvent.RepCompleted -> {
                    session.repCount = event.repCount
                    emit(
                        session,
                        FormCoachEvent.RepCompleted(
                            session.id,
                            frame.timestampMs,
                            session.evaluator.id,
                            event.repCount,
                            event.quality.name.lowercase(),
                        ),
                    )
                }
                is EvaluatorEvent.FormIssue -> {
                    session.formIssueCounts[event.issueId] = (session.formIssueCounts[event.issueId] ?: 0) + 1
                    emit(
                        session,
                        FormCoachEvent.FormIssue(
                            session.id,
                            frame.timestampMs,
                            session.evaluator.id,
                            event.issueId,
                            event.severity.name.lowercase(),
                            event.message,
                            event.assessment.name.lowercase(),
                            event.confidence,
                        ),
                    )
                }
                is EvaluatorEvent.CalibrationRequired ->
                    emit(session, FormCoachEvent.CalibrationRequired(session.id, frame.timestampMs, event.requiredView, event.guidance))
                is EvaluatorEvent.CalibrationCompleted ->
                    emit(session, FormCoachEvent.CalibrationCompleted(session.id, frame.timestampMs, event.requiredView))
            }
        }
    }

    private fun emit(session: Session, event: FormCoachEvent) {
        for (listener in session.listeners) listener.onEvent(event)
    }

    private fun requireSession(sessionId: String): Session =
        sessions[sessionId] ?: error("Session '$sessionId' does not exist or was disposed.")
}
