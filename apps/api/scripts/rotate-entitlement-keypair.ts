import 'dotenv/config';
import { rotateSigningKey } from '../src/modules/entitlements/signing';
import { prisma } from '../src/lib/prisma';

/**
 * Retires the current active signing key (kept queryable so entitlements already signed
 * with it keep verifying) and activates a new one. Run after a suspected key compromise
 * or on a routine rotation schedule.
 */
async function main() {
  const key = await rotateSigningKey();
  console.log(`New active keyId: ${key.keyId}`);
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
