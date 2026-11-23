import Foundation

public struct RequiredLandmarksCheck {
    public let ok: Bool
    public let missing: [LandmarkId]
}

public func checkRequiredLandmarks(_ landmarks: Landmarks, required: [LandmarkId], minConfidence: Float) -> RequiredLandmarksCheck {
    var missing: [LandmarkId] = []
    for id in required {
        guard let point = landmarks[id] else {
            missing.append(id)
            continue
        }
        let visibility = point.visibility ?? 1
        let presence = point.presence ?? 1
        if visibility < minConfidence || presence < minConfidence {
            missing.append(id)
        }
    }
    return RequiredLandmarksCheck(ok: missing.isEmpty, missing: missing)
}
