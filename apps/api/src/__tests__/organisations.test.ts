import './env-setup';
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, createOrgWithOwner, signupAndLogin } from './helpers';
import { resetDatabase } from './db-reset';

before(async () => {
  await resetDatabase();
});
beforeEach(async () => {
  await resetDatabase();
});

test('creating an organisation makes the creator an OWNER', async () => {
  const { owner, organisationId } = await createOrgWithOwner('owner1@example.com');
  const res = await request(app).get(`/v1/organisations/${organisationId}`).set('authorization', `Bearer ${owner.accessToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.myRole, 'OWNER');
});

test('a user who is not a member cannot see the organisation (404, not 403)', async () => {
  const { organisationId } = await createOrgWithOwner('owner2@example.com');
  const stranger = await signupAndLogin('stranger@example.com');
  const res = await request(app)
    .get(`/v1/organisations/${organisationId}`)
    .set('authorization', `Bearer ${stranger.accessToken}`);
  assert.equal(res.status, 404, 'must not leak that the org exists to a non-member');
});

test('owner can invite a member and the invitee can accept', async () => {
  const { owner, organisationId } = await createOrgWithOwner('owner3@example.com');
  const invite = await request(app)
    .post(`/v1/organisations/${organisationId}/invitations`)
    .set('authorization', `Bearer ${owner.accessToken}`)
    .send({ email: 'developer@example.com', role: 'DEVELOPER' });
  assert.equal(invite.status, 201);
  assert.ok(invite.body.devInviteToken);

  const developer = await signupAndLogin('developer@example.com');
  const accept = await request(app)
    .post(`/v1/invitations/${invite.body.devInviteToken}/accept`)
    .set('authorization', `Bearer ${developer.accessToken}`);
  assert.equal(accept.status, 200);
  assert.equal(accept.body.role, 'DEVELOPER');

  const members = await request(app)
    .get(`/v1/organisations/${organisationId}/members`)
    .set('authorization', `Bearer ${owner.accessToken}`);
  assert.equal(members.body.length, 2);
});

test('an invitation cannot be accepted by a different email address', async () => {
  const { owner, organisationId } = await createOrgWithOwner('owner4@example.com');
  const invite = await request(app)
    .post(`/v1/organisations/${organisationId}/invitations`)
    .set('authorization', `Bearer ${owner.accessToken}`)
    .send({ email: 'intended@example.com', role: 'ANALYST' });

  const impostor = await signupAndLogin('impostor@example.com');
  const accept = await request(app)
    .post(`/v1/invitations/${invite.body.devInviteToken}/accept`)
    .set('authorization', `Bearer ${impostor.accessToken}`);
  assert.equal(accept.status, 403);
});

test('an ANALYST cannot invite new members', async () => {
  const { owner, organisationId } = await createOrgWithOwner('owner5@example.com');
  const invite = await request(app)
    .post(`/v1/organisations/${organisationId}/invitations`)
    .set('authorization', `Bearer ${owner.accessToken}`)
    .send({ email: 'analyst@example.com', role: 'ANALYST' });
  const analyst = await signupAndLogin('analyst@example.com');
  await request(app).post(`/v1/invitations/${invite.body.devInviteToken}/accept`).set('authorization', `Bearer ${analyst.accessToken}`);

  const res = await request(app)
    .post(`/v1/organisations/${organisationId}/invitations`)
    .set('authorization', `Bearer ${analyst.accessToken}`)
    .send({ email: 'another@example.com', role: 'DEVELOPER' });
  assert.equal(res.status, 403);
});

test('removing a member sets status to REMOVED and they lose access', async () => {
  const { owner, organisationId } = await createOrgWithOwner('owner6@example.com');
  const invite = await request(app)
    .post(`/v1/organisations/${organisationId}/invitations`)
    .set('authorization', `Bearer ${owner.accessToken}`)
    .send({ email: 'removable@example.com', role: 'DEVELOPER' });
  const removable = await signupAndLogin('removable@example.com');
  await request(app).post(`/v1/invitations/${invite.body.devInviteToken}/accept`).set('authorization', `Bearer ${removable.accessToken}`);

  const membersBefore = await request(app)
    .get(`/v1/organisations/${organisationId}/members`)
    .set('authorization', `Bearer ${owner.accessToken}`);
  const memberId = membersBefore.body.find((m: { user: { email: string } }) => m.user.email === 'removable@example.com').id;

  const del = await request(app)
    .delete(`/v1/organisations/${organisationId}/members/${memberId}`)
    .set('authorization', `Bearer ${owner.accessToken}`);
  assert.equal(del.status, 204);

  const afterAccess = await request(app)
    .get(`/v1/organisations/${organisationId}`)
    .set('authorization', `Bearer ${removable.accessToken}`);
  assert.equal(afterAccess.status, 404);
});

test('sensitive mutations are recorded in the audit log', async () => {
  const { owner, organisationId } = await createOrgWithOwner('owner7@example.com');
  await request(app)
    .patch(`/v1/organisations/${organisationId}`)
    .set('authorization', `Bearer ${owner.accessToken}`)
    .send({ name: 'Renamed Org' });

  const logs = await request(app)
    .get(`/v1/organisations/${organisationId}/audit-logs`)
    .set('authorization', `Bearer ${owner.accessToken}`);
  assert.equal(logs.status, 200);
  const actions = logs.body.map((l: { action: string }) => l.action);
  assert.ok(actions.includes('organisation.created'));
  assert.ok(actions.includes('organisation.updated'));
});
