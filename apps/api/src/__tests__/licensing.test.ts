import './env-setup';
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, createOrgWithOwner } from './helpers';
import { resetDatabase } from './db-reset';
import { prisma } from '../lib/prisma';
import { verifyEntitlementToken } from '../modules/entitlements/signing';

before(async () => {
  await resetDatabase();
});
beforeEach(async () => {
  await resetDatabase();
});

async function seedCatalogue() {
  await prisma.exercise.createMany({
    data: [
      { id: 'squat', name: 'Squat', currentVersion: '1.0.0', evaluatorVersion: '1.0.0', publicationStatus: 'PUBLISHED' },
      { id: 'push_up', name: 'Push-up', currentVersion: '1.0.0', evaluatorVersion: '1.0.0', publicationStatus: 'PUBLISHED' },
      { id: 'lunge', name: 'Lunge', currentVersion: '1.0.0', evaluatorVersion: '1.0.0', publicationStatus: 'TESTING' },
    ],
  });
  const community = await prisma.plan.create({ data: { code: 'community', name: 'Community' } });
  const pro = await prisma.plan.create({ data: { code: 'pro', name: 'Pro' } });
  await prisma.planExercise.createMany({
    data: [
      { planId: community.id, exerciseId: 'squat' },
      { planId: pro.id, exerciseId: 'squat' },
      { planId: pro.id, exerciseId: 'push_up' },
      { planId: pro.id, exerciseId: 'lunge' },
    ],
  });
  return { community, pro };
}

async function setUpAppAndEnvironment(organisationId: string, accessToken: string) {
  const appRes = await request(app)
    .post(`/v1/organisations/${organisationId}/applications`)
    .set('authorization', `Bearer ${accessToken}`)
    .send({ name: 'Test App', platforms: ['react-native'] });
  const applicationId = appRes.body.id as string;

  const envRes = await request(app)
    .post(`/v1/applications/${applicationId}/environments`)
    .set('authorization', `Bearer ${accessToken}`)
    .send({ name: 'PRODUCTION' });

  return { applicationId, environmentPublicIdentifier: envRes.body.publicIdentifier as string, environmentId: envRes.body.id as string };
}

test('full flow: licence assignment produces a verifiable entitlement scoped to the plan', async () => {
  const { community } = await seedCatalogue();
  const { owner, organisationId } = await createOrgWithOwner('flow-owner@example.com');
  const { applicationId, environmentPublicIdentifier } = await setUpAppAndEnvironment(organisationId, owner.accessToken);

  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const licenceRes = await request(app)
    .post(`/v1/organisations/${organisationId}/licences`)
    .set('authorization', `Bearer ${owner.accessToken}`)
    .send({ applicationId, planId: community.id, expiresAt });
  assert.equal(licenceRes.status, 201);

  const bootstrap = await request(app)
    .post('/v1/sdk/bootstrap')
    .send({ environmentPublicIdentifier, sdkVersion: '1.0.0', platform: 'react-native' });
  assert.equal(bootstrap.status, 200);

  const verification = await verifyEntitlementToken(bootstrap.body.entitlementToken);
  assert.equal(verification.valid, true);
  assert.deepEqual(verification.claims?.exercises, ['squat'], 'community plan only includes squat');
  assert.equal(verification.claims?.aud, 'formcoach-sdk');
});

test('a per-licence exercise override can add an exercise outside the plan', async () => {
  const { community } = await seedCatalogue();
  const { owner, organisationId } = await createOrgWithOwner('override-owner@example.com');
  const { applicationId, environmentPublicIdentifier } = await setUpAppAndEnvironment(organisationId, owner.accessToken);

  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const licenceRes = await request(app)
    .post(`/v1/organisations/${organisationId}/licences`)
    .set('authorization', `Bearer ${owner.accessToken}`)
    .send({ applicationId, planId: community.id, expiresAt });

  await prisma.licenceExerciseOverride.create({
    data: { licenceId: licenceRes.body.licence.id, exerciseId: 'push_up', access: 'INCLUDE' },
  });

  const bootstrap = await request(app)
    .post('/v1/sdk/bootstrap')
    .send({ environmentPublicIdentifier, sdkVersion: '1.0.0', platform: 'react-native' });
  const verification = await verifyEntitlementToken(bootstrap.body.entitlementToken);
  assert.deepEqual(new Set(verification.claims?.exercises as string[]), new Set(['squat', 'push_up']));
});

test('bootstrap fails when no active licence is assigned to the application', async () => {
  await seedCatalogue();
  const { owner, organisationId } = await createOrgWithOwner('nolicence-owner@example.com');
  const { environmentPublicIdentifier } = await setUpAppAndEnvironment(organisationId, owner.accessToken);

  const bootstrap = await request(app)
    .post('/v1/sdk/bootstrap')
    .send({ environmentPublicIdentifier, sdkVersion: '1.0.0', platform: 'react-native' });
  assert.equal(bootstrap.status, 404);
  assert.equal(bootstrap.body.error.code, 'LICENCE_NOT_FOUND');
});

