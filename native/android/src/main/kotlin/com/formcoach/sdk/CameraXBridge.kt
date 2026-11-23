package com.formcoach.sdk

import android.content.Context
import android.hardware.camera2.CaptureRequest
import android.util.Range
import android.util.Size
import androidx.camera.camera2.interop.Camera2Interop
import androidx.camera.camera2.interop.ExperimentalCamera2Interop
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Owns the CameraX lifecycle for one session: binds Preview + ImageAnalysis, dispatches
 * frames to the pose source on a dedicated executor (never the CameraX analysis thread
 * itself, which must stay free to keep frame delivery unblocked), and deterministically
 * tears everything down on `dispose()` per spec 17.5's release gate.
 *
 * Capture setup (resolution, frame rate, camera selection, threading) is driven entirely by
 * the `CameraConfig` passed in — host apps that need something this SDK didn't anticipate
 * can supply their own `cameraSelector`/`analysisExecutor` rather than being stuck with it.
 */
@OptIn(ExperimentalCamera2Interop::class)
class CameraXBridge(
    private val context: Context,
    private val lifecycleOwner: LifecycleOwner,
    private val previewView: PreviewView,
    private val camera: CameraConfig,
    private val onPoseFrame: (PoseFrame) -> Unit,
) {
    private val ownsExecutor = camera.analysisExecutor == null
    private val analysisExecutor: ExecutorService = camera.analysisExecutor ?: Executors.newSingleThreadExecutor()
    private var cameraProvider: ProcessCameraProvider? = null
    private var poseSource: MediaPipePoseSource? = null
    private var boundCamera: Camera? = null
    private var disposed = false

    fun start() {
        val providerFuture = ProcessCameraProvider.getInstance(context)
        providerFuture.addListener(
            {
                if (disposed) return@addListener
                val provider = providerFuture.get()
                cameraProvider = provider
                bind(provider)
            },
            ContextCompat.getMainExecutor(context),
        )
    }

    private fun bind(provider: ProcessCameraProvider) {
        val mirrored = camera.facing == CameraFacing.FRONT
        val source = MediaPipePoseSource(context, onFrame = onPoseFrame)
        poseSource = source

        val resolutionSelector = resolutionSelectorFor(camera.resolution)

        val previewBuilder = Preview.Builder().also { builder ->
            resolutionSelector?.let { builder.setResolutionSelector(it) }
            applyTargetFps(builder)
        }
        val preview = previewBuilder.build().also {
            it.setSurfaceProvider(previewView.surfaceProvider)
        }

        val analysisBuilder = ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .also { builder ->
                resolutionSelector?.let { builder.setResolutionSelector(it) }
                applyTargetFps(builder)
            }
        val analysis = analysisBuilder.build().also {
            it.setAnalyzer(analysisExecutor) { imageProxy ->
                try {
                    source.analyze(imageProxy, mirrored)
                } finally {
                    imageProxy.close()
                }
            }
        }

        val selector = camera.cameraSelector ?: if (camera.facing == CameraFacing.FRONT) {
            CameraSelector.DEFAULT_FRONT_CAMERA
        } else {
            CameraSelector.DEFAULT_BACK_CAMERA
        }

        provider.unbindAll()
        boundCamera = provider.bindToLifecycle(lifecycleOwner, selector, preview, analysis)
    }

    private fun resolutionSelectorFor(resolution: CameraResolution): ResolutionSelector? {
        val targetSize = when (resolution) {
            CameraResolution.AUTO -> return null
            CameraResolution.P480 -> Size(640, 480)
            CameraResolution.P720 -> Size(1280, 720)
            CameraResolution.P1080 -> Size(1920, 1080)
        }
        return ResolutionSelector.Builder()
            .setResolutionStrategy(ResolutionStrategy(targetSize, ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER))
            .build()
    }

    private fun <T> applyTargetFps(builder: androidx.camera.core.ExtendableBuilder<T>) {
        val fps = camera.targetFps ?: return
        Camera2Interop.Extender(builder).setCaptureRequestOption(
            CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE,
            Range(fps, fps),
        )
    }

    /** Returns false if zoom isn't supported right now (camera not yet bound, or ratio rejected). */
    fun setZoomRatio(ratio: Float): Boolean {
        val cam = boundCamera ?: return false
        return try {
            cam.cameraControl.setZoomRatio(ratio)
            true
        } catch (e: IllegalArgumentException) {
            false
        }
    }

    /** Returns false if the camera isn't bound yet or has no flash unit. */
    fun setTorchEnabled(enabled: Boolean): Boolean {
        val cam = boundCamera ?: return false
        if (!cam.cameraInfo.hasFlashUnit()) return false
        cam.cameraControl.enableTorch(enabled)
        return true
    }

    /** Deterministically releases the camera, the inference session and (if owned) the analysis executor. */
    fun dispose() {
        if (disposed) return
        disposed = true
        cameraProvider?.unbindAll()
        cameraProvider = null
        boundCamera = null
        poseSource?.close()
        poseSource = null
        if (ownsExecutor) analysisExecutor.shutdown()
    }
}
