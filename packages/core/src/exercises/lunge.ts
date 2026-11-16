import type { BodyView, LandmarkId, PoseFrame, TrackingStatus } from '@formcoach/types';
import { averageConfidence, calculateAngle, normalizedHorizontalOffset, resolveLandmark } from '../geometry';
import { checkRequiredLandmarks } from '../landmark-validation';
import { Cooldown, Hysteresis, PhaseTimer } from '../state-helpers';
import { ConfidenceGate } from '../confidence-gate';
import { FeedbackController, type FormRuleDefinition } from '../feedback';
import { MeasurementSmoother } from '../smoothing';
import type {
  CalibrationResult,
  EvaluatorConfig,
  EvaluatorEvent,
  EvaluatorOutput,
  ExerciseEvaluator,
  ExerciseMetrics,
  ValidationResult,
} from '../evaluator';

/**
 * Known limitation (see spec section 4.1): the exact supported views and rules for
 * lunges must be established through device/trainer testing. This implementation
 * tracks a single calibrated leg in the side view only; alternating-leg lunges should
 * be run as separate sessions until per-leg switching is validated.
 */

type Phase = 'ready' | 'descending' | 'bottom' | 'ascending';
type Side = 'left' | 'right';

const STANDING_KNEE_ANGLE = 160;
const DEPTH_KNEE_ANGLE = 110;
const MIN_BOTTOM_DURATION_MS = 150;
const MIN_CONFIDENCE_DEFAULT = 0.5;
const DEPTH_CONFIDENCE_PERSISTENCE_MS = 100;
const KNEE_OVER_TOE_OFFSET = 0.5;
const KNEE_OVER_TOE_PERSISTENCE_MS = 250;

const FORM_RULES: Record<'front_knee_over_toe' | 'insufficient_depth', FormRuleDefinition> = {
  front_knee_over_toe: {
    issueId: 'front_knee_over_toe',
    severity: 'warning',
    message: 'Keep your front knee aligned over your ankle.',
    priority: 2,
    cooldownMs: 4000,
  },
  insufficient_depth: {
    issueId: 'insufficient_depth',
    severity: 'info',
    message: 'Lower your back knee closer to the ground for a full rep.',
    priority: 3,
    cooldownMs: 4000,
  },
};

export class LungeEvaluator implements ExerciseEvaluator {
  readonly id = 'lunge';
  readonly version = '1.0.0';

  private config: EvaluatorConfig = { requiredView: 'side', minLandmarkConfidence: MIN_CONFIDENCE_DEFAULT };
  private phase: Phase = 'ready';
  private repCount = 0;
  private reachedDepthThisRep = false;
  private trackedSide: Side | undefined;
  /** Suppresses re-entering `descending` after a tracking loss until standing is confirmed. */
  private awaitingReacquisitionBaseline = false;

  private readonly phaseTimer = new PhaseTimer();
  private readonly standingHysteresis = new Hysteresis({
    enterThreshold: STANDING_KNEE_ANGLE,
    exitThreshold: STANDING_KNEE_ANGLE - 10,
    direction: 'above',
  });
  private readonly depthGate = new ConfidenceGate({
    minConfidence: MIN_CONFIDENCE_DEFAULT,
    minPersistenceMs: DEPTH_CONFIDENCE_PERSISTENCE_MS,
  });
  private readonly kneeOverToeGate = new ConfidenceGate({
    minConfidence: MIN_CONFIDENCE_DEFAULT,
    minPersistenceMs: KNEE_OVER_TOE_PERSISTENCE_MS,
  });
  private readonly feedbackController = new FeedbackController();
  private readonly smoother = new MeasurementSmoother();
  private readonly insufficientDepthCooldown = new Cooldown(4000);

  private lastAssessment: 'valid' | 'insufficient_data' | 'not_evaluated' = 'not_evaluated';

  validateConfiguration(config: unknown): ValidationResult {
    const errors: string[] = [];
    const c = config as Partial<EvaluatorConfig> | undefined;
    const requiredView: BodyView | undefined = c?.requiredView;
    if (requiredView && requiredView !== 'side') {
      errors.push("lunge currently only supports requiredView 'side'");
    }
    if (errors.length === 0) {
      this.config = {
        requiredView: requiredView ?? 'side',
        minLandmarkConfidence: c?.minLandmarkConfidence ?? MIN_CONFIDENCE_DEFAULT,
      };
    }
    return { valid: errors.length === 0, errors };
  }

