import Foundation

public struct Point {
    public let x: Float
    public let y: Float
    public init(x: Float, y: Float) {
        self.x = x
        self.y = y
    }
}

/// Interior angle ABC in degrees, where B is the vertex.
/// Returns NaN if either segment has zero length (points coincide).
public func calculateAngle(_ a: Point, _ b: Point, _ c: Point) -> Float {
    let baX = a.x - b.x
    let baY = a.y - b.y
    let bcX = c.x - b.x
    let bcY = c.y - b.y

    let dot = baX * bcX + baY * bcY
    let magBa = hypotf(baX, baY)
    let magBc = hypotf(bcX, bcY)

    if magBa == 0 || magBc == 0 { return Float.nan }

    let cosine = max(-1, min(1, dot / (magBa * magBc)))
    return acos(cosine) * (180.0 / Float.pi)
}

public func distance(_ a: Point, _ b: Point) -> Float {
    hypotf(a.x - b.x, a.y - b.y)
}

/// Distance normalised by a body-scale reference (e.g. shoulder-to-hip distance),
/// so thresholds are comparable across body proportions and distance from camera.
public func normalizedDistance(_ a: Point, _ b: Point, scaleReference: Float) -> Float {
    if scaleReference == 0 { return Float.nan }
    return distance(a, b) / scaleReference
}

/// Inclination of a segment relative to vertical (0 = perfectly vertical), in degrees, [0, 180].
public func segmentInclinationFromVertical(_ top: Point, _ bottom: Point) -> Float {
    let dx = bottom.x - top.x
    let dy = bottom.y - top.y
    if dx == 0 && dy == 0 { return Float.nan }
    return atan2(abs(dx), abs(dy)) * (180.0 / Float.pi)
}

/// Signed horizontal offset of `point` from `reference`, normalised by `scaleReference`.
public func normalizedHorizontalOffset(_ point: Point, reference: Point, scaleReference: Float) -> Float {
    if scaleReference == 0 { return Float.nan }
    return (point.x - reference.x) / scaleReference
}

/// Resolves a landmark, requiring it to exist and meet a minimum visibility/presence confidence.
/// Returns nil (not a guessed value) when the landmark is missing or unreliable.
public func resolveLandmark(_ landmarks: Landmarks, _ id: LandmarkId, minConfidence: Float) -> Point? {
    guard let point = landmarks[id] else { return nil }
    let visibility = point.visibility ?? 1
    let presence = point.presence ?? 1
    if visibility < minConfidence || presence < minConfidence { return nil }
    return Point(x: point.x, y: point.y)
}

/// Average confidence across the given landmarks; 0 if any are missing.
public func averageConfidence(_ landmarks: Landmarks, _ ids: [LandmarkId]) -> Float {
    if ids.isEmpty { return 0 }
    var sum: Float = 0
    for id in ids {
        guard let point = landmarks[id] else { return 0 }
        let visibility = point.visibility ?? 1
        let presence = point.presence ?? 1
        sum += min(visibility, presence)
    }
    return sum / Float(ids.count)
}
