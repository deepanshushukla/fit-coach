package com.formcoach.demo

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.formcoach.sdk.BodyView
import com.formcoach.sdk.CameraConfig
import com.formcoach.sdk.CameraFacing
import com.formcoach.sdk.CreateSessionConfig
import com.formcoach.sdk.FormCoachEngineImpl
import com.formcoach.sdk.FormCoachEngineListener
import com.formcoach.sdk.FormCoachEvent
import com.formcoach.sdk.InitializeConfig
import com.formcoach.sdk.TrackingStatus

/**
 * Single-screen demo proving the native squat pipeline end-to-end on a real device:
 * CameraX preview -> MediaPipe pose landmarks -> SquatEvaluator -> on-screen status.
 * Deliberately minimal — no RN/Flutter bridge, matching spec section 25 Sprint group A's
 * "one exercise, proven natively" bar. See native/android/README.md for known limitations
 * (side-view-only, squat-only).
 */
private const val READINESS_DEBOUNCE_MS = 300L

class MainActivity : AppCompatActivity() {

    private lateinit var statusText: TextView
    private lateinit var repStatusText: TextView
    private lateinit var repCounterText: TextView
    private lateinit var readinessText: TextView
    private lateinit var engine: FormCoachEngineImpl
    private var sessionId: String? = null
    private var successfulReps = 0
    private var failedReps = 0
    private var exerciseId: String = "squat"

