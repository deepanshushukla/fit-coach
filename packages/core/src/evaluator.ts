import type {
  AssessmentStatus,
  BodyView,
  FeedbackSeverity,
  PoseFrame,
  TrackingStatus,
} from '@formcoach/types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface CalibrationResult {
  calibrated: boolean;
  requiredView?: BodyView;
  reason?: string;
}

export interface ExerciseMetrics {
  repCount: number;
  currentPhase: string;
  lastAssessment: AssessmentStatus;
}

export type EvaluatorEvent =
  | { type: 'phaseChanged'; fromPhase: string; toPhase: string }
  | { type: 'repCompleted'; repCount: number; durationMs?: number; quality: 'valid' | 'not_evaluated' }
  | {
      type: 'formIssue';
      issueId: string;
      severity: FeedbackSeverity;
      message: string;
      assessment: AssessmentStatus;
      confidence: number;
    }
  | { type: 'calibrationRequired'; requiredView: BodyView; guidance: string }
  | { type: 'calibrationCompleted'; requiredView: BodyView };

export interface EvaluatorOutput {
  timestampMs: number;
  trackingStatus: TrackingStatus;
  events: EvaluatorEvent[];
}

export interface EvaluatorConfig {
  requiredView: BodyView;
  minLandmarkConfidence?: number;
}

/**
 * Deterministic for a given input sequence + configuration. Must not depend on UI
 * rendering or network access, and must never throw for well-formed PoseFrame input —
 * uncertain situations are reported through AssessmentStatus/abstention, not exceptions.
 */
export interface ExerciseEvaluator {
  readonly id: string;
  readonly version: string;

  validateConfiguration(config: unknown): ValidationResult;
  calibrate(input: PoseFrame): CalibrationResult;
  update(input: PoseFrame): EvaluatorOutput;
  reset(): void;
  getMetrics(): ExerciseMetrics;
}
