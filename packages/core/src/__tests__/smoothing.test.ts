import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MovingAverage, OneEuroFilter } from '../smoothing';

test('OneEuroFilter passes through the first value unchanged', () => {
  const filter = new OneEuroFilter();
  assert.equal(filter.filter(10, 0), 10);
});

test('OneEuroFilter smooths a noisy constant signal toward the true value', () => {
  const filter = new OneEuroFilter({ minCutoff: 1, beta: 0.01 });
  let t = 0;
  let last = 0;
  const noise = [0.5, -0.4, 0.3, -0.5, 0.4, -0.3, 0.5, -0.4];
  for (const n of noise) {
    last = filter.filter(10 + n, t);
    t += 33;
  }
  assert.ok(Math.abs(last - 10) < 0.6, `expected convergence near 10, got ${last}`);
});

test('OneEuroFilter reset clears history', () => {
  const filter = new OneEuroFilter();
  filter.filter(10, 0);
  filter.filter(20, 33);
  filter.reset();
  assert.equal(filter.filter(5, 100), 5);
});

test('MovingAverage averages over the window', () => {
  const avg = new MovingAverage(3);
  assert.equal(avg.filter(1), 1);
  assert.equal(avg.filter(2), 1.5);
  assert.equal(avg.filter(3), 2);
  assert.equal(avg.filter(6), 11 / 3);
});
