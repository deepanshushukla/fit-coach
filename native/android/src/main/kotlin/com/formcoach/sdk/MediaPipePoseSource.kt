package com.formcoach.sdk

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.Matrix
import android.graphics.Rect
import android.graphics.YuvImage
import android.util.Log
import androidx.camera.core.ImageProxy
import java.io.ByteArrayOutputStream
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult

/**
 * MediaPipe's PoseLandmarker emits 33 landmarks in a fixed index order; FormCoach only
 * needs the 21 that packages/types/src/pose.ts's LandmarkId enumerates. Index reference:
 * https://developers.google.com/mediapipe/solutions/vision/pose_landmarker#models
 */
private val MEDIAPIPE_INDEX_TO_LANDMARK_ID: Map<Int, LandmarkId> = mapOf(
    0 to LandmarkId.NOSE,
    2 to LandmarkId.LEFT_EYE,
    5 to LandmarkId.RIGHT_EYE,
    7 to LandmarkId.LEFT_EAR,
    8 to LandmarkId.RIGHT_EAR,
    11 to LandmarkId.LEFT_SHOULDER,
    12 to LandmarkId.RIGHT_SHOULDER,
    13 to LandmarkId.LEFT_ELBOW,
    14 to LandmarkId.RIGHT_ELBOW,
    15 to LandmarkId.LEFT_WRIST,
    16 to LandmarkId.RIGHT_WRIST,
    23 to LandmarkId.LEFT_HIP,
    24 to LandmarkId.RIGHT_HIP,
    25 to LandmarkId.LEFT_KNEE,
    26 to LandmarkId.RIGHT_KNEE,
    27 to LandmarkId.LEFT_ANKLE,
    28 to LandmarkId.RIGHT_ANKLE,
    29 to LandmarkId.LEFT_HEEL,
    30 to LandmarkId.RIGHT_HEEL,
    31 to LandmarkId.LEFT_FOOT_INDEX,
    32 to LandmarkId.RIGHT_FOOT_INDEX,
)

/**
 * Wraps MediaPipe Tasks Vision's PoseLandmarker in LIVE_STREAM mode and converts its
 * results into FormCoach's PoseFrame envelope. Runs entirely off the CameraX analysis
 * thread (the caller is responsible for dispatching onto a dedicated executor).
 */
class MediaPipePoseSource(
    context: Context,
    modelAssetPath: String = "pose_landmarker_lite.task",
    private val onFrame: (PoseFrame) -> Unit,
) {
    private var imageWidth = 0
    private var imageHeight = 0
    private var mirrored = false
    private var rotationDegrees = 0

    private val landmarker: PoseLandmarker = PoseLandmarker.createFromOptions(
        context,
        PoseLandmarker.PoseLandmarkerOptions.builder()
            .setBaseOptions(
                BaseOptions.builder()
                    .setModelAssetPath(modelAssetPath)
                    .setDelegate(Delegate.CPU)
                    .build(),
            )
            .setRunningMode(RunningMode.LIVE_STREAM)
            .setNumPoses(1)
            .setResultListener(::handleResult)
            .setErrorListener { error -> Log.e("FormCoachPose", "PoseLandmarker error", error) }
            .build(),
    )

    /** Call from the CameraX analyzer, on its dedicated executor — never the analysis thread's caller directly. */
    fun analyze(image: ImageProxy, mirrored: Boolean) {
        this.mirrored = mirrored

        // Rotate to upright before inference: the sensor buffer's rotationDegrees (commonly
        // 90/270 on phones) is otherwise left unapplied, so the pose model would see a sideways
        // body and fail to detect any landmarks. Once rotated, the frame IS the internal
        // convention PoseFrame documents, so rotationDegrees reports 0 from here on.
        val bitmap = rotateBitmap(imageProxyToBitmap(image), image.imageInfo.rotationDegrees)
        this.imageWidth = bitmap.width
        this.imageHeight = bitmap.height
        this.rotationDegrees = 0

        val mpImage = BitmapImageBuilder(bitmap).build()
        val timestampMs = image.imageInfo.timestamp / 1_000_000L
        landmarker.detectAsync(mpImage, timestampMs)
    }

    private fun rotateBitmap(bitmap: Bitmap, degrees: Int): Bitmap {
        if (degrees == 0) return bitmap
        val matrix = Matrix().apply { postRotate(degrees.toFloat()) }
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    }

    private fun handleResult(result: PoseLandmarkerResult, input: com.google.mediapipe.framework.image.MPImage) {
        val landmarksList = result.landmarks()
        val landmarks: Landmarks = if (landmarksList.isEmpty()) {
            emptyMap()
        } else {
            val poseLandmarks = landmarksList[0]
            val map = mutableMapOf<LandmarkId, PosePoint>()
            for ((index, id) in MEDIAPIPE_INDEX_TO_LANDMARK_ID) {
                if (index < poseLandmarks.size) {
                    val lm = poseLandmarks[index]
                    map[id] = PosePoint(
                        x = lm.x(),
                        y = lm.y(),
                        z = lm.z(),
                        visibility = lm.visibility().orElse(1f),
                        presence = lm.presence().orElse(1f),
                    )
                }
            }
            map
        }

        onFrame(
            PoseFrame(
                timestampMs = System.currentTimeMillis(),
                landmarks = landmarks,
                mirrored = mirrored,
                rotationDegrees = rotationDegrees,
                imageWidth = imageWidth,
                imageHeight = imageHeight,
            ),
        )
    }

    /**
     * CameraX ImageAnalysis delivers YUV_420_888; convert via NV21 + JPEG re-encode (MediaPipe's
     * Android Bitmap input path has no direct YUV entry point). Walks each plane by its actual
     * rowStride/pixelStride rather than assuming contiguous planes with pixelStride 1 — many
     * devices (confirmed: this Moto/Qualcomm device, uPixelStride=vPixelStride=2) deliver
     * semi-planar interleaved chroma, which a flat buffer copy would scramble into garbage.
     */
    private fun imageProxyToBitmap(image: ImageProxy): Bitmap {
        val width = image.width
        val height = image.height
        val nv21 = ByteArray(width * height * 3 / 2)

        val yPlane = image.planes[0]
        val yBuffer = yPlane.buffer
        var pos = 0
        for (row in 0 until height) {
            val rowStart = row * yPlane.rowStride
            if (yPlane.pixelStride == 1) {
                yBuffer.position(rowStart)
                yBuffer.get(nv21, pos, width)
                pos += width
            } else {
                for (col in 0 until width) {
                    nv21[pos++] = yBuffer.get(rowStart + col * yPlane.pixelStride)
                }
            }
        }

        val uPlane = image.planes[1]
        val vPlane = image.planes[2]
        val uBuffer = uPlane.buffer
        val vBuffer = vPlane.buffer
        for (row in 0 until height / 2) {
            for (col in 0 until width / 2) {
                nv21[pos++] = vBuffer.get(row * vPlane.rowStride + col * vPlane.pixelStride)
                nv21[pos++] = uBuffer.get(row * uPlane.rowStride + col * uPlane.pixelStride)
            }
        }

        val yuvImage = YuvImage(nv21, ImageFormat.NV21, width, height, null)
        val out = ByteArrayOutputStream()
        yuvImage.compressToJpeg(Rect(0, 0, width, height), 90, out)
        val jpegBytes = out.toByteArray()
        return BitmapFactory.decodeByteArray(jpegBytes, 0, jpegBytes.size)
    }

    fun close() {
        landmarker.close()
    }
}
