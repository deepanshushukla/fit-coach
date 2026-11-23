import Foundation

public enum FeedbackSeverity: String {
    case info, warning
}

/// priority: 1 = tracking/setup, 2 = safety-relevant cue, 3 = main form cue, 4 = encouragement.
public struct FormRuleDefinition {
    public let issueId: String
    public let severity: FeedbackSeverity
    public let message: String
    public let priority: Int
    public let cooldownMs: Int64

    public init(issueId: String, severity: FeedbackSeverity, message: String, priority: Int, cooldownMs: Int64) {
        self.issueId = issueId
        self.severity = severity
        self.message = message
        self.priority = priority
        self.cooldownMs = cooldownMs
    }
}

public struct FeedbackCandidate {
    public let rule: FormRuleDefinition
    public let timestampMs: Int64

    public init(rule: FormRuleDefinition, timestampMs: Int64) {
        self.rule = rule
        self.timestampMs = timestampMs
    }
}

/// Chooses at most one feedback message per evaluation tick (highest priority wins —
/// lowest number first) and enforces a per-issue cooldown so the exerciser is never
/// shown contradictory cues at once or spammed with repeated alerts.
public final class FeedbackController {
    private var cooldowns: [String: Cooldown] = [:]

    public init() {}

    public func select(_ candidates: [FeedbackCandidate]) -> FeedbackCandidate? {
        let eligible = candidates.filter { candidate in
            let cooldown = cooldowns[candidate.rule.issueId] ?? {
                let created = Cooldown(candidate.rule.cooldownMs)
                cooldowns[candidate.rule.issueId] = created
                return created
            }()
            return cooldown.isReady(candidate.timestampMs)
        }

        guard let chosen = eligible.min(by: { $0.rule.priority < $1.rule.priority }) else { return nil }
        cooldowns[chosen.rule.issueId]?.trigger(chosen.timestampMs)
        return chosen
    }

    public func reset() {
        cooldowns.removeAll()
    }
}
