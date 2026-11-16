# SDK documentation site — deferred

A standalone docs site (e.g. Docusaurus, per spec 18) was deprioritised in favour of
building the actual SDK, backend and portal first — the recommended sequence in spec
section 25 explicitly defers "Documentation, sample apps and release automation" to
Sprint group F, after the SDK/licensing/portal core is working.

A minimal equivalent exists today: the portal's "SDK & docs" page
(`apps/portal/src/pages/Docs.tsx`) shows the supported-SDK matrix and a quick
integration snippet. When this becomes its own site, it should absorb that content
plus the full API reference, the exercise validation reports (spec 17.4), and the
entitlement/offline-policy explainer currently living in `docs/security/`.
