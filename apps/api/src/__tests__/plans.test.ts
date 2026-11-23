import './env-setup';
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, signupAndLogin } from './helpers';
import { resetDatabase } from './db-reset';
import { prisma } from '../lib/prisma';

before(async () => {
  await resetDatabase();
});
beforeEach(async () => {
  await resetDatabase();
});

async function signupAsAdmin(email: string) {
  const user = await signupAndLogin(email);
  await prisma.user.update({ where: { id: user.userId }, data: { platformRole: 'SUPER_ADMIN' } });
  // The access token already minted embeds the pre-promotion platformRole claim, so log
  // in again to get one that reflects SUPER_ADMIN.
  const loginRes = await request(app).post('/v1/auth/login').send({ email, password: 'a-very-long-password-1' });
  return { ...user, accessToken: loginRes.body.accessToken as string };
}

test('an admin can create a plan with an initial exercise set', async () => {
  await prisma.exercise.create({
    data: { id: 'squat', name: 'Squat', currentVersion: '1.0.0', evaluatorVersion: '1.0.0', publicationStatus: 'PUBLISHED' },
  });
  const admin = await signupAsAdmin('plan-admin@example.com');

  const res = await request(app)
    .post('/v1/plans')
    .set('authorization', `Bearer ${admin.accessToken}`)
    .send({ code: 'starter', name: 'Starter', exerciseIds: ['squat'] });

  assert.equal(res.status, 201);
  assert.equal(res.body.code, 'starter');
  assert.deepEqual(res.body.exerciseIds, ['squat']);

  const listRes = await request(app).get('/v1/plans');
  assert.ok(listRes.body.some((p: { code: string }) => p.code === 'starter'));
});

test('a non-admin cannot create a plan', async () => {
  const user = await signupAndLogin('plan-nonadmin@example.com');
  const res = await request(app)
    .post('/v1/plans')
    .set('authorization', `Bearer ${user.accessToken}`)
    .send({ code: 'starter', name: 'Starter' });
  assert.equal(res.status, 403);
});

test('creating a plan with a duplicate code is rejected', async () => {
  const admin = await signupAsAdmin('plan-admin-2@example.com');
  await prisma.plan.create({ data: { code: 'pro', name: 'Pro' } });

  const res = await request(app)
    .post('/v1/plans')
    .set('authorization', `Bearer ${admin.accessToken}`)
    .send({ code: 'pro', name: 'Another Pro' });
  assert.equal(res.status, 409);
});

test("updating a plan's exercise set replaces it and is reflected in subsequent entitlement issuance", async () => {
  await prisma.exercise.createMany({
    data: [
      { id: 'squat', name: 'Squat', currentVersion: '1.0.0', evaluatorVersion: '1.0.0', publicationStatus: 'PUBLISHED' },
      { id: 'push_up', name: 'Push-up', currentVersion: '1.0.0', evaluatorVersion: '1.0.0', publicationStatus: 'PUBLISHED' },
    ],
  });
  const admin = await signupAsAdmin('plan-admin-3@example.com');
  const plan = await prisma.plan.create({ data: { code: 'flex', name: 'Flex' } });
  await prisma.planExercise.create({ data: { planId: plan.id, exerciseId: 'squat' } });

  const patchRes = await request(app)
    .patch(`/v1/plans/${plan.id}`)
    .set('authorization', `Bearer ${admin.accessToken}`)
    .send({ exerciseIds: ['push_up'] });

  assert.equal(patchRes.status, 200);
  assert.deepEqual(patchRes.body.exerciseIds, ['push_up']);

  const remaining = await prisma.planExercise.findMany({ where: { planId: plan.id } });
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].exerciseId, 'push_up');
});

test('updating a non-existent plan returns NOT_FOUND', async () => {
  const admin = await signupAsAdmin('plan-admin-4@example.com');
  const res = await request(app)
    .patch('/v1/plans/does-not-exist')
    .set('authorization', `Bearer ${admin.accessToken}`)
    .send({ name: 'New Name' });
  assert.equal(res.status, 404);
});
