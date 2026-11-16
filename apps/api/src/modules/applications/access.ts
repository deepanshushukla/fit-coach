import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/errors';
import { asyncHandler } from '../../lib/http';

/**
 * Loads the application for req.params.applicationId, enforces that the caller is an
 * active member of its owning organisation (with an allowed role), and attaches both
 * to the request. Used by routes addressed by application/environment ID directly
 * (not nested under /organisations/:organisationId), which still must be tenant-scoped.
 */
export function requireApplicationRole(...allowedRoles: string[]) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new ApiError('UNAUTHENTICATED', 'Authentication required.');

    const application = await prisma.application.findUnique({ where: { id: req.params.applicationId } });
    if (!application) throw new ApiError('NOT_FOUND', 'Application not found.');

    if (req.user.platformRole !== 'SUPER_ADMIN') {
      const membership = await prisma.organisationMember.findFirst({
        where: { organisationId: application.organisationId, userId: req.user.id, status: 'ACTIVE' },
      });
      if (!membership) throw new ApiError('NOT_FOUND', 'Application not found.');
      if (allowedRoles.length > 0 && !allowedRoles.includes(membership.role)) {
        throw new ApiError('FORBIDDEN', 'This action requires a different organisation role.');
      }
      req.orgRole = membership.role;
    } else {
      req.orgRole = 'OWNER';
    }

    req.application = application;
    next();
  });
}

export function requireEnvironmentRole(...allowedRoles: string[]) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new ApiError('UNAUTHENTICATED', 'Authentication required.');

    const environment = await prisma.applicationEnvironment.findUnique({
      where: { id: req.params.environmentId },
      include: { application: true },
    });
    if (!environment) throw new ApiError('NOT_FOUND', 'Environment not found.');

    if (req.user.platformRole !== 'SUPER_ADMIN') {
      const membership = await prisma.organisationMember.findFirst({
        where: { organisationId: environment.application.organisationId, userId: req.user.id, status: 'ACTIVE' },
      });
      if (!membership) throw new ApiError('NOT_FOUND', 'Environment not found.');
      if (allowedRoles.length > 0 && !allowedRoles.includes(membership.role)) {
        throw new ApiError('FORBIDDEN', 'This action requires a different organisation role.');
      }
      req.orgRole = membership.role;
    } else {
      req.orgRole = 'OWNER';
    }

    req.environment = environment;
    next();
  });
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      application?: { id: string; organisationId: string; name: string };
      environment?: { id: string; applicationId: string };
    }
  }
}
