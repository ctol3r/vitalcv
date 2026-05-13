# Product Completion Audit

**Phase 1 deliverable.** Classifies every user-facing surface on
`origin/main` (HEAD `39bb65dd`) as: REAL+WORKING, REAL-BUT-DEGRADED,
STATIC SHELL, PARTIAL MOCK, BROKEN, or ABSENT.

This is a product-truth audit, not an architecture audit. The lens
is: "does a real user hitting this surface get something coherent,
or does it 404 / 500 / overclaim / confuse?"

## §0 — Methodology

For each surface I checked: file presence under `apps/web/app/`,
visible copy posture (truth-honest vs overclaim), known runtime
breakage from the audit set on PR #358, and gating from
`runtime-gating-graph.md`. No external HTTP probe (that's
operator-side).

## §1 — Surface-by-surface classification

### Marketing + entry points

| Surface | File | Classification | Notes |
|---|---|---|---|
| `/` (homepage) | `apps/web/app/HomePageClient.tsx` (425L) | **REAL+WORKING** | NPI submit flow → `/passport?npi=`. SSE handoff exists in `useIngestStream`. |
| `/pricing` | `apps/web/app/pricing/page.tsx` | **REAL+WORKING (foundation-honest)** | Copy: "Pricing is a foundation preview. Payments are not collected in this build." Truth-defensible. |
| `/contact` | `apps/web/app/contact/` | **STATIC SHELL** (assumed; not inspected) | Likely a form; no backend submission verified. |
| `/docs` | `apps/web/app/docs/page.tsx` | **REAL+WORKING (foundation-honest)** | Copy: "Docs are a launch-readiness foundation, not complete API documentation." |
| `/status` | `apps/web/app/status/page.tsx` | **REAL+WORKING (foundation-honest)** | Copy: "Status surfaces are foundation previews. No uptime guarantee is implied." `force-dynamic`; reads in-memory snapshot store (empty until probe runner scheduled — operator gap). |
| `/legal`, `/terms`, `/privacy` | dirs exist | **STATIC SHELL** (assumed) | Standard legal pages; need a content review pass before shipping. |
| `/p/[npi]` | public clinician profile | **PARTIAL MOCK / REAL** | Per route allowlist, public. Renders source-health-stripped trust state. |

### Clinician onboarding loop

| Surface | File | Classification | Notes |
|---|---|---|---|
| `/onboarding` | `apps/web/app/onboarding/page.tsx` | **REAL+WORKING (foundation-honest)** | Copy explicitly disclaims that onboarding finishes the credentialing process; renders a readiness summary only. Pure render, no backend dependency. |
| `/onboarding/identity` | dir | **PARTIAL** | Sub-step exists; flow continuity not verified. |
| `/onboarding/readiness` | dir | **PARTIAL** | Sub-step exists. |
| `/onboarding/success` | dir | **PARTIAL** | Terminal step. |
| `/onboarding/fetching` | dir | **PARTIAL** | Loading state. |
| `/sign-in/[[...sign-in]]` | Clerk catchall | **REAL-BUT-DEGRADED** | Clerk integration shipped; **apex env vars unset** per `/api/health` → routes redirect to a non-functional `/sign-in`. Blocker for any logged-in surface. |
| `/sign-up`, `/signup` | dirs | **REAL-BUT-DEGRADED** | Same Clerk-env gap. Two sign-up paths exist (`/sign-up` and `/signup`) — naming inconsistency worth resolving before shipping. |

### Passport (the load-bearing surface)

| Surface | File | Classification | Notes |
|---|---|---|---|
| `/passport` (entry) | `apps/web/app/passport/page.tsx` (841L) | **REAL-BUT-DEGRADED** | Renders. NPI submit + SSE ingest flow works. Lane statuses degrade: in-stream `SourceRow` shows real per-source progression, but the parallel `LaneHealthMount` band renders UNKNOWN seeds (probe runner unscheduled per `runtime-gating-graph.md` §6). |
| `/passport/[id]` | `PassportEntityClient.tsx` | **REAL-BUT-DEGRADED** | Fetches passport via `fetchPassportEntity`. Hydrates Lane B-adjacent primitives. Same `LaneHealthMount` issue. Demo NPI 1346053246 not seeded on Railway → renders "no profile" terminal state. |
| Replay continuity inside passport | (UI not wired to new readers yet) | **ABSENT in UI** | PR-α/β/γ shipped the data + readers; no passport-page UI consumes them yet. |

### Employer review loop

