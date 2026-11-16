import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FormCoachError } from '@formcoach/types';
import { FormCoachClient } from '../formCoach';
import { MemoryStorage } from '../storage';
import { FakeNativeBridge } from './fake-native-bridge';
import { fakeEntitlementToken, startTestServer, type TestServerHandle } from './test-server';

function claims(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: 'https://api.formcoach.example',
    aud: 'formcoach-sdk',
    sub: 'app_1',
    environment: 'production',
    licenceId: 'licence_1',
    entitlementVersion: 1,
    exercises: ['squat'],
    issuedAt: now - 10,
    expiresAt: now + 3600,
    offlineGraceUntil: now + 3600 + 259200,
    keyId: 'test-key',
    ...overrides,
  };
}

async function startServerWithEntitlement(entitlementClaims: Record<string, unknown>): Promise<TestServerHandle> {
  const token = fakeEntitlementToken(entitlementClaims);
  return startTestServer({
    'POST /v1/sdk/bootstrap': () => ({ status: 200, body: { sdkSessionToken: 'sdk-session-token', entitlementToken: token } }),
    'GET /v1/exercises': () => ({
      status: 200,
      body: [
        { id: 'squat', name: 'Squat' },
        { id: 'bicep_curl', name: 'Bicep curl' },
      ],
    }),
  });
}

test('calling getExercises before initialize throws SDK_NOT_INITIALIZED', async () => {
  const client = new FormCoachClient({ nativeBridge: new FakeNativeBridge() });
  await assert.rejects(() => client.getExercises(), (err: Error) => {
    assert.ok(err instanceof FormCoachError);
    assert.equal(err.code, 'SDK_NOT_INITIALIZED');
    return true;
  });
});

test('initialize bootstraps and getExercises marks entitlement state correctly', async () => {
  const server = await startServerWithEntitlement(claims());
  try {
    const client = new FormCoachClient({ apiBaseUrl: server.url, nativeBridge: new FakeNativeBridge(), storage: new MemoryStorage() });
    await client.initialize({ appId: 'fc_env_test', environment: 'production' });
    const exercises = await client.getExercises();
    assert.deepEqual(
      exercises,
      [
        { id: 'squat', name: 'Squat', entitlement: 'included' },
        { id: 'bicep_curl', name: 'Bicep curl', entitlement: 'locked' },
      ]
    );
  } finally {
    await server.close();
  }
});

test('createSession succeeds for a licensed exercise', async () => {
  const server = await startServerWithEntitlement(claims());
  try {
    const bridge = new FakeNativeBridge();
    const client = new FormCoachClient({ apiBaseUrl: server.url, nativeBridge: bridge, storage: new MemoryStorage() });
    await client.initialize({ appId: 'fc_env_test', environment: 'production' });
    const session = await client.createSession({
      exercise: 'squat',
      camera: { facing: 'back' },
      subject: { requiredView: 'side' },
      feedback: { visual: true, voice: false, haptic: false },
    });
    assert.ok(session.sessionId);
  } finally {
    await server.close();
  }
});

test('createSession fails with EXERCISE_NOT_LICENSED for an exercise outside the entitlement', async () => {
  const server = await startServerWithEntitlement(claims());
  try {
    const client = new FormCoachClient({ apiBaseUrl: server.url, nativeBridge: new FakeNativeBridge(), storage: new MemoryStorage() });
    await client.initialize({ appId: 'fc_env_test', environment: 'production' });
    await assert.rejects(
      () =>
        client.createSession({
          exercise: 'bicep_curl',
          camera: { facing: 'back' },
          subject: { requiredView: 'side' },
          feedback: { visual: true, voice: false, haptic: false },
        }),
      (err: Error) => {
        assert.ok(err instanceof FormCoachError);
        assert.equal(err.code, 'EXERCISE_NOT_LICENSED');
        return true;
      }
    );
  } finally {
    await server.close();
  }
});

test('createSession fails with LICENCE_EXPIRED once the offline grace period has passed', async () => {
  const now = Math.floor(Date.now() / 1000);
  const server = await startServerWithEntitlement(claims({ expiresAt: now - 20, offlineGraceUntil: now - 10 }));
  try {
    const client = new FormCoachClient({ apiBaseUrl: server.url, nativeBridge: new FakeNativeBridge(), storage: new MemoryStorage() });
    await client.initialize({ appId: 'fc_env_test', environment: 'production' });
    await assert.rejects(
      () =>
        client.createSession({
          exercise: 'squat',
          camera: { facing: 'back' },
          subject: { requiredView: 'side' },
          feedback: { visual: true, voice: false, haptic: false },
        }),
      (err: Error) => {
        assert.ok(err instanceof FormCoachError);
        assert.equal(err.code, 'LICENCE_EXPIRED');
        return true;
      }
    );
  } finally {
    await server.close();
  }
});

test('falls back to a cached entitlement when the network is unreachable (offline-first)', async () => {
  const storage = new MemoryStorage();
  const server = await startServerWithEntitlement(claims());
  const onlineClient = new FormCoachClient({ apiBaseUrl: server.url, nativeBridge: new FakeNativeBridge(), storage });
  await onlineClient.initialize({ appId: 'fc_env_test', environment: 'production' });
  await server.close();

  // A fresh client instance sharing the same storage, pointed at an address nothing listens on.
  const offlineClient = new FormCoachClient({
    apiBaseUrl: 'http://127.0.0.1:1',
    nativeBridge: new FakeNativeBridge(),
    storage,
  });
  await offlineClient.initialize({ appId: 'fc_env_test', environment: 'production' });

  const session = await offlineClient.createSession({
    exercise: 'squat',
    camera: { facing: 'back' },
    subject: { requiredView: 'side' },
    feedback: { visual: true, voice: false, haptic: false },
  });
  assert.ok(session.sessionId, 'offline-first: a non-expired cached entitlement must still allow session creation');
});

test('initialize throws LICENCE_INVALID when offline with no cached entitlement at all', async () => {
  const client = new FormCoachClient({
    apiBaseUrl: 'http://127.0.0.1:1',
    nativeBridge: new FakeNativeBridge(),
    storage: new MemoryStorage(),
  });
  await assert.rejects(
    () => client.initialize({ appId: 'fc_env_test', environment: 'production' }),
    (err: Error) => {
      assert.ok(err instanceof FormCoachError);
      assert.equal(err.code, 'LICENCE_INVALID');
      return true;
    }
  );
});
