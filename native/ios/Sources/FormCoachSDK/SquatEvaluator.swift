import Foundation

private enum Phase { case ready, descending, bottom, ascending }
private enum Side { case left, right }

private let standingKneeAngle: Float = 160
private let depthKneeAngle: Float = 100
private let minBottomDurationMs: Int64 = 150
private let minConfidenceDefault: Float = 0.5
private let depthConfidencePersistenceMs: Int64 = 100

/// Forward lean of the torso from vertical, in degrees, beyond which we flag back rounding risk.
private let backRoundingLeanDegrees: Float = 35
private let backRoundingPersistenceMs: Int64 = 300

private let backRoundingRule = FormRuleDefinition(
    issueId: "back_rounding",
    severity: .warning,
    message: "Keep your chest up and avoid rounding your back.",
    priority: 2,
    cooldownMs: 4000
)
private let insufficientDepthRule = FormRuleDefinition(
    issueId: "insufficient_depth",
    severity: .info,
    message: "Try to squat a little deeper for a full rep.",
    priority: 3,
    cooldownMs: 4000
)

/// Swift port of packages/core/src/exercises/squat.ts (TS is the source of truth). Keeps
/// identical constants, calibration heuristic, phase state machine and form-issue rules so
/// native behaviour matches the simulator/JS evaluator frame-for-frame. Cross-checked
/// against the Kotlin port at native/android/.../SquatEvaluator.kt.
public final class SquatEvaluator: ExerciseEvaluator {
    public let id = "squat"
    public let version = "1.0.0"

    private var config = EvaluatorConfig(requiredView: .side, minLandmarkConfidence: minConfidenceDefault)
    private var phase: Phase = .ready
    private var repCount = 0
    private var reachedDepthThisRep = false
    private var trackedSide: Side?

    /// Set when tracking is lost mid-movement. Suppresses re-entering .descending until the
    /// person is confirmed standing again, so a reacquired mid-squat frame cannot be
    /// misread as the start (and, moments later, the false completion) of a brand new rep.
    private var awaitingReacquisitionBaseline = false

    private let phaseTimer = PhaseTimer()
    private let standingHysteresis = Hysteresis(
        enterThreshold: standingKneeAngle,
        exitThreshold: standingKneeAngle - 10,
        direction: .above
    )
    private let depthGate = ConfidenceGate(minConfidence: minConfidenceDefault, minPersistenceMs: depthConfidencePersistenceMs)
    private let backRoundingGate = ConfidenceGate(minConfidence: minConfidenceDefault, minPersistenceMs: backRoundingPersistenceMs)
    private let feedbackController = FeedbackController()
    private let smoother = MeasurementSmoother()
    private let insufficientDepthCooldown = Cooldown(4000)

    private var lastAssessment: AssessmentStatus = .notEvaluated

    public init() {}

    public func validateConfiguration(_ config: EvaluatorConfig?) -> ValidationResult {
        var errors: [String] = []
        if let requiredView = config?.requiredView, requiredView != .side {
            errors.append("squat currently only supports requiredView 'side'")
        }
        if let minConfidence = config?.minLandmarkConfidence, minConfidence < 0 || minConfidence > 1 {
            errors.append("minLandmarkConfidence must be between 0 and 1")
        }
        if errors.isEmpty {
            self.config = EvaluatorConfig(
                requiredView: config?.requiredView ?? .side,
                minLandmarkConfidence: config?.minLandmarkConfidence ?? minConfidenceDefault
            )
        }
        return ValidationResult(valid: errors.isEmpty, errors: errors)
    }

