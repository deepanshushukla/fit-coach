import type { BodyView } from './pose';
import type { EntitlementState } from './status';

export type PublicationStatus = 'draft' | 'testing' | 'published' | 'deprecated';

export interface ExerciseSummary {
  id: string;
  name: string;
  entitlement: EntitlementState;
}

export interface ExerciseLimitation {
  id: string;
  description: string;
}

export interface ExerciseDetails {
  id: string;
  name: string;
  description: string;
  instructions: string;
  publicationStatus: PublicationStatus;
  entitlement: EntitlementState;
  supportedViews: BodyView[];
  minSdkVersion: string;
  /** Version of the exercise-specific evaluator logic, independent of the SDK package version. */
  evaluatorVersion: string;
  limitations: ExerciseLimitation[];
  setupGuidance: string;
}

export interface PlanSummary {
  id: string;
  code: string;
  name: string;
  /** Explicit exercise IDs included — never a bare count, so plan contents are deterministic. */
  exerciseIds: string[];
  billingPeriod: 'monthly' | 'annual' | 'custom';
}
