# VitalCV Failure & Contradiction Matrix

> **Purpose:** Canonical QA artifact enumerating failure scenarios along the NPI → Passport → Review → Accept wedge, with expected state transitions and audit behavior. Use this to write regression tests and to audit whether the system fails closed.
>
> **Scope:** The pilot wedge only. Does not cover mobile wallet, issuer-api, or verifier-api flows.
>
> **Authority:** Derived from `packages/trust-state/sourceCoverage.ts` (9 states), `readinessEngine.ts` (L0–L3), `employmentGuards.ts` (canonical path), and the audit contract in `routes/employerActions.ts`.
>
> **Generated:** 2026-04-14 · **Owner:** VitalCV QA / Claude Cowork

---

## Canonical References (Vocabulary Used Below)

**Source coverage states (9):** `checked` · `stale` · `pending` · `gated` · `unavailable` · `accessRequired` · `reviewRequired` · `notDecisionGrade` · `previewOnly`

**Operator spine (4):** `HEALTHY` → `DEGRADED` (≥3 consecutive failures) → `STALE` (missed freshness SLA) → `CRITICAL` (source unavailable)

**Readiness posture (L0–L3):**
- **L0** — no identity anchor; cannot proceed
- **L1** — identity only (NPPES present, safety/authority unresolved)
- **L2** — identity + safety clear + authority verified (`readinessEngine` ≥ 60)
- **L3** — all blockers resolved, CRS ≥ 80 → canonical path may reach `Start`

**Canonical path gates:** Recognition (≥1 valid PSV receipt) → Acceptance (references valid Recognition) → Start (CRS ≥ 80 AND references Acceptance).

**Mandatory audit contract:** Every mutating route writes an `AuditEvent` row *before* returning 2xx.

---

## Step 1–2 · Failure Scenario Matrix

| # | Scenario | NPPES | OIG/LEIE | PECOS | State Board | Expected `sourceCoverage` | Operator Spine | Readiness | Canonical Path | Decision Outcome | Expected AuditEvent(s) | Fails-Closed? |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Invalid NPI** (format fails Luhn / wrong length) | n/a | n/a | n/a | n/a | reject at ingress — no source call | HEALTHY | **L0** | cannot enter Recognition | `400` before ingest | `ingest.rejected` (reason: `invalid_npi_format`) | ✅ input validation |
| 2 | **No-record NPI** (valid format, not in NPPES) | `notDecisionGrade` | `pending` | `pending` | `pending` | `notDecisionGrade` dominant | HEALTHY | **L0** | Recognition refused (no PSV receipt issued) | `blocked: identity_not_found` | `ingest.attempted`, `psv.receipt.denied` (source: nppes) | ✅ |
| 3 | **OIG positive match** (exclusion confirmed) | `checked` | `checked` (EXCLUDED) | any | any | identity `checked`, safety `checked`-negative | HEALTHY | **L1** → frozen | Recognition issued; Acceptance **refused** by policy guard | `blocked: oig_exclusion` | `psv.receipt.issued` (nppes + oig), `acceptance.refused` (reason: `oig_excluded`) | ✅ revocation-style override |
| 4 | **OIG unresolved match** (name/DOB near-match, not confirmed) | `checked` | `reviewRequired` | any | any | safety = `reviewRequired` | HEALTHY | **L1** | Recognition issued; Acceptance **routed to review**, not auto-approved | `blocked: manual_review` | `psv.receipt.issued`, `review.routed` (reason: `oig_near_match`) | ✅ no silent pass |
| 5 | **PECOS NOT_FOUND** (clinician not enrolled in Medicare) | `checked` | `checked` (CLEAR) | `notDecisionGrade` | `checked` | eligibility = `notDecisionGrade` with explicit remediation | HEALTHY | **L2** (not L3) | Recognition + Acceptance permitted; Start blocked until action surfaced | `conditional: pecos_action_required` | `psv.receipt.issued`, `passport.built` with blocker `pecos_not_found` | ✅ surfaces, does not hide |
| 6 | **Source unavailable** (NPPES 5xx / timeout) | `unavailable` | depends | depends | depends | `unavailable` on affected lane | `CRITICAL` (on NPPES) | **L0** if identity source | No new Recognition issued; existing Recognitions unaffected | `error: source_critical` | `source.health.changed` (HEALTHY→CRITICAL), `ingest.deferred` | ✅ — NEVER infer identity from cache |
| 7 | **Stale data** (last successful check older than freshness SLA) | `stale` | `stale` | `stale` | `stale` | `stale` per lane | `STALE` | **L2 demoted → L1** if critical claim stale | Recognition valid but `FreshnessPanel` surfaces warning; Acceptance allowed with explicit operator ack | `warn: freshness_sla_breached` | `freshness.sla.breached`, and if Acceptance proceeds: `acceptance.recorded` with `stalenessAck=true` | ⚠ — trust gradient exposed, not hidden |
| 8 | **Revoked issuer** (PSV receipt previously valid, issuer revoked) | `checked` historical, now `notDecisionGrade` | same | same | same | revocation overrides prior `checked` | HEALTHY | posture drops to match revocation scope | Any dependent Recognition marked revoked; downstream Acceptance/Start **invalidated retroactively** (flagged, not deleted) | `revoked: issuer_revocation` | `revocation.cascaded`, `acceptance.invalidated`, `audit.scrapbook.append` | ✅ **revocation always overrides prior positive state** (Canon §3.5) |
| 9 | **Conflicting claims** (divergence across sources — e.g. NPPES says active, state board says expired) | `checked` | `checked` | `checked` | `checked` (conflicting) | `reviewRequired` via divergence rule | HEALTHY | **L1** (cannot promote to L2 under divergence) | Recognition suspended pending arbitration | `blocked: cross_source_divergence` | `divergence.detected` (rule id + severity), `review.routed` | ✅ — no silent promotion of conflicting truth |

