import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/errors';
import { asyncHandler } from '../../lib/http';
import { validateBody } from '../../lib/validate';
import { requireSdkSession } from '../../middleware/sdkAuth';
import { issueEntitlement } from '../entitlements/entitlements';
import { signSdkSessionToken } from './sessionToken';

export const sdkRouter = Router();

async function findActiveLicenceForApplication(applicationId: string, organisationId: string) {
  return prisma.licence.findFirst({
    where: {
      status: 'ACTIVE',
      OR: [{ applicationId }, { applicationId: null, organisationId }],
    },
    orderBy: { applicationId: 'desc' }, // application-specific licences win over org-wide ones
  });
}

const bootstrapSchema = z.object({
  environmentPublicIdentifier: z.string(),
  sdkVersion: z.string(),
  platform: z.string(),
});

sdkRouter.post(
  '/bootstrap',
  validateBody(bootstrapSchema),
  asyncHandler(async (req, res) => {
    const { environmentPublicIdentifier, sdkVersion, platform } = req.body as z.infer<typeof bootstrapSchema>;

    const environment = await prisma.applicationEnvironment.findUnique({
      where: { publicIdentifier: environmentPublicIdentifier },
      include: { application: true },
    });
    if (!environment || environment.status !== 'ACTIVE') {
      throw new ApiError('NOT_FOUND', 'Unknown or inactive application environment.');
    }

    if (!environment.application.platforms.includes(platform)) {
      throw new ApiError('VALIDATION_ERROR', `Platform '${platform}' is not enabled for this application.`);
    }
    if (environment.allowedSdkVersions.length > 0 && !environment.allowedSdkVersions.includes(sdkVersion)) {
      throw new ApiError('VALIDATION_ERROR', `SDK version '${sdkVersion}' is not permitted for this environment.`);
    }

    const licence = await findActiveLicenceForApplication(environment.applicationId, environment.application.organisationId);
    if (!licence) {
      throw new ApiError('LICENCE_NOT_FOUND', 'No active licence is assigned to this application.');
    }

    const entitlement = await issueEntitlement(licence.id, { bumpEntitlementVersion: false });

    const sessionToken = signSdkSessionToken({
      applicationId: environment.applicationId,
      environmentId: environment.id,
      organisationId: environment.application.organisationId,
      platform,
    });

    await prisma.applicationEnvironment.update({ where: { id: environment.id }, data: { lastUsedAt: new Date() } });

    res.json({ sdkSessionToken: sessionToken, entitlementToken: entitlement.token, claims: entitlement.claims });
  })
);

const refreshSchema = z.object({
  applicationId: z.string(),
  environment: z.string(),
  sdkVersion: z.string(),
  platform: z.string(),
});

sdkRouter.post(
  '/entitlements/refresh',
  requireSdkSession,
  validateBody(refreshSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof refreshSchema>;
    if (body.applicationId !== req.sdkSession!.applicationId) {
      throw new ApiError('FORBIDDEN', 'SDK session token does not match the requested application.');
    }

    const licence = await findActiveLicenceForApplication(req.sdkSession!.applicationId, req.sdkSession!.organisationId);
    if (!licence) throw new ApiError('LICENCE_NOT_FOUND', 'No active licence is assigned to this application.');

    const entitlement = await issueEntitlement(licence.id, { bumpEntitlementVersion: false });
    res.json({ entitlementToken: entitlement.token, claims: entitlement.claims });
  })
);

const usageEventSchema = z.object({
  eventType: z.string(),
  exerciseId: z.string().optional(),
  sdkVersion: z.string(),
  platform: z.string(),
  eventTimestamp: z.string().datetime(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
});

const usageBatchSchema = z.object({
  events: z.array(usageEventSchema).min(1).max(500),
});

sdkRouter.post(
  '/usage/batch',
  requireSdkSession,
  validateBody(usageBatchSchema),
  asyncHandler(async (req, res) => {
    const { events } = req.body as z.infer<typeof usageBatchSchema>;
    const session = req.sdkSession!;

    await prisma.usageEvent.createMany({
      data: events.map((event) => ({
        organisationId: session.organisationId,
        applicationId: session.applicationId,
        environmentId: session.environmentId,
        eventType: event.eventType,
        exerciseId: event.exerciseId,
        sdkVersion: event.sdkVersion,
        platform: event.platform,
        eventTimestamp: new Date(event.eventTimestamp),
        metadata: event.metadata,
      })),
    });

    res.status(202).json({ accepted: events.length });
  })
);

sdkRouter.get(
  '/status',
  requireSdkSession,
  asyncHandler(async (req, res) => {
    const session = req.sdkSession!;
    const licence = await findActiveLicenceForApplication(session.applicationId, session.organisationId);
    res.json({
      applicationId: session.applicationId,
      environmentId: session.environmentId,
      licenceStatus: licence?.status ?? 'none',
      entitlementVersion: licence?.entitlementVersion,
      serverTime: new Date().toISOString(),
    });
  })
);
