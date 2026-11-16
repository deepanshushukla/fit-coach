import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSyntheticFrameGenerator } from '../simulation';
import { SquatEvaluator } from '../exercises/squat';

test('synthetic squat generator is a pure function of timestamp', () => {
  const gen = createSyntheticFrameGenerator('squat');
  const a = gen.nextFrame(5000);
  const b = gen.nextFrame(5000);
  assert.deepEqual(a, b);
});

test('synthetic squat generator produces counted reps when fed through the real evaluator', () => {
  const gen = createSyntheticFrameGenerator('squat');
  const evaluator = new SquatEvaluator();
  let repCount = 0;
  const totalMs = 15000;
  const stepMs = 33;
  for (let t = 0; t <= totalMs; t += stepMs) {
    const output = evaluator.update(gen.nextFrame(t));
    for (const event of output.events) {
      if (event.type === 'repCompleted') repCount += 1;
    }
  }
  assert.ok(repCount >= 3, `expected several reps over 15s, got ${repCount}`);
});

test('throws for an exercise with no synthetic generator', () => {
  assert.throws(() => createSyntheticFrameGenerator('bicep_curl'));
});
