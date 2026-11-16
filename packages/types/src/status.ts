/** Whether the SDK currently has a usable view of the person — a tracking fact, not a judgement. */
export type TrackingStatus =
  | 'ready'
  | 'tracking'
  | 'partial'
  | 'lost'
  | 'calibrating';

/**
 * Whether a specific measurement/rule could be evaluated — independent of TrackingStatus.
 * A person can be fully visible (`tracking`) while a given rule is `not_evaluated` because
 * its required view or landmarks aren't satisfied.
 */
export type AssessmentStatus = 'valid' | 'insufficient_data' | 'not_evaluated';

export type FeedbackSeverity = 'info' | 'warning';

export type EntitlementState = 'included' | 'locked';

export type SessionState =
  | 'created'
  | 'starting'
  | 'running'
  | 'paused'
  | 'stopped'
  | 'disposed';
