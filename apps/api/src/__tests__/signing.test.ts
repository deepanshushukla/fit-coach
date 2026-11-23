import './env-setup';
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { resetDatabase } from './db-reset';
import { LocalDbKeyProvider } from '../modules/entitlements/providers/localDbKeyProvider';
import { AwsKmsKeyProvider } from '../modules/entitlements/providers/awsKmsKeyProvider';
import { prisma } from '../lib/prisma';

before(async () => {
  await resetDatabase();
});
beforeEach(async () => {
  await resetDatabase();
});

test('LocalDbKeyProvider: issues a key, signs claims, and verifies with its own public key', async () => {
  const provider = new LocalDbKeyProvider();
  const key = await provider.getActiveKey();
  const token = await provider.sign(key.keyId, { hello: 'world' });

  const decoded = jwt.verify(token, key.publicKeyPem, { algorithms: ['RS256'] }) as Record<string, unknown>;
  assert.equal(decoded.hello, 'world');
});

test('LocalDbKeyProvider: getActiveKey is idempotent until rotated', async () => {
  const provider = new LocalDbKeyProvider();
  const first = await provider.getActiveKey();
  const second = await provider.getActiveKey();
  assert.equal(first.keyId, second.keyId);
});

test('LocalDbKeyProvider: rotate() retires the old key but keeps it verifiable', async () => {
  const provider = new LocalDbKeyProvider();
  const oldKey = await provider.getActiveKey();
  const tokenSignedBeforeRotation = await provider.sign(oldKey.keyId, { claim: 'pre-rotation' });

  const newKey = await provider.rotate();
  assert.notEqual(newKey.keyId, oldKey.keyId);

  const activeAfterRotation = await provider.getActiveKey();
  assert.equal(activeAfterRotation.keyId, newKey.keyId);

  const oldKeyRow = await prisma.signingKey.findUnique({ where: { id: oldKey.keyId } });
  assert.equal(oldKeyRow?.status, 'ROTATED');

  const stillVerifiablePublicKey = await provider.getPublicKey(oldKey.keyId);
  assert.ok(stillVerifiablePublicKey);
  const decoded = jwt.verify(tokenSignedBeforeRotation, stillVerifiablePublicKey!, {
    algorithms: ['RS256'],
  }) as Record<string, unknown>;
  assert.equal(decoded.claim, 'pre-rotation');
});

/**
 * Minimal fake KMSClient: generates a real RSA keypair per "KMS key" and signs with it
 * locally, so AwsKmsKeyProvider's HTTP-shaped calls (CreateKey/GetPublicKey/Sign) are
 * exercised without a real AWS account.
 */
function fakeKmsClient() {
  const keys = new Map<string, { publicKeyDer: Buffer; privateKey: crypto.KeyObject }>();
  let counter = 0;

  return {
    send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      switch (command.constructor.name) {
        case 'CreateKeyCommand': {
          counter += 1;
          const keyId = `fake-kms-key-${counter}`;
          const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'der' },
            privateKeyEncoding: { type: 'pkcs8', format: 'der' },
          });
          const privateKeyObject = crypto.createPrivateKey({ key: privateKey, format: 'der', type: 'pkcs8' });
          keys.set(keyId, { publicKeyDer: publicKey, privateKey: privateKeyObject });
          return { KeyMetadata: { KeyId: keyId } };
        }
        case 'GetPublicKeyCommand': {
          const entry = keys.get(command.input.KeyId as string);
          if (!entry) throw new Error('unknown key');
          return { PublicKey: entry.publicKeyDer };
        }
        case 'SignCommand': {
          const entry = keys.get(command.input.KeyId as string);
          if (!entry) throw new Error('unknown key');
          const signature = crypto.sign('RSA-SHA256', command.input.Message as Buffer, entry.privateKey);
          return { Signature: signature };
        }
        default:
          throw new Error(`Unhandled command ${command.constructor.name}`);
      }
    },
  };
}

test('AwsKmsKeyProvider: signs via a mocked KMS client and verifies with the cached public key', async () => {
  const provider = new AwsKmsKeyProvider(fakeKmsClient() as never);
  const key = await provider.getActiveKey();
  const token = await provider.sign(key.keyId, { hello: 'kms' });

  const decoded = jwt.verify(token, key.publicKeyPem, { algorithms: ['RS256'] }) as Record<string, unknown>;
  assert.equal(decoded.hello, 'kms');

  const row = await prisma.signingKey.findUnique({ where: { id: key.keyId } });
  assert.equal(row?.privateKeyPem, null);
  assert.equal(row?.provider, 'aws-kms');
});

test('AwsKmsKeyProvider: rotate() creates a new KMS key and retires the old one', async () => {
  const provider = new AwsKmsKeyProvider(fakeKmsClient() as never);
  const oldKey = await provider.getActiveKey();
  const newKey = await provider.rotate();
  assert.notEqual(newKey.keyId, oldKey.keyId);

  const oldRow = await prisma.signingKey.findUnique({ where: { id: oldKey.keyId } });
  assert.equal(oldRow?.status, 'ROTATED');
});
