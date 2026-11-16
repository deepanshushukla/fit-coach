# Entitlement signing key storage — production gap

Spec sections 11.2 and 14.2 require the entitlement signing private key to be protected
by a KMS/HSM and to never be present in application code, SDK artifacts, or a
general-purpose database.

This reference implementation (`apps/api/src/modules/entitlements/signing.ts`) stores
the RSA private key PEM in the `SigningKey` Postgres table so the full signed-entitlement
issuance and verification flow is runnable and testable without an external KMS
dependency. **This is not production-acceptable.**

Before production use:

- Move private key material to a managed KMS/HSM (e.g. AWS KMS asymmetric keys, GCP Cloud
  KMS, HashiCorp Vault Transit) and sign via an API call instead of holding the key in
  process memory.
- Keep the public key distribution (for SDK-embedded verification) and `kid`-based
  rotation mechanism — that part of the design does not change.
- Restrict database access so even a full Postgres compromise cannot yield a usable
  signing key.
- Add key-rotation runbooks and alerting for unexpected signing volume.

Tracked as an open decision in `FORMCOACH_COMPLETE_SPEC.md` section 24 and in the
project's final build summary.
