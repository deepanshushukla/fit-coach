import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/errors';
import { asyncHandler } from '../../lib/http';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      licence?: { id: string; organisationId: string };
    }
  }
}

export function requireLicenceRole(...allowedRoles: string[]) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new ApiError('UNAUTHENTICATED', 'Authentication required.');

    const licence = await prisma.licence.findUnique({ where: { id: req.params.licenceId } });
    if (!licence) throw new ApiError('LICENCE_NOT_FOUND', 'Licence not found.');

    if (req.user.platformRole !== 'SUPER_ADMIN') {
      const membership = await prisma.organisationMember.findFirst({
        where: { organisationId: licence.organisationId, userId: req.user.id, status: 'ACTIVE' },
      });
      if (!membership) throw new ApiError('LICENCE_NOT_FOUND', 'Licence not found.');
      if (allowedRoles.length > 0 && !allowedRoles.includes(membership.role)) {
        throw new ApiError('FORBIDDEN', 'This action requires a different organisation role.');
      }
      req.orgRole = membership.role;
    } else {
      req.orgRole = 'OWNER';
    }

    req.licence = licence;
    next();
  });
}
