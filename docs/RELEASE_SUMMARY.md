# VitalCV Silent Pilot — Release Readiness Summary
**Date:** 2026-03-28
**Status:** PRE-PILOT — pending merge of open branches

---

## What Is Shipped and Working

### Core Wedge (GREEN)
- NPI lookup → readiness preview: **LIVE** at vitalcv.com
- Source-backed readiness (NPPES + OIG/LEIE): LIVE
- Passport proof view: LIVE at /passport
- Employer request-review: LIVE — employer creates context, review loads
- Employer workspace (review + action): LIVE — PR #87

### Infrastructure (GREEN)
- Deployment: Vercel (vitalcv.com), auto-deploys from main
- Backend: Railway (delightful-essence-production.up.railway.app)
- Auth: Clerk (configured, gating write flows)
- Build: passing, 300+ unit tests green
- Public copy truth: enforced via test guards (301/301)

---

## What Is In-Progress (Branches Pending Merge)

| Branch | Status | Blocks Pilot? |
|--------|--------|--------------|
| fix/public-shell-narrowing (PR #88) | Ready to merge | No — but improves trust |
| feat/buyer-conversion-wedge | Ready to merge | No — but adds /pilot CTA |
| feat/pilot-source-health | Ready to merge | No — but adds operator visibility |
| feat/launch-gate | This PR | No — docs only |

**Recommendation:** Merge all four before first pilot conversation.

---

## Known Deferred Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| PECOS quarterly — may show PENDING | LOW | Expected; labeled as pending in UI |
| State board lanes — access-required | LOW | Honest labeling in pilot |
| OFAC pipeline not wired | LOW | Not needed for NPPES/OIG pilot |
| Stripe not wired | LOW | Mailto fallback in billing |
| Source health freshness (env-dependent) | MEDIUM | SourceHealthPanel gives operator visibility |

---

## Pilot Operational Checklist (Run Before First Pilot Call)

- [ ] Verify /api/mission-ops/sources — spineStatus != CRITICAL
- [ ] Verify /api/deploy-info — SHA matches latest main
- [ ] Merge all open branches listed above
- [ ] Test NPI lookup with a known NPI (e.g., 1003000126)
- [ ] Confirm /review/request form submits and returns contextId
- [ ] Confirm /review/[entityId] loads with that contextId

---

## Contractor Handoff Notes

The codebase is in a state suitable for pilot operation. Key files for orientation:
- `docs/ARCHITECTURE.md` — system overview
- `docs/LAUNCH_GATE.md` — launch gate checklist (this release)
- `docs/FLAG_ACTIVATION_REVIEW.md` — which flags are safe to enable
- `apps/web/app/internal/pilot-ops/` — operator console
- `apps/web/__tests__/postrelease-truth-cleanup.test.tsx` — copy truth enforcement
- `packages/domain-common/__tests__/wordingSafety.test.ts` — wording safety

Key contacts: pilots@vitalcv.com (access), access@vitalcv.com (billing)
