import './env-setup';
import request from 'supertest';
import { createApp } from '../app';

export const app = createApp();

export async function signupAndLogin(email: string, password = 'a-very-long-password-1') {
  const res = await request(app).post('/v1/auth/signup').send({ email, password });
  return {
    userId: res.body.user.id as string,
    accessToken: res.body.accessToken as string,
    refreshToken: res.body.refreshToken as string,
  };
}

export async function createOrgWithOwner(email: string) {
  const owner = await signupAndLogin(email);
  const orgRes = await request(app)
    .post('/v1/organisations')
    .set('authorization', `Bearer ${owner.accessToken}`)
    .send({ name: `${email.split('@')[0]}'s Org` });
  return { owner, organisationId: orgRes.body.id as string };
}
