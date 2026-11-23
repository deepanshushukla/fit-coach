package com.formcoach.sdk

data class RequiredLandmarksCheck(val ok: Boolean, val missing: List<LandmarkId>)

fun checkRequiredLandmarks(
    landmarks: Landmarks,
    required: List<LandmarkId>,
    minConfidence: Float,
): RequiredLandmarksCheck {
    val missing = mutableListOf<LandmarkId>()
    for (id in required) {
        val point = landmarks[id]
        if (point == null) {
            missing.add(id)
            continue
        }
        val visibility = point.visibility ?: 1f
        val presence = point.presence ?: 1f
        if (visibility < minConfidence || presence < minConfidence) {
            missing.add(id)
        }
    }
    return RequiredLandmarksCheck(ok = missing.isEmpty(), missing = missing)
}
