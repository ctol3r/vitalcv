# VitalCV — Current State Map · 2026-05-07

Snapshot of every user-routable surface, classified by what's actually behind it. Read cold; no conversation context required.

**Inputs:** `origin/main` @ `27d5d6cf` (Code Red close), `apps/web/app/` route tree, `apps/web/lib/auth/roles.ts` `PROTECTED_ROUTES` + `PUBLIC_ROUTE_PATTERNS`, `docs/ops/code-red-final-verification-2026-05-07.md`, `apps/web/lib/demo/*`, `MASTER_PROMPT.md` §6 live-source registry.

**Method:** every page route was traced to its data source. A surface is **production-real** only when it consumes live source-adapter output (NPPES / OIG_LEIE / PECOS) or DB-backed records keyed by route param. Anything else is classified by its actual data path.

---

## Classification key

| Class | Definition |
|---|---|
| **production-real** | Renders live data from integrated sources or DB records keyed by the route param. Backend cap from PR #267 in flight; not yet on `main`. |
| **demo-only** | Renders fixtures from `apps/web/lib/demo/*` or hardcoded inline. The `/passport` demo path explicitly disclaims synthetic data via banner copy. |
| **fixture-backed** | Real-shaped data structurally representative of production but not from live sources (e.g. `demoProfiles.ts` Sarah Chen / Marcus Williams / Priya Nair). |
| **feature-flagged** | Behind a runtime env flag; renders different content or 404 when flag is off. |
| **stale/dead** | Lives under `_archive/*` (Next.js underscore-private — not routed) OR exists but is unreachable from any nav surface. |
| **unknown** | Surface exists; data path could not be conclusively traced from the route file. Needs a follow-up trace. |

---

## Live source adapters — ground truth

Per `MASTER_PROMPT.md` §6 and `packages/source-adapters/src/types.ts` `SOURCE_REGISTRY`:

| Source | Status | Flag | Cadence |
|---|---|---|---|
| NPPES (CMS NPI Registry) | ✅ always on | — | 24h |
| OIG / LEIE | ✅ always on | `OIG_LEIE_ENABLED=true` (default) | 24h |
| CMS PECOS | ✅ source-backed, not real-time | `PECOS_ENABLED=true` | quarterly snapshot |
| STATE_BOARD (launch lane) | ⚠ source-backed when adapter configured | `STATE_BOARD_ENABLED` | per-board |
| Nursys | 🔒 gated — institutional access | `REAL_NURSYS_ENABLED=true` when ready | — |
| FSMB | 🔒 gated — institutional agreement | `FSMB_ENABLED=true` | — |

**NEVER integrated, must not appear in UI:** NPDB, DEA, ABMS, SAM.gov, Doximity.

---

## Route classification (origin/main, page-level)

### Public — production-real

