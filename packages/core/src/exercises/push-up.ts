import type { BodyView, LandmarkId, PoseFrame, TrackingStatus } from '@formcoach/types';
import { averageConfidence, calculateAngle, resolveLandmark } from '../geometry';
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

type Phase = 'ready' | 'descending' | 'bottom' | 'ascending';
type Side = 'left' | 'right';

const EXTENDED_ELBOW_ANGLE = 155;
const DEPTH_ELBOW_ANGLE = 95;
const MIN_BOTTOM_DURATION_MS = 120;
const MIN_CONFIDENCE_DEFAULT = 0.5;
const DEPTH_CONFIDENCE_PERSISTENCE_MS = 100;
const HIP_SAG_ALIGNMENT_ANGLE = 155;
const HIP_SAG_PERSISTENCE_MS = 250;

const FORM_RULES: Record<'hips_sagging' | 'insufficient_depth', FormRuleDefinition> = {
  hips_sagging: {
    issueId: 'hips_sagging',
    severity: 'warning',
    message: 'Keep your hips in line with your shoulders and ankles.',
    priority: 2,
    cooldownMs: 4000,
  },
  insufficient_depth: {
    issueId: 'insufficient_depth',
    severity: 'info',
    message: 'Lower your chest further for a full rep.',
    priority: 3,
    cooldownMs: 4000,
  },
};

export class PushUpEvaluator implements ExerciseEvaluator {
  readonly id = 'push_up';
  readonly version = '1.0.0';

  private config: EvaluatorConfig = { requiredView: 'side', minLandmarkConfidence: MIN_CONFIDENCE_DEFAULT };
  private phase: Phase = 'ready';
  private repCount = 0;
  private reachedDepthThisRep = false;
  private trackedSide: Side | undefined;
  /** Suppresses re-entering `descending` after a tracking loss until extension is confirmed. */
  private awaitingReacquisitionBaseline = false;

  private readonly phaseTimer = new PhaseTimer();
  private readonly extendedHysteresis = new Hysteresis({
    enterThreshold: EXTENDED_ELBOW_ANGLE,
    exitThreshold: EXTENDED_ELBOW_ANGLE - 10,
    direction: 'above',
  });
  private readonly depthGate = new ConfidenceGate({
    minConfidence: MIN_CONFIDENCE_DEFAULT,
    minPersistenceMs: DEPTH_CONFIDENCE_PERSISTENCE_MS,
  });
  private readonly hipSagGate = new ConfidenceGate({
    minConfidence: MIN_CONFIDENCE_DEFAULT,
    minPersistenceMs: HIP_SAG_PERSISTENCE_MS,
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
      errors.push("push_up currently only supports requiredView 'side'");
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
      return { calibrated: false, requiredView: 'side', reason: 'Required arm, hip and ankle landmarks are not visible.' };
    }
    this.trackedSide = side;
    return { calibrated: true, requiredView: 'side' };
  }

