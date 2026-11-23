package com.formcoach.sdk

enum class AssessmentStatus { VALID, INSUFFICIENT_DATA, NOT_EVALUATED }

data class ConfidenceGateInput(
    val measurable: Boolean,
    val confidence: Float,
    val conditionMet: Boolean,
    val timestampMs: Long,
)

/**
 * Converts a noisy per-frame rule evaluation into a stable AssessmentStatus.
 * VALID requires the condition to be both confidently measurable and persistent.
 * A single noisy frame cannot flip the result — this is what makes the system prefer
 * silence over a guessed form score.
 */
class ConfidenceGate(
    private val minConfidence: Float,
    private val minPersistenceMs: Long,
) {
    private var conditionSinceMs: Long? = null

    fun evaluate(input: ConfidenceGateInput): AssessmentStatus {
        if (!input.measurable) {
            conditionSinceMs = null
            return AssessmentStatus.NOT_EVALUATED
        }

        if (input.confidence < minConfidence) {
            conditionSinceMs = null
            return AssessmentStatus.INSUFFICIENT_DATA
        }

        if (!input.conditionMet) {
            conditionSinceMs = null
            return AssessmentStatus.INSUFFICIENT_DATA
        }

        val since = conditionSinceMs ?: input.timestampMs.also { conditionSinceMs = it }
        val persistedMs = input.timestampMs - since
        return if (persistedMs >= minPersistenceMs) AssessmentStatus.VALID else AssessmentStatus.INSUFFICIENT_DATA
    }

    fun reset() {
        conditionSinceMs = null
    }
}