    private val requestCameraPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) startSession() else statusText.text = "Camera permission denied."
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusText = findViewById(R.id.statusText)
        repStatusText = findViewById(R.id.repStatusText)
        repCounterText = findViewById(R.id.repCounterText)
        readinessText = findViewById(R.id.readinessText)
        val previewView = findViewById<PreviewView>(R.id.previewView)
        val skeletonOverlay = findViewById<SkeletonOverlayView>(R.id.skeletonOverlay)

        ViewCompat.setOnApplyWindowInsetsListener(statusText) { view, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(view.paddingLeft, view.paddingTop, view.paddingRight, 16.dp + systemBars.bottom)
            insets
        }
        ViewCompat.setOnApplyWindowInsetsListener(repCounterText) { view, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(view.paddingLeft, 16.dp + systemBars.top, view.paddingRight, view.paddingBottom)
            insets
        }
        ViewCompat.setOnApplyWindowInsetsListener(readinessText) { view, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(view.paddingLeft, 16.dp + systemBars.top, view.paddingRight, view.paddingBottom)
            insets
        }

        engine = FormCoachEngineImpl(applicationContext)
        engine.initialize(InitializeConfig(appId = "demo-android", environment = "development"))

        val config = CreateSessionConfig(
            exercise = "squat",
            camera = CameraConfig(facing = CameraFacing.FRONT),
            requiredView = BodyView.SIDE,
        )
        exerciseId = config.exercise
        sessionId = engine.createSession(config)
        engine.attachPreview(sessionId!!, this, previewView)
        engine.addListener(sessionId!!, FormCoachEngineListener { event -> runOnUiThread { render(event) } })
        engine.setDebugPoseFrameListener(sessionId!!) { frame -> runOnUiThread { skeletonOverlay.updateFrame(frame) } }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            startSession()
        } else {
            requestCameraPermission.launch(Manifest.permission.CAMERA)
        }
    }

    private fun startSession() {
        sessionId?.let { engine.start(it) }
        val setup = exerciseSetupGuidance[exerciseId] ?: "Full body must stay in frame, side-on to the camera."
        statusText.text = "Stand side-on (shoulder pointed at camera). $setup"
    }

    private fun render(event: FormCoachEvent) {
        // TrackingUpdate/TrackingLost are deliberately excluded here: TrackingUpdate fires every
        // single frame (~30/sec), so writing it to statusText would stomp any coaching message
        // (form issue, phase cue, rep result) within ~33ms of it appearing — readinessText
        // already surfaces that frame-tracking signal separately, so statusText stays free for
        // actual coaching content.
        when (event) {
            is FormCoachEvent.CalibrationRequired -> statusText.text = "Calibrating: ${event.guidance}"
            is FormCoachEvent.CalibrationCompleted -> statusText.text = "Calibrated. Tracking side view."
            is FormCoachEvent.PhaseChanged -> statusText.text = phaseCue(event.toPhase)
            is FormCoachEvent.RepCompleted -> statusText.text = "Rep #${event.repCount} (${event.quality})"
            is FormCoachEvent.FormIssue -> statusText.text = "Coaching: ${event.message}"
            is FormCoachEvent.Ready -> statusText.text = "Ready: ${event.exerciseId} v${event.evaluatorVersion}"
            is FormCoachEvent.SessionCompleted -> statusText.text = "Session complete: ${event.repCount} reps"
            is FormCoachEvent.SessionError -> statusText.text = "Error: ${event.message}"
            is FormCoachEvent.TrackingUpdate, is FormCoachEvent.TrackingLost -> Unit
        }

        when (event) {
            is FormCoachEvent.TrackingUpdate -> updateReadiness(event.status)
            is FormCoachEvent.TrackingLost -> updateReadiness(TrackingStatus.LOST)
            else -> Unit
        }

        when (event) {
            is FormCoachEvent.PhaseChanged -> {
                when (event.toPhase) {
                    "descending" -> showRepStatus("Rep started")
                    "bottom" -> showRepStatus("Please go on")
                }
            }
            is FormCoachEvent.RepCompleted -> {
                showRepStatus("Done")
                if (event.quality == "valid") successfulReps++ else failedReps++
                repCounterText.text = "✓ $successfulReps   ✗ $failedReps"
            }
            else -> Unit
        }
    }

    private fun showRepStatus(text: String) {
        repStatusText.text = text
        repStatusText.visibility = android.view.View.VISIBLE
    }

    private var pendingReadinessStatus: TrackingStatus? = null
    private var pendingReadinessSinceMs: Long = 0L
    private var displayedReadinessStatus: TrackingStatus? = null

    /**
     * Continuous "are you in frame" signal, independent of rep/phase state. Per-frame landmark
     * confidence is noisy (a landmark can dip under the threshold for a single frame and recover
     * the next), so a status must persist for READINESS_DEBOUNCE_MS before the badge commits to
     * it — otherwise it flickers between states every frame instead of giving a stable read.
     */
    private fun updateReadiness(status: TrackingStatus) {
        val now = System.currentTimeMillis()
        if (status != pendingReadinessStatus) {
            pendingReadinessStatus = status
            pendingReadinessSinceMs = now
        }
        if (status == displayedReadinessStatus) return
        if (now - pendingReadinessSinceMs < READINESS_DEBOUNCE_MS) return

        displayedReadinessStatus = status
        val (text, color) = when (status) {
            TrackingStatus.TRACKING -> "✓ In frame" to "#2E7D32"
            TrackingStatus.CALIBRATING -> "⚠ Get fully in frame" to "#F9A825"
            TrackingStatus.PARTIAL -> "⚠ Partially out of frame" to "#F9A825"
            TrackingStatus.LOST -> "✗ Out of frame" to "#C62828"
            TrackingStatus.READY -> "Starting..." to "#616161"
        }
        readinessText.text = text
        readinessText.setBackgroundColor(android.graphics.Color.parseColor(color))
    }

    override fun onDestroy() {
        super.onDestroy()
        sessionId?.let { engine.dispose(it) }
    }

    private val Int.dp: Int
        get() = (this * resources.displayMetrics.density).toInt()
}

/**
 * What each exercise's evaluator needs visible, and how to place the camera so it stays
 * visible through the full movement — not just at rest. Keyed by exercise id so adding a
 * new exercise means adding one entry here.
 */
private val exerciseSetupGuidance = mapOf(
    "squat" to "Needs your shoulder, hip, knee and ankle all visible (one full side of your body, " +
        "head to feet) for the whole rep, not just standing. Put the phone low — around knee height " +
        "— 7-8ft away, tilted up slightly, so your feet stay in frame when you squat down.",
)

private fun phaseCue(toPhase: String): String = when (toPhase) {
    "descending" -> "Bend your knees, go down."
    "bottom" -> "Good depth. Now stand up."
    "ascending" -> "Push through your heels, stand tall."
    "ready" -> "Stand tall, ready for the next rep."
    else -> toPhase
}
