import type { AssessmentStatus, FeedbackSeverity, TrackingStatus } from './status';
import type { BodyView } from './pose';

interface BaseEvent {
  sessionId: string;
  timestampMs: number;
}

export interface ReadyEvent extends BaseEvent {
  exerciseId: string;
  evaluatorVersion: string;
}

export interface TrackingUpdateEvent extends BaseEvent {
  status: TrackingStatus;
  visibleLandmarkCount: number;
}

export interface TrackingLostEvent extends BaseEvent {
  reason: 'out_of_frame' | 'occluded' | 'low_light' | 'camera_moved' | 'subject_switched' | 'unknown';
}

export interface CalibrationRequiredEvent extends BaseEvent {
  requiredView: BodyView;
  guidance: string;
}

export interface CalibrationCompletedEvent extends BaseEvent {
  requiredView: BodyView;
}

export interface PhaseChangedEvent extends BaseEvent {
  exerciseId: string;
  fromPhase: string;
  toPhase: string;
}

export interface RepCompletedEvent extends BaseEvent {
  exerciseId: string;
  repCount: number;
  durationMs?: number;
  quality?: 'valid' | 'not_evaluated';
}

export interface FormIssueEvent extends BaseEvent {
  exerciseId: string;
  issueId: string;
  severity: FeedbackSeverity;
  message: string;
  assessment: AssessmentStatus;
  confidence: number;
}

export interface FeedbackEvent extends BaseEvent {
  exerciseId: string;
  /** Priority rank: 1 = tracking/setup issue, 2 = safety-relevant cue, 3 = main form cue, 4 = encouragement. */
  priority: 1 | 2 | 3 | 4;
  message: string;
  channel: 'visual' | 'voice' | 'haptic';
}

export interface PerformanceEvent extends BaseEvent {
  effectiveFps: number;
  droppedFrameCount: number;
  inferenceLatencyMsP50: number;
  inferenceLatencyMsP95: number;
  thermalState: 'nominal' | 'fair' | 'serious' | 'critical';
}

export interface SessionSummary {
  sessionId: string;
  exerciseId: string;
  evaluatorVersion: string;
  startedAtMs: number;
  endedAtMs: number;
  repCount: number;
  formIssueCounts: Record<string, number>;
  abstentionDurationMs: number;
}

export interface SessionCompletedEvent extends BaseEvent {
  summary: SessionSummary;
}

export interface SdkErrorEvent extends BaseEvent {
  code: string;
  message: string;
  recoverable: boolean;
}

export interface FormCoachEventMap {
  ready: ReadyEvent;
  trackingUpdate: TrackingUpdateEvent;
  trackingLost: TrackingLostEvent;
  calibrationRequired: CalibrationRequiredEvent;
  calibrationCompleted: CalibrationCompletedEvent;
  phaseChanged: PhaseChangedEvent;
  repCompleted: RepCompletedEvent;
  formIssue: FormIssueEvent;
  feedback: FeedbackEvent;
  performance: PerformanceEvent;
  sessionCompleted: SessionCompletedEvent;
  error: SdkErrorEvent;
}

export type FormCoachEventName = keyof FormCoachEventMap;