    public func calibrate(_ input: PoseFrame) -> CalibrationResult {
        let minConfidence = config.minLandmarkConfidence
        guard let side = pickSide(input, minConfidence: minConfidence) else {
            return CalibrationResult(calibrated: false, requiredView: .side, reason: "Required leg and hip landmarks are not visible.")
        }

        let leftShoulder = resolveLandmark(input.landmarks, .leftShoulder, minConfidence: 0)
        let rightShoulder = resolveLandmark(input.landmarks, .rightShoulder, minConfidence: 0)
        let hip = resolveLandmark(input.landmarks, hipFor(side), minConfidence: minConfidence)
        let ankle = resolveLandmark(input.landmarks, ankleFor(side), minConfidence: minConfidence)

        guard let leftShoulder, let rightShoulder, let hip, let ankle else {
            return CalibrationResult(calibrated: false, requiredView: .side, reason: "Required landmarks are not visible.")
        }

        let shoulderWidth = hypotf(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y)
        let torsoHeightRaw = hypotf(hip.x - leftShoulder.x, hip.y - leftShoulder.y)
        let torsoHeight = torsoHeightRaw == 0 ? 1 : torsoHeightRaw
        let normalizedShoulderWidth = shoulderWidth / torsoHeight

        if normalizedShoulderWidth > 0.4 {
            return CalibrationResult(
                calibrated: false,
                requiredView: .side,
                reason: "Position the camera to your side so your full body profile is visible."
            )
        }

        trackedSide = side
        return CalibrationResult(calibrated: true, requiredView: .side)
    }

    private func pickSide(_ input: PoseFrame, minConfidence: Float) -> Side? {
        let leftIds: [LandmarkId] = [.leftShoulder, .leftHip, .leftKnee, .leftAnkle]
        let rightIds: [LandmarkId] = [.rightShoulder, .rightHip, .rightKnee, .rightAnkle]
        let leftConfidence = averageConfidence(input.landmarks, leftIds)
        let rightConfidence = averageConfidence(input.landmarks, rightIds)
        if leftConfidence < minConfidence && rightConfidence < minConfidence { return nil }
        return leftConfidence >= rightConfidence ? .left : .right
    }

    public func update(_ input: PoseFrame) -> EvaluatorOutput {
        var events: [EvaluatorEvent] = []
        let minConfidence = config.minLandmarkConfidence

        if trackedSide == nil {
            let calibration = calibrate(input)
            if !calibration.calibrated {
                return EvaluatorOutput(
                    timestampMs: input.timestampMs,
                    trackingStatus: .calibrating,
                    events: [.calibrationRequired(requiredView: .side, guidance: calibration.reason ?? "Unable to calibrate.")]
                )
            }
            events.append(.calibrationCompleted(requiredView: .side))
        }

        let side = trackedSide!
        let requiredIds = [shoulderFor(side), hipFor(side), kneeFor(side), ankleFor(side)]
        let check = checkRequiredLandmarks(input.landmarks, required: requiredIds, minConfidence: minConfidence)

        var trackingStatus: TrackingStatus = .tracking
        if !check.ok {
            trackingStatus = check.missing.count == requiredIds.count ? .lost : .partial
            lastAssessment = .notEvaluated
            resetPhaseOnTrackingLoss()
            return EvaluatorOutput(timestampMs: input.timestampMs, trackingStatus: trackingStatus, events: events)
        }

        let shoulder = resolveLandmark(input.landmarks, shoulderFor(side), minConfidence: minConfidence)!
        let hip = resolveLandmark(input.landmarks, hipFor(side), minConfidence: minConfidence)!
        let knee = resolveLandmark(input.landmarks, kneeFor(side), minConfidence: minConfidence)!
        let ankle = resolveLandmark(input.landmarks, ankleFor(side), minConfidence: minConfidence)!

        let rawKneeAngle = calculateAngle(hip, knee, ankle)
        let kneeAngle = smoother.smooth("kneeAngle", rawKneeAngle, timestampMs: input.timestampMs)
        let torsoLean = smoother.smooth("torsoLean", segmentInclinationFromVertical(shoulder, hip), timestampMs: input.timestampMs)

        let confidence = averageConfidence(input.landmarks, requiredIds)
        let isStanding = standingHysteresis.update(kneeAngle)

        events.append(contentsOf: advancePhase(kneeAngle: kneeAngle, isStanding: isStanding, timestampMs: input.timestampMs))

        let depthAssessment = depthGate.evaluate(ConfidenceGateInput(
            measurable: true,
            confidence: confidence,
            conditionMet: kneeAngle <= depthKneeAngle,
            timestampMs: input.timestampMs
        ))
        if depthAssessment == .valid { reachedDepthThisRep = true }

        let backRoundingAssessment = backRoundingGate.evaluate(ConfidenceGateInput(
            measurable: phase == .descending || phase == .bottom || phase == .ascending,
            confidence: confidence,
            conditionMet: torsoLean > backRoundingLeanDegrees,
            timestampMs: input.timestampMs
        ))

        lastAssessment = (depthAssessment == .valid || backRoundingAssessment == .valid) ? .valid : depthAssessment

        var candidates: [FeedbackCandidate] = []
        if backRoundingAssessment == .valid {
            candidates.append(FeedbackCandidate(rule: backRoundingRule, timestampMs: input.timestampMs))
        }
        if phase == .ascending && !reachedDepthThisRep && insufficientDepthCooldown.isReady(input.timestampMs) {
            candidates.append(FeedbackCandidate(rule: insufficientDepthRule, timestampMs: input.timestampMs))
        }

        if let chosen = feedbackController.select(candidates) {
            if chosen.rule.issueId == "insufficient_depth" {
                insufficientDepthCooldown.trigger(input.timestampMs)
            }
            events.append(.formIssue(
                issueId: chosen.rule.issueId,
                severity: chosen.rule.severity,
                message: chosen.rule.message,
                assessment: .valid,
                confidence: confidence
            ))
        }

        return EvaluatorOutput(timestampMs: input.timestampMs, trackingStatus: trackingStatus, events: events)
    }

