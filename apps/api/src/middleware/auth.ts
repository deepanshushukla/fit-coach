import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/errors';
import { verifyAccessToken } from '../modules/auth/tokens';

export interface AuthenticatedUser {
  id: string;
  platformRole: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new ApiError('UNAUTHENTICATED', 'Missing bearer access token.');
  }
  const token = header.slice('Bearer '.length);
  try {
    const claims = verifyAccessToken(token);
    req.user = { id: claims.sub, platformRole: claims.platformRole };
    next();
  } catch {
    throw new ApiError('TOKEN_INVALID', 'Access token is invalid or expired.');
  }
}

export function requirePlatformRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.platformRole)) {
      throw new ApiError('FORBIDDEN', 'This action requires elevated platform permissions.');
    }
    next();
  };
}