  calibrate(input: PoseFrame): CalibrationResult {
    const minConfidence = this.config.minLandmarkConfidence ?? MIN_CONFIDENCE_DEFAULT;
    const side = this.pickSide(input, minConfidence);
    if (!side) {
      return { calibrated: false, requiredView: 'side', reason: 'Required leg landmarks are not visible.' };
    }
    this.trackedSide = side;
    return { calibrated: true, requiredView: 'side' };
  }

  private pickSide(input: PoseFrame, minConfidence: number): Side | undefined {
    const leftIds: LandmarkId[] = ['left_hip', 'left_knee', 'left_ankle', 'left_foot_index'];
    const rightIds: LandmarkId[] = ['right_hip', 'right_knee', 'right_ankle', 'right_foot_index'];
    const leftConfidence = averageConfidence(input.landmarks, leftIds);
    const rightConfidence = averageConfidence(input.landmarks, rightIds);
    if (leftConfidence < minConfidence && rightConfidence < minConfidence) return undefined;
    return leftConfidence >= rightConfidence ? 'left' : 'right';
  }

  update(input: PoseFrame): EvaluatorOutput {
    const events: EvaluatorEvent[] = [];
    const minConfidence = this.config.minLandmarkConfidence ?? MIN_CONFIDENCE_DEFAULT;

    if (!this.trackedSide) {
      const calibration = this.calibrate(input);
      if (!calibration.calibrated) {
        return {
          timestampMs: input.timestampMs,
          trackingStatus: 'calibrating',
          events: [{ type: 'calibrationRequired', requiredView: 'side', guidance: calibration.reason ?? 'Unable to calibrate.' }],
        };
      }
      events.push({ type: 'calibrationCompleted', requiredView: 'side' });
    }

    const side = this.trackedSide!;
    const requiredIds: LandmarkId[] = [`${side}_hip`, `${side}_knee`, `${side}_ankle`, `${side}_foot_index`];
    const check = checkRequiredLandmarks(input.landmarks, requiredIds, minConfidence);

    let trackingStatus: TrackingStatus = 'tracking';
    if (!check.ok) {
      trackingStatus = check.missing.length === requiredIds.length ? 'lost' : 'partial';
      this.lastAssessment = 'not_evaluated';
      this.resetPhaseOnTrackingLoss();
      return { timestampMs: input.timestampMs, trackingStatus, events };
    }

    const hip = resolveLandmark(input.landmarks, `${side}_hip`, minConfidence)!;
    const knee = resolveLandmark(input.landmarks, `${side}_knee`, minConfidence)!;
    const ankle = resolveLandmark(input.landmarks, `${side}_ankle`, minConfidence)!;
    const footIndex = resolveLandmark(input.landmarks, `${side}_foot_index`, minConfidence)!;

    const rawKneeAngle = calculateAngle(hip, knee, ankle);
    const kneeAngle = this.smoother.smooth('kneeAngle', rawKneeAngle, input.timestampMs);
    const shinLength = Math.hypot(knee.x - ankle.x, knee.y - ankle.y) || 1;
    const kneeOverToeOffset = Math.abs(normalizedHorizontalOffset(knee, footIndex, shinLength));

    const confidence = averageConfidence(input.landmarks, requiredIds);
    const isStanding = this.standingHysteresis.update(kneeAngle);

    events.push(...this.advancePhase(kneeAngle, isStanding, input.timestampMs));

    const depthAssessment = this.depthGate.evaluate({
      measurable: true,
      confidence,
      conditionMet: kneeAngle <= DEPTH_KNEE_ANGLE,
      timestampMs: input.timestampMs,
    });
    if (depthAssessment === 'valid') this.reachedDepthThisRep = true;

    const kneeOverToeAssessment = this.kneeOverToeGate.evaluate({
      measurable: this.phase === 'bottom' || this.phase === 'descending',
      confidence,
      conditionMet: kneeOverToeOffset > KNEE_OVER_TOE_OFFSET,
      timestampMs: input.timestampMs,
    });

    this.lastAssessment = depthAssessment === 'valid' || kneeOverToeAssessment === 'valid' ? 'valid' : depthAssessment;

    const candidates = [];
    if (kneeOverToeAssessment === 'valid') {
      candidates.push({ rule: FORM_RULES.front_knee_over_toe, timestampMs: input.timestampMs });
    }
    if (
      this.phase === 'ascending' &&
      !this.reachedDepthThisRep &&
      this.insufficientDepthCooldown.isReady(input.timestampMs)
    ) {
      candidates.push({ rule: FORM_RULES.insufficient_depth, timestampMs: input.timestampMs });
    }

    const chosen = this.feedbackController.select(candidates);
    if (chosen) {
      if (chosen.rule.issueId === 'insufficient_depth') this.insufficientDepthCooldown.trigger(input.timestampMs);
      events.push({
        type: 'formIssue',
        issueId: chosen.rule.issueId,
        severity: chosen.rule.severity,
        message: chosen.rule.message,
        assessment: 'valid',
        confidence,
      });
    }

    return { timestampMs: input.timestampMs, trackingStatus, events };
  }

