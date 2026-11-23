import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../lib/prisma';
import { newId } from '../../../lib/ids';
import type { SigningKeyProvider } from '../keyProvider';

const PROVIDER = 'local';

function generateKeyPair(): { publicKeyPem: string; privateKeyPem: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKeyPem: publicKey, privateKeyPem: privateKey };
}

/**
 * Dev/test default. Generates and stores the RSA private key directly in Postgres — the
 * documented production gap (spec 11.2/14.2, docs/security/entitlement-signing.md). Not
 * production-acceptable; use AwsKmsKeyProvider there instead.
 */
export class LocalDbKeyProvider implements SigningKeyProvider {
  async getActiveKey(): Promise<{ keyId: string; publicKeyPem: string }> {
    const existing = await prisma.signingKey.findFirst({ where: { status: 'ACTIVE', provider: PROVIDER } });
    if (existing) return { keyId: existing.id, publicKeyPem: existing.publicKeyPem };

    const { publicKeyPem, privateKeyPem } = generateKeyPair();
    const keyId = `entitlement-key-${newId()}`;
    await prisma.signingKey.create({
      data: { id: keyId, publicKeyPem, privateKeyPem, algorithm: 'RS256', provider: PROVIDER },
    });
    return { keyId, publicKeyPem };
  }

  async sign(keyId: string, claims: Record<string, unknown>): Promise<string> {
    const key = await prisma.signingKey.findUnique({ where: { id: keyId } });
    if (!key?.privateKeyPem) throw new Error(`No private key material available for key '${keyId}'.`);
    return jwt.sign(claims, key.privateKeyPem, { algorithm: 'RS256', keyid: keyId });
  }

  async getPublicKey(keyId: string): Promise<string | undefined> {
    const key = await prisma.signingKey.findUnique({ where: { id: keyId } });
    return key?.publicKeyPem;
  }

  async rotate(): Promise<{ keyId: string; publicKeyPem: string }> {
    await prisma.signingKey.updateMany({
      where: { status: 'ACTIVE', provider: PROVIDER },
      data: { status: 'ROTATED', rotatedAt: new Date() },
    });
    const { publicKeyPem, privateKeyPem } = generateKeyPair();
    const keyId = `entitlement-key-${newId()}`;
    await prisma.signingKey.create({
      data: { id: keyId, publicKeyPem, privateKeyPem, algorithm: 'RS256', provider: PROVIDER },
    });
    return { keyId, publicKeyPem };
  }
}
