import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateAngle, distance, normalizedDistance } from '../geometry';

test('calculateAngle returns 90 for a right angle', () => {
  const angle = calculateAngle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 });
  assert.ok(Math.abs(angle - 90) < 1e-6);
});

test('calculateAngle returns ~180 for a straight line', () => {
  // acos() of a cosine computed via dot/magnitude product accumulates floating-point
  // error on the order of 1e-6 degrees for exact-collinearity cases; 1e-4 is a safe bound.
  const angle = calculateAngle({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 });
  assert.ok(Math.abs(angle - 180) < 1e-4);
});

test('calculateAngle returns 0 for folded-back points', () => {
  const angle = calculateAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 });
  assert.ok(Math.abs(angle - 0) < 1e-6);
});

test('calculateAngle returns NaN for coincident points', () => {
  const angle = calculateAngle({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 });
  assert.ok(Number.isNaN(angle));
});

test('distance computes euclidean distance', () => {
  assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});

test('normalizedDistance divides by the scale reference', () => {
  assert.equal(normalizedDistance({ x: 0, y: 0 }, { x: 3, y: 4 }, 2), 2.5);
});

test('normalizedDistance returns NaN for a zero scale reference', () => {
  assert.ok(Number.isNaN(normalizedDistance({ x: 0, y: 0 }, { x: 3, y: 4 }, 0)));
});
