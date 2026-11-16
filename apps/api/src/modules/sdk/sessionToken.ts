import jwt from 'jsonwebtoken';
import { env } from '../../lib/env';

export interface SdkSessionClaims {
  applicationId: string;
  environmentId: string;
  organisationId: string;
  platform: string;
}

/**
 * Short-lived bearer used only to call SDK endpoints (refresh, usage, status) — distinct
 * from the signed entitlement itself. It authenticates "this is a known app/environment
 * integration", not "this device holds a particular set of rights" (spec 11.1/11.5):
 * the client bootstrap flow must not require a long-lived secret embedded in the binary.
 */
export function signSdkSessionToken(claims: SdkSessionClaims): string {
  return jwt.sign(claims, env.jwtSdkSecret, { expiresIn: env.sdkSessionTokenTtlSeconds });
}

export function verifySdkSessionToken(token: string): SdkSessionClaims {
  return jwt.verify(token, env.jwtSdkSecret) as unknown as SdkSessionClaims;
}
