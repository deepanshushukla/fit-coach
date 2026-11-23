import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SquatFrontViewEvaluator } from '../exercises/squat-front';
import { loadFixture, replay } from './replay-helper';

test('counts exactly 3 reps for 3 clean front-view squat cycles', () => {
  const evaluator = new SquatFrontViewEvaluator();
  const frames = loadFixture('squat_front_correct_reps');
  const result = replay(evaluator, frames);
  assert.equal(result.repCompletedEvents.length, 3);
  assert.equal(evaluator.getMetrics().repCount, 3);
  for (const rep of result.repCompletedEvents) {
    assert.equal(rep.quality, 'valid');
  }
});

test('does not count a rep for a shallow front-view squat that never reaches depth', () => {
  const evaluator = new SquatFrontViewEvaluator();
  const frames = loadFixture('squat_front_shallow_no_rep');
  const result = replay(evaluator, frames);
  assert.equal(result.repCompletedEvents.length, 0);
  assert.equal(evaluator.getMetrics().currentPhase, 'ready');
});

test('emits a knee_valgus form issue when knees cave inward at depth', () => {
  const evaluator = new SquatFrontViewEvaluator();
  const frames = loadFixture('squat_front_knee_valgus');
  const result = replay(evaluator, frames);
  const valgus = result.formIssueEvents.filter((e) => e.issueId === 'knee_valgus');
  assert.ok(valgus.length > 0, 'expected at least one knee_valgus form issue');
  assert.equal(valgus[0]!.assessment, 'valid');
});

test('does not emit knee_valgus on clean reps', () => {
  const evaluator = new SquatFrontViewEvaluator();
  const frames = loadFixture('squat_front_correct_reps');
  const result = replay(evaluator, frames);
  assert.equal(result.formIssueEvents.filter((e) => e.issueId === 'knee_valgus').length, 0);
});

test('evaluator is deterministic for the same input sequence', () => {
  const frames = loadFixture('squat_front_correct_reps');
  const a = replay(new SquatFrontViewEvaluator(), frames);
  const b = replay(new SquatFrontViewEvaluator(), frames);
  assert.deepEqual(
    a.repCompletedEvents.map((e) => e.repCount),
    b.repCompletedEvents.map((e) => e.repCount)
  );
});

test('reset clears rep count and phase', () => {
  const evaluator = new SquatFrontViewEvaluator();
  replay(evaluator, loadFixture('squat_front_correct_reps'));
  assert.equal(evaluator.getMetrics().repCount, 3);
  evaluator.reset();
  assert.equal(evaluator.getMetrics().repCount, 0);
  assert.equal(evaluator.getMetrics().currentPhase, 'ready');
});

test('validateConfiguration rejects unsupported views', () => {
  const evaluator = new SquatFrontViewEvaluator();
  const result = evaluator.validateConfiguration({ requiredView: 'side' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test('a side-view-shaped pose (narrow apparent shoulder width) is rejected by front-view calibration', () => {
  const evaluator = new SquatFrontViewEvaluator();
  const frames = loadFixture('squat_correct_reps'); // side-view fixture: duplicated single leg, narrow shoulders
  const result = replay(evaluator, frames);
  assert.equal(result.repCompletedEvents.length, 0);
  assert.ok(result.outputs.every((o) => o.trackingStatus === 'calibrating'));
});
