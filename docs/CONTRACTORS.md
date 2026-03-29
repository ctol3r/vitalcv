# VitalCV — Contractor Handoff
**Date:** 2026-03-28
**Status:** Silent pilot preparation complete. One deployment blocker.

## Quick Orientation
- **Product:** NPI-based clinician readiness verification -> employer review -> faster start decisions
- **Wedge:** vitalcv.com (NPI input) -> readiness -> /passport -> /review/request -> /review/[entityId] -> start outcome
- **Frontend:** Vercel (vitalcv.com) — auto-deploys from main
- **Backend:** Railway (delightful-essence-production.up.railway.app) — currently 35 commits behind main
- **Database:** Postgres (Railway-managed)

## Immediate Action Required
Railway backend needs a manual redeploy from main via Railway dashboard.
Without this, `/api/identity`, `/api/ingest`, `/api/trust-state` return 401 (tenant guard stale).

## Key Files
| What | Where |
|------|-------|
| Launch gate | docs/LAUNCH_GATE.md, docs/specs/vitalcv-launch-gate.md |
| Pilot runbook | docs/REAL_PILOT_RUNBOOK.md |
| Execution tracker | docs/REAL_PILOT_EXECUTION_TRACKER.md |
| KPI definitions | docs/PILOT_METRIC_DEFINITIONS.md |
| Source health | /internal/pilot-ops (browser) |
| Proof pack | docs/PILOT_PROOF_PACK.md |

## Open PRs (merge in order)
#89 feat/buyer-conversion-wedge -> /pilot page, employer CTA
#90 feat/launch-gate -> docs/LAUNCH_GATE.md, smoke tests
#92 feat/regression-hardening -> 338 tests, risk matrix
#94 feat/buyer-proof-pack -> pilot runbook, checklist, evidence template
#95 feat/buyer-proof-outreach -> proof pack, outreach, ROI narrative
#96 feat/pilot-proof-pack-finalize -> tightened claims, pack index

Note: Merge #89 after #91 (already merged) to resolve build dependency.

## Pre-existing CI Failures (not bugs)
- Railway Deploy Preflight: railway.toml uses --no-frozen-lockfile — known, low priority
- Vercel – vcv-web: separate Vercel project misconfiguration — not vitalcv.com

## Architecture Notes
- Tenant guard: requireTenantContextOrReadAccess in apps/api/backend/src/middleware/tenantGuard.ts
- Deploy trigger: .github/workflows/deploy-api.yml watches apps/api/**, packages/**, railway.toml
- KPI events: apps/web/lib/analytics/ux-events.ts -> /api/pilot-ops/events -> backend pilot_metric_events

## Test Commands
pnpm --filter @vitalcv/web test         # 338 tests
pnpm --filter @vitalcv/api test         # ~36 seal/pilot tests
pnpm --filter @vitalcv/web exec tsc --noEmit   # typecheck

## Contacts
pilots@vitalcv.com — pilot access
access@vitalcv.com — billing/org access
