import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { newId } from '../../lib/ids';

/**
 * Entitlement signing key management.
 *
 * IMPORTANT (spec 11.2, 14.2): in a production deployment the private key must live in a
 * KMS/HSM and never touch application memory or a general-purpose database row. This
 * reference implementation stores the private key PEM in Postgres so the full signed-
 * entitlement flow is runnable and testable without standing up a cloud KMS — that gap
 * is called out explicitly in docs/security/entitlement-signing.md and must be closed
 * before production use.
 */

export interface SigningKeyPair {
  keyId: string;
  publicKeyPem: string;
  privateKeyPem: string;
}

export async function getOrCreateActiveSigningKey(): Promise<SigningKeyPair> {
  const existing = await prisma.signingKey.findFirst({ where: { status: 'ACTIVE' } });
  if (existing) {
    return { keyId: existing.id, publicKeyPem: existing.publicKeyPem, privateKeyPem: existing.privateKeyPem };
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const keyId = `entitlement-key-${newId()}`;
  await prisma.signingKey.create({
    data: { id: keyId, publicKeyPem: publicKey, privateKeyPem: privateKey, algorithm: 'RS256' },
  });

  return { keyId, publicKeyPem: publicKey, privateKeyPem: privateKey };
}

export async function getPublicKey(keyId: string): Promise<string | undefined> {
  const key = await prisma.signingKey.findUnique({ where: { id: keyId } });
  return key?.publicKeyPem;
}

export function signClaims(claims: Record<string, unknown>, key: SigningKeyPair): string {
  return jwt.sign(claims, key.privateKeyPem, { algorithm: 'RS256', keyid: key.keyId });
}

export interface VerifyResult {
  valid: boolean;
  claims?: Record<string, unknown>;
  failure?: string;
}

export async function verifyEntitlementToken(token: string): Promise<VerifyResult> {
  const decoded = jwt.decode(token, { complete: true });
  const keyId = decoded && typeof decoded === 'object' ? decoded.header.kid : undefined;
  if (!keyId) return { valid: false, failure: 'malformed' };

  const publicKeyPem = await getPublicKey(keyId);
  if (!publicKeyPem) return { valid: false, failure: 'unknown_key_id' };

  try {
    const claims = jwt.verify(token, publicKeyPem, { algorithms: ['RS256'] }) as Record<string, unknown>;
    return { valid: true, claims };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) return { valid: false, failure: 'expired' };
    return { valid: false, failure: 'signature_invalid' };
  }
}

export function hashClaims(claims: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(JSON.stringify(claims)).digest('hex');
}
