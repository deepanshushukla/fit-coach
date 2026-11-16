import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../lib/http';
import { validateBody } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import { requireOrgRole } from '../../middleware/orgRbac';
import { requireApplicationRole, requireEnvironmentRole } from './access';
import { newPublicIdentifier } from '../../lib/ids';
import { recordAudit } from '../audit/audit';

const PLATFORMS = ['ios', 'android', 'react-native', 'expo', 'flutter'] as const;
const ENVIRONMENT_NAMES = ['DEVELOPMENT', 'STAGING', 'PRODUCTION'] as const;

export const organisationApplicationsRouter = Router({ mergeParams: true });
organisationApplicationsRouter.use(requireAuth);

const createAppSchema = z.object({
  name: z.string().min(2).max(120),
  platforms: z.array(z.enum(PLATFORMS)).min(1),
});

organisationApplicationsRouter.post(
  '/',
  requireOrgRole('OWNER', 'ADMIN', 'DEVELOPER'),
  validateBody(createAppSchema),
  asyncHandler(async (req, res) => {
    const { name, platforms } = req.body as z.infer<typeof createAppSchema>;
    const application = await prisma.application.create({
      data: { organisationId: req.params.organisationId, name, platforms },
    });
    await recordAudit({
      actorUserId: req.user!.id,
      organisationId: req.params.organisationId,
      action: 'application.created',
      resourceType: 'application',
      resourceId: application.id,
    });
    res.status(201).json(application);
  })
);

organisationApplicationsRouter.get(
  '/',
  requireOrgRole(),
  asyncHandler(async (req, res) => {
    const applications = await prisma.application.findMany({
      where: { organisationId: req.params.organisationId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(applications);
  })
);

organisationApplicationsRouter.get(
  '/:applicationId/usage',
  requireOrgRole(),
  asyncHandler(async (req, res) => {
    const events = await prisma.usageEvent.groupBy({
      by: ['exerciseId', 'eventType'],
      where: { applicationId: req.params.applicationId },
      _count: { _all: true },
    });
    res.json(events);
  })
);

export const applicationsRouter = Router();
applicationsRouter.use(requireAuth);

applicationsRouter.get(
  '/:applicationId',
  requireApplicationRole(),
  asyncHandler(async (req, res) => {
    const application = await prisma.application.findUnique({
      where: { id: req.params.applicationId },
      include: { environments: true },
    });
    res.json(application);
  })
);

const patchAppSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
});

applicationsRouter.patch(
  '/:applicationId',
  requireApplicationRole('OWNER', 'ADMIN'),
  validateBody(patchAppSchema),
  asyncHandler(async (req, res) => {
    const application = await prisma.application.update({
      where: { id: req.params.applicationId },
      data: req.body as z.infer<typeof patchAppSchema>,
    });
    await recordAudit({
      actorUserId: req.user!.id,
      organisationId: req.application!.organisationId,
      action: 'application.updated',
      resourceType: 'application',
      resourceId: application.id,
      metadata: req.body as Record<string, unknown>,
    });
    res.json(application);
  })
);

const createEnvSchema = z.object({
  name: z.enum(ENVIRONMENT_NAMES),
  allowedSdkVersions: z.array(z.string()).default([]),
  bundleIdentifiers: z.array(z.string()).default([]),
});

applicationsRouter.post(
  '/:applicationId/environments',
  requireApplicationRole('OWNER', 'ADMIN', 'DEVELOPER'),
  validateBody(createEnvSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createEnvSchema>;
    const environment = await prisma.applicationEnvironment.create({
      data: {
        applicationId: req.params.applicationId,
        name: body.name,
        publicIdentifier: newPublicIdentifier('fc_env'),
        allowedSdkVersions: body.allowedSdkVersions,
        bundleIdentifiers: body.bundleIdentifiers,
      },
    });
    await recordAudit({
      actorUserId: req.user!.id,
      organisationId: req.application!.organisationId,
      action: 'environment.created',
      resourceType: 'application_environment',
      resourceId: environment.id,
      metadata: { name: body.name },
    });
    res.status(201).json(environment);
  })
);

applicationsRouter.get(
  '/:applicationId/environments',
  requireApplicationRole(),
  asyncHandler(async (req, res) => {
    const environments = await prisma.applicationEnvironment.findMany({
      where: { applicationId: req.params.applicationId },
    });
    res.json(environments);
  })
);

export const environmentsRouter = Router();
environmentsRouter.use(requireAuth);

const patchEnvSchema = z.object({
  allowedSdkVersions: z.array(z.string()).optional(),
  bundleIdentifiers: z.array(z.string()).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
});

environmentsRouter.patch(
  '/:environmentId',
  requireEnvironmentRole('OWNER', 'ADMIN', 'DEVELOPER'),
  validateBody(patchEnvSchema),
  asyncHandler(async (req, res) => {
    const environment = await prisma.applicationEnvironment.update({
      where: { id: req.params.environmentId },
      data: req.body as z.infer<typeof patchEnvSchema>,
    });
    res.json(environment);
  })
);

environmentsRouter.post(
  '/:environmentId/rotate-credential',
  requireEnvironmentRole('OWNER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const previousIdentifier = req.environment!.id;
    const environment = await prisma.applicationEnvironment.update({
      where: { id: req.params.environmentId },
      data: {
        publicIdentifier: newPublicIdentifier('fc_env'),
        credentialStatus: 'ROTATED',
      },
    });

    await recordAudit({
      actorUserId: req.user!.id,
      action: 'environment.credential_rotated',
      resourceType: 'application_environment',
      resourceId: previousIdentifier,
    });

    res.json(environment);
  })
);
