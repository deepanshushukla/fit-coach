import type { BodyView, LandmarkId, PoseFrame, TrackingStatus } from '@formcoach/types';
import { averageConfidence, calculateAngle, distance, type Point, resolveLandmark, segmentInclinationFromVertical } from '../geometry';
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

const STANDING_KNEE_ANGLE = 160;
const DEPTH_KNEE_ANGLE = 100;
const MIN_BOTTOM_DURATION_MS = 150;
const MIN_CONFIDENCE_DEFAULT = 0.5;
const DEPTH_CONFIDENCE_PERSISTENCE_MS = 100;
/** Forward lean of the torso from vertical, in degrees, beyond which we flag back rounding risk. */
const BACK_ROUNDING_LEAN_DEGREES = 35;
const BACK_ROUNDING_PERSISTENCE_MS = 300;
/**
 * Minimum hip drop from the calibrated standing baseline, as a fraction of torso height,
 * required (alongside the knee angle) to count as real squat depth. Knee angle alone can't
 * tell a squat from standing still and bending/lifting one knee — the hip has to actually
 * descend too.
 */
const MIN_HIP_DROP_RATIO = 0.3;
/**
 * How long to wait after entering `descending` before nudging for more depth. Without this
 * delay the cue would fire the instant the knees start bending, before the lifter has had any
 * real chance to go lower.
 */
const DESCENDING_GUIDANCE_DELAY_MS = 400;

/**
 * How long a required landmark may stay below the confidence threshold before it's treated
 * as genuinely lost. A single-frame confidence dip (e.g. the ankle's MediaPipe `presence`
 * score briefly dropping under threshold from partial occlusion at full squat depth) would
 * otherwise instantly discard an in-progress rep via resetPhaseOnTrackingLoss — this grace
 * window absorbs brief blips while still catching sustained, real tracking loss.
 */
const LANDMARK_DROPOUT_GRACE_MS = 400;

