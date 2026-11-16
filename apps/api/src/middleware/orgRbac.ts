import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiError } from '../lib/errors';
import { asyncHandler } from '../lib/http';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      orgRole?: string;
    }
  }
}

/**
 * Loads the caller's membership for req.params.organisationId and enforces role.
 * Returns NOT_FOUND rather than FORBIDDEN when the org doesn't exist or the caller
 * isn't a member, so callers cannot probe for the existence of another tenant's org.
 */
export function requireOrgRole(...allowedRoles: string[]) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const organisationId = req.params.organisationId;
    if (!req.user) throw new ApiError('UNAUTHENTICATED', 'Authentication required.');

    if (req.user.platformRole === 'SUPER_ADMIN') {
      req.orgRole = 'OWNER';
      next();
      return;
    }

    const membership = await prisma.organisationMember.findFirst({
      where: { organisationId, userId: req.user.id, status: 'ACTIVE' },
    });

    if (!membership) {
      throw new ApiError('NOT_FOUND', 'Organisation not found.');
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(membership.role)) {
      throw new ApiError('FORBIDDEN', 'This action requires a different organisation role.');
    }

    req.orgRole = membership.role;
    next();
  });
}