| Surface | File | Classification | Notes |
|---|---|---|---|
| `/employer/dashboard` | `page.tsx` | **PARTIAL (untested)** | Page exists; population data path not verified. |
| `/employer/worklist` | dir | **PARTIAL** | Likely a listing surface. |
| `/employer/review/[applicationId]` | dir | **REAL-BUT-DEGRADED** | Review surface exists. Reviewer-action endpoint `/api/employer-review/...` is on main (per session git status). |
| `/employer/decision/[applicationId]` | dir | **PARTIAL** | Decision surface; workflow completeness not verified. |
| `/review/[entityId]` | dir + `page.tsx` | **REAL** | Public review packet (per allowlist). |
| `/review/request` | dir | **PARTIAL** | Inbound review request surface. |

### Issuer flows

| Surface | File | Classification | Notes |
|---|---|---|---|
| `/issuer/request/[requestId]` | exists | **REAL** | Demo-grade — per `CLAUDE.md`, issuer-verification surfaces are demo renders only; `recordedBy: 'demo'`. |
| `/issuer/review/[requestId]` | exists | **REAL (demo)** | Same demo posture. |
| `/issuer/policy-review/[requestId]` | exists | **REAL (demo)** | Same. |
| `/issuer/psv-receipt/[requestId]` | exists | **REAL (demo)** | Renders a `PSVReceiptCandidate` (literal `decisionGrade: false`). |
| `/issuer/psv-reuse/[receiptId]` | exists | **REAL (demo)** | |
| `/issuer/verify/[requestId]` | exists | **REAL (demo)** | |
| `/issuer/audit-boundary/[requestId]` | exists | **REAL (demo)** | |
| `/issuer/backend-persistence/[requestId]` | exists | **REAL (demo)** | |
| `/issuer/persistence-adapter/[requestId]` | exists | **REAL (demo)** | |

### Verifier surfaces (institutional)

