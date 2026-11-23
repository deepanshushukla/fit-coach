package com.formcoach.sdk

private enum class Phase { READY, DESCENDING, BOTTOM, ASCENDING }
private enum class Side { LEFT, RIGHT }

private const val STANDING_KNEE_ANGLE = 160f
private const val DEPTH_KNEE_ANGLE = 100f
private const val MIN_BOTTOM_DURATION_MS = 150L
private const val MIN_CONFIDENCE_DEFAULT = 0.5f
private const val DEPTH_CONFIDENCE_PERSISTENCE_MS = 100L
/**
 * Minimum hip drop from the calibrated standing baseline, as a fraction of torso height,
 * required (alongside the knee angle) to count as real squat depth. Knee angle alone can't
 * tell a squat from standing still and bending/lifting one knee — the hip has to actually
 * descend too.
 */
private const val MIN_HIP_DROP_RATIO = 0.3f

/** Forward lean of the torso from vertical, in degrees, beyond which we flag back rounding risk. */
private const val BACK_ROUNDING_LEAN_DEGREES = 35f
private const val BACK_ROUNDING_PERSISTENCE_MS = 300L

/**
 * How long to wait after entering DESCENDING before nudging for more depth. Without this
 * delay the cue would fire the instant the knees start bending, before the lifter has had any
 * real chance to go lower.
 */
private const val DESCENDING_GUIDANCE_DELAY_MS = 400L

/**
 * How long a required landmark may stay below the confidence threshold before it's treated
 * as genuinely lost. A single-frame confidence dip (e.g. the ankle's MediaPipe `presence`
 * score briefly dropping under threshold from partial occlusion at full squat depth) would
 * otherwise instantly discard an in-progress rep via resetPhaseOnTrackingLoss — this grace
 * window absorbs brief blips while still catching sustained, real tracking loss.
 */
private const val LANDMARK_DROPOUT_GRACE_MS = 400L

private val BACK_ROUNDING_RULE = FormRuleDefinition(
    issueId = "back_rounding",
    severity = FeedbackSeverity.WARNING,
    message = "Keep your chest up and avoid rounding your back.",
    priority = 2,
    cooldownMs = 4000L,
)
private val INSUFFICIENT_DEPTH_RULE = FormRuleDefinition(
    issueId = "insufficient_depth",
    severity = FeedbackSeverity.INFO,
    message = "Try to squat a little deeper for a full rep.",
    priority = 3,
    cooldownMs = 4000L,
)
private val GO_LOWER_RULE = FormRuleDefinition(
    issueId = "go_lower",
    severity = FeedbackSeverity.INFO,
    message = "Go a little lower to hit full depth.",
    priority = 4,
    cooldownMs = 2500L,
)

/**
 * Kotlin port of packages/core/src/exercises/squat.ts (TS is the source of truth). Keeps
 * identical constants, calibration heuristic, phase state machine and form-issue rules so
 * native behaviour matches the simulator/JS evaluator frame-for-frame.
 */
class SquatEvaluator : ExerciseEvaluator {
    override val id: String = "squat"
    override val version: String = "1.0.0"

    private var config = EvaluatorConfig(requiredView = BodyView.SIDE, minLandmarkConfidence = MIN_CONFIDENCE_DEFAULT)
    private var phase = Phase.READY
    private var repCount = 0
    private var reachedDepthThisRep = false
    private var trackedSide: Side? = null

    /**
     * Set when tracking is lost mid-movement. Suppresses re-entering DESCENDING until the
     * person is confirmed standing again, so a reacquired mid-squat frame cannot be
     * misread as the start (and, moments later, the false completion) of a brand new rep.
     */
    private var awaitingReacquisitionBaseline = false

    /** Calibrated standing hip height (normalised y), refreshed whenever confirmed standing. */
    private var standingHipY: Float? = null

    private val phaseTimer = PhaseTimer()
    private val standingHysteresis = Hysteresis(
        enterThreshold = STANDING_KNEE_ANGLE,
        exitThreshold = STANDING_KNEE_ANGLE - 10f,
        direction = HysteresisDirection.ABOVE,
    )
    private val depthGate = ConfidenceGate(
        minConfidence = MIN_CONFIDENCE_DEFAULT,
        minPersistenceMs = DEPTH_CONFIDENCE_PERSISTENCE_MS,
    )
    private val backRoundingGate = ConfidenceGate(
        minConfidence = MIN_CONFIDENCE_DEFAULT,
        minPersistenceMs = BACK_ROUNDING_PERSISTENCE_MS,
    )
    private val feedbackController = FeedbackController()
    private val smoother = MeasurementSmoother()
    private val insufficientDepthCooldown = Cooldown(4000L)

