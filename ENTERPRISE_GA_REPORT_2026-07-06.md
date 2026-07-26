# VitalCV — Enterprise GA Readiness Report

**Date:** 2026-07-06 · **Branch:** `wave/master-plan-enterprise-ga` (off `origin/main`)
**Author:** Master Wave Plan execution (M0–M12)
**Verdict:** **NOT-YET-GA — foundation solid, defined remainder is external / large-build.**

This is the honest successor to every prior `FINAL_*_AUDIT`. It scores the 15 GA
criteria against **evidence produced by the waves**, and states plainly what is not
yet done and why.

## Scope note

The Master Wave Plan is ~30 weeks of work for a founder + agents + contractors,
including hard external dependencies (SOC 2 auditor, legal BAA review, institutional
Nursys/FSMB agreements, live Stripe billing, real sales/pilots). This program
executed the **sequential critical path and every code/docs-doable slice**; it
could not — and does not claim to — complete the external or multi-week-build items.

## GA checklist (15 criteria)

| # | Criterion | Status | Evidence / gap |
|---|---|---|---|
| 1 | Canonical path test-proven, fail-closed, revocation-first | ✅ **Met** | `canonical-path-gate` (67 cases green); revocation re-checked read-time (`TrustStateResolver`, `validateReceipt`) |
| 2 | 100% mutating-route audit coverage | ⚠️ **Partial** | `audit-coverage-gate` freezes the gap (92-file baseline); workspace-switch audited. Full 100% = documented remediation backlog (`docs/security/audit-coverage.md`) |
| 3 | Copy/claims compliance automated | ✅ **Met** | `copy-compliance-gate` (marketing scan + bare-Verified + allowlist); caught & fixed real marketing violations |
| 4 | Single coherent public funnel, honest demo | ⚠️ **Partial** | Marketing doctrine-honesty fixed (no SAM/ABMS/DEA); dead-`/clinician` already resolved. M2-2 app-fate + M2-4 un-gated demo + M2-5 25 NPIs = backlog |
| 5 | AuthN/RBAC/tenant-isolation matrix green 30 days | ❌ **Gap** | Primitives exist (`tenantGuard`, `employerActionRbac`); G1 header-trust + G2 RBAC-shadow are open, owner-gated (`docs/security/m3-security-status.md`) |
| 6 | Secrets clean, encryption attested, HIPAA packet | ⚠️ **Partial** | Secrets: ✅ (`.env.production` untracked, history scan clean). Zero-PHI-on-chain: ✅ enforced. HIPAA packet: draft-pending; BAA needs counsel |
| 7 | SOC 2 Type I in progress/complete | ❌ **Gap (external)** | Not started — auditor engagement is the next step; **not claimed** |
| 8 | Backups restore-drilled; SLO monitoring; incident runbook | ❌ **Gap (ops)** | Railway managed backups exist; no timed restore drill / SLO synthetic / drilled runbook yet (needs prod access) |
| 9 | Employer org lifecycle self-serve incl. billing | ❌ **Gap** | Workspace runtime + switch-audit ✅; team mgmt + Stripe billing (external) = build |
| 10 | ≥3 decision-grade source lanes; trust registry honest | ⚠️ **Partial** | Honest coverage states ✅; latent NPDB claim removed ✅. Real state-board lanes + Nursys/FSMB (external) + registry page = backlog |
| 11 | Wallet GA (web) + conformance report | ⚠️ **Partial** | Web wallet + SD-JWT + revocation status-list present; substrate ADR ✅. Committed conformance-run artifact = follow-up |
| 12 | ≥1 paying pilot with measured TTS delta | ❌ **Gap (founder)** | Concierge offer SOP + pilot kit shipped (sellable today); actual pilot is a founder/business action |
| 13 | E2E + a11y + perf gates green | ⚠️ **Partial** | a11y gate + 5 Playwright specs + route-contracts exist; Playwright not CI-wired (auth/server strategy needed); perf budget pending |
| 14 | Buyer-facing docs verified accurate | ✅ **Met (core)** | Security whitepaper shipped, every claim artifact-backed; OpenAPI served. Onboarding/ops handbooks = follow-up |
| 15 | Founder-signed launch-readiness report | ⚠️ **This doc** | This report is the evidence base; founder sign-off is the human step |

**Tally:** 3 Met · 7 Partial · 5 Gap (4 of the 5 gaps are external/founder/ops, not code).

## What this program shipped (17 commits on this branch)

- **M0** hygiene: secrets untracked + history-scanned clean; orphan SQL resolved;
  53 stale root docs archived; deployment truth verified (prod LIVE on Railway).
- **M1** trust core: 3 CI gates (canonical-path, audit-coverage, copy-compliance).
- **M2** marketing doctrine-honesty (removed SAM/ABMS/DEA claims).
- **M3** security: trust-proxy (G3) + non-root containers; honest gap disposition.
- **M4** compliance: zero-PHI-on-chain guard (enforced + 15-case test) + data map.
- **M5** observability: Sentry PII scrubbing.
- **M6** employer: audited the workspace switch (also closed an M1-2 P0 gap).
- **M7** sources: removed a latent NPDB over-claim.
- **M8** wallet: substrate-anchoring ADR.
- **M9** revenue: concierge offer SOP + pilot kit.
- **M10/M11** quality + docs: status + buyer security whitepaper.

## The critical path to actual GA (owner/external)

1. **G1 header-trust authn redesign** (owner-reviewed; highest security priority).
2. **SOC 2 Type I** auditor engagement + **BAA legal review** (external, start now).
3. **Nursys/FSMB institutional agreements** (external, calendar-bound).
4. **Backups DR drill + SLO synthetic monitoring** (ops, needs prod access).
5. **Land ≥1 pilot** with measured scoped TTS (founder).
6. **Stripe billing** + team management (build).

## Bottom line

The trust product's load-bearing walls — fail-closed canonical path, audit-before-2xx,
zero-PHI-on-chain, copy-compliance, source honesty — are now **enforced in CI**, and
the enterprise security posture is documented honestly with a disclosed gap register.
VitalCV is **not** enterprise-GA today; the remaining distance is concentrated in
external programs (SOC 2, agreements, pilots) and a few owner-gated builds, not in
the trust core. Proceed by starting the external clocks (SOC 2, agreements) in
parallel with the G1 auth redesign.
