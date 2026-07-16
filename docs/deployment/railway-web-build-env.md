# Railway web service — build-time environment contract (Wave 0.1)

**Production owner of `vitalcv.com` is Railway** (project `inspiring-reflection`,
environment `production`, service `vitalcv-web`). The web service builds from
`apps/web/Dockerfile` — NOT Nixpacks. Any doc claiming Nixpacks for the web
service is stale.

## The incident this contract prevents (18c9311, 2026-07-16)

Next.js inlines `NEXT_PUBLIC_*` at **build** time. Railway passes service
variables into a **Docker** build only for names the Dockerfile declares as
`ARG`. The Dockerfile declared only `NEXT_PUBLIC_API_BASE`, so production
built with **no Clerk publishable key**:

- every prerendered page baked `clerkEnabled:false` into its RSC payload;
- the entire client JS bundle compiled `CLERK_PROVIDER_ENABLED = false`;
- runtime-rendered pages (e.g. `/sign-in`, which is `force-dynamic`) read the
  full runtime env and served the key — masking the breakage;
- net effect: sign-in "worked", then every prerendered/client surface treated
  the user as signed out.

Historical cause: the web service originally built with Nixpacks (service
variables injected into builds automatically); the ASVS non-root Dockerfile
migration silently dropped every undeclared variable from the build.

## The contract

1. **Every client-baked (`NEXT_PUBLIC_*`) variable must have a matching `ARG`**
   in the `build` stage of `apps/web/Dockerfile`. Runtime-only secrets
   (`CLERK_SECRET_KEY`, `DATABASE_URL`) must NOT be build args.
2. `apps/web/scripts/docker-build.sh` unsets declared-but-empty vars (an empty
   string would shadow `?? fallback` defaults in code) and **fails the build**
   when `VITALCV_REQUIRE_AUTH_ENV=1` and the Clerk publishable key is absent.
   `VITALCV_REQUIRE_AUTH_ENV=1` must stay set on the `vitalcv-web` service.
3. `turbo.json` hashes `NEXT_PUBLIC_*` into the build task, so a cached build
   from a different env can never be restored as current.
4. `/api/health/auth` (force-dynamic) compares build-time inlined state against
   runtime env and returns 503 on divergence or missing config. Presence
   booleans only — never key material. The deploy smoke test asserts it.

## Required Clerk configuration (verified 2026-07-16, names only)

| Variable | Where | State |
| --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Railway `vitalcv-web` | present (runtime) — now also a build ARG |
| `CLERK_SECRET_KEY` | Railway `vitalcv-web` | present (runtime-only, correct) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `SIGN_UP_URL` | optional | unset — code falls back to `/sign-in`, `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` / `AFTER_SIGN_UP_URL` | optional | unset — ClerkProvider uses `/holder` fallback redirects (app/layout.tsx) |
| Frontend API domain (`clerk.vitalcv.com`) | Clerk dashboard + DNS | serving (CSP allows it since #536) |
| Authorized origins / production instance | Clerk dashboard | **manual check** — dashboard-only, verify `https://www.vitalcv.com` + `https://vitalcv.com` are authorized |

## Production journey status (recorded)

Signed-out verifications (curl, 2026-07-16): `/sign-in` serves Clerk with the
live key; `/holder/*` redirects signed-out visitors; homepage NPI lookup works.
**First failing step on 18c9311:** after Clerk sign-in, the post-auth redirect
lands on surfaces whose client bundle compiled auth-off — the session is
invisible (no signed-in state on `/`, `/onboarding` cannot bind the NPI to the
account). The full authenticated journey (sign up → onboarding → NPI bind →
readiness → Wallet → /holder) requires a human click-through after the fix
deploys: Clerk's bot protection blocks automated browsers, and automated
account creation is out of policy.
