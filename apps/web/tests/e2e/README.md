# Web e2e suite (Playwright)

Two specs, both expected green against a production build:

- **`homepage-motion.spec.ts`** — scroll choreography, responsiveness, and
  reduced-motion behavior of the homepage's pinned product story and carousel.
- **`npi-truth-engine.spec.ts`** — the truth contract of the hero NPI lookup
  (`app/HomePageClient.tsx` → `components/home/LiveNpiResult.tsx`) plus the
  `/review` no-fabricated-decision state. It mocks the two browser-visible
  proxies (`/api/identity/bootstrap/:npi`, `/api/trust-state/:npi`) and pins
  how each truth state renders: confirmed vs attention vs
  unavailable-without-access, outage = system state not a finding, no bare
  "Verified", no fabricated score. **Do not weaken these assertions to make a
  copy change pass** — update copy and spec together, deliberately.

## Running locally

Against a production build (what CI-style verification means here):

```sh
pnpm run build:web   # turbo — also builds the @vitalcv/trust-state dependency
cd apps/web
CLERK_SECRET_KEY= NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= \
  pnpm exec next start -H 127.0.0.1 -p 3000 &
pnpm exec playwright test
```

`playwright.config.ts` reuses an existing server on `:3000` outside CI; with
nothing listening it starts `next dev` itself (Clerk keys cleared either way —
the suite runs signed-out and must not depend on a backend on `:4000`).

## Retired specs (2026-07-15)

Four pre-#510 specs were removed rather than rewritten. They drove flows that
no longer exist:

- `01-clinician-onboarding.spec.ts` (`/demo/magic`), `02-employer-verification.spec.ts`
  (`/demo/command-center`), `03-revocation-trigger.spec.ts` (`/demo/verifier-portal`) —
  the `/demo/*` routes were deleted along with the fabricated demo theater they
  exercised (mock document scans, "ZK proof" terminals, simulated revocations).
  The product deliberately moved to honest, source-backed surfaces; there is
  nothing real behind those flows to test.
- `04-launch-wedge.spec.ts` — targeted the pre-#510 hero (`Check Credential
  Readiness`, `/api/ingest/**` SSE) and a removed "share in your next
  interview" flow. Its one still-true assertion — `/review/<entityId>` renders
  an explicit unavailable card, never a fabricated decision — lives on in
  `npi-truth-engine.spec.ts`.

If a retired flow returns as a real product surface, write a fresh spec against
the real routes; `git log -- apps/web/tests/e2e` has the originals.
