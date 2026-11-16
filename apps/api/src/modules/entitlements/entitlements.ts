import { prisma } from '../../lib/prisma';
import { env } from '../../lib/env';
import { ApiError } from '../../lib/errors';
import { getOrCreateActiveSigningKey, hashClaims, signClaims } from './signing';

export interface IssuedEntitlement {
  token: string;
  claims: Record<string, unknown>;
}

async function resolveLicenceExerciseIds(licenceId: string, planId: string): Promise<string[]> {
  const [planExercises, overrides] = await Promise.all([
    prisma.planExercise.findMany({ where: { planId } }),
    prisma.licenceExerciseOverride.findMany({ where: { licenceId } }),
  ]);

  const included = new Set(planExercises.map((pe) => pe.exerciseId));
  for (const override of overrides) {
    if (override.access === 'INCLUDE') included.add(override.exerciseId);
    else included.delete(override.exerciseId);
  }
  return Array.from(included);
}

/**
 * Builds and signs a fresh entitlement for a licence. Pass bumpEntitlementVersion=true
 * only for explicit reissues (plan change, revoke+reissue) — a routine SDK refresh should
 * not change the version, since entitlementVersion exists to let the SDK detect
 * genuinely new rights, not merely a re-signed copy of the same rights.
 */
export async function issueEntitlement(
  licenceId: string,
  options: { bumpEntitlementVersion: boolean }
): Promise<IssuedEntitlement> {
  const licence = await prisma.licence.findUnique({ where: { id: licenceId } });
  if (!licence) throw new ApiError('LICENCE_NOT_FOUND', 'Licence not found.');
  if (licence.status === 'REVOKED') throw new ApiError('CONFLICT', 'Licence has been revoked.');
  if (!licence.applicationId) {
    throw new ApiError('VALIDATION_ERROR', 'Licence must be assigned to an application before entitlement issuance.');
  }

  const entitlementVersion = options.bumpEntitlementVersion
    ? (
        await prisma.licence.update({
          where: { id: licence.id },
          data: { entitlementVersion: { increment: 1 } },
        })
      ).entitlementVersion
    : licence.entitlementVersion;

  const exercises = await resolveLicenceExerciseIds(licence.id, licence.planId);

  const application = await prisma.application.findUnique({ where: { id: licence.applicationId } });
  if (!application) throw new ApiError('NOT_FOUND', 'Application not found.');

  const now = new Date();
  const expiresAt = licence.expiresAt < now ? now : licence.expiresAt;
  const offlineGraceUntil = new Date(expiresAt.getTime() + licence.offlineGraceSeconds * 1000);

  const key = await getOrCreateActiveSigningKey();

  const claims = {
    iss: env.entitlementIssuer,
    aud: 'formcoach-sdk',
    sub: licence.applicationId,
    environment: 'production',
    licenceId: licence.id,
    entitlementVersion,
    exercises,
    issuedAt: Math.floor(now.getTime() / 1000),
    expiresAt: Math.floor(expiresAt.getTime() / 1000),
    offlineGraceUntil: Math.floor(offlineGraceUntil.getTime() / 1000),
    keyId: key.keyId,
  };

  const token = signClaims(claims, key);

  await prisma.entitlementIssue.create({
    data: {
      licenceId: licence.id,
      entitlementVersion,
      keyId: key.keyId,
      expiresAt,
      claimsHash: hashClaims(claims),
    },
  });

  return { token, claims };
}