    private var lastAssessment: AssessmentStatus = AssessmentStatus.NOT_EVALUATED

    private val lastKnownPoints = mutableMapOf<LandmarkId, Point>()
    private val lastKnownAtMs = mutableMapOf<LandmarkId, Long>()

    /** Resolves a landmark directly if confident, otherwise falls back to a recent cached position within the grace window. */
    private fun resolveWithGrace(landmarks: Landmarks, id: LandmarkId, minConfidence: Float, timestampMs: Long): Point? {
        val direct = resolveLandmark(landmarks, id, minConfidence)
        if (direct != null) {
            lastKnownPoints[id] = direct
            lastKnownAtMs[id] = timestampMs
            return direct
        }
        val lastAt = lastKnownAtMs[id] ?: return null
        return if (timestampMs - lastAt <= LANDMARK_DROPOUT_GRACE_MS) lastKnownPoints[id] else null
    }

    override fun validateConfiguration(config: EvaluatorConfig?): ValidationResult {
        val errors = mutableListOf<String>()
        val requiredView = config?.requiredView
        if (requiredView != null && requiredView != BodyView.SIDE) {
            errors.add("squat currently only supports requiredView 'side'")
        }
        val minConfidence = config?.minLandmarkConfidence
        if (minConfidence != null && (minConfidence < 0f || minConfidence > 1f)) {
            errors.add("minLandmarkConfidence must be between 0 and 1")
        }
        if (errors.isEmpty()) {
            this.config = EvaluatorConfig(
                requiredView = requiredView ?: BodyView.SIDE,
                minLandmarkConfidence = minConfidence ?: MIN_CONFIDENCE_DEFAULT,
            )
        }
        return ValidationResult(valid = errors.isEmpty(), errors = errors)
    }

    override fun calibrate(input: PoseFrame): CalibrationResult {
        val minConfidence = config.minLandmarkConfidence
        val side = pickSide(input, minConfidence)
            ?: return CalibrationResult(
                calibrated = false,
                requiredView = BodyView.SIDE,
                reason = "Required leg and hip landmarks are not visible.",
            )

        val leftShoulder = resolveLandmark(input.landmarks, LandmarkId.LEFT_SHOULDER, 0f)
        val rightShoulder = resolveLandmark(input.landmarks, LandmarkId.RIGHT_SHOULDER, 0f)
        val hip = resolveLandmark(input.landmarks, hipFor(side), minConfidence)
        val ankle = resolveLandmark(input.landmarks, ankleFor(side), minConfidence)

        if (leftShoulder == null || rightShoulder == null || hip == null || ankle == null) {
            return CalibrationResult(
                calibrated = false,
                requiredView = BodyView.SIDE,
                reason = "Required landmarks are not visible.",
            )
        }

        val shoulderWidth = kotlin.math.hypot(
            (leftShoulder.x - rightShoulder.x).toDouble(),
            (leftShoulder.y - rightShoulder.y).toDouble(),
        ).toFloat()
        val torsoHeightRaw = kotlin.math.hypot(
            (hip.x - leftShoulder.x).toDouble(),
            (hip.y - leftShoulder.y).toDouble(),
        ).toFloat()
        val torsoHeight = if (torsoHeightRaw == 0f) 1f else torsoHeightRaw
        val normalizedShoulderWidth = shoulderWidth / torsoHeight

        if (normalizedShoulderWidth > 0.4f) {
            return CalibrationResult(
                calibrated = false,
                requiredView = BodyView.SIDE,
                reason = "Position the camera to your side so your full body profile is visible.",
            )
        }

        trackedSide = side
        return CalibrationResult(calibrated = true, requiredView = BodyView.SIDE)
    }

    private fun pickSide(input: PoseFrame, minConfidence: Float): Side? {
        val leftIds = listOf(LandmarkId.LEFT_SHOULDER, LandmarkId.LEFT_HIP, LandmarkId.LEFT_KNEE, LandmarkId.LEFT_ANKLE)
        val rightIds = listOf(LandmarkId.RIGHT_SHOULDER, LandmarkId.RIGHT_HIP, LandmarkId.RIGHT_KNEE, LandmarkId.RIGHT_ANKLE)
        val leftConfidence = averageConfidence(input.landmarks, leftIds)
        val rightConfidence = averageConfidence(input.landmarks, rightIds)
        if (leftConfidence < minConfidence && rightConfidence < minConfidence) return null
        return if (leftConfidence >= rightConfidence) Side.LEFT else Side.RIGHT
    }