  private advancePhase(kneeAngle: number, isStanding: boolean, timestampMs: number): EvaluatorEvent[] {
    const events: EvaluatorEvent[] = [];
    const previousPhase = this.phase;

    if (this.awaitingReacquisitionBaseline) {
      if (isStanding) this.awaitingReacquisitionBaseline = false;
    }

    switch (this.phase) {
      case 'ready':
        if (!isStanding && !this.awaitingReacquisitionBaseline) {
          this.phase = 'descending';
          this.phaseTimer.enterPhase(timestampMs);
        }
        break;
      case 'descending':
        if (kneeAngle <= DEPTH_KNEE_ANGLE) {
          this.phase = 'bottom';
          this.phaseTimer.enterPhase(timestampMs);
        } else if (isStanding) {
          this.phase = 'ready';
          this.reachedDepthThisRep = false;
        }
        break;
      case 'bottom':
        if (kneeAngle > DEPTH_KNEE_ANGLE && this.phaseTimer.hasMetMinDuration(timestampMs, MIN_BOTTOM_DURATION_MS)) {
          this.phase = 'ascending';
          this.phaseTimer.enterPhase(timestampMs);
        }
        break;
      case 'ascending':
        if (isStanding) {
          this.repCount += 1;
          events.push({
            type: 'repCompleted',
            repCount: this.repCount,
            durationMs: undefined,
            quality: this.reachedDepthThisRep ? 'valid' : 'not_evaluated',
          });
          this.reachedDepthThisRep = false;
          this.phase = 'ready';
        } else if (kneeAngle <= DEPTH_KNEE_ANGLE) {
          this.phase = 'bottom';
          this.phaseTimer.enterPhase(timestampMs);
        }
        break;
    }

    if (this.phase !== previousPhase) {
      events.unshift({ type: 'phaseChanged', fromPhase: previousPhase, toPhase: this.phase });
    }
    return events;
  }

  private resetPhaseOnTrackingLoss(): void {
    if (this.phase !== 'ready') {
      this.phase = 'ready';
      this.reachedDepthThisRep = false;
      this.awaitingReacquisitionBaseline = true;
      this.phaseTimer.reset();
      this.standingHysteresis.reset();
      this.depthGate.reset();
      this.kneeOverToeGate.reset();
    }
  }

  reset(): void {
    this.phase = 'ready';
    this.repCount = 0;
    this.reachedDepthThisRep = false;
    this.trackedSide = undefined;
    this.awaitingReacquisitionBaseline = false;
    this.phaseTimer.reset();
    this.standingHysteresis.reset();
    this.depthGate.reset();
    this.kneeOverToeGate.reset();
    this.feedbackController.reset();
    this.smoother.reset();
    this.insufficientDepthCooldown.reset();
    this.lastAssessment = 'not_evaluated';
  }

  getMetrics(): ExerciseMetrics {
    return { repCount: this.repCount, currentPhase: this.phase, lastAssessment: this.lastAssessment };
  }
}
