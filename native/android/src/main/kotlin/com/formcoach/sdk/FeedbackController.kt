package com.formcoach.sdk

enum class FeedbackSeverity { INFO, WARNING }

/**
 * priority: 1 = tracking/setup, 2 = safety-relevant cue, 3 = main form cue, 4 = encouragement.
 */
data class FormRuleDefinition(
    val issueId: String,
    val severity: FeedbackSeverity,
    val message: String,
    val priority: Int,
    val cooldownMs: Long,
)

data class FeedbackCandidate(val rule: FormRuleDefinition, val timestampMs: Long)

/**
 * Chooses at most one feedback message per evaluation tick (highest priority wins —
 * lowest number first) and enforces a per-issue cooldown so the exerciser is never
 * shown contradictory cues at once or spammed with repeated alerts.
 */
class FeedbackController {
    private val cooldowns = mutableMapOf<String, Cooldown>()

    fun select(candidates: List<FeedbackCandidate>): FeedbackCandidate? {
        val eligible = candidates.filter { candidate ->
            val cooldown = cooldowns.getOrPut(candidate.rule.issueId) { Cooldown(candidate.rule.cooldownMs) }
            cooldown.isReady(candidate.timestampMs)
        }

        if (eligible.isEmpty()) return null

        val chosen = eligible.minByOrNull { it.rule.priority }!!
        cooldowns.getValue(chosen.rule.issueId).trigger(chosen.timestampMs)
        return chosen
    }

    fun reset() {
        cooldowns.clear()
    }
}
