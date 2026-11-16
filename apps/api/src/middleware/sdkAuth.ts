import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/errors';
import { verifySdkSessionToken, type SdkSessionClaims } from '../modules/sdk/sessionToken';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      sdkSession?: SdkSessionClaims;
    }
  }
}

export function requireSdkSession(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new ApiError('UNAUTHENTICATED', 'Missing SDK session token.');
  }
  try {
    req.sdkSession = verifySdkSessionToken(header.slice('Bearer '.length));
    next();
  } catch {
    throw new ApiError('TOKEN_INVALID', 'SDK session token is invalid or expired.');
  }
}
