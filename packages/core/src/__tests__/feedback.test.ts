import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FeedbackController } from '../feedback';
import type { FormRuleDefinition } from '../feedback';

const safety: FormRuleDefinition = {
  issueId: 'safety_rule',
  severity: 'warning',
  message: 'safety',
  priority: 2,
  cooldownMs: 1000,
};
const mainCue: FormRuleDefinition = {
  issueId: 'main_rule',
  severity: 'info',
  message: 'main',
  priority: 3,
  cooldownMs: 1000,
};

test('selects the highest priority candidate (lowest number) when multiple are eligible', () => {
  const controller = new FeedbackController();
  const chosen = controller.select([
    { rule: mainCue, timestampMs: 0 },
    { rule: safety, timestampMs: 0 },
  ]);
  assert.equal(chosen?.rule.issueId, 'safety_rule');
});

test('enforces per-issue cooldown so repeated alerts are suppressed', () => {
  const controller = new FeedbackController();
  const first = controller.select([{ rule: safety, timestampMs: 0 }]);
  assert.equal(first?.rule.issueId, 'safety_rule');
  const second = controller.select([{ rule: safety, timestampMs: 100 }]);
  assert.equal(second, undefined, 'should be suppressed within the cooldown window');
  const third = controller.select([{ rule: safety, timestampMs: 1000 }]);
  assert.equal(third?.rule.issueId, 'safety_rule');
});

test('returns undefined when there are no candidates', () => {
  const controller = new FeedbackController();
  assert.equal(controller.select([]), undefined);
});
