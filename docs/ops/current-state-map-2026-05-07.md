# Current State Map — 2026-05-07

**Baseline commit:** `bf654a94`  
**Date:** 2026-05-07  
**Branch:** `origin/main`  
**Stack:** Next.js 15.2.8, React 19, pnpm 10.6.1, Turborepo, Clerk ^6.37.3, Prisma (SQLite/in-memory), Tailwind v4, Geist font, Vercel (web) + Railway (API)

---

## 1. Surface Classification — App Routes

Labels:
- **production-real** — real implementation, live data, auth-gated, no fake data
- **demo-only** — renders but uses `recordedBy:'demo'` or static fixtures
- **fixture-backed** — uses hardcoded seed data, not live DB reads
- **feature-flagged** — real implementation behind an env flag (flag noted)
- **stale/dead** — returns 404, redirect, or broken state
- **unknown** — insufficient evidence to classify

| Route | Classification | Notes |
|---|---|---|
| `/` (homepage) | demo-only | `HomePageClient.tsx` — editorial shell; NPI submit routes to `/passport?npi=`; static copy; contains banned-string violation |
| `/onboarding` | fixture-backed | `onboardingFoundation.ts` milestones; `productionOnboardingComplete: false`; no auth gate enforced |
| `/passport/[id]` | fixture-backed | Route + provenance panel + `LaneHealthMount` on main; shareable link renders; no live DB read behind it |
| `/p/[slug]` | unknown | Slug-based public profile; no evidence of live data source |
| `/review/[entityId]` | unknown | Employer review surface; likely demo render path |
| `/clinician/profile` | fixture-backed | Shell on main (PR-C #207); `ClinicianProfile` type defined; no production auth gate; no live DB write |
| `/clinician/graph` | fixture-backed | Knowledge Graph Preview shell; no live personalization |
| `/clinician/onboarding` | fixture-backed | Shell route; `productionOnboardingComplete: false`; contains banned-string violation |
| `/clinician/import` | fixture-backed | Import shell; `ImportEntryKind` defined; no live binary CV upload; contains banned-string violation |
| `/clinician/import/professional` | fixture-backed | Professional import shell; contains banned-string violation |
| `/clinician/identity` | fixture-backed | Identity shell with `aria-labelledby`; no live identity verification |
| `/clinician/profile-layers` | fixture-backed | Profile layers shell; contains banned-string violation |
| `/clinician/research` | fixture-backed | PubMed candidates foundation; `pubmedCandidatesVerifiedByDefault: false`; not live |
| `/clinician/device-security` | unknown | Device security shell; capability scope only |
| `/clinician/mobile-capture` | unknown | Mobile capture shell; `mobileCaptureFoundation.ts` in scope |
| `/issuer/review/[requestId]` | demo-only | `recordedBy:'demo'` — explicit disclaimer in component; no audit row written |
| `/issuer/policy-review/[requestId]` | demo-only | Demo render only; `policyReview.ts` pure transform, no DB write |
| `/issuer/audit-boundary/[requestId]` | demo-only | Demo render; audit boundary exists, no real table |
| `/issuer/backend-persistence/[requestId]` | demo-only | Demo render; deferred writer |
| `/issuer/persistence-adapter/[requestId]` | demo-only | Demo render |
| `/issuer/psv-receipt/[requestId]` | demo-only | In-memory PSV receipt store only |
| `/issuer/psv-reuse/[receiptId]` | demo-only | Reuse boundary exists; `crossTenantReuseImplemented: false` |
| `/issuer/verify/[requestId]` (if exists) | unknown | Insufficient evidence |
| `/employer/review` | demo-only | Demo render; `recordedBy:'demo'`; 60% completion board score |
| `/employer/dashboard` | fixture-backed | Dashboard shell; no live data |
| `/employer/decision/[id]` | fixture-backed | `policyDecisionFoundation.ts` 4-outcome model; `automatedPolicyEngine: false` |
| `/employer/worklist` | fixture-backed | `worklist.ts` + `WorklistPanel`; `dbBackedWorklist: false` |
| `/holder/home` | unknown | Holder home shell |
| `/holder/readiness` | unknown | Readiness shell |
| `/status` | feature-flagged | Source-health panel live (`SourceHealthState`, RELIABILITY-2 #187); some lanes flag-gated (OIG_LEIE_ENABLED, PECOS_ENABLED) |
| `/pilot` | production-real | CTA live; `/pilot` route stable; no funnel instrumentation |
| `/pricing` | fixture-backed | Pricing CTAs (PR #262); `collectsPayment: false`; `checkoutIntegrationLive: false` |
| `/employers` | fixture-backed | Redirect + CTA page; no live employer data |
| `/sign-in` | production-real | Clerk-backed; live auth flow |
| `/sign-up` | production-real | Clerk-backed; live auth flow (e2e signup test not yet written) |
| `/signup` | unknown | May duplicate `/sign-up`; insufficient evidence |
| `/privacy` | production-real | Static legal page; live (#LIVE-100C) |
| `/terms` | production-real | Static legal page; live (#LIVE-100C) |
| `/apply/[bundleId]` | unknown | Apply bundle route; no evidence of live data path |
| `/account/*` | fixture-backed | Account shell routes; `productionAdminEnabled: false` |
| `/admin/demo-reset` | fixture-backed | `demoResetFoundation.ts`; `productionResetEnabled: false` |
| `/analytics-foundation` | fixture-backed | Analytics event vocabulary shell; no vendor wired |
| `/calibration` | unknown | Calibration route; insufficient evidence |
| `/mobile/native-readiness` | fixture-backed | `nativeAppReadiness.ts`; all `isLive: false` |
| `/docs` | unknown | Docs shell; content unknown |
| `/support` | fixture-backed | `supportAdminFoundation.ts`; `staffed: false` |
| `/auth/error` | unknown | Auth error boundary; Clerk-standard; behavior unverified |
| **All `_archive/` routes** | stale/dead | `_archive/dashboard/cv-builder`, `_archive/demo/*`, `_archive/simulation`, `_archive/verifier/*`, `_archive/wave119/*` (100+ routes) — all archived, not served |

---

## 2. API Route Classification

| API Group | Classification | Notes |
|---|---|---|
| `/api/ingest/[npi]` | production-real | Real HTTP call to `npiregistry.cms.hhs.gov`; NPPES always on; ingest fallback wired |
| `/api/ingest/stream` | unknown | Stream variant; insufficient evidence |
| `/api/passport/[npi]` | fixture-backed | Passport data read; no live DB behind it |
| `/api/passport/npi` | fixture-backed | Same; NPI-keyed passport lookup |
| `/api/passport/analytics` | unknown | Analytics stub |
| `/api/passport/entity` | unknown | Entity lookup variant |
| `/api/employer-review/[entityId]` | demo-only | Demo render path; `recordedBy:'demo'` |
| `/api/employer-review/npi` | demo-only | NPI-keyed employer review; demo |
| `/api/psv/oig/*` | feature-flagged | `OIG_LEIE_ENABLED=true` — live when flag set; semantics fix in open PR #272 |
| `/api/internal/source-health/probe` | production-real | RELIABILITY-2 (#187); `runAllProbes`; scheduled cron |
| `/api/internal/source-health/snapshots` | production-real | Snapshot store read; RELIABILITY-2 (#187) |
| `/api/issuer/*` | demo-only | No issuer API routes found in `app/api/issuer/`; issuer surfaces are demo-only page routes |
| `/api/compliance/evidence` | fixture-backed | `apps/web/app/api/compliance/evidence/route.ts` — reports planned controls, not enforced production policies; `superadminGateLive: false` |
| `/api/simulation/compliance` | demo-only | Simulation; demo data |
| `/api/simulation/expiration` | demo-only | Simulation; demo data |
| `/api/simulation/revocation` | demo-only | Simulation; demo data |
| `/api/network/*` | unknown | Network API group; insufficient evidence |
| `/api/graph/*` | unknown | Graph API group; insufficient evidence |
| `/api/intelligence/*` | unknown | Intelligence routes; insufficient evidence |
| `/api/investigation/*` | unknown | Investigation routes; insufficient evidence |
| `/api/copilot/*` | unknown | Copilot routes; insufficient evidence |
| `/api/storylines/*` | unknown | Storylines routes; insufficient evidence |
| `/api/verifier/*` | unknown | Verifier API routes exist; RBAC not enforced (PR #243 conflicting); `invitationSystemLive: false` |
| `/api/trust-state/*` | unknown | Trust state API; insufficient evidence |
| `/api/apply/*` | unknown | Apply bundle API; insufficient evidence |
| `/api/decisions/*` | unknown | Decision API; insufficient evidence |
| `/api/receipts/*` | unknown | Receipts API; in-memory store only |
| `/api/health` | unknown | Health endpoint; standard Next pattern |
| `/api/readyz` | unknown | Readiness endpoint |

---

## 3. Package Classification

| Package | Status | Notes |
|---|---|---|
| `packages/crs` | partial | CRS engine exists; licensure cap engine in open PR #266; cap rim in open PR #267 |
| `packages/trust-state` | implemented | `TrustStateResolver`, 9 coverage states; ships from `dist/`; must be turbo-built before web build |
| `packages/psv` | partial | PSV receipt + store on main; in-memory only; promotion path in open PR #240 (CONFLICTING) |
| `packages/source-adapters` | partial | NPPES live (always on); OIG partial — three-way semantics fix in open PR #272; PECOS/STATE_BOARD/Nursys/FSMB flag-gated |
| `packages/audit` | stub | `auditPersistence.ts` boundary exists; no real DB table; no audit event written to storage |
| `packages/domain-common` | implemented | Contracts, guards, policy; barrel re-exports with `type` keyword |
| `packages/domain-core` | implemented | PSV receipt contract frozen; mapper tests pass; `psvReceipts.ts` (#178) |
| `packages/domain-events` | unknown | Domain events package; scope unclear |
| `packages/embed-sdk` | unknown | Embed SDK; no evidence of live usage |
| `packages/wallet-sdk` | stub | `localMode` only; no production wallet |
| `packages/haip-config` | implemented | HAIP config package on main |
| `packages/vc-formats-csdjwt` | unknown | VC formats / CSD-JWT; scope unclear |
| `packages/trust-contract` | unknown | Trust contract package; scope unclear |
| `packages/truth-enforcement` | unknown | Truth enforcement package; scope unclear |
| `packages/issuer-sdk` | unknown | Issuer SDK; scope unclear |
| `packages/verifier-sdk` | unknown | Verifier SDK; scope unclear |
| `packages/graph-core` | unknown | Graph core; scope unclear |
| `packages/poe-engine` | unknown | Proof-of-existence engine; scope unclear |
| `packages/shared` | partial | Shared utilities; used across web app |

---

## 4. Known Banned-String Violations on Main

Files confirmed by grep to contain banned strings (from MASTER_PROMPT.md Wave 17 + task brief):

- `apps/web/app/clinician/profile-layers/page.tsx`
- `apps/web/app/clinician/import/professional/page.tsx`
- `apps/web/app/clinician/import/page.tsx`
- `apps/web/app/clinician/onboarding/page.tsx`
- `apps/web/app/HomePageClient.tsx`

Additional known P0 copy violations in `apps/web/app/` (from MASTER_PROMPT.md Wave 17):
- `Hero.tsx` W17-1: "anchor it to a zero-trust ledger" + "hire instantly"
- `Hero.tsx` W17-2: "Zero-Trust Credentialing Infrastructure" eyebrow
- `Hero.tsx` W17-5: Nursys shown with green checkmark (gated source — `REAL_NURSYS_ENABLED` required)
- `Hero.tsx` W17-6: SOC2 / NCQA trust badges (uncertified — `SOC2 certified` is banned)
- `Hero.tsx` W17-7: "Request a Demo" CTA routes to `/verifier` (dead/archived route)

---

## 5. Persistence State

| Layer | State |
|---|---|
| Primary DB | SQLite / in-memory (`apps/web`) — Prisma schema exists, PostgreSQL not live |
| Audit events | `auditPersistence.ts` boundary exists; no real table; no audit row written to storage |
| PSV receipts | In-memory store only; `serverPsvReceiptWriter.ts` defensive downgrade (deferred default) |
| Policy decisions | No persistence; demo render only |
| Clinician profiles | No live DB write; shell + type definitions only |
| Real persistence writer | **5%** — deferred-only default; no Prisma table behind PSV or audit |
| DB migration readiness | **5%** — SQLite + in-memory; PostgreSQL migration is Phase 1.1; migration SQL in open PR #251 |
| Signup/account creation | **10%** — Clerk wired; e2e signup test not written; Google OAuth broken in prod |
