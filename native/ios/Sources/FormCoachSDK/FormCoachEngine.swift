import Foundation

/// Contract for the native iOS engine: camera capture, pose inference and exercise
/// evaluation all happen behind this protocol (spec 7.2/8.5). No frame buffers cross
/// into any bridge — only the compact types below do.
///
/// Implemented by FormCoachEngineImpl, wiring AVCaptureBridge -> MediaPipePoseSource ->
/// SquatEvaluator. See native/ios/README.md for what's real vs. still a known limitation.

public enum TrackingStatus: String {
    case ready, tracking, partial, lost, calibrating
}

public enum CameraFacing: String {
    case front, back
}

public enum BodyView: String {
    case front, side, back
}

public struct InitializeConfig {
    public let appId: String
    public let environment: String
    public let targetFps: Int
    public let processingResolution: String

    public init(appId: String, environment: String, targetFps: Int = 24, processingResolution: String = "720p") {
        self.appId = appId
        self.environment = environment
        self.targetFps = targetFps
        self.processingResolution = processingResolution
    }
}

public struct CreateSessionConfig {
    public let exercise: String
    public let cameraFacing: CameraFacing
    public let requiredView: BodyView

    public init(exercise: String, cameraFacing: CameraFacing, requiredView: BodyView) {
        self.exercise = exercise
        self.cameraFacing = cameraFacing
        self.requiredView = requiredView
    }
}

/// Mirrors packages/types/src/events.ts's FormCoachEventMap, flattened for the Swift bridge.
public enum FormCoachEvent {
    case ready(sessionId: String, timestampMs: Int64, exerciseId: String, evaluatorVersion: String)
    case trackingUpdate(sessionId: String, timestampMs: Int64, status: TrackingStatus, visibleLandmarkCount: Int)
    case trackingLost(sessionId: String, timestampMs: Int64, reason: String)
    case calibrationRequired(sessionId: String, timestampMs: Int64, requiredView: BodyView, guidance: String)
    case calibrationCompleted(sessionId: String, timestampMs: Int64, requiredView: BodyView)
    case phaseChanged(sessionId: String, timestampMs: Int64, exerciseId: String, fromPhase: String, toPhase: String)
    case repCompleted(sessionId: String, timestampMs: Int64, exerciseId: String, repCount: Int, quality: String)
    case formIssue(
        sessionId: String,
        timestampMs: Int64,
        exerciseId: String,
        issueId: String,
        severity: String,
        message: String,
        assessment: String,
        confidence: Float
    )
    case sessionCompleted(
        sessionId: String,
        timestampMs: Int64,
        exerciseId: String,
        evaluatorVersion: String,
        startedAtMs: Int64,
        endedAtMs: Int64,
        repCount: Int,
        formIssueCounts: [String: Int]
    )
    case sessionError(sessionId: String, code: String, message: String, recoverable: Bool)
}

public protocol FormCoachEngineListener: AnyObject {
    func onEvent(_ event: FormCoachEvent)
}

public protocol FormCoachEngine {
    func initialize(config: InitializeConfig) throws

    /// Returns an opaque session ID. Does not start the camera.
    func createSession(config: CreateSessionConfig) throws -> String

    func start(sessionId: String) throws
    func pause(sessionId: String) throws
    func resume(sessionId: String) throws
    func stop(sessionId: String) throws

    /// Must deterministically release the capture session, inference model and buffers.
    func dispose(sessionId: String)

    func addListener(sessionId: String, listener: FormCoachEngineListener)
    func removeListener(sessionId: String, listener: FormCoachEngineListener)
}
