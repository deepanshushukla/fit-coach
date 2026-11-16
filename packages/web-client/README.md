# @formcoach/web-client — deferred

Not implemented. Spec section 8.1 lists an "optional typed portal/API client" as a
nice-to-have, not a required deliverable. The portal app (`apps/portal`) currently
talks to the API directly through a small hand-written fetch wrapper
(`apps/portal/src/lib/api.ts`), which was the higher-priority path given the sprint
sequence in spec section 25 (prove the SDK/engine and licensing flows first).

If this package is picked up later, it should be generated from the backend's OpenAPI
contract (spec 12, "described with OpenAPI" — the OpenAPI document itself is also not
yet generated and is tracked as follow-up work) rather than hand-written a second time.
