import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/errors';
import { asyncHandler } from '../../lib/http';
import { validateBody } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import { requireOrgRole } from '../../middleware/orgRbac';
import { requireLicenceRole } from './access';
import { issueEntitlement } from '../entitlements/entitlements';
import { recordAudit } from '../audit/audit';

export const organisationLicencesRouter = Router({ mergeParams: true });
organisationLicencesRouter.use(requireAuth);

const createLicenceSchema = z.object({
  applicationId: z.string(),
  planId: z.string(),
  expiresAt: z.string().datetime(),
  offlineGraceSeconds: z.number().int().positive().default(259200),
});

organisationLicencesRouter.post(
  '/',
  requireOrgRole('OWNER', 'ADMIN'),
  validateBody(createLicenceSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createLicenceSchema>;

    const application = await prisma.application.findFirst({
      where: { id: body.applicationId, organisationId: req.params.organisationId },
    });
    if (!application) throw new ApiError('NOT_FOUND', 'Application not found in this organisation.');

    const plan = await prisma.plan.findUnique({ where: { id: body.planId } });
    if (!plan) throw new ApiError('NOT_FOUND', 'Plan not found.');

    const licence = await prisma.licence.create({
      data: {
        organisationId: req.params.organisationId,
        applicationId: body.applicationId,
        planId: body.planId,
        expiresAt: new Date(body.expiresAt),
        offlineGraceSeconds: body.offlineGraceSeconds,
      },
    });

    await recordAudit({
      actorUserId: req.user!.id,
      organisationId: req.params.organisationId,
      action: 'licence.created',
      resourceType: 'licence',
      resourceId: licence.id,
      metadata: { applicationId: body.applicationId, planId: body.planId },
    });

    const entitlement = await issueEntitlement(licence.id, { bumpEntitlementVersion: false });

    res.status(201).json({ licence, entitlementToken: entitlement.token });
  })
);

organisationLicencesRouter.get(
  '/',
  requireOrgRole(),
  asyncHandler(async (req, res) => {
    const licences = await prisma.licence.findMany({ where: { organisationId: req.params.organisationId } });
    res.json(licences);
  })
);

export const licencesRouter = Router();
licencesRouter.use(requireAuth);

licencesRouter.get(
  '/:licenceId',
  requireLicenceRole(),
  asyncHandler(async (req, res) => {
    const licence = await prisma.licence.findUnique({
      where: { id: req.params.licenceId },
      include: { exerciseOverrides: true, plan: true },
    });
    res.json(licence);
  })
);

const patchLicenceSchema = z.object({
  planId: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  offlineGraceSeconds: z.number().int().positive().optional(),
});

licencesRouter.patch(
  '/:licenceId',
  requireLicenceRole('OWNER', 'ADMIN'),
  validateBody(patchLicenceSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof patchLicenceSchema>;
    const licence = await prisma.licence.update({
      where: { id: req.params.licenceId },
      data: {
        planId: body.planId,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        offlineGraceSeconds: body.offlineGraceSeconds,
      },
    });

    await recordAudit({
      actorUserId: req.user!.id,
      organisationId: licence.organisationId,
      action: 'licence.updated',
      resourceType: 'licence',
      resourceId: licence.id,
      metadata: body as Record<string, unknown>,
    });

    // A plan or exercise change is a rights change: issue a new entitlement version immediately
    // rather than waiting for the SDK's next scheduled refresh.
    const entitlement = await issueEntitlement(licence.id, { bumpEntitlementVersion: Boolean(body.planId) });
    const updatedLicence = await prisma.licence.findUniqueOrThrow({ where: { id: licence.id } });

    res.json({ licence: updatedLicence, entitlementToken: entitlement.token });
  })
);

licencesRouter.post(
  '/:licenceId/revoke',
  requireLicenceRole('OWNER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const licence = await prisma.licence.update({
      where: { id: req.params.licenceId },
      data: { status: 'REVOKED' },
    });

    await prisma.entitlementIssue.updateMany({
      where: { licenceId: licence.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await recordAudit({
      actorUserId: req.user!.id,
      organisationId: licence.organisationId,
      action: 'licence.revoked',
      resourceType: 'licence',
      resourceId: licence.id,
    });

    res.json(licence);
  })
);

licencesRouter.post(
  '/:licenceId/reissue-entitlement',
  requireLicenceRole('OWNER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const entitlement = await issueEntitlement(req.params.licenceId, { bumpEntitlementVersion: true });

    await recordAudit({
      actorUserId: req.user!.id,
      organisationId: req.licence!.organisationId,
      action: 'licence.entitlement_reissued',
      resourceType: 'licence',
      resourceId: req.params.licenceId,
    });

    res.json({ entitlementToken: entitlement.token, claims: entitlement.claims });
  })
);