    private func advancePhase(kneeAngle: Float, isStanding: Bool, timestampMs: Int64) -> [EvaluatorEvent] {
        var events: [EvaluatorEvent] = []
        let previousPhase = phase

        if awaitingReacquisitionBaseline && isStanding {
            awaitingReacquisitionBaseline = false
        }

        switch phase {
        case .ready:
            if !isStanding && !awaitingReacquisitionBaseline {
                phase = .descending
                phaseTimer.enterPhase(timestampMs)
            }
        case .descending:
            if kneeAngle <= depthKneeAngle {
                phase = .bottom
                phaseTimer.enterPhase(timestampMs)
            } else if isStanding {
                phase = .ready
                reachedDepthThisRep = false
            }
        case .bottom:
            if kneeAngle > depthKneeAngle && phaseTimer.hasMetMinDuration(timestampMs, minDurationMs: minBottomDurationMs) {
                phase = .ascending
                phaseTimer.enterPhase(timestampMs)
            }
        case .ascending:
            if isStanding {
                repCount += 1
                events.append(.repCompleted(
                    repCount: repCount,
                    durationMs: nil,
                    quality: reachedDepthThisRep ? .valid : .notEvaluated
                ))
                reachedDepthThisRep = false
                phase = .ready
            } else if kneeAngle <= depthKneeAngle {
                phase = .bottom
                phaseTimer.enterPhase(timestampMs)
            }
        }

        if phase != previousPhase {
            events.insert(.phaseChanged(fromPhase: phaseName(previousPhase), toPhase: phaseName(phase)), at: 0)
        }
        return events
    }

    private func resetPhaseOnTrackingLoss() {
        if phase != .ready {
            phase = .ready
            reachedDepthThisRep = false
            awaitingReacquisitionBaseline = true
            phaseTimer.reset()
            standingHysteresis.reset()
            depthGate.reset()
            backRoundingGate.reset()
        }
    }

    public func reset() {
        phase = .ready
        repCount = 0
        reachedDepthThisRep = false
        trackedSide = nil
        awaitingReacquisitionBaseline = false
        phaseTimer.reset()
        standingHysteresis.reset()
        depthGate.reset()
        backRoundingGate.reset()
        feedbackController.reset()
        smoother.reset()
        insufficientDepthCooldown.reset()
        lastAssessment = .notEvaluated
    }

    public func getMetrics() -> ExerciseMetrics {
        ExerciseMetrics(repCount: repCount, currentPhase: phaseName(phase), lastAssessment: lastAssessment)
    }

    private func phaseName(_ phase: Phase) -> String {
        switch phase {
        case .ready: return "ready"
        case .descending: return "descending"
        case .bottom: return "bottom"
        case .ascending: return "ascending"
        }
    }

    private func shoulderFor(_ side: Side) -> LandmarkId { side == .left ? .leftShoulder : .rightShoulder }
    private func hipFor(_ side: Side) -> LandmarkId { side == .left ? .leftHip : .rightHip }
    private func kneeFor(_ side: Side) -> LandmarkId { side == .left ? .leftKnee : .rightKnee }
    private func ankleFor(_ side: Side) -> LandmarkId { side == .left ? .leftAnkle : .rightAnkle }
}
