import type { BodyView, LandmarkId, PoseFrame, TrackingStatus } from '@formcoach/types';
import { averageConfidence, distance, normalizedDistance, resolveLandmark } from '../geometry';
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

const REQUIRED_IDS: LandmarkId[] = ['left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle'];

/**
 * Standing/depth thresholds on `depthRatio = (hip.y - knee.y) / distance(hip, knee)`,
 * averaged across both legs. Standing: hip sits a full thigh-length above the knee, so
 * this is close to -1. Full squat depth (hip at knee height): close to 0. This replaces
 * side view's knee-angle signal, which barely changes in 2D when viewed head-on — the
 * bend happens mostly along the camera's depth axis there. Same unvalidated-heuristic
 * caveat as the side-view thresholds: not checked against a real person yet.
 */
const STANDING_DEPTH_RATIO = -0.85;
const STANDING_EXIT_DEPTH_RATIO = -0.75;
const DEPTH_RATIO_THRESHOLD = -0.1;
const MIN_BOTTOM_DURATION_MS = 150;
const MIN_CONFIDENCE_DEFAULT = 0.5;
const DEPTH_CONFIDENCE_PERSISTENCE_MS = 100;
/** kneeWidth / ankleWidth below this, sustained, reads as knees caving inward. */
const KNEE_VALGUS_RATIO_THRESHOLD = 0.7;
const KNEE_VALGUS_PERSISTENCE_MS = 300;

const FORM_RULES: Record<'knee_valgus' | 'insufficient_depth', FormRuleDefinition> = {
  knee_valgus: {
    issueId: 'knee_valgus',
    severity: 'warning',
    message: "Keep your knees tracking over your toes — don't let them cave inward.",
    priority: 2,
    cooldownMs: 4000,
  },
  insufficient_depth: {
    issueId: 'insufficient_depth',
    severity: 'info',
    message: 'Try to squat a little deeper for a full rep.',
    priority: 3,
    cooldownMs: 4000,
  },
};

/**
 * Front-facing squat evaluator. Complementary to SquatEvaluator (side view), not a
 * degraded version of it: this view loses back-rounding (torso lean is along the camera
 * axis, invisible in 2D) but gains knee-valgus checking (both legs visible, so left/right
 * knee position can be compared — side view can't do that with only one leg in frame).
 */
export class SquatFrontViewEvaluator implements ExerciseEvaluator {
  readonly id = 'squat';
  readonly version = '1.0.0-front';

  private config: EvaluatorConfig = { requiredView: 'front', minLandmarkConfidence: MIN_CONFIDENCE_DEFAULT };
  private phase: Phase = 'ready';
  private repCount = 0;
  private reachedDepthThisRep = false;
  private calibrated = false;
  /** Same reacquisition guard as the side-view evaluator — see squat.ts for the rationale. */
  private awaitingReacquisitionBaseline = false;

  private readonly phaseTimer = new PhaseTimer();
  private readonly standingHysteresis = new Hysteresis({
    enterThreshold: STANDING_DEPTH_RATIO,
    exitThreshold: STANDING_EXIT_DEPTH_RATIO,
    direction: 'below',
  });
  private readonly depthGate = new ConfidenceGate({
    minConfidence: MIN_CONFIDENCE_DEFAULT,
    minPersistenceMs: DEPTH_CONFIDENCE_PERSISTENCE_MS,
  });
  private readonly valgusGate = new ConfidenceGate({
    minConfidence: MIN_CONFIDENCE_DEFAULT,
    minPersistenceMs: KNEE_VALGUS_PERSISTENCE_MS,
  });
  private readonly feedbackController = new FeedbackController();
  private readonly smoother = new MeasurementSmoother();
  private readonly insufficientDepthCooldown = new Cooldown(4000);

  private lastAssessment: 'valid' | 'insufficient_data' | 'not_evaluated' = 'not_evaluated';

  validateConfiguration(config: unknown): ValidationResult {
    const errors: string[] = [];
    const c = config as Partial<EvaluatorConfig> | undefined;
    const requiredView: BodyView | undefined = c?.requiredView;
    if (requiredView && requiredView !== 'front') {
      errors.push("squat (front view) currently only supports requiredView 'front'");
    }
    if (c?.minLandmarkConfidence !== undefined && (c.minLandmarkConfidence < 0 || c.minLandmarkConfidence > 1)) {
      errors.push('minLandmarkConfidence must be between 0 and 1');
    }
    if (errors.length === 0) {
      this.config = {
        requiredView: requiredView ?? 'front',
        minLandmarkConfidence: c?.minLandmarkConfidence ?? MIN_CONFIDENCE_DEFAULT,
      };
    }
    return { valid: errors.length === 0, errors };
  }

  calibrate(input: PoseFrame): CalibrationResult {
    const minConfidence = this.config.minLandmarkConfidence ?? MIN_CONFIDENCE_DEFAULT;
    const check = checkRequiredLandmarks(input.landmarks, REQUIRED_IDS, minConfidence);
    if (!check.ok) {
      return { calibrated: false, requiredView: 'front', reason: 'Required leg and hip landmarks are not visible.' };
    }

    const leftShoulder = resolveLandmark(input.landmarks, 'left_shoulder', 0);
    const rightShoulder = resolveLandmark(input.landmarks, 'right_shoulder', 0);
    const hip = resolveLandmark(input.landmarks, 'left_hip', minConfidence);
    if (!leftShoulder || !rightShoulder || !hip) {
      return { calibrated: false, requiredView: 'front', reason: 'Required landmarks are not visible.' };
    }

    const shoulderWidth = distance(leftShoulder, rightShoulder);
    const torsoHeight = distance(hip, leftShoulder) || 1;
    const normalizedShoulderWidth = shoulderWidth / torsoHeight;

    // Inverted vs. side view's calibration: front view needs shoulders to look WIDE
    // relative to torso height — that's what tells us the person is facing the camera
    // rather than standing sideways to it.
    if (normalizedShoulderWidth <= 0.4) {
      return {
        calibrated: false,
        requiredView: 'front',
        reason: 'Position the camera to face you directly so both shoulders and both legs are visible.',
      };
    }

    this.calibrated = true;
    return { calibrated: true, requiredView: 'front' };
  }

