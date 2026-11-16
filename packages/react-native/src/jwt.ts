import type { EntitlementClaims } from '@formcoach/types';

/**
 * Decodes a JWS/JWT payload WITHOUT verifying its signature.
 *
 * Spec 11.2 requires the SDK to verify the entitlement signature using an embedded
 * public key before trusting any claim. In a production native implementation that
 * verification happens in the native layer (Kotlin/Swift), which is not implemented
 * in this environment — see native/README.md. This TypeScript reference facade
 * decodes claims for cache/expiry bookkeeping only and must not be treated as proof
 * the token is authentic; do not ship this decode-only path as the sole trust boundary.
 */
export function decodeEntitlementPayload(token: string): EntitlementClaims {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed entitlement token.');
  const payloadBase64Url = parts[1]!;
  const base64 = payloadBase64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const json = globalThis.atob ? globalThis.atob(padded) : Buffer.from(padded, 'base64').toString('utf-8');
  return JSON.parse(json) as EntitlementClaims;
}

export function isEntitlementExpired(claims: EntitlementClaims, nowMs: number = Date.now()): boolean {
  return nowMs / 1000 > claims.offlineGraceUntil;
}

export function isEntitlementWithinGrace(claims: EntitlementClaims, nowMs: number = Date.now()): boolean {
  const nowSeconds = nowMs / 1000;
  return nowSeconds > claims.expiresAt && nowSeconds <= claims.offlineGraceUntil;
}