const FORM_RULES: Record<'back_rounding' | 'insufficient_depth' | 'go_lower', FormRuleDefinition> = {
  back_rounding: {
    issueId: 'back_rounding',
    severity: 'warning',
    message: 'Keep your chest up and avoid rounding your back.',
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
  go_lower: {
    issueId: 'go_lower',
    severity: 'info',
    message: 'Go a little lower to hit full depth.',
    priority: 4,
    cooldownMs: 2500,
  },
};

export class SquatEvaluator implements ExerciseEvaluator {
  readonly id = 'squat';
  readonly version = '1.0.0';

  private config: EvaluatorConfig = { requiredView: 'side', minLandmarkConfidence: MIN_CONFIDENCE_DEFAULT };
  private phase: Phase = 'ready';
  private repCount = 0;
  private reachedDepthThisRep = false;
  private trackedSide: Side | undefined;
  /**
   * Set when tracking is lost mid-movement. Suppresses re-entering `descending` until the
   * person is confirmed standing again, so a reacquired mid-squat frame cannot be
   * misread as the start (and, moments later, the false completion) of a brand new rep.
   */
  private awaitingReacquisitionBaseline = false;

  /** Calibrated standing hip height (normalised y), refreshed whenever confirmed standing. */
  private standingHipY: number | undefined;

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
  private readonly backRoundingGate = new ConfidenceGate({
    minConfidence: MIN_CONFIDENCE_DEFAULT,
    minPersistenceMs: BACK_ROUNDING_PERSISTENCE_MS,
  });
  private readonly feedbackController = new FeedbackController();
  private readonly smoother = new MeasurementSmoother();
  private readonly insufficientDepthCooldown = new Cooldown(4000);

  private lastAssessment: 'valid' | 'insufficient_data' | 'not_evaluated' = 'not_evaluated';

  private readonly lastKnownPoints = new Map<LandmarkId, Point>();
  private readonly lastKnownAtMs = new Map<LandmarkId, number>();

  /** Resolves a landmark directly if confident, otherwise falls back to a recent cached position within the grace window. */
  private resolveWithGrace(landmarks: PoseFrame['landmarks'], id: LandmarkId, minConfidence: number, timestampMs: number): Point | undefined {
    const direct = resolveLandmark(landmarks, id, minConfidence);
    if (direct) {
      this.lastKnownPoints.set(id, direct);
      this.lastKnownAtMs.set(id, timestampMs);
      return direct;
    }
    const lastAt = this.lastKnownAtMs.get(id);
    if (lastAt === undefined) return undefined;
    return timestampMs - lastAt <= LANDMARK_DROPOUT_GRACE_MS ? this.lastKnownPoints.get(id) : undefined;
  }

  validateConfiguration(config: unknown): ValidationResult {
    const errors: string[] = [];
    const c = config as Partial<EvaluatorConfig> | undefined;
    const requiredView: BodyView | undefined = c?.requiredView;
    if (requiredView && requiredView !== 'side') {
      errors.push("squat currently only supports requiredView 'side'");
    }
    if (c?.minLandmarkConfidence !== undefined && (c.minLandmarkConfidence < 0 || c.minLandmarkConfidence > 1)) {
      errors.push('minLandmarkConfidence must be between 0 and 1');
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
      return { calibrated: false, requiredView: 'side', reason: 'Required leg and hip landmarks are not visible.' };
    }

    const leftShoulder = resolveLandmark(input.landmarks, 'left_shoulder', 0);
    const rightShoulder = resolveLandmark(input.landmarks, 'right_shoulder', 0);
    const hip = resolveLandmark(input.landmarks, `${side}_hip`, minConfidence);
    const ankle = resolveLandmark(input.landmarks, `${side}_ankle`, minConfidence);

    if (!leftShoulder || !rightShoulder || !hip || !ankle) {
      return { calibrated: false, requiredView: 'side', reason: 'Required landmarks are not visible.' };
    }

    const shoulderWidth = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);
    const torsoHeight = Math.hypot(hip.x - leftShoulder.x, hip.y - leftShoulder.y) || 1;
    const normalizedShoulderWidth = shoulderWidth / torsoHeight;

    if (normalizedShoulderWidth > 0.4) {
      return {
        calibrated: false,
        requiredView: 'side',
        reason: 'Position the camera to your side so your full body profile is visible.',
      };
    }

    this.trackedSide = side;
    return { calibrated: true, requiredView: 'side' };
  }

  private pickSide(input: PoseFrame, minConfidence: number): Side | undefined {
    const leftIds: LandmarkId[] = ['left_shoulder', 'left_hip', 'left_knee', 'left_ankle'];
    const rightIds: LandmarkId[] = ['right_shoulder', 'right_hip', 'right_knee', 'right_ankle'];
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
      `${side}_hip`,
      `${side}_knee`,
      `${side}_ankle`,
    ];
    const directCheck = checkRequiredLandmarks(input.landmarks, requiredIds, minConfidence);

    const shoulder = this.resolveWithGrace(input.landmarks, `${side}_shoulder`, minConfidence, input.timestampMs);
    const hip = this.resolveWithGrace(input.landmarks, `${side}_hip`, minConfidence, input.timestampMs);
    const knee = this.resolveWithGrace(input.landmarks, `${side}_knee`, minConfidence, input.timestampMs);
    const ankle = this.resolveWithGrace(input.landmarks, `${side}_ankle`, minConfidence, input.timestampMs);

    let trackingStatus: TrackingStatus = 'tracking';
    if (!shoulder || !hip || !knee || !ankle) {
      const missingCount = [shoulder, hip, knee, ankle].filter((p) => !p).length;
      trackingStatus = missingCount === requiredIds.length ? 'lost' : 'partial';
      this.lastAssessment = 'not_evaluated';
      this.resetPhaseOnTrackingLoss();
      return { timestampMs: input.timestampMs, trackingStatus, events };
    }
    trackingStatus = directCheck.ok ? 'tracking' : 'partial';

    const rawKneeAngle = calculateAngle(hip, knee, ankle);
    const kneeAngle = this.smoother.smooth('kneeAngle', rawKneeAngle, input.timestampMs);
    const torsoLean = this.smoother.smooth(
      'torsoLean',
      segmentInclinationFromVertical(shoulder, hip),
      input.timestampMs
    );

    const confidence = averageConfidence(input.landmarks, requiredIds);
    const isStanding = this.standingHysteresis.update(kneeAngle);

    const torsoHeight = distance(shoulder, hip) || 1;
    // Deliberately not `isStanding` (the latched hysteresis flag): that stays true across
    // the whole 150-160 degree exit band to avoid flicker, so it would keep chasing the hip
    // down as the squat begins and the real baseline would never freeze at true standing
    // height. Only refresh while actually near full knee extension.
    if (kneeAngle >= STANDING_KNEE_ANGLE) this.standingHipY = hip.y;
    const hipDropRatio = this.standingHipY !== undefined ? (hip.y - this.standingHipY) / torsoHeight : 0;
    const realDepthReached = kneeAngle <= DEPTH_KNEE_ANGLE && hipDropRatio >= MIN_HIP_DROP_RATIO;

    events.push(...this.advancePhase(kneeAngle, realDepthReached, isStanding, input.timestampMs));

    const depthAssessment = this.depthGate.evaluate({
      measurable: true,
      confidence,
      conditionMet: realDepthReached,
      timestampMs: input.timestampMs,
    });
    if (depthAssessment === 'valid') this.reachedDepthThisRep = true;

    const backRoundingAssessment = this.backRoundingGate.evaluate({
      measurable: this.phase === 'descending' || this.phase === 'bottom' || this.phase === 'ascending',
      confidence,
      conditionMet: torsoLean > BACK_ROUNDING_LEAN_DEGREES,
      timestampMs: input.timestampMs,
    });

    this.lastAssessment = depthAssessment === 'valid' || backRoundingAssessment === 'valid' ? 'valid' : depthAssessment;

    const candidates = [];
    if (
      backRoundingAssessment === 'valid'
    ) {
      candidates.push({ rule: FORM_RULES.back_rounding, timestampMs: input.timestampMs });
    }
    if (
      this.phase === 'ascending' &&
      !this.reachedDepthThisRep &&
      this.insufficientDepthCooldown.isReady(input.timestampMs)
    ) {
      candidates.push({ rule: FORM_RULES.insufficient_depth, timestampMs: input.timestampMs });
    }
    if (
      this.phase === 'descending' &&
      !realDepthReached &&
      this.phaseTimer.hasMetMinDuration(input.timestampMs, DESCENDING_GUIDANCE_DELAY_MS)
    ) {
      candidates.push({ rule: FORM_RULES.go_lower, timestampMs: input.timestampMs });
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

  private advancePhase(
    kneeAngle: number,
    depthReached: boolean,
    isStanding: boolean,
    timestampMs: number
  ): EvaluatorEvent[] {
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
        if (depthReached) {
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
        } else if (depthReached) {
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
      this.standingHipY = undefined;
      this.phaseTimer.reset();
      this.standingHysteresis.reset();
      this.depthGate.reset();
      this.backRoundingGate.reset();
    }
  }

  reset(): void {
    this.phase = 'ready';
    this.repCount = 0;
    this.reachedDepthThisRep = false;
    this.trackedSide = undefined;
    this.awaitingReacquisitionBaseline = false;
    this.standingHipY = undefined;
    this.phaseTimer.reset();
    this.standingHysteresis.reset();
    this.depthGate.reset();
    this.backRoundingGate.reset();
    this.feedbackController.reset();
    this.smoother.reset();
    this.insufficientDepthCooldown.reset();
    this.lastAssessment = 'not_evaluated';
    this.lastKnownPoints.clear();
    this.lastKnownAtMs.clear();
  }

  getMetrics(): ExerciseMetrics {
    return { repCount: this.repCount, currentPhase: this.phase, lastAssessment: this.lastAssessment };
  }
}
