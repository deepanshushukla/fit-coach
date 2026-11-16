import type { AssessmentStatus } from '@formcoach/types';

export interface ConfidenceGateConfig {
  minConfidence: number;
  /** A condition must hold continuously for at least this long before it is reported as `valid`. */
  minPersistenceMs: number;
}

/**
 * Converts a noisy per-frame rule evaluation into a stable AssessmentStatus.
 * `valid` requires the condition to be both confidently measurable and persistent.
 * A single noisy frame cannot flip the result — this is what makes the system prefer
 * silence over a guessed form score.
 */
export class ConfidenceGate {
  private readonly config: ConfidenceGateConfig;
  private conditionSinceMs?: number;

  constructor(config: ConfidenceGateConfig) {
    this.config = config;
  }

  evaluate(
    options: { measurable: boolean; confidence: number; conditionMet: boolean; timestampMs: number }
  ): AssessmentStatus {
    const { measurable, confidence, conditionMet, timestampMs } = options;

    if (!measurable) {
      this.conditionSinceMs = undefined;
      return 'not_evaluated';
    }

    if (confidence < this.config.minConfidence) {
      this.conditionSinceMs = undefined;
      return 'insufficient_data';
    }

    if (!conditionMet) {
      this.conditionSinceMs = undefined;
      return 'insufficient_data';
    }

    if (this.conditionSinceMs === undefined) {
      this.conditionSinceMs = timestampMs;
    }

    const persistedMs = timestampMs - this.conditionSinceMs;
    return persistedMs >= this.config.minPersistenceMs ? 'valid' : 'insufficient_data';
  }

  reset(): void {
    this.conditionSinceMs = undefined;
  }
}
