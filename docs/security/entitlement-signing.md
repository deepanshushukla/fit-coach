# Entitlement signing key storage

Spec sections 11.2 and 14.2 require the entitlement signing private key to be protected
by a KMS/HSM and to never be present in application code, SDK artifacts, or a
general-purpose database.

Signing is implemented behind a `SigningKeyProvider` interface
(`apps/api/src/modules/entitlements/keyProvider.ts`), selected at startup via the
`SIGNING_KEY_PROVIDER` env var:

- **`local`** (default) — `providers/localDbKeyProvider.ts`. Generates an RSA keypair and
  stores the private key PEM in the `SigningKey` Postgres table. **Dev/test only, not
  production-acceptable** — a full Postgres compromise yields a usable signing key.
- **`aws-kms`** — `providers/awsKmsKeyProvider.ts`. The key is generated inside AWS KMS
  (asymmetric `RSA_2048`, `SIGN_VERIFY`) and signing happens via `KMSClient`'s `Sign` API
  call (`RSASSA_PKCS1_V1_5_SHA_256`, matching RS256); the private key never leaves KMS or
  touches application memory. `SigningKey.privateKeyPem` is left `null` for these rows —
  only the cached public key (for SDK-embedded verification) is stored in Postgres.
  **This is the production-acceptable option.**

Both providers share the same `kid`-based rotation design: `rotate()` flips the current
`ACTIVE` key to `ROTATED` (kept queryable so tokens signed before rotation keep verifying
until they expire) and creates a new `ACTIVE` key. Exposed via `npm run keys:rotate`
(mirrors the existing `npm run keys:generate`).

Remaining before a KMS-backed production rollout:

- IAM policy restricting who/what can call `kms:Sign`/`kms:CreateKey` for this key.
- Key-rotation runbooks and alerting for unexpected signing volume — the rotation
  *mechanism* now exists, but no schedule or alerting is wired up.
- GCP Cloud KMS / HashiCorp Vault Transit providers, if multi-cloud matters — only AWS KMS
  is implemented today.

Tracked as an open decision in `FORMCOACH_COMPLETE_SPEC.md` section 24 and in the
project's final build summary.
