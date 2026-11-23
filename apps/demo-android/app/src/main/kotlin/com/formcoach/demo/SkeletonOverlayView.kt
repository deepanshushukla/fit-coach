package com.formcoach.demo

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PointF
import android.util.AttributeSet
import android.view.View
import com.formcoach.sdk.LandmarkId
import com.formcoach.sdk.Point
import com.formcoach.sdk.PoseFrame
import com.formcoach.sdk.calculateAngle
import com.formcoach.sdk.segmentInclinationFromVertical
import kotlin.math.max

private val BONES = listOf(
    LandmarkId.LEFT_SHOULDER to LandmarkId.RIGHT_SHOULDER,
    LandmarkId.LEFT_SHOULDER to LandmarkId.LEFT_ELBOW,
    LandmarkId.LEFT_ELBOW to LandmarkId.LEFT_WRIST,
    LandmarkId.RIGHT_SHOULDER to LandmarkId.RIGHT_ELBOW,
    LandmarkId.RIGHT_ELBOW to LandmarkId.RIGHT_WRIST,
    LandmarkId.LEFT_SHOULDER to LandmarkId.LEFT_HIP,
    LandmarkId.RIGHT_SHOULDER to LandmarkId.RIGHT_HIP,
    LandmarkId.LEFT_HIP to LandmarkId.RIGHT_HIP,
    LandmarkId.LEFT_HIP to LandmarkId.LEFT_KNEE,
    LandmarkId.LEFT_KNEE to LandmarkId.LEFT_ANKLE,
    LandmarkId.RIGHT_HIP to LandmarkId.RIGHT_KNEE,
    LandmarkId.RIGHT_KNEE to LandmarkId.RIGHT_ANKLE,
    LandmarkId.LEFT_ANKLE to LandmarkId.LEFT_HEEL,
    LandmarkId.LEFT_HEEL to LandmarkId.LEFT_FOOT_INDEX,
    LandmarkId.RIGHT_ANKLE to LandmarkId.RIGHT_HEEL,
    LandmarkId.RIGHT_HEEL to LandmarkId.RIGHT_FOOT_INDEX,
)

private const val MIN_CONFIDENCE = 0.3f

/**
 * Debug-only overlay: draws the raw pose skeleton plus live knee/torso angles over the
 * camera preview, fed by FormCoachEngineImpl.setDebugPoseFrameListener. Lets you see exactly
 * what the evaluator sees, since the production FormCoachEvent stream only exposes
 * phase/rep/form-issue results, not landmarks.
 */
class SkeletonOverlayView(context: Context, attrs: AttributeSet? = null) : View(context, attrs) {
    private var frame: PoseFrame? = null

    private val bonePaint = Paint().apply {
        color = Color.GREEN
        strokeWidth = 6f
        style = Paint.Style.STROKE
    }
    private val jointPaint = Paint().apply {
        color = Color.YELLOW
        style = Paint.Style.FILL
    }
    private val textPaint = Paint().apply {
        color = Color.WHITE
        textSize = 42f
        isFakeBoldText = true
        setShadowLayer(4f, 0f, 0f, Color.BLACK)
    }

    fun updateFrame(frame: PoseFrame?) {
        this.frame = frame
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val f = frame ?: return
        if (f.landmarks.isEmpty() || width == 0 || height == 0) return

        for ((startId, endId) in BONES) {
            val start = screenPoint(f, startId) ?: continue
            val end = screenPoint(f, endId) ?: continue
            canvas.drawLine(start.x, start.y, end.x, end.y, bonePaint)
        }
        for (id in LandmarkId.entries) {
            val p = screenPoint(f, id) ?: continue
            canvas.drawCircle(p.x, p.y, 10f, jointPaint)
        }

        drawKneeAngle(canvas, f, LandmarkId.LEFT_HIP, LandmarkId.LEFT_KNEE, LandmarkId.LEFT_ANKLE)
        drawKneeAngle(canvas, f, LandmarkId.RIGHT_HIP, LandmarkId.RIGHT_KNEE, LandmarkId.RIGHT_ANKLE)
        drawTorsoLean(canvas, f, LandmarkId.LEFT_SHOULDER, LandmarkId.LEFT_HIP)
        drawTorsoLean(canvas, f, LandmarkId.RIGHT_SHOULDER, LandmarkId.RIGHT_HIP)
    }

    /**
     * Maps a normalised landmark to view pixels, matching PreviewView's default FILL_CENTER
     * crop: rotates the point by the frame's rotationDegrees (same correction CameraX applies
     * to the Preview surface) so the overlay lines up with the upright video, then mirrors for
     * front camera, then scales/centers to fill the view.
     */
    private fun screenPoint(frame: PoseFrame, id: LandmarkId): PointF? {
        val lm = frame.landmarks[id] ?: return null
        if ((lm.visibility ?: 1f) < MIN_CONFIDENCE || (lm.presence ?: 1f) < MIN_CONFIDENCE) return null

        var rx = lm.x
        var ry = lm.y
        var imgW = frame.imageWidth.toFloat()
        var imgH = frame.imageHeight.toFloat()
        val quarterTurns = (((frame.rotationDegrees % 360) + 360) % 360) / 90
        repeat(quarterTurns) {
            val nrx = 1f - ry
            val nry = rx
            rx = nrx
            ry = nry
            val tmp = imgW
            imgW = imgH
            imgH = tmp
        }
        if (frame.mirrored) rx = 1f - rx
        if (imgW <= 0f || imgH <= 0f) return null

        val scale = max(width / imgW, height / imgH)
        val offsetX = (width - imgW * scale) / 2f
        val offsetY = (height - imgH * scale) / 2f
        return PointF(rx * imgW * scale + offsetX, ry * imgH * scale + offsetY)
    }

    private fun drawKneeAngle(canvas: Canvas, frame: PoseFrame, hipId: LandmarkId, kneeId: LandmarkId, ankleId: LandmarkId) {
        val hip = frame.landmarks[hipId] ?: return
        val knee = frame.landmarks[kneeId] ?: return
        val ankle = frame.landmarks[ankleId] ?: return
        val minConfidence = minOf(hip.visibility ?: 1f, knee.visibility ?: 1f, ankle.visibility ?: 1f)
        if (minConfidence < MIN_CONFIDENCE) return

        val angle = calculateAngle(Point(hip.x, hip.y), Point(knee.x, knee.y), Point(ankle.x, ankle.y))
        if (angle.isNaN()) return
        val kneePoint = screenPoint(frame, kneeId) ?: return
        canvas.drawText("${angle.toInt()}°", kneePoint.x + 16f, kneePoint.y, textPaint)
    }

    private fun drawTorsoLean(canvas: Canvas, frame: PoseFrame, shoulderId: LandmarkId, hipId: LandmarkId) {
        val shoulder = frame.landmarks[shoulderId] ?: return
        val hip = frame.landmarks[hipId] ?: return
        if (minOf(shoulder.visibility ?: 1f, hip.visibility ?: 1f) < MIN_CONFIDENCE) return

        val lean = segmentInclinationFromVertical(Point(shoulder.x, shoulder.y), Point(hip.x, hip.y))
        if (lean.isNaN()) return
        val hipPoint = screenPoint(frame, hipId) ?: return
        canvas.drawText("lean ${lean.toInt()}°", hipPoint.x + 16f, hipPoint.y - 30f, textPaint)
    }
}