  update(input: PoseFrame): EvaluatorOutput {
    const events: EvaluatorEvent[] = [];
    const minConfidence = this.config.minLandmarkConfidence ?? MIN_CONFIDENCE_DEFAULT;

    if (!this.calibrated) {
      const calibration = this.calibrate(input);
      if (!calibration.calibrated) {
        return {
          timestampMs: input.timestampMs,
          trackingStatus: 'calibrating',
          events: [{ type: 'calibrationRequired', requiredView: 'front', guidance: calibration.reason ?? 'Unable to calibrate.' }],
        };
      }
      events.push({ type: 'calibrationCompleted', requiredView: 'front' });
    }

    const check = checkRequiredLandmarks(input.landmarks, REQUIRED_IDS, minConfidence);
    let trackingStatus: TrackingStatus = 'tracking';
    if (!check.ok) {
      trackingStatus = check.missing.length === REQUIRED_IDS.length ? 'lost' : 'partial';
      this.lastAssessment = 'not_evaluated';
      this.resetPhaseOnTrackingLoss();
      return { timestampMs: input.timestampMs, trackingStatus, events };
    }

    const leftHip = resolveLandmark(input.landmarks, 'left_hip', minConfidence)!;
    const rightHip = resolveLandmark(input.landmarks, 'right_hip', minConfidence)!;
    const leftKnee = resolveLandmark(input.landmarks, 'left_knee', minConfidence)!;
    const rightKnee = resolveLandmark(input.landmarks, 'right_knee', minConfidence)!;
    const leftAnkle = resolveLandmark(input.landmarks, 'left_ankle', minConfidence)!;
    const rightAnkle = resolveLandmark(input.landmarks, 'right_ankle', minConfidence)!;

    const leftDepthRatio = (leftHip.y - leftKnee.y) / (distance(leftHip, leftKnee) || 1);
    const rightDepthRatio = (rightHip.y - rightKnee.y) / (distance(rightHip, rightKnee) || 1);
    const depthRatio = this.smoother.smooth('depthRatio', (leftDepthRatio + rightDepthRatio) / 2, input.timestampMs);

    const ankleWidth = distance(leftAnkle, rightAnkle);
    const valgusRatio = this.smoother.smooth(
      'valgusRatio',
      normalizedDistance(leftKnee, rightKnee, ankleWidth),
      input.timestampMs
    );

    const confidence = averageConfidence(input.landmarks, REQUIRED_IDS);
    const isStanding = this.standingHysteresis.update(depthRatio);

    events.push(...this.advancePhase(depthRatio, isStanding, input.timestampMs));

    const depthAssessment = this.depthGate.evaluate({
      measurable: true,
      confidence,
      conditionMet: depthRatio >= DEPTH_RATIO_THRESHOLD,
      timestampMs: input.timestampMs,
    });
    if (depthAssessment === 'valid') this.reachedDepthThisRep = true;

    const valgusAssessment = this.valgusGate.evaluate({
      measurable: this.phase === 'descending' || this.phase === 'bottom' || this.phase === 'ascending',
      confidence,
      conditionMet: valgusRatio < KNEE_VALGUS_RATIO_THRESHOLD,
      timestampMs: input.timestampMs,
    });

    this.lastAssessment = depthAssessment === 'valid' || valgusAssessment === 'valid' ? 'valid' : depthAssessment;

    const candidates = [];
    if (valgusAssessment === 'valid') {
      candidates.push({ rule: FORM_RULES.knee_valgus, timestampMs: input.timestampMs });
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

  private advancePhase(depthRatio: number, isStanding: boolean, timestampMs: number): EvaluatorEvent[] {
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
        if (depthRatio >= DEPTH_RATIO_THRESHOLD) {
          this.phase = 'bottom';
          this.phaseTimer.enterPhase(timestampMs);
        } else if (isStanding) {
          this.phase = 'ready';
          this.reachedDepthThisRep = false;
        }
        break;
      case 'bottom':
        if (depthRatio < DEPTH_RATIO_THRESHOLD && this.phaseTimer.hasMetMinDuration(timestampMs, MIN_BOTTOM_DURATION_MS)) {
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
        } else if (depthRatio >= DEPTH_RATIO_THRESHOLD) {
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
      this.valgusGate.reset();
    }
  }

  reset(): void {
    this.phase = 'ready';
    this.repCount = 0;
    this.reachedDepthThisRep = false;
    this.calibrated = false;
    this.awaitingReacquisitionBaseline = false;
    this.phaseTimer.reset();
    this.standingHysteresis.reset();
    this.depthGate.reset();
    this.valgusGate.reset();
    this.feedbackController.reset();
    this.smoother.reset();
    this.insufficientDepthCooldown.reset();
    this.lastAssessment = 'not_evaluated';
  }

  getMetrics(): ExerciseMetrics {
    return { repCount: this.repCount, currentPhase: this.phase, lastAssessment: this.lastAssessment };
  }
}
