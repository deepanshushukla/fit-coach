import type { FeedbackSeverity } from '@formcoach/types';
import { Cooldown } from './state-helpers';

export interface FormRuleDefinition {
  issueId: string;
  severity: FeedbackSeverity;
  message: string;
  /** 1 = tracking/setup, 2 = safety-relevant cue, 3 = main form cue, 4 = encouragement. */
  priority: 1 | 2 | 3 | 4;
  cooldownMs: number;
}

export interface FeedbackCandidate {
  rule: FormRuleDefinition;
  timestampMs: number;
}

/**
 * Chooses at most one feedback message per evaluation tick (highest priority wins —
 * lowest number first) and enforces a per-issue cooldown so the exerciser is never
 * shown contradictory cues at once or spammed with repeated alerts.
 */
export class FeedbackController {
  private readonly cooldowns = new Map<string, Cooldown>();

  select(candidates: FeedbackCandidate[]): FeedbackCandidate | undefined {
    const eligible = candidates.filter((candidate) => {
      let cooldown = this.cooldowns.get(candidate.rule.issueId);
      if (!cooldown) {
        cooldown = new Cooldown(candidate.rule.cooldownMs);
        this.cooldowns.set(candidate.rule.issueId, cooldown);
      }
      return cooldown.isReady(candidate.timestampMs);
    });

    if (eligible.length === 0) return undefined;

    eligible.sort((a, b) => a.rule.priority - b.rule.priority);
    const chosen = eligible[0]!;
    this.cooldowns.get(chosen.rule.issueId)!.trigger(chosen.timestampMs);
    return chosen;
  }

  reset(): void {
    this.cooldowns.clear();
  }
}