  private pickSide(input: PoseFrame, minConfidence: number): Side | undefined {
    const leftIds: LandmarkId[] = ['left_shoulder', 'left_elbow', 'left_wrist', 'left_hip', 'left_ankle'];
    const rightIds: LandmarkId[] = ['right_shoulder', 'right_elbow', 'right_wrist', 'right_hip', 'right_ankle'];
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
    const requiredIds: LandmarkId[] = [
      `${side}_shoulder`,
      `${side}_elbow`,
      `${side}_wrist`,
      `${side}_hip`,
      `${side}_ankle`,
    ];
    const check = checkRequiredLandmarks(input.landmarks, requiredIds, minConfidence);

    let trackingStatus: TrackingStatus = 'tracking';
    if (!check.ok) {
      trackingStatus = check.missing.length === requiredIds.length ? 'lost' : 'partial';
      this.lastAssessment = 'not_evaluated';
      this.resetPhaseOnTrackingLoss();
      return { timestampMs: input.timestampMs, trackingStatus, events };
    }

    const shoulder = resolveLandmark(input.landmarks, `${side}_shoulder`, minConfidence)!;
    const elbow = resolveLandmark(input.landmarks, `${side}_elbow`, minConfidence)!;
    const wrist = resolveLandmark(input.landmarks, `${side}_wrist`, minConfidence)!;
    const hip = resolveLandmark(input.landmarks, `${side}_hip`, minConfidence)!;
    const ankle = resolveLandmark(input.landmarks, `${side}_ankle`, minConfidence)!;

    const rawElbowAngle = calculateAngle(shoulder, elbow, wrist);
    const elbowAngle = this.smoother.smooth('elbowAngle', rawElbowAngle, input.timestampMs);
    const alignmentAngle = this.smoother.smooth(
      'alignmentAngle',
      calculateAngle(shoulder, hip, ankle),
      input.timestampMs
    );

    const confidence = averageConfidence(input.landmarks, requiredIds);
    const isExtended = this.extendedHysteresis.update(elbowAngle);

    events.push(...this.advancePhase(elbowAngle, isExtended, input.timestampMs));

    const depthAssessment = this.depthGate.evaluate({
      measurable: true,
      confidence,
      conditionMet: elbowAngle <= DEPTH_ELBOW_ANGLE,
      timestampMs: input.timestampMs,
    });
    if (depthAssessment === 'valid') this.reachedDepthThisRep = true;

    const hipSagAssessment = this.hipSagGate.evaluate({
      measurable: this.phase !== 'ready',
      confidence,
      conditionMet: alignmentAngle < HIP_SAG_ALIGNMENT_ANGLE,
      timestampMs: input.timestampMs,
    });

    this.lastAssessment = depthAssessment === 'valid' || hipSagAssessment === 'valid' ? 'valid' : depthAssessment;

    const candidates = [];
    if (hipSagAssessment === 'valid') {
      candidates.push({ rule: FORM_RULES.hips_sagging, timestampMs: input.timestampMs });
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

  private advancePhase(elbowAngle: number, isExtended: boolean, timestampMs: number): EvaluatorEvent[] {
    const events: EvaluatorEvent[] = [];
    const previousPhase = this.phase;

    if (this.awaitingReacquisitionBaseline) {
      if (isExtended) this.awaitingReacquisitionBaseline = false;
    }

    switch (this.phase) {
      case 'ready':
        if (!isExtended && !this.awaitingReacquisitionBaseline) {
          this.phase = 'descending';
          this.phaseTimer.enterPhase(timestampMs);
        }
        break;
      case 'descending':
        if (elbowAngle <= DEPTH_ELBOW_ANGLE) {
          this.phase = 'bottom';
          this.phaseTimer.enterPhase(timestampMs);
        } else if (isExtended) {
          this.phase = 'ready';
          this.reachedDepthThisRep = false;
        }
        break;
      case 'bottom':
        if (elbowAngle > DEPTH_ELBOW_ANGLE && this.phaseTimer.hasMetMinDuration(timestampMs, MIN_BOTTOM_DURATION_MS)) {
          this.phase = 'ascending';
          this.phaseTimer.enterPhase(timestampMs);
        }
        break;
      case 'ascending':
        if (isExtended) {
          this.repCount += 1;
          events.push({
            type: 'repCompleted',
            repCount: this.repCount,
            durationMs: undefined,
            quality: this.reachedDepthThisRep ? 'valid' : 'not_evaluated',
          });
          this.reachedDepthThisRep = false;
          this.phase = 'ready';
        } else if (elbowAngle <= DEPTH_ELBOW_ANGLE) {
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
      this.extendedHysteresis.reset();
      this.depthGate.reset();
      this.hipSagGate.reset();
    }
  }

  reset(): void {
    this.phase = 'ready';
    this.repCount = 0;
    this.reachedDepthThisRep = false;
    this.trackedSide = undefined;
    this.awaitingReacquisitionBaseline = false;
    this.phaseTimer.reset();
    this.extendedHysteresis.reset();
    this.depthGate.reset();
    this.hipSagGate.reset();
    this.feedbackController.reset();
    this.smoother.reset();
    this.insufficientDepthCooldown.reset();
    this.lastAssessment = 'not_evaluated';
  }

  getMetrics(): ExerciseMetrics {
    return { repCount: this.repCount, currentPhase: this.phase, lastAssessment: this.lastAssessment };
  }
}
