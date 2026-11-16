import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../lib/http';
import { requireAuth } from '../../middleware/auth';
import { requireOrgRole } from '../../middleware/orgRbac';

export const organisationUsageRouter = Router({ mergeParams: true });
organisationUsageRouter.use(requireAuth);

organisationUsageRouter.get(
  '/',
  requireOrgRole(),
  asyncHandler(async (req, res) => {
    const grouped = await prisma.usageEvent.groupBy({
      by: ['applicationId', 'environmentId', 'exerciseId', 'eventType'],
      where: { organisationId: req.params.organisationId },
      _count: { _all: true },
    });
    res.json(grouped);
  })
);