| Surface | Classification | Notes |
|---|---|---|
| `/verifier` and `/verifier/*` | **ABSENT** | Directory `apps/web/app/verifier/` exists but is empty on `origin/main`. Currently 404s. |
| `/verify` (institutional inspector) | **ABSENT** | Lives on unmerged PR #345. |
| `/trust` (institutional overview) | **ABSENT** | Lives on unmerged PR #355. |
| `/trust/doctrine` | **ABSENT** | No file. |
| `/.well-known/jwks.json` | **ABSENT (canonical path)** | Legacy mirror at `/api/.well-known/jwks.json` ships and works. Canonical path on unmerged #349. |
| `/.well-known/did.json`, `openid-credential-issuer`, `openid-configuration`, `trust-register` | **ABSENT** | All on unmerged #349/#355. |
| `/api/replay/runs/by-npi/[npi]` | **REAL+WORKING** (NEW in #361) | Discovery endpoint. |
| `/api/replay/chain/[npi]` | **REAL+WORKING** (NEW) | Continuity summary. |
| `/api/receipt/by-lineage/[lineageKey]` | **REAL+WORKING** (NEW) | Receipt derivation pointer. |
| `/api/receipts/verify` | **REAL+WORKING** | Existing ES256 signature oracle. |

### Operational / institutional self-serve

| Surface | Classification | Notes |
|---|---|---|
| `/api/health` | **REAL+WORKING** | `service: "web"`, config posture booleans. Per operator probe: `apiBase=false`, `clerk.enabled=false`, `sentry=false` — these are env gaps, not product gaps. |
| `/compliance` | **ARCHIVED (ABSENT on main)** | Lives only under `_archive/wave119/`. No live compliance surface. If marketing/sales links to `/compliance`, those links break. |
| `/admin`, `/internal`, `/analytics-foundation` | dirs | **GATED** | ADMIN-only per `roles.ts`. Out of scope for public ship. |
| `/pilot`, `/roi`, `/calibration` | dirs | **PARTIAL** | Internal-ish surfaces; not customer-facing core. |
| `/autopilot`, `/account`, `/activation`, `/inbox`, `/dossier`, `/clinician` | dirs | **PARTIAL** (varies) | Need per-surface inspection before shipping. |
| `/mobile`, `/apply`, `/intake` | dirs | **PARTIAL** | Cross-platform / form flows. |

### API surface (selected critical paths)

| Path | Classification | Notes |
|---|---|---|
| `/api/passport/npi/[npi]` | **REAL+WORKING** | Backend proxy via `BACKEND_URL`. |
| `/api/passport/entity/[id]` | **REAL+WORKING** | Same pattern. |
| `/api/ingest/[npi]` | **REAL-BUT-DEGRADED** | HTTP 200 always; on backend error returns `{fallback:true, runId:null, ...}` masked-200 — the client throws because it doesn't branch on `fallback:true` (per `gating-graph.md` §4 + `upstream-fetch-topology.md`). |
| `/api/ingest/stream/[runId]` | **REAL+WORKING** | SSE stream; six enumerated event types. |
| `/api/health` | **REAL+WORKING** | See above. |
| `/api/.well-known/jwks.json` | **REAL-BUT-DEGRADED** | Works but emits `application/json` instead of canonical `application/jwk-set+json`. |
| `/api/auth/resolve-role` | **REAL** | Middleware fallback; now has `AbortSignal.timeout(8000)` bound (PR #360). |
| `/api/replay/...` (4 readers + 2 NPI-keyed + 2 lineage-keyed proxies) | **REAL+WORKING** | Net-new on PR #361. Returns 503 `replay_infrastructure_unavailable` gracefully if migration unapplied. |

## §2 — What MUST be fixed before shipping (HIGH bar)

| # | Item | Why it blocks ship | Effort |
|---|---|---|---|
| 1 | Apex Vercel env vars (Clerk, receipt key, issuer origin, sentry) | `clerk.enabled: false` on apex breaks every authenticated surface; users hit `/sign-in` redirect loops | <30 min operator-side |
| 2 | Probe runner cron schedule | `LaneHealthMount` band shows UNKNOWN seeds; visible to every passport viewer as "Unavailable" lane state | <15 min operator-side |
| 3 | Railway demo seed for NPI 1346053246 | Demo flow → "no profile" terminal state; institutional reviewers see broken demo | <5 min operator-side |
| 4 | `/verifier` directory either: (a) populated with a real page, or (b) handle 404 gracefully or (c) hide all `/verifier/*` links | Empty dir means 404 cascade on any verifier-facing nav | code: 1 PR |
| 5 | `/compliance` either: (a) restored from archive, or (b) remove all links to `/compliance` from marketing copy | Inbound link to archived path → 404 | code: 1 PR (links audit) |
| 6 | `/sign-up` vs `/signup` duplication — pick one, redirect the other | Naming inconsistency / SEO duplication | code: 1 PR (add redirect) |
| 7 | `/api/ingest/[npi]` HTTP-200-with-fallback client branch fix | Client throws because it doesn't handle the masked-200 response | code: 1 PR |
| 8 | Lane-status copy de-dup ("Unavailable" appearing on both in-stream `SourceRow` and `LaneHealthMount` band with different semantics) | User confusion | copy fix |

## §3 — What CAN be hidden vs fixed

| Surface | Recommendation |
|---|---|
| `/verifier` empty dir | HIDE — remove all nav links pointing here; let 404 happen quietly. The institutional verifier story ships on unmerged #345/#349/#355; until then, no public link to it. |
| `/trust`, `/verify`, `/.well-known/{jwks,did,openid-credential-issuer,openid-configuration,trust-register}` | HIDE — none of these exist on main. Don't advertise them. The route map doc on PR #358 already labels them as target-not-live. |
| `/issuer/*` flows | HIDE FROM PUBLIC NAV — all marked `recordedBy: 'demo'`. They're real renders but demo-grade; should be accessible only via invite/internal link, not public nav. |
| `/admin`, `/internal/*` | KEEP GATED — already ADMIN-only via middleware. |
| `/compliance` | HIDE — archived. Remove inbound links. |
| `/api/replay/*` new endpoints | KEEP — they ship and work. Don't advertise to general users; let institutional partners discover via the JSON contracts. |

## §4 — What's broken vs degraded

**BROKEN (404 / 500 / nonfunctional)** on `origin/main` today:
- Any link to `/verifier`, `/verifier/*`
- Any link to `/verify`, `/trust`, `/trust/*`
- Any link to `/compliance`
- Any link to `/.well-known/jwks.json` (canonical path; legacy `/api/.well-known/jwks.json` works)
- Any link to `/.well-known/did.json`, `openid-credential-issuer`, `openid-configuration`, `trust-register`

**DEGRADED (renders but with caveats)**:
- `/passport` lane statuses (probe runner gap)
- Any authenticated surface (Clerk env gap)
- `/api/ingest/[npi]` HTTP-200-with-fallback masquerade
- Legacy `/api/.well-known/jwks.json` Content-Type

**REAL+WORKING (ships as-is)**:
- Homepage NPI submission flow
- Public landing surfaces (pricing, docs, status, legal — all foundation-honest copy)
- `/onboarding` (no auth required)
- Public `/p/[npi]` profile
- Replay API endpoints (when migration applied)
- `/api/health`

## §5 — Headline finding

**The product surface area is broader than the institutional verifier
gap suggested.** Most public marketing + onboarding surfaces already
ship truth-honest copy. The institutional verifier story is the
load-bearing absent piece, AND it's also the thing the user said NOT
to expand right now.

The blocking work to ship a coherent product is **almost entirely
operator-side** (env vars + cron + seed = ~50 min) plus **6 small
hide-or-fix PRs** for the broken-link cascade.

No new architecture is required to ship. The product fits an
"institutional readiness preview" framing today — what's missing is
the published-receipt + canonical-verifier-path story, which is
exactly what the unmerged #345/#349/#355 stack provides.
