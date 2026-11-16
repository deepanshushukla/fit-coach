import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PushUpEvaluator } from '../exercises/push-up';
import { loadFixture, replay } from './replay-helper';

test('counts exactly 3 reps for 3 clean push-up cycles', () => {
  const evaluator = new PushUpEvaluator();
  const frames = loadFixture('push_up_correct_reps');
  const result = replay(evaluator, frames);
  assert.equal(result.repCompletedEvents.length, 3);
});

test('emits a hips_sagging form issue when hip alignment collapses', () => {
  const evaluator = new PushUpEvaluator();
  const frames = loadFixture('push_up_hips_sagging');
  const result = replay(evaluator, frames);
  const sagging = result.formIssueEvents.filter((e) => e.issueId === 'hips_sagging');
  assert.ok(sagging.length > 0, 'expected at least one hips_sagging form issue');
});
