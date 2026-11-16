import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SquatEvaluator } from '../exercises/squat';
import { loadFixture, replay } from './replay-helper';

test('counts exactly 3 reps for 3 clean squat cycles', () => {
  const evaluator = new SquatEvaluator();
  const frames = loadFixture('squat_correct_reps');
  const result = replay(evaluator, frames);
  assert.equal(result.repCompletedEvents.length, 3);
  assert.equal(evaluator.getMetrics().repCount, 3);
  for (const rep of result.repCompletedEvents) {
    assert.equal(rep.quality, 'valid');
  }
});

test('does not count a rep for a shallow squat that never reaches depth', () => {
  const evaluator = new SquatEvaluator();
  const frames = loadFixture('squat_shallow_no_rep');
  const result = replay(evaluator, frames);
  assert.equal(result.repCompletedEvents.length, 0);
  assert.equal(evaluator.getMetrics().currentPhase, 'ready');
});

test('counts a slow rep performed well under the deadline', () => {
  const evaluator = new SquatEvaluator();
  const frames = loadFixture('squat_slow_rep');
  const result = replay(evaluator, frames);
  assert.equal(result.repCompletedEvents.length, 1);
});

test('counts a fast rep but respects minimum bottom phase duration', () => {
  const evaluator = new SquatEvaluator();
  const frames = loadFixture('squat_fast_rep');
  const result = replay(evaluator, frames);
  assert.equal(result.repCompletedEvents.length, 1);
});

test('emits a back_rounding form issue when torso collapses at depth', () => {
  const evaluator = new SquatEvaluator();
  const frames = loadFixture('squat_back_rounding');
  const result = replay(evaluator, frames);
  const backRounding = result.formIssueEvents.filter((e) => e.issueId === 'back_rounding');
  assert.ok(backRounding.length > 0, 'expected at least one back_rounding form issue');
  assert.equal(backRounding[0]!.assessment, 'valid');
});

test('does not count a rep when tracking is lost during the bottom phase', () => {
  const evaluator = new SquatEvaluator();
  const frames = loadFixture('squat_tracking_loss_during_rep');
  const result = replay(evaluator, frames);
  assert.equal(result.repCompletedEvents.length, 0, 'a rep spanning a tracking loss must not be counted');

  const lostStatuses = result.outputs.filter((o) => o.trackingStatus === 'lost' || o.trackingStatus === 'partial');
  assert.ok(lostStatuses.length > 0, 'expected tracking to degrade during the simulated loss window');
});

test('evaluator is deterministic for the same input sequence', () => {
  const frames = loadFixture('squat_correct_reps');
  const a = replay(new SquatEvaluator(), frames);
  const b = replay(new SquatEvaluator(), frames);
  assert.deepEqual(
    a.repCompletedEvents.map((e) => e.repCount),
    b.repCompletedEvents.map((e) => e.repCount)
  );
});

test('reset clears rep count and phase', () => {
  const evaluator = new SquatEvaluator();
  replay(evaluator, loadFixture('squat_correct_reps'));
  assert.equal(evaluator.getMetrics().repCount, 3);
  evaluator.reset();
  assert.equal(evaluator.getMetrics().repCount, 0);
  assert.equal(evaluator.getMetrics().currentPhase, 'ready');
});

test('validateConfiguration rejects unsupported views', () => {
  const evaluator = new SquatEvaluator();
  const result = evaluator.validateConfiguration({ requiredView: 'front' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});