    override fun update(input: PoseFrame): EvaluatorOutput {
        val events = mutableListOf<EvaluatorEvent>()
        val minConfidence = config.minLandmarkConfidence

        if (trackedSide == null) {
            val calibration = calibrate(input)
            if (!calibration.calibrated) {
                return EvaluatorOutput(
                    timestampMs = input.timestampMs,
                    trackingStatus = TrackingStatus.CALIBRATING,
                    events = listOf(
                        EvaluatorEvent.CalibrationRequired(
                            requiredView = BodyView.SIDE,
                            guidance = calibration.reason ?: "Unable to calibrate.",
                        ),
                    ),
                )
            }
            events.add(EvaluatorEvent.CalibrationCompleted(requiredView = BodyView.SIDE))
        }

        val side = trackedSide!!
        val requiredIds = listOf(shoulderFor(side), hipFor(side), kneeFor(side), ankleFor(side))
        val directCheck = checkRequiredLandmarks(input.landmarks, requiredIds, minConfidence)

        val shoulder = resolveWithGrace(input.landmarks, shoulderFor(side), minConfidence, input.timestampMs)
        val hip = resolveWithGrace(input.landmarks, hipFor(side), minConfidence, input.timestampMs)
        val knee = resolveWithGrace(input.landmarks, kneeFor(side), minConfidence, input.timestampMs)
        val ankle = resolveWithGrace(input.landmarks, ankleFor(side), minConfidence, input.timestampMs)

        val trackingStatus: TrackingStatus
        if (shoulder == null || hip == null || knee == null || ankle == null) {
            val missingCount = listOf(shoulder, hip, knee, ankle).count { it == null }
            trackingStatus = if (missingCount == requiredIds.size) TrackingStatus.LOST else TrackingStatus.PARTIAL
            lastAssessment = AssessmentStatus.NOT_EVALUATED
            resetPhaseOnTrackingLoss()
            return EvaluatorOutput(timestampMs = input.timestampMs, trackingStatus = trackingStatus, events = events)
        }
        trackingStatus = if (directCheck.ok) TrackingStatus.TRACKING else TrackingStatus.PARTIAL

        val rawKneeAngle = calculateAngle(hip, knee, ankle)
        val kneeAngle = smoother.smooth("kneeAngle", rawKneeAngle, input.timestampMs)
        val torsoLean = smoother.smooth(
            "torsoLean",
            segmentInclinationFromVertical(shoulder, hip),
            input.timestampMs,
        )

        val confidence = averageConfidence(input.landmarks, requiredIds)
        val isStanding = standingHysteresis.update(kneeAngle)

        val torsoHeight = distance(shoulder, hip).let { if (it == 0f) 1f else it }
        // Deliberately not `isStanding` (the latched hysteresis flag): that stays true across
        // the whole 150-160 degree exit band to avoid flicker, so it would keep chasing the hip
        // down as the squat begins and the real baseline would never freeze at true standing
        // height. Only refresh while actually near full knee extension.
        if (kneeAngle >= STANDING_KNEE_ANGLE) standingHipY = hip.y
        val hipDropRatio = standingHipY?.let { (hip.y - it) / torsoHeight } ?: 0f
        val realDepthReached = kneeAngle <= DEPTH_KNEE_ANGLE && hipDropRatio >= MIN_HIP_DROP_RATIO

        events.addAll(advancePhase(kneeAngle, realDepthReached, isStanding, input.timestampMs))

        val depthAssessment = depthGate.evaluate(
            ConfidenceGateInput(
                measurable = true,
                confidence = confidence,
                conditionMet = realDepthReached,
                timestampMs = input.timestampMs,
            ),
        )
        if (depthAssessment == AssessmentStatus.VALID) reachedDepthThisRep = true

        val backRoundingAssessment = backRoundingGate.evaluate(
            ConfidenceGateInput(
                measurable = phase == Phase.DESCENDING || phase == Phase.BOTTOM || phase == Phase.ASCENDING,
                confidence = confidence,
                conditionMet = torsoLean > BACK_ROUNDING_LEAN_DEGREES,
                timestampMs = input.timestampMs,
            ),
        )

        lastAssessment = if (depthAssessment == AssessmentStatus.VALID || backRoundingAssessment == AssessmentStatus.VALID) {
            AssessmentStatus.VALID
        } else {
            depthAssessment
        }

        val candidates = mutableListOf<FeedbackCandidate>()
        if (backRoundingAssessment == AssessmentStatus.VALID) {
            candidates.add(FeedbackCandidate(BACK_ROUNDING_RULE, input.timestampMs))
        }
        if (phase == Phase.ASCENDING && !reachedDepthThisRep && insufficientDepthCooldown.isReady(input.timestampMs)) {
            candidates.add(FeedbackCandidate(INSUFFICIENT_DEPTH_RULE, input.timestampMs))
        }
        if (
            phase == Phase.DESCENDING &&
            !realDepthReached &&
            phaseTimer.hasMetMinDuration(input.timestampMs, DESCENDING_GUIDANCE_DELAY_MS)
        ) {
            candidates.add(FeedbackCandidate(GO_LOWER_RULE, input.timestampMs))
        }

        val chosen = feedbackController.select(candidates)
        if (chosen != null) {
            if (chosen.rule.issueId == "insufficient_depth") {
                insufficientDepthCooldown.trigger(input.timestampMs)
            }
            events.add(
                EvaluatorEvent.FormIssue(
                    issueId = chosen.rule.issueId,
                    severity = chosen.rule.severity,
                    message = chosen.rule.message,
                    assessment = AssessmentStatus.VALID,
                    confidence = confidence,
                ),
            )
        }

        return EvaluatorOutput(timestampMs = input.timestampMs, trackingStatus = trackingStatus, events = events)
    }

