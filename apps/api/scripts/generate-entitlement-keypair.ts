import 'dotenv/config';
import { getActiveSigningKey } from '../src/modules/entitlements/signing';
import { prisma } from '../src/lib/prisma';

/**
 * Ensures an active entitlement signing key exists and prints its public key / keyId —
 * the artifact that must be embedded in SDK builds for offline signature verification
 * (spec 11.2). Which provider creates the key (Postgres-stored for dev, AWS KMS for
 * production) is controlled by SIGNING_KEY_PROVIDER; see
 * docs/security/entitlement-signing.md.
 */
async function main() {
  const key = await getActiveSigningKey();
  console.log(`keyId: ${key.keyId}`);
  console.log('publicKeyPem:');
  console.log(key.publicKeyPem);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
