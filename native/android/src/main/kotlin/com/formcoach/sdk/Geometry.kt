package com.formcoach.sdk

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.atan2
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

data class Point(val x: Float, val y: Float)

/**
 * Interior angle ABC in degrees, where B is the vertex.
 * Returns NaN if either segment has zero length (points coincide).
 */
fun calculateAngle(a: Point, b: Point, c: Point): Float {
    val baX = a.x - b.x
    val baY = a.y - b.y
    val bcX = c.x - b.x
    val bcY = c.y - b.y

    val dot = baX * bcX + baY * bcY
    val magBa = hypot(baX, baY)
    val magBc = hypot(bcX, bcY)

    if (magBa == 0f || magBc == 0f) return Float.NaN

    val cosine = max(-1f, min(1f, dot / (magBa * magBc)))
    return (acos(cosine.toDouble()) * (180.0 / PI)).toFloat()
}

fun distance(a: Point, b: Point): Float = hypot(a.x - b.x, a.y - b.y)

/**
 * Distance normalised by a body-scale reference (e.g. shoulder-to-hip distance),
 * so thresholds are comparable across body proportions and distance from camera.
 */
fun normalizedDistance(a: Point, b: Point, scaleReference: Float): Float {
    if (scaleReference == 0f) return Float.NaN
    return distance(a, b) / scaleReference
}

/** Inclination of a segment relative to vertical (0 = perfectly vertical), in degrees, [0, 180]. */
fun segmentInclinationFromVertical(top: Point, bottom: Point): Float {
    val dx = bottom.x - top.x
    val dy = bottom.y - top.y
    if (dx == 0f && dy == 0f) return Float.NaN
    return (atan2(abs(dx.toDouble()), abs(dy.toDouble())) * (180.0 / PI)).toFloat()
}

/** Signed horizontal offset of `point` from `reference`, normalised by `scaleReference`. */
fun normalizedHorizontalOffset(point: Point, reference: Point, scaleReference: Float): Float {
    if (scaleReference == 0f) return Float.NaN
    return (point.x - reference.x) / scaleReference
}

/**
 * Resolves a landmark, requiring it to exist and meet a minimum visibility/presence confidence.
 * Returns null (not a guessed value) when the landmark is missing or unreliable.
 */
fun resolveLandmark(landmarks: Landmarks, id: LandmarkId, minConfidence: Float): Point? {
    val point = landmarks[id] ?: return null
    val visibility = point.visibility ?: 1f
    val presence = point.presence ?: 1f
    if (visibility < minConfidence || presence < minConfidence) return null
    return Point(point.x, point.y)
}

/** Average confidence across the given landmarks; 0 if any are missing. */
fun averageConfidence(landmarks: Landmarks, ids: List<LandmarkId>): Float {
    if (ids.isEmpty()) return 0f
    var sum = 0f
    for (id in ids) {
        val point = landmarks[id] ?: return 0f
        val visibility = point.visibility ?: 1f
        val presence = point.presence ?: 1f
        sum += min(visibility, presence)
    }
    return sum / ids.size
}
