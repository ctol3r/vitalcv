# Golden Path Route Inventory

Canonical inventory of every route on the clinician Golden Path
(`NPI → Source Checks → Readiness Snapshot → Passport / Proof Packet →
Employer Review → Accept / Refresh / Route to Review`), the surfaces that
render them, and how each is verified.

**Contract enforcement:** every route in this table is pinned by
[`apps/web/__tests__/holder-route-contract.test.ts`](../../apps/web/__tests__/holder-route-contract.test.ts)
(`GOLDEN_PATH_ROUTES`). Removing, renaming, or archiving any of these pages —
or minting a link to a route that doesn't exist — fails CI before production.
This document and that table must change together.

- **Wave:** 2F — Route Contract + Golden Path Regression Hardening
- **Last verified SHA:** `a2d03cac2` (origin/main)
- **Last production probe:** 2026-07-02 (https://vitalcv.com, statuses below)

## Primary routes

| Route | Source component | Source file | Expected auth state | Public/Private | Production verification method | Last verified SHA |
|---|---|---|---|---|---|---|
| `/get-ready` | `GetReadySurface` | `apps/web/app/get-ready/GetReadySurface.tsx` | Anonymous OK (NPI binding entry) | Public | `curl` → 200 ✅ | `a2d03cac2` |
| `/onboarding` | `GetReadySurface` | `apps/web/app/onboarding/GetReadySurface.tsx` | Anonymous OK (NPI binding entry) | Public | `curl` → 200 ✅ | `a2d03cac2` |
| `/holder` | Holder hub | `apps/web/app/holder/page.tsx` | Signed-in, role `CLINICIAN` | Private | `curl` → 307 → `/sign-in` ✅; signed-in browser pass (Chris — Clerk CDN blocks automated browsers) | `a2d03cac2` |
| `/holder/home` | `ClinicianHomeSurface` | `apps/web/components/mobile/ClinicianHomeSurface.tsx` (page: `apps/web/app/holder/home/page.tsx`) | Signed-in, role `CLINICIAN` | Private | `curl` → 307 ✅; signed-in browser pass | `a2d03cac2` |
| `/holder/readiness` | `ReadinessSurface` | `apps/web/app/holder/readiness/ReadinessSurface.tsx` | Signed-in, role `CLINICIAN` | Private | `curl` → 307 ✅; signed-in browser pass | `a2d03cac2` |
| `/holder/blockers/[blockerId]` | `ClinicianBlockerDetailSurface` | `apps/web/components/mobile/ClinicianBlockerDetailSurface.tsx` (page: `apps/web/app/holder/blockers/[blockerId]/page.tsx`; hrefs built in `apps/web/lib/mobile/clinician-state.ts`) | Signed-in, role `CLINICIAN` | Private | `curl` → 307 ✅; signed-in browser pass | `a2d03cac2` |
| `/holder/opportunities` | `ClinicianOpportunitiesSurface` | `apps/web/components/mobile/ClinicianOpportunitiesSurface.tsx` (page: `apps/web/app/holder/opportunities/page.tsx`) | Signed-in, role `CLINICIAN` | Private | `curl` → 307 ✅; signed-in browser pass | `a2d03cac2` |
| `/holder/opportunities/discover` | `DiscoverSurface` (MATCHA Deck) | `apps/web/components/matcha-deck/DiscoverSurface.tsx` (page: `apps/web/app/holder/opportunities/discover/page.tsx`) | Signed-in, role `CLINICIAN` | Private | vitest route contract ✅; fixture-deck browser pass via `/dev/matcha-deck` harness | PR J1 |
| `/holder/opportunities/interested` | `InterestedWorkspaceSurface` | `apps/web/components/matcha-deck/InterestedWorkspaceSurface.tsx` (page: `apps/web/app/holder/opportunities/interested/page.tsx`) | Signed-in, role `CLINICIAN` | Private | vitest route contract ✅ | PR J4 |
| `/holder/opportunities/passed` | `PassedWorkspaceSurface` | `apps/web/components/matcha-deck/PassedWorkspaceSurface.tsx` (page: `apps/web/app/holder/opportunities/passed/page.tsx`) | Signed-in, role `CLINICIAN` | Private | vitest route contract ✅ | PR J4 |
| `/holder/opportunities/[id]` | `OpportunityDetailSurface` | `apps/web/app/holder/opportunities/[id]/OpportunityDetailSurface.tsx` | Signed-in, role `CLINICIAN` | Private | `curl` → 307 ✅; signed-in browser pass | `a2d03cac2` |
| `/holder/applications` | `ClinicianApplicationsSurface` | `apps/web/components/mobile/ClinicianApplicationsSurface.tsx` (page: `apps/web/app/holder/applications/page.tsx`) | Signed-in, role `CLINICIAN` | Private | `curl` → 307 ✅; signed-in browser pass | `a2d03cac2` |
| `/holder/applications/[id]` | `ClinicianApplicationDetailSurface` | `apps/web/components/mobile/ClinicianApplicationDetailSurface.tsx` (page: `apps/web/app/holder/applications/[id]/page.tsx`) | Signed-in, role `CLINICIAN` | Private | `curl` → 307 ✅; signed-in browser pass | `a2d03cac2` |
| `/holder/timeline` | Server redirect → `/activity/[entityId]` | `apps/web/app/holder/timeline/page.tsx` | Signed-in, role `CLINICIAN` (redirects: no NPI → `/get-ready`; no session → `/sign-in`) | Private | `curl` → 307 ✅; signed-in browser pass confirms redirect chain | `a2d03cac2` |
| `/holder/settings` | `SettingsSurface` | `apps/web/app/holder/settings/SettingsSurface.tsx` | Signed-in, role `CLINICIAN` | Private | `curl` → 307 ✅; signed-in browser pass | `a2d03cac2` |
| `/holder/recognition` | `RecognitionSurface` | `apps/web/components/recognition/RecognitionSurface.tsx` (page: `apps/web/app/holder/recognition/page.tsx`) | Signed-in, role `CLINICIAN` | Private | `curl` → 307 ✅; signed-in browser pass | `a2d03cac2` |
| `/clinician/profile` | `ProfileSurface` | `apps/web/app/clinician/profile/ProfileSurface.tsx` | Signed-in, role `CLINICIAN` | Private | `__tests__/clinician-route-guard.test.ts` drives the real middleware: anonymous → 307 `/sign-in` + `private, no-store` ✅ | RD-2 guard fix |
| `/verify/[npi]` | Public verifier surface | `apps/web/app/verify/[npi]/page.tsx` | Anonymous (public share target for recognition/passport links) | Public | `curl /verify/1234567890` → 200 ✅ | `a2d03cac2` |

## Supporting routes the Golden Path depends on

| Route | Source component | Source file | Expected auth state | Public/Private | Production verification method | Last verified SHA |
|---|---|---|---|---|---|---|
| `/activity/[entityId]` | `ActivityClient` (career timeline) | `apps/web/app/activity/[entityId]/page.tsx` | Middleware pass-through (NPI-keyed public read) | Public | `curl /activity/1234567890` → 200 ✅ | `a2d03cac2` |
| `/apply/[bundleId]` | `ApplyBundleView` | `apps/web/app/apply/[bundleId]/page.tsx` | Anonymous (public apply flow) | Public | `curl /apply/<id>` — ⚠️ invalid ids return 500 instead of 404 (tracked as follow-up task; route itself is live) | `a2d03cac2` |
| `/.well-known/jwks.json`, `/.well-known/trust.json` | Rewrites → `/api/.well-known/*` route handlers | `apps/web/next.config.mjs` (rewrites), `apps/web/app/api/.well-known/*/route.ts` | Anonymous (offline verification endpoints, linked from `/verify/guide`) | Public | `curl` → 200 ✅ | `a2d03cac2` |

## Auth-state legend

- **Signed-in, role `CLINICIAN`** — `apps/web/lib/auth/roles.ts` `PROTECTED_ROUTES` matches `/holder(/.*)?` and `/clinician(/.*)?` to `UserRole.CLINICIAN`; middleware 307s anonymous traffic to `/sign-in`. The contract test asserts this classification (`getRequiredRole`). Note that asserting the classification is asserting a LIST — `apps/web/__tests__/clinician-route-guard.test.ts` additionally asserts the response an anonymous visitor actually receives, which is what the list is for.
- **Public** — matches `PUBLIC_ROUTE_PATTERNS`; the contract test asserts `isPublicRoute(...) === true`.
- **Middleware pass-through** — neither protected nor public in middleware; the page handles its own state. The contract test pins this too, so silently gating or un-gating one of these routes fails CI.

## How the contract protects these routes (Wave 2F)

Four independent layers in `holder-route-contract.test.ts`:

1. **Route presence** — each row above must resolve to a live page under
   `apps/web/app` using App-Router semantics: `(group)` folders transparent,
   `_private`/`@slot` folders never routable (so `_archive/**` copies do NOT
   count), `[param]`/`[...rest]`/`[[...rest]]` handled, `next.config.mjs`
   rewrite/redirect sources honored only when their destinations resolve.
2. **Link contract** — every internal href constructed by files under the
   golden scan roots (`app/holder`, `app/clinician`, `app/get-ready`,
   `app/verify`, `app/activity`, `app/apply`, `components/mobile`,
   `components/clinician`, `components/recognition`, `lib/mobile`, plus
   `app/HomePageClient.tsx`) must resolve — JSX attrs, `href:` object keys,
   variable assignments, template literals (query-aware), `router.push` /
   `router.replace`, and `redirect()` / `permanentRedirect()` calls.
   Files are auto-discovered; new surfaces are covered automatically.
3. **Repo-wide namespace sweep** — any quoted string anywhere in `app/`,
   `components/`, or `lib/` minting a `/holder|/clinician|/get-ready|/verify|/activity|/apply`
   URL must resolve, regardless of syntax (route-constant tables, data-layer
   builders, ternary arms, prefix classifiers).
4. **Negative controls** — the extractor and resolver are themselves tested
   against fixtures (every href syntax + a planted dead route, a synthetic
   route tree with archived/grouped/slotted/dynamic dirs) and live probes
   (`_archive/**` pages on disk must never be routable). A regex or resolver
   regression cannot silently pass everything.

**Removal drill (verified 2026-07-02):** deleting
`app/holder/timeline/page.tsx` → 5 failures; deleting
`app/holder/blockers/[blockerId]/` → 5 failures across presence, inbound
links, and the data-layer contract. Restore → 145/145.

## Maintenance

- **Adding a Golden Path route:** add the page, add a row here, add the entry
  to `GOLDEN_PATH_ROUTES` in the contract test (route + auth expectation).
- **Retiring a route:** move the page under `apps/web/app/_archive/` (never
  routable), remove its row + table entry, and let the link contract point
  you at every inbound href that must be retargeted.
- **Verifying production:** `pnpm check:deploy` (Railway SHA/health drift),
  then `curl -s -o /dev/null -w '%{http_code}' https://vitalcv.com<route>`
  per the method column. Role-gated content needs a signed-in browser pass —
  Clerk's CDN bot management blocks automated browsers
  (see memory: clerk-cdn-bot-management).
- **Updating "last verified SHA":** after a production probe pass, set all
  rows you probed to the `origin/main` SHA the deploy was serving.
