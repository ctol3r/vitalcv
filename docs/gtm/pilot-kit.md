# M9-3 — Pilot Kit

**Date:** 2026-07-06
**Use:** send same-day to any interested buyer (staffing firm, locums, payer
credentialing team, health-system credentialing office).

## 1. One-pager (buyer-facing)

**VitalCV — the Provider Career Evidence Network.**
Reusable, source-backed clinician career evidence that follows the provider across
opportunities. The wedge: `NPI → source checks → readiness snapshot → passport /
proof packet → employer review → accept as head start`.

- **What you get in a pilot:** your reviewers see source-backed evidence packets
  and can *accept as a head start*, *request refresh*, or *route to review* — with
  an audit trail on every decision.
- **What we measure:** Time-to-Start (TTS) and In-Scope Verification (ISV) deltas
  vs your baseline, scoped to your org/lane/geography.

## 2. Success-criteria sheet

| Metric | Baseline (yours) | Pilot target |
|---|---|---|
| Time-to-Start (28-day rolling median, scoped) | ___ | measurable reduction |
| Evidence-packet acceptance rate | ___ | ≥ X% accepted as head start |
| Reviewer time per candidate | ___ | reduced |

Pilot gate criteria per `docs/specs/vitalcv-launch-gate.md`. Metrics are always
**scoped** (org/lane/geography) and labeled — never aggregate unscoped starts.

## 3. Security overview (points to real artifacts)

- **Trust model & audit:** every mutating action writes an AuditEvent before 2xx;
  regression-gated (`docs/security/audit-coverage.md`). Canonical path
  Recognition→Acceptance→Start is fail-closed + test-proven (`canonical-path-gate`).
- **Data & PHI:** zero PHI on-chain, enforced by `assertHashOnlyAnchor`
  (`docs/compliance/data-map.md`). HIPAA-**aligned** (never "certified").
- **AppSec posture:** ASVS L2 self-assessment with an open gap register
  (`docs/security/ASVS-scorecard-2026-07.md`); SCA critical-gate + Dependabot live;
  strong HTTP headers; rate-limit keying fixed (`docs/security/m3-security-status.md`).
- **Honesty:** source coverage shown as checked/gated/stale/unknown; we never claim
  NPDB/DEA/ABMS/SAM.gov or SOC 2/NCQA/HIPAA certification.

## 4. Pilot agreement (outline — legal review required)

Scope, term (e.g. 60 days), data-handling (BAA if PHI in scope — **counsel review**),
success criteria (above), pricing + conversion path, mutual NDA, exit/data-export.
> The BAA template + pilot agreement require legal counsel review before use.

## 5. Instrumentation (M9-4)

Measure TTS + ISV per pilot org (28-day rolling median, scoped). First pilot should
produce a real before/after TTS number usable — with scope labels — in sales
material and the first case study (M9-5).
