import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Cooldown, Hysteresis, PhaseTimer } from '../state-helpers';

test('Hysteresis requires crossing the enter threshold before activating (direction: below)', () => {
  const h = new Hysteresis({ enterThreshold: 100, exitThreshold: 110, direction: 'below' });
  assert.equal(h.update(150), false);
  assert.equal(h.update(105), false);
  assert.equal(h.update(100), true);
  assert.equal(h.update(105), true, 'should stay active until exit threshold');
  assert.equal(h.update(110), false);
});

test('Hysteresis direction: above', () => {
  const h = new Hysteresis({ enterThreshold: 160, exitThreshold: 150, direction: 'above' });
  assert.equal(h.update(100), false);
  assert.equal(h.update(160), true);
  assert.equal(h.update(155), true);
  assert.equal(h.update(150), false);
});

test('Hysteresis ignores NaN and preserves prior state', () => {
  const h = new Hysteresis({ enterThreshold: 160, exitThreshold: 150, direction: 'above' });
  h.update(160);
  assert.equal(h.update(Number.NaN), true);
});

test('PhaseTimer tracks elapsed time since entering a phase', () => {
  const timer = new PhaseTimer();
  timer.enterPhase(1000);
  assert.equal(timer.elapsedMs(1500), 500);
  assert.equal(timer.hasMetMinDuration(1500, 400), true);
  assert.equal(timer.hasMetMinDuration(1500, 600), false);
});

test('Cooldown blocks triggers within the window and allows after', () => {
  const cooldown = new Cooldown(1000);
  assert.equal(cooldown.isReady(0), true);
  cooldown.trigger(0);
  assert.equal(cooldown.isReady(500), false);
  assert.equal(cooldown.isReady(1000), true);
});
