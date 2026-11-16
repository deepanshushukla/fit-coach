import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LungeEvaluator } from '../exercises/lunge';
import { loadFixture, replay } from './replay-helper';

test('counts exactly 3 reps for 3 clean lunge cycles', () => {
  const evaluator = new LungeEvaluator();
  const frames = loadFixture('lunge_correct_reps');
  const result = replay(evaluator, frames);
  assert.equal(result.repCompletedEvents.length, 3);
});
