import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SimulatorNativeBridge } from '../simulatorNativeBridge';
import { Session } from '../session';

test('the simulator bridge drives a real evaluator and emits rep/tracking events over time', async () => {
  const bridge = new SimulatorNativeBridge();
  const handle = await bridge.createSession({
    exercise: 'squat',
    camera: { facing: 'back' },
    subject: { requiredView: 'side' },
    feedback: { visual: true, voice: false, haptic: false },
  });
  const session = new Session(bridge, handle.sessionId, 'squat');

  const trackingUpdates: string[] = [];
  const repCounts: number[] = [];
  session.on('trackingUpdate', (e) => trackingUpdates.push(e.status));
  session.on('repCompleted', (e) => repCounts.push(e.repCount));

  await session.start();
  await new Promise((resolve) => setTimeout(resolve, 3000));
  await session.stop();
  await session.dispose();

  assert.ok(trackingUpdates.length > 0, 'expected at least one trackingUpdate event');
  assert.ok(trackingUpdates.includes('tracking'), 'expected tracking to become established');
  assert.ok(repCounts.length >= 1, `expected at least one repCompleted event in 3s, got ${repCounts.length}`);
});
