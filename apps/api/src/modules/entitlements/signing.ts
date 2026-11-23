import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../lib/env';
import type { SigningKeyProvider } from './keyProvider';
import { LocalDbKeyProvider } from './providers/localDbKeyProvider';
import { AwsKmsKeyProvider } from './providers/awsKmsKeyProvider';

/**
 * Entitlement signing. All key storage/signing detail lives behind `SigningKeyProvider`
 * (see keyProvider.ts) — this module only picks which provider is active, via
 * `SIGNING_KEY_PROVIDER`. `local` (the default) stores the private key in Postgres and is
 * dev/test-only; `aws-kms` never lets the private key leave AWS KMS and is the
 * production-acceptable option. See docs/security/entitlement-signing.md.
 */
const provider: SigningKeyProvider =
  env.signingKeyProvider === 'aws-kms' ? new AwsKmsKeyProvider() : new LocalDbKeyProvider();

export async function getActiveSigningKey(): Promise<{ keyId: string; publicKeyPem: string }> {
  return provider.getActiveKey();
}

export async function signClaims(claims: Record<string, unknown>, keyId: string): Promise<string> {
  return provider.sign(keyId, claims);
}

export async function rotateSigningKey(): Promise<{ keyId: string; publicKeyPem: string }> {
  return provider.rotate();
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

  const publicKeyPem = await provider.getPublicKey(keyId);
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
