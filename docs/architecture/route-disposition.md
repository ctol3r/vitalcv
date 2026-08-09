# Route disposition — apps/web

**Wave:** A0 (production-truth containment and route disposition), per
`docs/audits/2026-08-08-signed-in-product-audit-action-plan.md`.
**Census base:** `origin/main` @ `4765ff90f` (2026-08-08); branch rebased onto `5bc35c9da`
(#1201 retired-route gate, #1203 Workbench CC-00/CC-01/CC-04) before publication.
**Production at census time:** `https://vitalcv.com/api/version` → `873542cbe`; by A0 completion it
had advanced to `87bea5598` (#1201), an ancestor of this branch's base. Production was read live at
both points, not inferred from local main.
**Counts:** 135 non-archive page routes, 280 non-archive API routes, 92 archived pages under
`apps/web/app/_archive` (none linked or imported by active code — verified by sweep; the only
mention outside `_archive` is a historical comment in `apps/web/app/explore/page.tsx`).

Maintenance rule: this document classifies routes; it does not own them. The enforcing artifacts
are `apps/web/components/layout/publicSurfaceRoutes.ts` (chrome), `apps/web/lib/auth/roles.ts`
(middleware auth), `apps/web/app/sitemap.ts` (indexing), and the tests named below. When a route's
class changes, change the enforcing artifact and its test first, then this record.

## Classification taxonomy

| Class | Meaning |
| --- | --- |
| `public-current` | Current product/marketing surface, intentionally public. |
| `authenticated-clinician` | Clinician product; Clerk-gated. |
| `authenticated-employer` | Employer product; VERIFIER-gated. |
| `internal/guarded` | Admin, ops, issuer-demo; role- or session-gated. |
| `developer` | Preview/reference harnesses; must 404 on canonical production. |
| `legacy-compatibility` | Kept deliberately for old links/binaries; redirect or frozen. |
| `remove/redirect` | No current owner or leaking; disposition action required. |

## Navigation and chrome ownership (A0 work item 4)

Exactly one owner per chrome family. These are the declared owners for UX-02/UX-03 to converge on:

| Chrome | Owner (single) | Composition |
| --- | --- | --- |
| Public | `apps/web/components/layout/RootChrome.tsx` | Mounted by `app/layout.tsx`; branches only on `isOpsSurfacePath`; renders `Eyebrow.tsx` (header, self-nulls off public surface) + `Footer` (same rule). Nav destinations live in `components/layout/navDestinations.ts`; route-context CTAs in `headerRouteContext.ts`. |
| Clinician | `apps/web/components/holder/HolderWorkspaceFrame.tsx` | Mounted by `app/holder/layout.tsx` (the single Clerk gate for the tree); composes `HolderDesktopNav.tsx`, `HolderWorkspaceShell.tsx`, and `components/clinician/MobileBottomNav.tsx`. Garden tabs come from `lib/career-garden/nav.ts`. |
| Ops | `components/ui/app-shell.tsx` (VCommandBar et al.) | Mounted only for `OPS_SURFACE_PREFIXES` paths. |

Corrections to the 2026-08-08 audit's repository observations:

- `apps/web/components/holder/HolderSubNav.tsx` **no longer exists** and has zero imports. There is
  no second holder navigation family on main; the audit's finding is stale.
- `apps/web/app/holder/readiness/ReadinessSurface.tsx` **no longer contains `buildDemoSnapshot()`**.
  It was replaced with passport-backed readiness (`8f68ef004`, PR #706 era) that renders honest
  loading / no-NPI / error states. A0 adds the guard so it cannot return:
  `apps/web/__tests__/a0-truth-containment.test.tsx` (component + source sweep) and
  `apps/web/tests/e2e-authed/readiness-unlinked.spec.ts` (the real route through the real gate).
- `components/mobile/ClinicianReadinessSurface.tsx` is an **orphan**: no route imports it, yet
  `apps/web/__tests__/holder-readiness-page.test.tsx` tests it under the name "/holder/readiness
  page". The test asserts a component production never renders. Converge or retire in A2/A3.

## Page routes

Auth legend — `public`: matched by `PUBLIC_ROUTE_PATTERNS`; `fallthrough`: matched by neither
pattern table in `roles.ts`, so middleware passes it through unauthenticated (data may still be
backend-enforced); `mw:<ROLE>`: middleware prefix guard; `page`: inline `auth()` in the page.

### public-current (52)

| Route | Auth | Note |
| --- | --- | --- |
| `/` | public | Eyebrow nav; footer suppressed by design. UX-V1 composition — regression baseline. |
| `/explore` | public | Public jobs board. |
| `/onboarding` (+`/identity`, `/fetching`, `/readiness`) | public | Canonical clinician entry; child steps deliberately self-chromed (pinned by `public-surface-registry.test.ts`). |
| `/get-ready` | public | Redirect-only → `/onboarding`. |
| `/employers`, `/employers/how-it-works`, `/employers/request-access` | public | Employer acquisition (plural = public; singular `/employer` = gated product). |
| `/pricing` | fallthrough | Index-menu Employers group. |
| `/pilot`, `/contact` | fallthrough | Footer nav. |
| `/concierge` | fallthrough | Sellable offer page; nothing links to it (registry note). Candidate for a nav decision in UX-03, not deletion. |
| `/solutions`, `/for/cvo`, `/for/payer`, `/for/staffing-exchange` | fallthrough | Sitemap-only, zero inbound links. Keep-or-kill decision owed in A6 (employer acquisition). |
| `/trust`, `/trust/attribution`, `/trust/doctrine`, `/trust/technical` | fallthrough | Trust group. `/trust/doctrine` renders the pilot subject identity as a worked example — content, not viewer state (see containment scope note in `a0-truth-containment.test.tsx`). |
| `/evidence-network` | fallthrough | Static transparency page (SHD-0.3); graph exploration is signed-in only. |
| `/status` | fallthrough | Footer. |
| `/status/technical` | fallthrough | Deliberately chrome-less dark console (bucket E, pinned by test). |
| `/privacy`, `/terms`, `/legal/cookies`, `/legal/dpa` | fallthrough | Footer. |
| `/docs` | public | Static docs index. |
| `/demo` | fallthrough | Live demo hub over `DEMO_ENTITY_ID`; noindex; labeled demo. One of its six links (`/network/…`) is auth-walled — see remove/redirect. |
| `/directory/[npi]` | public | Indexable NPPES SEO surface. |
| `/profile/[npi]` | fallthrough | Public career profile; `/profile` prefix also carries the unlanded `/profile/activate` promise (PR #1081). |
| `/investigate/[npi]` | fallthrough | Public diligence surface (survivability registry). |
| `/p/[slug]` | public | Pilot proof registry (real recorded pilot evidence, limitation-boxed); `notFound` on unknown slug. |
| `/verify`, `/verify/guide`, `/verify/[npi]`, `/verify/receipt/[receiptId]` | public | Public verification suite; `/verify/[npi]` is the share target. |
| `/receipt/[receiptId]`, `/snapshot/[id]` | fallthrough | Share-link artifacts; self-documented public; revoked snapshot fails closed. |
| `/apply/[requestUri]` | public | Employer-issued apply link. |
| `/review`, `/review/request`, `/review/[entityId]` | public | Public review-packet links (explicitly public in `roles.ts`). |
| `/opportunities/[id]` | fallthrough | Public job detail; UUID-validated. |
| `/opportunities/discover` | fallthrough | Redirect-only → `/holder/opportunities/discover`. |
| `/sign-in/[[...sign-in]]`, `/sign-up/[[...sign-up]]` | public | Clerk. |
| `/auth/error`, `/auth/resolving` | public | Auth interstitials. |

### authenticated-clinician (26)

All `/holder/*` are gated once, in `app/holder/layout.tsx` (Clerk `auth()` → redirect) **plus** the
`^/holder` middleware prefix; chrome is `HolderWorkspaceFrame`.

| Route | Nav | Note |
| --- | --- | --- |
| `/holder` | holder-nav | "Wallet". |
| `/holder/home` | holder-nav | Clinician home (A3 target). |
| `/holder/readiness` | holder-nav | Passport-backed; unlinked state guarded by A0 tests. |
| `/holder/recognition` | holder-nav | |
| `/holder/opportunities` (+`/discover`, `/interested`, `/passed`, `/[id]`) | holder-nav | Discover = MATCHA deck (harness twin `/dev/matcha-deck`). |
| `/holder/applications` (+`/[id]`) | holder-nav | |
| `/holder/blockers/[blockerId]` | content | Hrefs minted by `lib/mobile/clinician-state.ts`. |
| `/holder/garden` (+`/cv`, `/research`, `/notes`, `/opportunities`, `/privacy`) | holder-nav + garden tabs | Customer-facing name is now "VitalCV Workbench" (CC-04, `lib/career-garden/branding.ts`); routes and the `career-garden` namespace deliberately unchanged. Carries the labeled "Sample — its wave is next" cards; removal is sequenced in **A5** (pinned today by `career-garden-pages.test.tsx`). |
| `/holder/scoreboard` | content | Home tile only. |
| `/holder/settings` | content | |
| `/holder/timeline` | content | Resolves NPI then redirects → `/activity/{npi}`; no NPI → `/onboarding`. |
| `/holder/matcha` (+`/assessment`, `/onboarding`, `/opportunities`) | content | `FEATURES.MATCHA_V2` gate, defaults **true** (GA). |
| `/clinician/profile` | holder-nav ("Profile") | **Finding RD-2 — guard half CLOSED.** `roles.ts` now carries `^/clinician` → CLINICIAN, the tree has a `force-dynamic` layout, and `/clinician` is in `SESSION_PATH_PREFIXES`, so an anonymous request 307s to `/sign-in` with `private, no-store`. Pinned by `__tests__/clinician-route-guard.test.ts`, which asserts the response rather than the list it came from. **Chrome half still open** — the route remains chrome-less; owner A2. |

### authenticated-employer (10)

Middleware-only guard `^/employer` → VERIFIER; `app/employer/layout.tsx` has no auth; only
`/employer/decision/[applicationId]` adds page-level `auth()`. None is linked from any current nav.

`/employer/dashboard`, `/employer/worklist`, `/employer/candidates` (MATCHA_V2-gated),
`/employer/applications` (+`/[applicationId]`), `/employer/review/[applicationId]` (redirect →
applications), `/employer/review-queue`, `/employer/decision/[applicationId]`, `/employer/profile`,
`/employer/post`. Employer IA rebuild is A6; org-scope RBAC gaps are tracked in the ASVS/verifier
memory lines, not this doc.

### internal/guarded (15)

| Route | Guard | Note |
| --- | --- | --- |
| `/admin/demo-reset`, `/admin/leads`, `/admin/platform` | mw:ADMIN + page ADMIN claim | Double-guarded. |
| `/ops`, `/ops/engine`, `/ops/survivability` | page `auth()` only | **Finding RD-4** — sign-in is checked, role is not: any authenticated user of any role can read the operator surfaces. `/ops` is absent from `PROTECTED_ROUTES`. |
| `/issuer/{request,review,verify,policy-review,psv-receipt,psv-reuse,audit-boundary,backend-persistence,persistence-adapter}/[id]` | mw:ISSUER | Demo renders by design (truth contract: `recordedBy: 'demo'`, no persistence). `ROLE_LANDING.ISSUER` points at `/issuer`, which has no page → signed-in issuers land on a 404 (**Finding RD-7**). |

### developer (17)

All `/design/*` (10 routes) 404 on canonical production via `app/design/layout.tsx` +
`isDesignPreviewAllowed` (env flag cannot override canonical prod). `/dev/career-garden`,
`/dev/matcha-deck`, `/dev/matcha-workspaces` are per-page gated with `!isCanonicalProduction`
checks. `/dev/compete-film`, `/dev/page-stack`, `/dev/story-rail` are gated but their env flags
**do** work on canonical production (weaker than the `/design` gate — acceptable only while the
flags stay unset in Railway).

**Finding RD-1 — `/dev/graph/[entityId]` is ungated.** No `notFound()`, no env check, no auth, no
`roles.ts` coverage; the graph-era debug inspector is publicly reachable in production for any
entityId, protected only by a noindex meta. Disposition: `remove/redirect` — gate it like
`/dev/matcha-deck` or delete it. Flagged as a follow-up task, deliberately not fixed inside A0's
diff (A0 changes no route behavior).

### legacy-compatibility (7)

| Route | Behavior | Kept because |
| --- | --- | --- |
| `/passport` | Redirect → `/onboarding` (forwards 10-digit `?npi=`) | Retired 2026-08-07; shipped mobile binaries hardcode `/passport/{npi}`; `holder-route-contract` golden scan. |
| `/passport/[id]` | 10-digit → `/verify/{id}`; else → `/onboarding` | Same. |
| `/signup` | Redirect → `/sign-up` | Legacy links; `/sign-up` prefix does not cover it. |
| `/activity/[entityId]` | Renders (public-prefix chrome via regex) | Target of `/holder/timeline`; graph-era but load-bearing. |
| `/career-intelligence/[entityId]`, `/career-map/[entityId]`, `/ecosystem/[entityId]`, `/packet/[entityId]`, `/recruiter/candidate/[entityId]` | Render; linked from `/demo` (and `/solutions`) | Demo journey surfaces (bucket E chrome decision, 2026-08-07). Their long-term owner is the demo experience; if `/demo` is rebuilt, they retire with it. |

### remove/redirect (8)

| Route | Problem | Disposition |
| --- | --- | --- |
| `/dev/graph/[entityId]` | Ungated in production (RD-1) | Gate or delete; follow-up task filed. |
| `/network/[entityId]` | Linked from `/demo` but AUTHENTICATED-gated **and** ops-chromed — a signed-out demo visitor is bounced to sign-in mid-demo (chrome + auth cliff) (**RD-5**) | Either de-gate to match its five demo siblings or drop the `/demo` link. Owner: A6/demo rebuild. |
| `/professional-growth/[entityId]`, `/search/[entityId]` | Graph-era, zero inbound links, noindex | Retire to `_archive` after confirming no external links (they are fallthrough-public today). |
| `/matcha/experience` | Marketing showcase, ungated, zero inbound links | Fold into the MATCHA buyer-pages flag or archive. |
| `/matcha/hospitals`, `/matcha/investors`, `/matcha/recruiters` | Behind `MATCHA_BUYER_PAGES` (defaults false) → 404 today | Keep dark or archive; do not link until the flag decision is made. |

## API routes (280) — family census

The middleware fact that governs everything: `roles.ts` places `/^\/api(\/.*)?$/` in
`PUBLIC_ROUTE_PATTERNS` ("API routes handle their own auth"), so **no API route inherits a guard**.
93 routes import Clerk; ~100 are thin proxies deferring enforcement to the Express backend
(`apps/api/backend` — which has its own `verifiedIdentity`/`tenantGuard` middleware and a
header-trust ratchet, `header-trust-baseline.json`); the remainder are public-by-design or
unguarded. Regenerate the raw list with:
`find apps/web/app -name route.ts | grep -v _archive | sed 's|apps/web/app||;s|/route.ts||' | sort`

| Family | n | Guard pattern | Tests | Note |
| --- | --- | --- | --- | --- |
| `/api/profile/*` | 16 | Clerk on all | yes | Cleanest family (garden, identity OTP, resume, work-auth). |
| `/api/internal/*` | 15 | mixed | partial | ADMIN via `requireAdminPilotSession` (7) · shared-secret via `source-health/_auth.ts` (5) · **unguarded: `funnel-metrics`, `mission-ops/sources`** (**RD-3**, task filed — funnel-metrics fronts a privileged PostHog personal key anonymously). |
| `/api/passport/*` | 12 | public-by-design | yes | Live and load-bearing while the `/passport` pages are redirect stubs. |
| `/api/intelligence/*` | 12 | soft-degrading Clerk helper | partial | Only `launch-readiness` hard-`auth()`s. |
| `/api/matcha/*` | 11 | Clerk on 9; `intent`, `simulate/[npi]` unguarded | yes | Backend router **is mounted** (`app.ts` `registerMatchaRoutes`) — the "never mounted" folklore is stale. |
| `/api/employer*` (3 families) | 15 | Clerk mostly; `employer/decisions` unguarded; `employer-review/[entityId]/[action]` reads `x-verifier-team-role` from the caller | yes | Header-trust: see RD-6. |
| `/.well-known/*` + `/api/.well-known/*` | 9 | public-by-design | partial | DID/JWKS derive from signing keys. |
| `/api/decisions/*` | 6 | none | no | Public decision surfaces. |
| `/api/graph*` + `knowledge-graph` | 8 | **none on any** | incidental | `graph-engine/[...path]` is an open catch-all proxy. |
| `/api/findings/*` | 5 | proxies to backend | yes | |
| `/api/pilot*` | 8 | Clerk on 2; rest none | yes | KPI/ROI exports anonymous in web tier. |
| health/status/version | 17 | public-by-design | partial | `runtime/activation` is Clerk-guarded. |
| `/api/opportunities` + `applications` + `clinician` | 10 | Clerk on all | yes | |
| `/api/directory*` + `providers*` | 6 | anonymous by design | thin | Public-record NPI registry incl. CSV export. |
| `/api/credentials` + `documents` | 7 | Clerk on all | partial | documents untested. |
| `/api/trust-state` + `trust` + `trust-proof` | 6 | refresh Clerk; rest none | yes | `trust-state/[npi]` falls back to `x-org-id: demo-pilot-org-alpha` when `PUBLIC_WEDGE_ORG_ID` unset — config landmine (**RD-8**), shared with `identity/[npi]/ingest` and `ingest/[npi]`. |
| `/api/agent/*` | 3 | Clerk + 401 on all | yes | Consent/plan chain threads `session.userId` as subjectRef. |
| `/api/admin/platform` | 1 | Clerk + ADMIN claim → 403 | **no** | Strongest guard, zero tests. |
| `/api/ops-engine/*` + `ops/snapshot` | 3 | Clerk → 401 | no | |
| `/api/investigation*` + `copilot` | 7 | helper on 4; `copilot/ask`, `copilot/query` none | partial | |
| `/api/simulation`, `report`, `replay` | 9 | none | no | Public simulation/report surfaces. |
| `/api/mobility`, `map` | 6 | none | yes | `map/institutions` falls back to a curated set but labels it `dataSource: 'demo'` — the honest pattern. |
| 16 two-route families (`psv`, `search`, `webauthn`, `watch`, `ownership`, `exchange`, `hiring`, `identity`, `ingest`, `capacity`, `velocity`, `actions`, `reasoning`, `storylines`, `analytics`, `verify-professional`) | 32 | Clerk on ~6 families; rest none | mixed | `webauthn/authenticate-options` reads caller `x-session-id`. |
| Singletons (37) | 37 | ~20 Clerk, rest none | scattered | Incl. `ask`, `export/packet`, `feed/live`, `me/workspaces`, `mobile/dashboard`, `receipts/verify`, `request-review`, `share`, `workspaces/switch`, `version`. |

**Finding RD-6 — no web-tier header-trust ratchet.** The backend pins its 32 header-reading files
in `header-trust-baseline.json` ("may SHRINK, never grow"); `apps/web/app/api` has four
header-trusted routes (`employer-review/[entityId]/[action]`, `workspace-config/[entityId]`,
`snapshot/[id]`, `webauthn/authenticate-options`) and no equivalent ratchet.

## Findings register (owners)

| # | Finding | Class | Owner |
| --- | --- | --- | --- |
| RD-1 | `/dev/graph/[entityId]` ungated in production | exposure | Follow-up task (filed at census) |
| RD-2 | `/clinician/profile` outside every auth layer, chrome-less | auth/IA | Guard: **CLOSED** (`apps/web/__tests__/clinician-route-guard.test.ts`); chrome: A2 |
| RD-3 | `/api/internal/funnel-metrics` + `mission-ops/sources` unguarded; funnel-metrics fronts a privileged PostHog key | security | Follow-up task (filed at census) |
| RD-4 | `/ops/*` checks sign-in, not role | authz | Ops Center roadmap (V1) |
| RD-5 | `/demo` → `/network/[entityId]` auth+chrome cliff | IA | A6 / demo rebuild |
| RD-6 | No web-tier header-trust ratchet (4 routes) | governance | Security backlog (pattern: backend baseline) |
| RD-7 | `ROLE_LANDING.ISSUER` → `/issuer` 404s | IA | Issuer wave |
| RD-8 | `demo-pilot-org-alpha` x-org-id fallback on 3 public write paths when `PUBLIC_WEDGE_ORG_ID` unset | config | Deploy checklist + env audit |
| RD-9 | `ClinicianReadinessSurface` orphan with a test asserting an unrendered component | test-truth | A2/A3 |
| RD-10 | Garden "Sample — its wave is next" cards in production (labeled) | product | **A5** (explicitly sequenced there; not touched in A0) |

## A0 evidence trail

- Containment guards: `apps/web/__tests__/a0-truth-containment.test.tsx` (13 tests; proven by bug
  injection — reintroducing the identity or a `buildDemoSnapshot` definition fails 2 tests) and
  `apps/web/tests/e2e-authed/readiness-unlinked.spec.ts` (real gate, real route, screenshot).
- The historical demo identity survives in exactly three non-test places, all as labeled content,
  none as viewer state: `/p/[slug]` (pilot evidence), `/trust/doctrine` (worked example), and a
  path comment in `api/receipt/[lineageKey]/route.ts`.
- No active link or import into `_archive`.
- Of the audit's three cited Workbench/Living-Profile briefs, one landed mid-A0 via #1203:
  `docs/design/VITALCV_LIVING_PROFILE_VISUAL_SYSTEM_2026-08-08.md` (plus
  `docs/architecture/workbench-baseline.md` as the CC-00 truth baseline). Two remain uncommitted
  anywhere in the repository or its history:
  `VITALCV_CLAUDE_CODE_ACTION_PLAN_VISUAL_WORKBENCH_2026-08-08.md` and
  `VITALCV_WORKBENCH_SPATIAL_KNOWLEDGE_PROGRAM_2026-08-08.md`. The Experience Overhaul Program
  lives at `docs/design/VITALCV_EXPERIENCE_OVERHAUL_PROGRAM_2026-08-08.md`, not the repo root the
  audit cites. A5/A7 must not start until their governing briefs are committed (the
  governance-citability lesson, PR #1200).
