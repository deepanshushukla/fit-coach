import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../../lib/env';

export interface AccessTokenClaims {
  sub: string;
  platformRole: string;
}

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, env.jwtAccessSecret, { expiresIn: env.accessTokenTtlSeconds });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  return jwt.verify(token, env.jwtAccessSecret) as unknown as AccessTokenClaims;
}

/** Refresh tokens are opaque random strings; only their hash is stored, so a DB leak can't be replayed. */
export function generateRefreshToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateOpaqueToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(24).toString('hex');
  return { token, hash: hashToken(token) };
}
