import Foundation

public struct ValidationResult {
    public let valid: Bool
    public let errors: [String]
}

public struct CalibrationResult {
    public let calibrated: Bool
    public let requiredView: BodyView?
    public let reason: String?

    public init(calibrated: Bool, requiredView: BodyView? = nil, reason: String? = nil) {
        self.calibrated = calibrated
        self.requiredView = requiredView
        self.reason = reason
    }
}

public struct ExerciseMetrics {
    public let repCount: Int
    public let currentPhase: String
    public let lastAssessment: AssessmentStatus
}

public enum RepQuality: String {
    case valid, notEvaluated = "not_evaluated"
}

public enum EvaluatorEvent {
    case phaseChanged(fromPhase: String, toPhase: String)
    case repCompleted(repCount: Int, durationMs: Int64?, quality: RepQuality)
    case formIssue(issueId: String, severity: FeedbackSeverity, message: String, assessment: AssessmentStatus, confidence: Float)
    case calibrationRequired(requiredView: BodyView, guidance: String)
    case calibrationCompleted(requiredView: BodyView)
}

public struct EvaluatorOutput {
    public let timestampMs: Int64
    public let trackingStatus: TrackingStatus
    public let events: [EvaluatorEvent]
}

public struct EvaluatorConfig {
    public let requiredView: BodyView
    public let minLandmarkConfidence: Float

    public init(requiredView: BodyView = .side, minLandmarkConfidence: Float = 0.5) {
        self.requiredView = requiredView
        self.minLandmarkConfidence = minLandmarkConfidence
    }
}

/// Deterministic for a given input sequence + configuration. Must never throw for
/// well-formed PoseFrame input — uncertain situations are reported through
/// AssessmentStatus/abstention, not exceptions.
public protocol ExerciseEvaluator: AnyObject {
    var id: String { get }
    var version: String { get }

    func validateConfiguration(_ config: EvaluatorConfig?) -> ValidationResult
    func calibrate(_ input: PoseFrame) -> CalibrationResult
    func update(_ input: PoseFrame) -> EvaluatorOutput
    func reset()
    func getMetrics() -> ExerciseMetrics
}
