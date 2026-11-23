import Foundation

public enum AssessmentStatus: String {
    case valid, insufficientData = "insufficient_data", notEvaluated = "not_evaluated"
}

public struct ConfidenceGateInput {
    public let measurable: Bool
    public let confidence: Float
    public let conditionMet: Bool
    public let timestampMs: Int64

    public init(measurable: Bool, confidence: Float, conditionMet: Bool, timestampMs: Int64) {
        self.measurable = measurable
        self.confidence = confidence
        self.conditionMet = conditionMet
        self.timestampMs = timestampMs
    }
}

/// Converts a noisy per-frame rule evaluation into a stable AssessmentStatus.
/// `.valid` requires the condition to be both confidently measurable and persistent.
/// A single noisy frame cannot flip the result — this is what makes the system prefer
/// silence over a guessed form score.
public final class ConfidenceGate {
    private let minConfidence: Float
    private let minPersistenceMs: Int64
    private var conditionSinceMs: Int64?

    public init(minConfidence: Float, minPersistenceMs: Int64) {
        self.minConfidence = minConfidence
        self.minPersistenceMs = minPersistenceMs
    }

    public func evaluate(_ input: ConfidenceGateInput) -> AssessmentStatus {
        if !input.measurable {
            conditionSinceMs = nil
            return .notEvaluated
        }

        if input.confidence < minConfidence {
            conditionSinceMs = nil
            return .insufficientData
        }

        if !input.conditionMet {
            conditionSinceMs = nil
            return .insufficientData
        }

        let since = conditionSinceMs ?? {
            conditionSinceMs = input.timestampMs
            return input.timestampMs
        }()
        let persistedMs = input.timestampMs - since
        return persistedMs >= minPersistenceMs ? .valid : .insufficientData
    }

    public func reset() {
        conditionSinceMs = nil
    }
}
