# VitalCV Pilot Launch Gate
**Generated:** 2026-03-28
**Purpose:** Defines exactly what "pilot-ready" means. Each item must be GREEN before silent pilot begins.

> **⚠️ Historical snapshot (superseded 2026-07-04).** This gate reflects the 2026-03-28 tree (PR #87/#88 era). The canonical open-blocker list is now `docs/ops/launch-blockers.md`; the on-disk verification that retired most rows below is `docs/ops/REBASELINE-2026-07-04.md`. Kept unedited for audit lineage.

---

## WEDGE TRUTH

| # | Check | Status | Notes |
|---|-------|--------|-------|
| W1 | Homepage serves clean wedge copy (no "Get Verified", no "Primary sources verify you") | GREEN | Confirmed by smoke test |
| W2 | NPI input → readiness reveal renders for valid NPI | GREEN | LiveTrustConsole wired |
| W3 | Readiness reveal shows correct source lane states (checked/pending/access-required) | GREEN | SourceHealthPanel confirmed |
| W4 | "Continue to passport" flow reachable from readiness | GREEN | /passport route exists |
| W5 | /passport shows identity + sanctions + enrollment grouping | GREEN | passportService wired |
| W6 | Employer request-review CTA present and routes to /review/request | GREEN | route unification confirmed |
| W7 | /review/request → employer context created → /review/[entityId] loads | GREEN | PR #87 merged |
| W8 | Employer action (accept/start) persists via API | GREEN | employer workspace bootstrap |

## DEPLOYMENT

| # | Check | Status | Notes |
|---|-------|--------|-------|
| D1 | Production SHA matches latest main SHA | GREEN | 140d808 == 140d8083 |
| D2 | /api/deploy-info returns correct branch=main | GREEN | confirmed |
| D3 | Backend Railway API reachable (delightful-essence-production.up.railway.app) | GREEN | /api/health passes |
| D4 | No banned strings in production HTML or JS bundles | GREEN | all 29 chunks checked |

## SOURCE HEALTH

| # | Check | Status | Notes |
|---|-------|--------|-------|
| S1 | NPPES/CMS NPI spine source active and checked | YELLOW | depends on env — verify via /api/mission-ops/sources |
| S2 | OIG/LEIE spine source active and checked | YELLOW | verify via /api/mission-ops/sources |
| S3 | PECOS quarterly check — pending is acceptable for pilot | YELLOW | quarterly cadence |
| S4 | spineStatus = HEALTHY or DEGRADED (not CRITICAL) | YELLOW | verify before pilot start |
| S5 | SourceHealthPanel visible at /internal/pilot-ops | GREEN | feat/pilot-source-health branch |

## BUYER SURFACES

| # | Check | Status | Notes |
|---|-------|--------|-------|
| B1 | /employers page shows pilot CTA | YELLOW | feat/buyer-conversion-wedge pending merge |
| B2 | /pilot page exists and routes to pilots@vitalcv.com | YELLOW | feat/buyer-conversion-wedge pending merge |
| B3 | /billing CTAs all route to mailto | GREEN | accessMailto() wired |
| B4 | HomeSections pillars 02-04 scoped to pilot reality | YELLOW | feat/buyer-conversion-wedge pending merge |

## OPERATOR VISIBILITY

| # | Check | Status | Notes |
|---|-------|--------|-------|
| O1 | /internal/pilot-ops accessible | GREEN | PILOT_FLAGS.enableSystemHealth |
| O2 | Source health panel shows freshness + alerts | GREEN | feat/pilot-source-health |
| O3 | Pilot diagnostics panel shows failing steps | GREEN | feat/pilot-source-health |
| O4 | PilotEventTracker instrumentation wired | GREEN | components/pilot-ops |
| O5 | KPI endpoints (/api/pilot-ops/summary) return valid data | GREEN | pilotOpsService wired |

## COPY TRUTH

| # | Check | Status | Notes |
|---|-------|--------|-------|
| C1 | public-copy-guard.ts blocklist up to date | GREEN | +11 terms added today |
| C2 | postrelease-truth-cleanup.test.tsx assertions current | GREEN | 301/301 passing |
| C3 | Governance cards absent from /developers | GREEN | fix/public-shell-narrowing |
| C4 | Wave/Phase labels stripped from /developers sections | GREEN | fix/public-shell-narrowing |

---

## DEFERRED (NOT PILOT BLOCKERS)

| # | Item | Reason |
|---|------|--------|
| DEF1 | OFAC SDN check pipeline wiring | Rendering complete; pipeline wire-up not needed for NPPES/OIG pilot |
| DEF2 | CMS_OPT_OUT_ENABLED | UI rendering for OPTED_OUT absent — do not enable |
| DEF3 | Stripe/self-serve checkout | Billing is mailto-gated during pilot |
| DEF4 | NPDB/DEA/ABMS sources | Not integrated in pilot wedge |
| DEF5 | MATCHA AI matching (full production) | Scoped to preview in pilot |
| DEF6 | Clinic Capacity Intelligence (full) | Preview-labeled in pilot |
| DEF7 | Light/dark theme completion | UX polish deferred |

---

## PRE-PILOT MERGE ORDER

Before declaring pilot-ready, merge in this order:
1. fix/public-shell-narrowing (PR #88) — copy guard + governance cleanup
2. feat/buyer-conversion-wedge — /pilot page + employer CTA
3. feat/pilot-source-health — source health panel + diagnostics
4. feat/launch-gate (this PR) — docs only

---

## CONTACTS

| Role | Contact |
|------|---------|
| Pilot access requests | pilots@vitalcv.com |
| Access/billing | access@vitalcv.com |
| Technical issues | [engineering contact] |