    private fun advancePhase(kneeAngle: Float, depthReached: Boolean, isStanding: Boolean, timestampMs: Long): List<EvaluatorEvent> {
        val events = mutableListOf<EvaluatorEvent>()
        val previousPhase = phase

        if (awaitingReacquisitionBaseline && isStanding) {
            awaitingReacquisitionBaseline = false
        }

        when (phase) {
            Phase.READY -> {
                if (!isStanding && !awaitingReacquisitionBaseline) {
                    phase = Phase.DESCENDING
                    phaseTimer.enterPhase(timestampMs)
                }
            }
            Phase.DESCENDING -> {
                if (depthReached) {
                    phase = Phase.BOTTOM
                    phaseTimer.enterPhase(timestampMs)
                } else if (isStanding) {
                    phase = Phase.READY
                    reachedDepthThisRep = false
                }
            }
            Phase.BOTTOM -> {
                if (kneeAngle > DEPTH_KNEE_ANGLE && phaseTimer.hasMetMinDuration(timestampMs, MIN_BOTTOM_DURATION_MS)) {
                    phase = Phase.ASCENDING
                    phaseTimer.enterPhase(timestampMs)
                }
            }
            Phase.ASCENDING -> {
                if (isStanding) {
                    repCount += 1
                    events.add(
                        EvaluatorEvent.RepCompleted(
                            repCount = repCount,
                            durationMs = null,
                            quality = if (reachedDepthThisRep) RepQuality.VALID else RepQuality.NOT_EVALUATED,
                        ),
                    )
                    reachedDepthThisRep = false
                    phase = Phase.READY
                } else if (depthReached) {
                    phase = Phase.BOTTOM
                    phaseTimer.enterPhase(timestampMs)
                }
            }
        }

        if (phase != previousPhase) {
            events.add(0, EvaluatorEvent.PhaseChanged(fromPhase = previousPhase.name.lowercase(), toPhase = phase.name.lowercase()))
        }
        return events
    }

    private fun resetPhaseOnTrackingLoss() {
        if (phase != Phase.READY) {
            phase = Phase.READY
            reachedDepthThisRep = false
            awaitingReacquisitionBaseline = true
            standingHipY = null
            phaseTimer.reset()
            standingHysteresis.reset()
            depthGate.reset()
            backRoundingGate.reset()
        }
    }

    override fun reset() {
        phase = Phase.READY
        repCount = 0
        reachedDepthThisRep = false
        trackedSide = null
        awaitingReacquisitionBaseline = false
        standingHipY = null
        phaseTimer.reset()
        standingHysteresis.reset()
        depthGate.reset()
        backRoundingGate.reset()
        feedbackController.reset()
        smoother.reset()
        insufficientDepthCooldown.reset()
        lastAssessment = AssessmentStatus.NOT_EVALUATED
        lastKnownPoints.clear()
        lastKnownAtMs.clear()
    }

    override fun getMetrics(): ExerciseMetrics =
        ExerciseMetrics(repCount = repCount, currentPhase = phase.name.lowercase(), lastAssessment = lastAssessment)

    private fun shoulderFor(side: Side) = if (side == Side.LEFT) LandmarkId.LEFT_SHOULDER else LandmarkId.RIGHT_SHOULDER
    private fun hipFor(side: Side) = if (side == Side.LEFT) LandmarkId.LEFT_HIP else LandmarkId.RIGHT_HIP
    private fun kneeFor(side: Side) = if (side == Side.LEFT) LandmarkId.LEFT_KNEE else LandmarkId.RIGHT_KNEE
    private fun ankleFor(side: Side) = if (side == Side.LEFT) LandmarkId.LEFT_ANKLE else LandmarkId.RIGHT_ANKLE
}
