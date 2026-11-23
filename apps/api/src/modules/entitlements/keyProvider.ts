/**
 * Seam between entitlement signing and where the private key material actually lives.
 * `signing.ts` depends only on this interface — never on `crypto`/Postgres/KMS directly —
 * so swapping storage (local Postgres for dev, a real KMS for production) is a choice of
 * which implementation to construct, not a rewrite of the signing/verification flow.
 */
export interface SigningKeyProvider {
  /** Returns the current signing key, creating one if none exists yet. */
  getActiveKey(): Promise<{ keyId: string; publicKeyPem: string }>;

  /** Signs `claims` as an RS256 JWT using `keyId`, embedding it as the JWT header's `kid`. */
  sign(keyId: string, claims: Record<string, unknown>): Promise<string>;

  /** Looks up the public key for `keyId`, regardless of whether that key is still ACTIVE. */
  getPublicKey(keyId: string): Promise<string | undefined>;

  /** Retires the current active key (kept queryable for verification) and activates a new one. */
  rotate(): Promise<{ keyId: string; publicKeyPem: string }>;
}
