import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FormCoachError } from '@formcoach/types';
import { Session } from '../session';
import { FakeNativeBridge } from './fake-native-bridge';

async function createTestSession(): Promise<{ session: Session; bridge: FakeNativeBridge }> {
  const bridge = new FakeNativeBridge();
  const handle = await bridge.createSession();
  return { session: new Session(bridge, handle.sessionId, 'squat'), bridge };
}

test('start() is valid from the created state', async () => {
  const { session, bridge } = await createTestSession();
  await session.start();
  assert.deepEqual(bridge.calls, [`start:${session.sessionId}`]);
});

test('pause() is idempotent when already paused', async () => {
  const { session } = await createTestSession();
  await session.start();
  await session.pause();
  await session.pause(); // should not throw
});

test('pause() from created throws SESSION_INVALID_STATE', async () => {
  const { session } = await createTestSession();
  await assert.rejects(() => session.pause(), (err: Error) => {
    assert.ok(err instanceof FormCoachError);
    assert.equal(err.code, 'SESSION_INVALID_STATE');
    return true;
  });
});

test('resume() from running throws SESSION_INVALID_STATE', async () => {
  const { session } = await createTestSession();
  await session.start();
  await assert.rejects(() => session.resume(), (err: Error) => {
    assert.ok(err instanceof FormCoachError);
    assert.equal(err.code, 'SESSION_INVALID_STATE');
    return true;
  });
});

test('full lifecycle: start -> pause -> resume -> stop -> dispose', async () => {
  const { session, bridge } = await createTestSession();
  await session.start();
  await session.pause();
  await session.resume();
  const summary = await session.stop();
  assert.equal(summary.exerciseId, 'squat');
  await session.dispose();
  assert.deepEqual(bridge.calls, [
    `start:${session.sessionId}`,
    `pause:${session.sessionId}`,
    `resume:${session.sessionId}`,
    `stop:${session.sessionId}`,
    `dispose:${session.sessionId}`,
  ]);
});

test('a disposed session cannot be restarted', async () => {
  const { session } = await createTestSession();
  await session.start();
  await session.stop();
  await session.dispose();
  await assert.rejects(() => session.start(), (err: Error) => {
    assert.ok(err instanceof FormCoachError);
    assert.equal(err.code, 'RESOURCE_DISPOSED');
    return true;
  });
});

test('dispose() is idempotent', async () => {
  const { session } = await createTestSession();
  await session.dispose();
  await session.dispose(); // should not throw
});

test('on()/off() wires and unwires native events', async () => {
  const { session, bridge } = await createTestSession();
  const received: unknown[] = [];
  const handler = (payload: unknown) => received.push(payload);
  const unsubscribe = session.on('repCompleted', handler);

  bridge.emit(session.sessionId, 'repCompleted', { sessionId: session.sessionId, timestampMs: 1, exerciseId: 'squat', repCount: 1 });
  assert.equal(received.length, 1);

  unsubscribe();
  bridge.emit(session.sessionId, 'repCompleted', { sessionId: session.sessionId, timestampMs: 2, exerciseId: 'squat', repCount: 2 });
  assert.equal(received.length, 1, 'handler should not fire after unsubscribe');
});
