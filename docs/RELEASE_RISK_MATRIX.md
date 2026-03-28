# Release Risk Matrix — Pilot Readiness
**Date:** 2026-03-28
**Branch:** feat/regression-hardening

## Risk Level: LOW — Proceed to pilot with noted mitigations

| Risk ID | Area | Risk | Severity | Mitigation | Status |
|---------|------|------|----------|------------|--------|
| R1 | Source Health | NPPES/OIG connector health is env-dependent | MEDIUM | SourceHealthPanel gives real-time visibility; pilot ops can monitor | MITIGATED |
| R2 | PECOS | Quarterly cadence means PECOS may be PENDING | LOW | Explicitly labeled as pending in UI; not a blocker | MITIGATED |
| R3 | State board lanes | CA/state board is access-required in pilot | LOW | Labeled correctly; pilots are healthcare employers who understand this | MITIGATED |
| R4 | Deployment parity | feat/* branches not yet merged to main | MEDIUM | Merge order documented in LAUNCH_GATE.md; PR #88/#89/#90/#91 ready | IN PROGRESS |
| R5 | Build failure in PR #89 | Pre-existing missing import from unmerged #91 | LOW | Resolves when #91 merges first | KNOWN |
| R6 | OFAC pipeline not wired | OFAC check imported but not called | LOW | Not needed for NPPES/OIG pilot; deferred in LAUNCH_GATE.md | DEFERRED |
| R7 | Stripe not wired | Billing is mailto-fallback | LOW | Pilot is pre-Stripe by design | DEFERRED |
| R8 | Test coverage gaps (pre-hardening) | KPI events, buyer copy, state labels not asserted | LOW | Addressed in this PR | RESOLVED |
| R9 | Pillar content cleanup | MATCHA branding and "Every healthcare job" still in HomeSections pillars | LOW | Aspirational content flagged with TODO; not user-facing in pilot wedge flow | KNOWN |

## Recommendation

**PROCEED TO SILENT PILOT** after merging open PRs in documented order (#88 → #89 → #91 → #90 → this PR).

No blockers. Remaining YELLOWs are operational (source health monitoring) not product (broken flows).

## Pre-pilot run order
1. gh pr merge 88 --merge
2. gh pr merge 89 --merge
3. gh pr merge 91 --merge
4. gh pr merge 90 --merge
5. gh pr merge <this PR> --merge
6. Verify /api/deploy-info SHA matches latest main
7. Verify /api/mission-ops/sources spineStatus != CRITICAL
8. Run NPI 1003000126 through full wedge flow manually
