import './env-setup';
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from './helpers';
import { resetDatabase } from './db-reset';

before(async () => {
  await resetDatabase();
});
beforeEach(async () => {
  await resetDatabase();
});

test('signup creates a user and returns tokens', async () => {
  const res = await request(app).post('/v1/auth/signup').send({ email: 'a@example.com', password: 'a-very-long-password' });
  assert.equal(res.status, 201);
  assert.equal(res.body.user.email, 'a@example.com');
  assert.ok(res.body.accessToken);
  assert.ok(res.body.refreshToken);
});

test('signup rejects a duplicate email with CONFLICT', async () => {
  await request(app).post('/v1/auth/signup').send({ email: 'dup@example.com', password: 'a-very-long-password' });
  const res = await request(app).post('/v1/auth/signup').send({ email: 'dup@example.com', password: 'a-very-long-password' });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'CONFLICT');
});

test('signup rejects a short password', async () => {
  const res = await request(app).post('/v1/auth/signup').send({ email: 'short@example.com', password: 'short' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('login with correct credentials succeeds', async () => {
  await request(app).post('/v1/auth/signup').send({ email: 'login@example.com', password: 'a-very-long-password' });
  const res = await request(app).post('/v1/auth/login').send({ email: 'login@example.com', password: 'a-very-long-password' });
  assert.equal(res.status, 200);
  assert.ok(res.body.accessToken);
});

test('login with wrong password fails with INVALID_CREDENTIALS', async () => {
  await request(app).post('/v1/auth/signup').send({ email: 'wrongpw@example.com', password: 'a-very-long-password' });
  const res = await request(app).post('/v1/auth/login').send({ email: 'wrongpw@example.com', password: 'not-the-password' });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
});

test('GET /v1/me requires authentication', async () => {
  const res = await request(app).get('/v1/me');
  assert.equal(res.status, 401);
});

test('GET /v1/me returns the authenticated user', async () => {
  const signup = await request(app).post('/v1/auth/signup').send({ email: 'me@example.com', password: 'a-very-long-password' });
  const res = await request(app).get('/v1/me').set('authorization', `Bearer ${signup.body.accessToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.email, 'me@example.com');
});

test('refresh token rotates and the old token cannot be reused', async () => {
  const signup = await request(app).post('/v1/auth/signup').send({ email: 'refresh@example.com', password: 'a-very-long-password' });
  const first = await request(app).post('/v1/auth/refresh').send({ refreshToken: signup.body.refreshToken });
  assert.equal(first.status, 200);
  assert.notEqual(first.body.refreshToken, signup.body.refreshToken);

  const replay = await request(app).post('/v1/auth/refresh').send({ refreshToken: signup.body.refreshToken });
  assert.equal(replay.status, 401, 'a rotated-out refresh token must not be reusable');
});

test('logout revokes the refresh token', async () => {
  const signup = await request(app).post('/v1/auth/signup').send({ email: 'logout@example.com', password: 'a-very-long-password' });
  const logoutRes = await request(app).post('/v1/auth/logout').send({ refreshToken: signup.body.refreshToken });
  assert.equal(logoutRes.status, 204);

  const refreshAfterLogout = await request(app).post('/v1/auth/refresh').send({ refreshToken: signup.body.refreshToken });
  assert.equal(refreshAfterLogout.status, 401);
});

test('password reset request does not reveal whether an account exists', async () => {
  const known = await request(app).post('/v1/auth/password/reset/request').send({ email: 'unknown-user@example.com' });
  assert.equal(known.status, 200);
  assert.equal(known.body.status, 'sent');
  assert.equal(known.body.devResetToken, undefined, 'should not return a token for an unknown account');
});

test('password reset confirm changes the password and revokes existing sessions', async () => {
  const signup = await request(app).post('/v1/auth/signup').send({ email: 'reset@example.com', password: 'original-password-1' });
  const resetReq = await request(app).post('/v1/auth/password/reset/request').send({ email: 'reset@example.com' });
  assert.ok(resetReq.body.devResetToken);

  const confirm = await request(app)
    .post('/v1/auth/password/reset/confirm')
    .send({ token: resetReq.body.devResetToken, newPassword: 'brand-new-password-1' });
  assert.equal(confirm.status, 204);

  const oldLogin = await request(app).post('/v1/auth/login').send({ email: 'reset@example.com', password: 'original-password-1' });
  assert.equal(oldLogin.status, 401);

  const newLogin = await request(app).post('/v1/auth/login').send({ email: 'reset@example.com', password: 'brand-new-password-1' });
  assert.equal(newLogin.status, 200);

  const refreshAfterReset = await request(app).post('/v1/auth/refresh').send({ refreshToken: signup.body.refreshToken });
  assert.equal(refreshAfterReset.status, 401, 'existing sessions must be revoked on password reset');
});