| Route | Class | Source | Notes |
|---|---|---|---|
| `/` | production-real | `HomePageClient` → `useIngestStream` SSE → `/api/ingest/[npi]` | NPI submit triggers live multi-source ingestion (NPPES + OIG/LEIE) |
| `/page.tsx` | (above) | | |
| `/passport/[id]` | mixed: production-real **OR** demo-only | `fetchPassportEntity(id)` → `/api/passport/npi/{npi}` for prod; `getDemoPassport(id)` returns Macie Miller fixture when `id === DEMO_NPI` (default `1346053246`) | Demo path emits banner via `data-testid="demo-passport-banner"`; the rim-side licensure cap is **not yet on main** (PR #267 open) |
| `/passport` | production-real | NPI entry shell | |
| `/p/[slug]` | fixture-backed | hardcoded `PILOTS` object in `apps/web/app/p/[slug]/page.tsx` | Pilot proof page; renders `proofTier` only, not score |
| `/status` | production-real | `/api/internal/source-health/snapshots` (PR #261, landed) | Public NPPES/OIG/PECOS/state-board snapshot |
| `/contact` | production-real | `POST /api/pilot-intake` (PR #259, landed) → Slack hand-off | Pilot intake form |
| `/for/cvo` | production-real | static landing + `/contact?persona=cvo` (PR #260, landed) | |
| `/for/payer` | production-real | static landing + `/contact?persona=payer` (PR #260, landed) | |
| `/for/staffing-exchange` | production-real | static landing + `/contact?persona=staffing` (PR #260, landed) | |
| `/pricing` | production-real | static; CTAs route to `/contact?persona=...` + Cal.com booking (PR #262, landed) | |
| `/pilot` | production-real | static page; "limitation honesty" disclaimers | Gold-standard truth-language reference per audit |

### Public — fixture-backed

| Route | Class | Source | Notes |
|---|---|---|---|
| `/file/[fileId]` | fixture-backed | inline fixtures (PR #263, landed) | Wave D File surface; design-source `verified` provenance renamed to `source_confirmed`. Phase 2 needs interactive upload |
| `/roi` | fixture-backed | inline fixtures (PR #265, landed) | Wave E ROI dashboard; no live billing data; tests assert no bare `Verified` labels |
| `/inbox` | fixture-backed | inline fixtures (PR #268, landed) | Wave D Inbox; suggestion provenance renamed away from bare `verified`; "Phase 2 needs accept-into-profile flow" |
| `/activation/[caseId]` | fixture-backed | route param ignored, inline fixture used (PR #270, landed) | Wave F Activation console; phase 2 needs DB reads keyed by caseId |
| `/autopilot` | fixture-backed | inline fixtures (PR #271, landed) | Wave F Autopilot; status renamed from `verified` to `Granted`/`Enrolled`/`Live`/`Aligned` |
| `/dossier/[receiptId]` | fixture-backed | inline fixture (PR #273, landed) | Wave E Dossier; phase 2 needs real EdDSA signing + RFC3161 timestamp + signed-PDF export |

### Public — content / static

| Route | Class | Source | Notes |
|---|---|---|---|
| `/privacy` | production-real | static MDX/page | |
| `/terms` | production-real | static MDX/page | |
| `/legal/dpa` | production-real | static (PR #242, landed) | DPA template with explicit "not a binding agreement" disclaimer |
| `/legal/cookies` | production-real | static (PR #242, landed) | Cookie inventory |
| `/docs` | production-real | static MDX | |
| `/support` | production-real | static page | |
| `/employers` | production-real | static landing | |

### Auth + onboarding

| Route | Class | Source | Notes |
|---|---|---|---|
| `/sign-in/[[...sign-in]]` | production-real | Clerk catch-all | |
| `/sign-up/[[...sign-up]]` | production-real | Clerk catch-all | **Two sign-up routes exist** — see launch blockers |
| `/signup` | unknown | custom signup page | Diverges from Clerk catch-all; needs trace to confirm both end at the same Clerk session |
| `/auth/error` | production-real | role-resolve fallback target | |
| `/account/recovery` | production-real | Clerk recovery wrapper | |
| `/onboarding` | production-real | shell | |
| `/onboarding/identity` | production-real | NPPES identity check via ingest stream | |
| `/onboarding/fetching` | production-real | progress shell | |
| `/onboarding/readiness` | production-real | trust-state output | |
| `/onboarding/success` | production-real | terminal state | |

### Clinician (CLINICIAN role)

| Route | Class | Source | Notes |
|---|---|---|---|
| `/clinician/onboarding` | production-real | shell | |
| `/clinician/identity` | production-real | NPPES identity bootstrap | |
| `/clinician/identity/verification` | production-real | identity ingestion | |
| `/clinician/import` | feature-flagged + fixture-backed | `DocumentUploadZone` mounts when PR #239 lands; `CvUploadZone` mounts when PR #245 lands | Both PRs still open; main has the import landing page only |
| `/clinician/import/professional` | unknown | needs trace | |
| `/clinician/profile` | unknown | likely DB-backed | |
| `/clinician/profile-layers` | unknown | needs trace | |
| `/clinician/research` | unknown | needs trace | |
| `/clinician/graph` | unknown | needs trace; possibly intelligence-graph-driven | |
| `/clinician/device-security` | unknown | needs trace | |
| `/clinician/mobile-capture` | unknown | needs trace | |
| `/holder` | production-real | DB-backed (per master prompt §6) | |
| `/holder/home` | production-real | trust-state-keyed | |
| `/holder/readiness` | demo-only | hardcoded demo snapshot (score 25); production wiring TBD | |

### Issuer (ISSUER role) — all six surfaces are demo-only by truth contract

Per `CLAUDE.md` §truth-contract: "review surfaces under `apps/web/app/issuer/{review,policy-review}/[requestId]/page.tsx` are **demo renders only** — `recordedBy: 'demo'` and copy explicitly disclaims a real audit row." PR #255–#258 wired feature-flagged DB writers (`ISSUER_PERSISTENCE_ENABLED`); without that flag the surfaces remain demo-only.

| Route | Class | Source | Notes |
|---|---|---|---|
| `/issuer/request/[requestId]` | demo-only | inline demo render | |
| `/issuer/review/[requestId]` | feature-flagged demo-only | DB write only when `ISSUER_PERSISTENCE_ENABLED=true` (PR #256 landed) | |
| `/issuer/policy-review/[requestId]` | feature-flagged demo-only | DB write only when flag set (PR #257 landed); `PolicyReviewDecision` model NOT yet on main (Phase 3d, deferred) | |
| `/issuer/psv-receipt/[requestId]` | feature-flagged demo-only | DB write only when flag set (PR #258 landed) | |
| `/issuer/psv-reuse/[receiptId]` | demo-only | demo render | Phase 3e wiring not yet started |
| `/issuer/verify/[requestId]` | demo-only | demo render | |
| `/issuer/audit-boundary/[requestId]` | demo-only | demo render | |
| `/issuer/backend-persistence/[requestId]` | demo-only | demo render | |
| `/issuer/persistence-adapter/[requestId]` | demo-only | demo render | |

### Employer / verifier (VERIFIER role)

| Route | Class | Source | Notes |
|---|---|---|---|
| `/employer/dashboard` | unknown | needs trace | |
| `/employer/worklist` | production-real | DB-backed via `getWorklist()` (PR #253, landed) | Returns `[]` cleanly when `DATABASE_URL` absent |
| `/employer/review/[applicationId]` | unknown | needs trace; likely backend-keyed | |
| `/employer/decision/[applicationId]` | unknown | needs trace | |
| `/review` | unknown | top-level review shell | |
| `/review/[entityId]` | production-real | passport-payload-keyed | per master prompt §7 |
| `/review/request` | unknown | needs trace | |
| `/apply/[bundleId]` | unknown | public per `roles.ts:80` | **Backend ACL must enforce per-bundle access — frontend can't prevent enumeration** |

### Admin / internal (ADMIN role)

| Route | Class | Source | Notes |
|---|---|---|---|
| `/admin/demo-reset` | demo-only / non-operational | `provisionLive: false`, `productionResetEnabled: false` | Route exists; destructive reset is hard-coded off |
| `/analytics-foundation` | unknown | foundation marker; data-path unclear | |

### Mobile

| Route | Class | Source | Notes |
|---|---|---|---|
| `/mobile/native-readiness` | unknown | mobile readiness shell | |

### Stale / dead — Next.js private folders (NOT routed)

`apps/web/app/_archive/*` — folder names beginning with `_` are private folders per Next.js App Router convention; they are **not user-routable**. The tree contains:
- `_archive/dashboard/cv-builder/` (legacy cv-builder)
- `_archive/demo/{,command-center,verifier-portal}/` (early demo)
- `_archive/mobile/`, `_archive/simulation/`
- `_archive/verifier/{candidates,company,home,inbox,opportunities}/`
- `_archive/wave119/**` (~80 archived pages including `compare/*`, `tools/*`, `holder/*`, `internal/*`)

Per the audit: archive trees may contain banned-string copy ("real time" claims in `_archive/wave119/about/page.tsx:48`) but **none reaches users** because of the underscore-private convention. **Hygiene risk only**, not user risk.

---

## Demo fixtures inventory

| Fixture | File | Used by |
|---|---|---|
| `DEMO_PROFILES` (Sarah Chen / Marcus Williams / Priya Nair) | `apps/web/lib/demo/demoProfiles.ts` | hero `ReadinessPreview` (degraded mode), `/p/[slug]` lookups |
| `MACIE_MILLER_DEMO_PASSPORT` | `apps/web/lib/demo/demoPassportFixture.ts` (PR #250, **still open**) | `/passport/[id]` when `id === DEMO_NPI` (default `1346053246`) |
| `demoResetFoundation` | `apps/web/lib/demo/demoResetFoundation.ts` | `/admin/demo-reset` (non-operational) |
| Inline marketing fixtures | `apps/web/components/marketing/ReadinessDemo.tsx` (3 hardcoded profiles) | marketing surface only — claims DEA/ABMS/state-license verified for sources VitalCV doesn't integrate (audit P1, W1.3 scope) |
| Inline design-surface fixtures | `apps/web/app/{file,roi,inbox,activation,autopilot,dossier}/...` | each Wave D/E/F surface uses inline fixtures pending Phase 2 DB reads |

---

## Feature-flag surfaces

| Flag | Effect | Default |
|---|---|---|
| `OIG_LEIE_ENABLED` | gates real OIG fetch | `true` |
| `PECOS_ENABLED` | gates PECOS adapter | `true` |
| `STATE_BOARD_ENABLED` | gates launch licensure lane | `false` |
| `REAL_NURSYS_ENABLED` | gates Nursys adapter | `false` |
| `FSMB_ENABLED` | gates FSMB adapter | `false` |
| `ISSUER_PERSISTENCE_ENABLED` | flips issuer review surfaces from demo to DB-backed (PR #255–#258) | `false` |
| `NEXT_PUBLIC_MIROFISH_ENABLED` | gates Mirofish engine | `false` |
| `HRSA_CONTEXT_ENABLED` | gates `/api/map/shortages` HRSA layer | `false` |
| `CLERK_SECRET_KEY` (presence-as-flag) | when absent, middleware skips Clerk for public routes; auth-required routes redirect to `/sign-in` | required in prod |
| `DEMO_NPI` | which NPI hydrates from the demo fixture | `'1346053246'` (Macie Miller) |
| `DATABASE_URL` (presence-as-flag) | DB-backed surfaces (worklist, optional issuer persistence) gracefully degrade to empty when absent | required in prod |

---

## Routes by middleware role gate

(`apps/web/lib/auth/roles.ts:PROTECTED_ROUTES`)

| Pattern | Required role |
|---|---|
| `/holder/**` | CLINICIAN |
| `/verifier/**` | VERIFIER |
| `/issuer/**` | ISSUER |
| `/internal/**`, `/pilot-ops/**`, `/mission-ops/**`, `/analytics/**`, `/billing/**`, `/command-center/**` | ADMIN |
| `/dashboard/**` | CLINICIAN (legacy gate) |
| `/workspace/**`, `/intelligence/**`, `/findings/**`, `/storylines/**`, `/providers/**`, `/actions/**`, `/investigations/**`, `/calibration/**`, `/system-health/**`, `/graph/**`, `/network/**`, `/documents/**` | AUTHENTICATED |

`PUBLIC_ROUTE_PATTERNS` includes `/`, `/p/**`, `/verify/**`, `/api/**`, `/clip/**`, `/.well-known/**`, plus marketing surfaces (`/pricing`, `/pilot`, `/contact`, `/for/**`, `/legal/**`, `/status`, `/docs`, `/support`).

---

## Newly-added design surfaces vs production gap (Code Red)

The Code Red push (PRs #263, #265, #268, #270, #271, #273) added six routes — `/file`, `/roi`, `/inbox`, `/activation`, `/autopilot`, `/dossier` — but **all six are fixture-backed**. Their Phase 2 needs (per the verification doc):

| Surface | Phase 2 work |
|---|---|
| `/inbox` | accept-into-profile flow (suggestion → real DB write) |
| `/activation/[caseId]` | real DB reads keyed by caseId |
| `/autopilot` | real action endpoints (NBA buttons → backend) |
| `/dossier/[receiptId]` | real EdDSA signing + RFC3161 timestamp + signed-PDF export |
| `/roi` | live billing/value data |
| `/file/[fileId]` | interactive upload |

These are the rim layer to which production data must connect. None have wiring on `main` today.

---

## Surfaces still in `unknown` — needs follow-up trace

| Route | Why unknown |
|---|---|
| `/clinician/import/professional` | route file exists, data path not traced |
| `/clinician/profile`, `/clinician/profile-layers`, `/clinician/research`, `/clinician/graph`, `/clinician/device-security`, `/clinician/mobile-capture` | role-gated, data sources not enumerated |
| `/employer/dashboard`, `/employer/review/[applicationId]`, `/employer/decision/[applicationId]` | likely backend-keyed; needs trace |
| `/review`, `/review/request` | top-level shell; needs trace |
| `/apply/[bundleId]` | public surface; **backend ACL is the only defense** |
| `/analytics-foundation` | foundation marker; data path unclear |
| `/mobile/native-readiness` | mobile shell |
| `/signup` | divergence from `/sign-up/[[...sign-up]]` (Clerk) needs reconciliation |

Each is a one-PR follow-up to either reclassify or document the data path.

---

## Summary counts

- **Total page-level routes on main:** ~70 (excluding `_archive/*` private folders + API-only routes)
- **Production-real:** ~25
- **Demo-only:** 9 (issuer + holder/readiness + admin/demo-reset)
- **Fixture-backed:** 7 (six Code Red design surfaces + `/p/[slug]`)
- **Feature-flagged:** ~6 (issuer persistence trio + integrations)
- **Stale/dead:** ~95 (all in `_archive/` private folders — not routable)
- **Unknown:** 12 (above)

Production-real density is highest on the buyer funnel (homepage → contact → for-* → pricing → status) and the issuer/PSV truth chain. Fixture density is highest on the new Code Red design surfaces — they're the next wave's wiring target.
