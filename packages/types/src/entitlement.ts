/**
 * Decoded, verified entitlement claims. The wire format is a JWS/JWT signed with an
 * asymmetric key (RS256); this interface describes the payload after signature
 * verification, issuer/audience/expiry checks and claim validation.
 */
export interface EntitlementClaims {
  iss: string;
  aud: 'formcoach-sdk';
  /** Application ID this entitlement is scoped to. */
  sub: string;
  environment: 'development' | 'staging' | 'production';
  licenceId: string;
  /** Monotonically increasing per-licence version; used to detect stale cached tokens. */
  entitlementVersion: number;
  exercises: string[];
  issuedAt: number;
  expiresAt: number;
  /** Latest timestamp at which an unrefreshed-but-previously-valid token may still be used offline. */
  offlineGraceUntil: number;
  /** Key ID identifying which public key verifies this token's signature, for rotation. */
  keyId: string;
}

export type EntitlementVerificationFailure =
  | 'signature_invalid'
  | 'issuer_mismatch'
  | 'audience_mismatch'
  | 'application_mismatch'
  | 'environment_mismatch'
  | 'expired'
  | 'not_yet_valid'
  | 'unknown_key_id'
  | 'malformed';

export interface EntitlementVerificationResult {
  valid: boolean;
  claims?: EntitlementClaims;
  failure?: EntitlementVerificationFailure;
}
