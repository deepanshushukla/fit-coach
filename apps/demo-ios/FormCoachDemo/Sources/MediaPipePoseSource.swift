import Foundation
import CoreVideo
import UIKit
import MediaPipeTasksVision
import FormCoachSDK

/// MediaPipe's PoseLandmarker emits 33 landmarks in a fixed index order; FormCoach only
/// needs the 21 that packages/types/src/pose.ts's LandmarkId enumerates. Index reference:
/// https://developers.google.com/mediapipe/solutions/vision/pose_landmarker#models
/// Mirrors native/android's MEDIAPIPE_INDEX_TO_LANDMARK_ID mapping.
private let mediapipeIndexToLandmarkId: [Int: LandmarkId] = [
    0: .nose,
    2: .leftEye, 5: .rightEye,
    7: .leftEar, 8: .rightEar,
    11: .leftShoulder, 12: .rightShoulder,
    13: .leftElbow, 14: .rightElbow,
    15: .leftWrist, 16: .rightWrist,
    23: .leftHip, 24: .rightHip,
    25: .leftKnee, 26: .rightKnee,
    27: .leftAnkle, 28: .rightAnkle,
    29: .leftHeel, 30: .rightHeel,
    31: .leftFootIndex, 32: .rightFootIndex,
]

/// Wraps MediaPipe Tasks Vision's PoseLandmarker in `.liveStream` mode and converts its
/// results into FormCoach's PoseFrame envelope. This lives in the app target (not the
/// FormCoachSDK SPM package) because MediaPipeTasksVision's own SPM manifest uses
/// `.unsafeFlags`, which Apple's resolver only allows a top-level Xcode project to consume
/// — see native/ios/Package.swift's comment for the full explanation.
///
/// This binary's shipped API (dated 2026-11-11) is the delegate-based ObjC-bridged
/// surface (`PoseLandmarkerLiveStreamDelegate`), not the newer closure-based pure-Swift
/// API that google-ai-edge/mediapipe's `master` source branch has since moved to — the
/// xcframework lags the source tree. Confirmed against the actual framework headers
/// (MPPPoseLandmarkerOptions.h etc.) rather than assumed.
final class MediaPipePoseSource: NSObject, PoseLandmarkerLiveStreamDelegate {
    private var imageWidth = 0
    private var imageHeight = 0
    private var mirrored = false
    private var rotationDegrees = 0
    private let onFrame: (PoseFrame) -> Void
    private let onError: (Error) -> Void

    // Implicitly-unwrapped: Swift's two-phase init requires `self` to be fully initialized
    // before it can be handed to `options.poseLandmarkerLiveStreamDelegate`, but the
    // landmarker can only be constructed from those same `options` — an IUO stored
    // property satisfies phase 1 with a nil default so `self` can escape to the delegate
    // slot, then gets its real value immediately after `super.init()`.
    private var landmarker: PoseLandmarker!

    init(modelPath: String, onFrame: @escaping (PoseFrame) -> Void, onError: @escaping (Error) -> Void) throws {
        self.onFrame = onFrame
        self.onError = onError

        let baseOptions = BaseOptions()
        baseOptions.modelAssetPath = modelPath

        let options = PoseLandmarkerOptions()
        options.baseOptions = baseOptions
        options.runningMode = .liveStream
        options.numPoses = 1

        super.init()
        options.poseLandmarkerLiveStreamDelegate = self
        self.landmarker = try PoseLandmarker(options: options)
    }

    /// Call from the capture queue — never the main queue.
    func analyze(pixelBuffer: CVPixelBuffer, mirrored: Bool, rotationDegrees: Int, timestampMs: Int64) {
        self.imageWidth = CVPixelBufferGetWidth(pixelBuffer)
        self.imageHeight = CVPixelBufferGetHeight(pixelBuffer)
        self.mirrored = mirrored
        self.rotationDegrees = rotationDegrees

        let orientation = Self.imageOrientation(forRotationDegrees: rotationDegrees, mirrored: mirrored)
        do {
            let mpImage = try MPImage(pixelBuffer: pixelBuffer, orientation: orientation)
            try landmarker.detectAsync(image: mpImage, timestampInMilliseconds: Int(timestampMs))
        } catch {
            onError(error)
        }
    }

    func poseLandmarker(
        _ poseLandmarker: PoseLandmarker,
        didFinishDetection result: PoseLandmarkerResult?,
        timestampInMilliseconds: Int,
        error: Error?
    ) {
        if let error {
            onError(error)
            return
        }
        guard let result else { return }

        var landmarks: Landmarks = [:]
        if let poseLandmarks = result.landmarks.first {
            for (index, id) in mediapipeIndexToLandmarkId {
                guard index < poseLandmarks.count else { continue }
                let lm = poseLandmarks[index]
                landmarks[id] = PosePoint(
                    x: lm.x,
                    y: lm.y,
                    z: lm.z,
                    visibility: lm.visibility?.floatValue ?? 1,
                    presence: lm.presence?.floatValue ?? 1
                )
            }
        }

        onFrame(PoseFrame(
            timestampMs: Int64(timestampInMilliseconds),
            landmarks: landmarks,
            mirrored: mirrored,
            rotationDegrees: rotationDegrees,
            imageWidth: imageWidth,
            imageHeight: imageHeight
        ))
    }

    private static func imageOrientation(forRotationDegrees degrees: Int, mirrored: Bool) -> UIImage.Orientation {
        // Mirrors native/android's rotationDegrees passthrough convention: the capture
        // bridge reports clockwise rotation needed to reach upright, and front-camera
        // mirroring is tracked separately rather than baked into the enum case.
        switch (degrees, mirrored) {
        case (0, false): return .up
        case (0, true): return .upMirrored
        case (90, false): return .right
        case (90, true): return .rightMirrored
        case (180, false): return .down
        case (180, true): return .downMirrored
        case (270, false): return .left
        case (270, true): return .leftMirrored
        default: return .up
        }
    }

    func close() {
        // PoseLandmarker has no explicit close(); releasing the only strong reference
        // (held by AVCaptureBridge, released in its dispose()) deterministically frees it.
    }
}
