import Foundation

/// Normalised image-space body point produced by the pose estimation runtime.
public struct PosePoint {
    public let x: Float
    public let y: Float
    public let z: Float?
    /// Model-estimated probability the landmark is within the frame.
    public let visibility: Float?
    /// Model-estimated probability the landmark is this specific joint.
    public let presence: Float?

    public init(x: Float, y: Float, z: Float? = nil, visibility: Float? = nil, presence: Float? = nil) {
        self.x = x
        self.y = y
        self.z = z
        self.visibility = visibility
        self.presence = presence
    }
}

/// Canonical landmark identifiers. Mirrors packages/types/src/pose.ts's LandmarkId union so
/// evaluator code never depends on a specific model's own enum/ordering.
public enum LandmarkId: Hashable {
    case nose
    case leftEye, rightEye
    case leftEar, rightEar
    case leftShoulder, rightShoulder
    case leftElbow, rightElbow
    case leftWrist, rightWrist
    case leftHip, rightHip
    case leftKnee, rightKnee
    case leftAnkle, rightAnkle
    case leftHeel, rightHeel
    case leftFootIndex, rightFootIndex
}

public typealias Landmarks = [LandmarkId: PosePoint]

/// A single pose inference result for one frame, in the internal coordinate convention.
public struct PoseFrame {
    public let timestampMs: Int64
    /// Normalised image coordinates: origin top-left, x/y in [0, 1], not mirrored.
    public let landmarks: Landmarks
    /// True if the source frame was horizontally mirrored before inference (e.g. front camera preview).
    public let mirrored: Bool
    /// Clockwise rotation in degrees applied to reach the internal coordinate convention.
    public let rotationDegrees: Int
    public let imageWidth: Int
    public let imageHeight: Int

    public init(timestampMs: Int64, landmarks: Landmarks, mirrored: Bool, rotationDegrees: Int, imageWidth: Int, imageHeight: Int) {
        self.timestampMs = timestampMs
        self.landmarks = landmarks
        self.mirrored = mirrored
        self.rotationDegrees = rotationDegrees
        self.imageWidth = imageWidth
        self.imageHeight = imageHeight
    }
}
