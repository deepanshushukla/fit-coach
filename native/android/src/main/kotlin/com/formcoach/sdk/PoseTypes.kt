package com.formcoach.sdk

/** Normalised image-space body point produced by the pose estimation runtime. */
data class PosePoint(
    val x: Float,
    val y: Float,
    val z: Float? = null,
    /** Model-estimated probability the landmark is within the frame. */
    val visibility: Float? = null,
    /** Model-estimated probability the landmark is this specific joint. */
    val presence: Float? = null,
)

/**
 * Canonical landmark identifiers. Mirrors packages/types/src/pose.ts's LandmarkId union so
 * evaluator code never depends on a specific model's own enum/ordering.
 */
enum class LandmarkId {
    NOSE,
    LEFT_EYE,
    RIGHT_EYE,
    LEFT_EAR,
    RIGHT_EAR,
    LEFT_SHOULDER,
    RIGHT_SHOULDER,
    LEFT_ELBOW,
    RIGHT_ELBOW,
    LEFT_WRIST,
    RIGHT_WRIST,
    LEFT_HIP,
    RIGHT_HIP,
    LEFT_KNEE,
    RIGHT_KNEE,
    LEFT_ANKLE,
    RIGHT_ANKLE,
    LEFT_HEEL,
    RIGHT_HEEL,
    LEFT_FOOT_INDEX,
    RIGHT_FOOT_INDEX,
}

typealias Landmarks = Map<LandmarkId, PosePoint>

/** A single pose inference result for one frame, in the internal coordinate convention. */
data class PoseFrame(
    val timestampMs: Long,
    /** Normalised image coordinates: origin top-left, x/y in [0, 1], not mirrored. */
    val landmarks: Landmarks,
    /** True if the source frame was horizontally mirrored before inference (e.g. front camera preview). */
    val mirrored: Boolean,
    /** Clockwise rotation in degrees applied to reach the internal coordinate convention. */
    val rotationDegrees: Int,
    val imageWidth: Int,
    val imageHeight: Int,
)
