# Infrastructure — deferred

Spec section 21 describes separate local/dev/staging/production environments, managed
Postgres, managed secrets/KMS, and centralised logs/metrics/alerts. None of that exists
here: this build runs against a local Postgres instance (`createdb formcoach_dev` /
`formcoach_test`) with no deployment automation, no managed KMS (see
`docs/security/entitlement-signing.md` for why that specifically matters), and no
observability stack beyond the SDK/backend metric *names* described in spec section 16.

Provisioning real infrastructure wasn't attempted — it requires choosing a cloud
provider and committing real spend/accounts, which is a product/ops decision, not
something to default into. `apps/api`'s `.env.example` documents every configuration
value a real deployment would need to externalise.