test('revoking a licence blocks further entitlement issuance', async () => {
  const { community } = await seedCatalogue();
  const { owner, organisationId } = await createOrgWithOwner('revoke-owner@example.com');
  const { applicationId, environmentPublicIdentifier } = await setUpAppAndEnvironment(organisationId, owner.accessToken);
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const licenceRes = await request(app)
    .post(`/v1/organisations/${organisationId}/licences`)
    .set('authorization', `Bearer ${owner.accessToken}`)
    .send({ applicationId, planId: community.id, expiresAt });

  const revoke = await request(app)
    .post(`/v1/licences/${licenceRes.body.licence.id}/revoke`)
    .set('authorization', `Bearer ${owner.accessToken}`);
  assert.equal(revoke.status, 200);
  assert.equal(revoke.body.status, 'REVOKED');

  const bootstrap = await request(app)
    .post('/v1/sdk/bootstrap')
    .send({ environmentPublicIdentifier, sdkVersion: '1.0.0', platform: 'react-native' });
  assert.equal(bootstrap.status, 404);
});

test('changing a licence plan bumps entitlementVersion and grants newly licensed exercises', async () => {
  const { community, pro } = await seedCatalogue();
  const { owner, organisationId } = await createOrgWithOwner('upgrade-owner@example.com');
  const { applicationId, environmentPublicIdentifier } = await setUpAppAndEnvironment(organisationId, owner.accessToken);
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const licenceRes = await request(app)
    .post(`/v1/organisations/${organisationId}/licences`)
    .set('authorization', `Bearer ${owner.accessToken}`)
    .send({ applicationId, planId: community.id, expiresAt });
  assert.equal(licenceRes.body.licence.entitlementVersion, 1);

  const upgrade = await request(app)
    .patch(`/v1/licences/${licenceRes.body.licence.id}`)
    .set('authorization', `Bearer ${owner.accessToken}`)
    .send({ planId: pro.id });
  assert.equal(upgrade.body.licence.entitlementVersion, 2, 'a plan change must bump the entitlement version');

  const bootstrap = await request(app)
    .post('/v1/sdk/bootstrap')
    .send({ environmentPublicIdentifier, sdkVersion: '1.0.0', platform: 'react-native' });
  const verification = await verifyEntitlementToken(bootstrap.body.entitlementToken);
  assert.deepEqual(new Set(verification.claims?.exercises as string[]), new Set(['squat', 'push_up', 'lunge']));
});

test('an SDK session token cannot be used to refresh a different application', async () => {
  const { community } = await seedCatalogue();
  const orgA = await createOrgWithOwner('orga-owner@example.com');
  const orgB = await createOrgWithOwner('orgb-owner@example.com');
  const setupA = await setUpAppAndEnvironment(orgA.organisationId, orgA.owner.accessToken);
  const setupB = await setUpAppAndEnvironment(orgB.organisationId, orgB.owner.accessToken);
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  await request(app)
    .post(`/v1/organisations/${orgA.organisationId}/licences`)
    .set('authorization', `Bearer ${orgA.owner.accessToken}`)
    .send({ applicationId: setupA.applicationId, planId: community.id, expiresAt });

  const bootstrapA = await request(app)
    .post('/v1/sdk/bootstrap')
    .send({ environmentPublicIdentifier: setupA.environmentPublicIdentifier, sdkVersion: '1.0.0', platform: 'react-native' });

  const crossRefresh = await request(app)
    .post('/v1/sdk/entitlements/refresh')
    .set('authorization', `Bearer ${bootstrapA.body.sdkSessionToken}`)
    .send({ applicationId: setupB.applicationId, environment: 'production', sdkVersion: '1.0.0', platform: 'react-native' });
  assert.equal(crossRefresh.status, 403);
});

test('usage batch ingestion is accepted and attributed to the correct application', async () => {
  const { community } = await seedCatalogue();
  const { owner, organisationId } = await createOrgWithOwner('usage-owner@example.com');
  const { applicationId, environmentPublicIdentifier } = await setUpAppAndEnvironment(organisationId, owner.accessToken);
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  await request(app)
    .post(`/v1/organisations/${organisationId}/licences`)
    .set('authorization', `Bearer ${owner.accessToken}`)
    .send({ applicationId, planId: community.id, expiresAt });

  const bootstrap = await request(app)
    .post('/v1/sdk/bootstrap')
    .send({ environmentPublicIdentifier, sdkVersion: '1.0.0', platform: 'react-native' });

  const usage = await request(app)
    .post('/v1/sdk/usage/batch')
    .set('authorization', `Bearer ${bootstrap.body.sdkSessionToken}`)
    .send({
      events: [
        {
          eventType: 'session_completed',
          exerciseId: 'squat',
          sdkVersion: '1.0.0',
          platform: 'react-native',
          eventTimestamp: new Date().toISOString(),
          metadata: { repCount: 10 },
        },
      ],
    });
  assert.equal(usage.status, 202);

  const stored = await prisma.usageEvent.findMany({ where: { applicationId } });
  assert.equal(stored.length, 1);
  assert.equal(stored[0]?.exerciseId, 'squat');
});
