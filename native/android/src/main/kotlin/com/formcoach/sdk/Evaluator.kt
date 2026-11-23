package com.formcoach.sdk

data class ValidationResult(val valid: Boolean, val errors: List<String>)

data class CalibrationResult(
    val calibrated: Boolean,
    val requiredView: BodyView? = null,
    val reason: String? = null,
)

data class ExerciseMetrics(
    val repCount: Int,
    val currentPhase: String,
    val lastAssessment: AssessmentStatus,
)

enum class RepQuality { VALID, NOT_EVALUATED }

sealed class EvaluatorEvent {
    data class PhaseChanged(val fromPhase: String, val toPhase: String) : EvaluatorEvent()
    data class RepCompleted(val repCount: Int, val durationMs: Long?, val quality: RepQuality) : EvaluatorEvent()
    data class FormIssue(
        val issueId: String,
        val severity: FeedbackSeverity,
        val message: String,
        val assessment: AssessmentStatus,
        val confidence: Float,
    ) : EvaluatorEvent()
    data class CalibrationRequired(val requiredView: BodyView, val guidance: String) : EvaluatorEvent()
    data class CalibrationCompleted(val requiredView: BodyView) : EvaluatorEvent()
}

data class EvaluatorOutput(
    val timestampMs: Long,
    val trackingStatus: TrackingStatus,
    val events: List<EvaluatorEvent>,
)

data class EvaluatorConfig(
    val requiredView: BodyView = BodyView.SIDE,
    val minLandmarkConfidence: Float = 0.5f,
)

/**
 * Deterministic for a given input sequence + configuration. Must never throw for
 * well-formed PoseFrame input — uncertain situations are reported through
 * AssessmentStatus/abstention, not exceptions.
 */
interface ExerciseEvaluator {
    val id: String
    val version: String

    fun validateConfiguration(config: EvaluatorConfig?): ValidationResult
    fun calibrate(input: PoseFrame): CalibrationResult
    fun update(input: PoseFrame): EvaluatorOutput
    fun reset()
    fun getMetrics(): ExerciseMetrics
}