### Notes on selected rows

- **Row 1 vs Row 2:** Row 1 is an input-validation failure; no source is called, no PSV receipt is created. Row 2 calls NPPES and receives a negative result — a PSV receipt is *denied* (which is itself an audit-worthy event). These must not be conflated in tests.
- **Row 7 staleness:** The `FreshnessPanel` 4-layer model means some staleness is tolerable with explicit operator acknowledgment. Tests must assert that `stalenessAck=true` is recorded, not merely that Acceptance succeeded.
- **Row 8 revocation cascade:** This is the most dangerous row. Prior `checked` state must not "stick" once revocation lands. The test must confirm that a query at T₂ (post-revocation) never returns the T₁ positive state without a revocation flag.

---

## Step 4 · Contradiction Checklist (Layer-Seam Truth Violations)

Contradictions in VitalCV almost always live at a seam between two layers. This checklist enumerates the seams most likely to leak truth.

### Seam A · Source Adapter → `trustStateEngine`
- [ ] Adapter returns a 200 with empty body but resolver records `checked` instead of `notDecisionGrade`.
- [ ] Adapter timeout classified as `stale` instead of `unavailable` (hides CRITICAL state from operator spine).
- [ ] Adapter returns soft-404 (HTML error page with 200) parsed as success.

### Seam B · `trustStateEngine` → `readinessEngine`
- [ ] `reviewRequired` on any safety/authority lane still permits promotion to **L2**.
- [ ] `stale` on identity lane does not demote from **L2** to **L1**.
- [ ] Divergence-detected state silently aggregated away by a worst-wins rollup that picks the *wrong* axis.

### Seam C · `readinessEngine` → Canonical Path Guards
- [ ] CRS computed at **< 80** but Start gate still opens because `EmployerAcceptance` record exists from a prior state.
- [ ] Acceptance created without a referenced Recognition (type-level guard in `employmentGuards.ts` bypassed via raw Prisma write).
- [ ] Revoked Recognition not propagated to dependent Acceptance (cascade failure).

### Seam D · Canonical Path → `AuditEvent`
- [ ] 2xx returned from `POST /api/employer-review/:entityId/accept` without an `AuditEvent` row committed in the same transaction (audit contract violation).
- [ ] `acceptance.refused` returns 200 with `{ok: false}` instead of a non-2xx status — swallows the refusal in client logic that only checks HTTP status.
- [ ] AuditEvent written but `decisionCapsule` payload omits the trust-state snapshot used at decision time (replayability lost).

### Seam E · UI ↔ API Truth
- [ ] `SourceHealthPanel` shows green checkmark for a `gated` source (W17-5 class bug — a Nursys-style false positive).
- [ ] `FreshnessPanel` shows a relative timestamp only; operator cannot distinguish "2 hours stale" from "2 hours past SLA" without absolute ISO on hover (W16-2).
- [ ] Public `/p/[slug]` page renders a passport field that the clinician has not opted to disclose (selective-disclosure bypass).

### Seam F · Copy vs Reality
- [ ] UI copy says "verified" when underlying state is `stale` or `reviewRequired`.
- [ ] Marketing page claims a source (e.g., NPDB) that is not integrated.
- [ ] Any use of "hire instantly", "blockchain-anchored", "zero-knowledge proof", "permanent record", "all 50 states" (copy-prohibition list, Canon §16).

### Seam G · Temporal Truth
- [ ] System accepts a PSV receipt whose `issuedAt` is in the future.
- [ ] System treats `expiresAt == now` as valid (should be strict `<`).
- [ ] Freshness SLA computed against `createdAt` of the DB row instead of the source's `verifiedAt` timestamp.

---

## How to Use This Document

1. **For test authors:** Each row in Step 1–2 should map to at least one integration test in `apps/api` and one UI assertion in `apps/web`. The `Expected AuditEvent(s)` column is the most skipped — assert it explicitly.
2. **For release gates:** Before a pilot deployment, walk the Seam Checklist and mark every box. An unchecked box is a launch blocker.
3. **For incident postmortems:** When a trust regression happens in production, find the row or seam it belongs to. If it fits none, add a new one and link the incident.

---

## Out of Scope (Explicitly)

- NPDB, DEA, ABMS, SAM.gov, Doximity — not integrated; do not add rows.
- Mobile wallet offline flows — covered separately in Wave Wallet spec.
- Blockchain anchor failures — tracked under `blockchain/substrate/` runbook, not here.

---

## Output Summary

```json
{
  "failure_matrix_created": true,
  "contradictions_identified": [
    "Seam A: timeout-as-stale misclassification hides CRITICAL",
    "Seam B: reviewRequired promoted to L2",
    "Seam B: stale identity not demoted",
    "Seam C: CRS<80 Start opened via prior Acceptance",
    "Seam C: revocation not cascaded to dependent Acceptance",
    "Seam D: 2xx returned without AuditEvent commit",
    "Seam D: decisionCapsule omits trust-state snapshot",
    "Seam E: gated source rendered as checked (Nursys-class)",
    "Seam F: 'verified' copy over stale state",
    "Seam G: freshness computed on createdAt not verifiedAt"
  ],
  "qa_artifact_ready": true
}
```
