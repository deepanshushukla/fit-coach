# FormCoach public site

Real Vite/React app (not deferred anymore) covering the marketing/product overview, the
full REST API reference, the React Native SDK reference, and a pricing page. Mirrors
`apps/portal`'s stack (React 18, react-router-dom v6, Vite 5, plain CSS with the same
design tokens) and its plain-`fetch` API pattern, trimmed down since this site only ever
calls two public, unauthenticated endpoints.

## Running it

```bash
cd apps/docs
npm install
npm run dev   # http://localhost:5174
```

Run `apps/api` (`cd apps/api && npm run dev`, seeded via `npm run db:seed`) alongside it
if you want the Pricing page's live `GET /v1/plans` call to return real data instead of
an error banner.

## What's live vs. static

- **Pricing page** fetches `GET /v1/plans` live — the plan names/exercise lists you see
  are whatever the backend is actually configured with.
- **Home and SDK pages** are static copy, hand-written from the actual router code and
  `packages/react-native`'s exported surface — not generated from an OpenAPI spec or any
  other source of truth. Keeping that in sync by hand is a known maintenance cost; a
  reasonable v2 improvement is generating the API reference from the zod schemas already
  in `apps/api/src/modules/*/router.ts` instead.
- **API reference page** is likewise hand-written from the real routers — every
  endpoint listed is something `apps/api` actually serves today.
