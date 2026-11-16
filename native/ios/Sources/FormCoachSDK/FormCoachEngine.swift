import Foundation

/// Contract for the native iOS engine: camera capture, pose inference and exercise
/// evaluation all happen behind this protocol (spec 7.2/8.5). No frame buffers cross
/// into any bridge — only the compact types below do.
///
/// NOT IMPLEMENTED. This file defines the contract only; see native/ios/README.md.
/// It intentionally has no Xcode project and has never been compiled.

public struct PosePoint {
    public let x: Float
    public let y: Float
    public let z: Float?
    public let visibility: Float?
    public let presence: Float?
}

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
}

public struct CreateSessionConfig {
    public let exercise: String
    public let cameraFacing: CameraFacing
    public let requiredView: BodyView
}

public enum FormCoachEvent {
    case trackingUpdate(sessionId: String, timestampMs: Int64, status: TrackingStatus)
    case phaseChanged(sessionId: String, timestampMs: Int64, fromPhase: String, toPhase: String)
    case repCompleted(sessionId: String, timestampMs: Int64, repCount: Int, quality: String)
    case formIssue(sessionId: String, timestampMs: Int64, issueId: String, severity: String, message: String)
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
