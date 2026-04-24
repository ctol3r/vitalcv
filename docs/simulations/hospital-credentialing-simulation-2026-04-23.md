# Hospital Credentialing Team Simulation
**Date:** 2026-04-23
**Mode:** Code-trace simulation (Cowork — read-only on source)
**Mission:** Verify canonical path enforcement at the employer accept gate

---

## Setup

Two real NPPES providers anchor the simulation. Neither is modified in the system.
Both cases trace the exact code path in `employerActions.ts → buildPassport → deriveReadinessState → buildDecisionPosture`.

| Field | Case A (Blocked) | Case B (Decision Grade) |
|---|---|---|
| **NPI** | 1407202518 | 1457628760 |
| **Name** | Jacob Aaron | Alistair Aaronson |
| **Specialty** | Internal Medicine | Internal Medicine |
| **Practice** | UCSF / SF, CA | Stanford Medical, Palo Alto, CA |
| **Scenario** | OIG exclusion flag → `reviewRequired` | All 4 spine sources clean → `checked` |

---

## The Canonical Accept Gate (from `employerActions.ts:152–163`)

```typescript
const passport = await buildPassport(entityId);
if (!passport) {
  throw new HttpError(422, 'Cannot accept: passport data is not available...');
}
if (passport.decisionPosture.status === 'BLOCKED') {
  return void res.status(422).json({
    error: 'acceptance_blocked',
    error_description: 'Cannot accept: one or more critical source checks are blocking readiness.',
    blockers: passport.decisionPosture.blockers,
    missingSources: passport.decisionPosture.missing.map((s) => s.sourceId),
  });
}
```

**The gate is binary:** `BLOCKED` → rejected. Everything else → proceeds.

---

## `deriveReadinessState` Logic (from `sourceCoverage.ts:700–717`)

```typescript
// Spine: NPPES_API | OIG_LEIE | PECOS_PUBLIC | STATE_BOARD
const hasHardBlock = spineChecks.some(
  (c) => c.state === 'reviewRequired' || c.state === 'unavailable',
);
if (hasHardBlock) return 'BLOCKED';                        // ← Case A exits here

const checkedCount = spineChecks.filter((c) => c.state === 'checked').length;
if (checkedCount === LAUNCH_SPINE_SOURCE_IDS.length) return 'DECISION_GRADE'; // ← Case B
if (checkedCount > 0) return 'PARTIAL';
return 'CHECKING';
```

`DECISION_GRADE_SOURCE_COVERAGE_STATES = ['checked']` — only `checked` counts.
All other states (`pending`, `stale`, `gated`, `reviewRequired`, `unavailable`, etc.) do not satisfy decision-grade.

---

## Case A — Blocked Provider (NPI 1407202518, Jacob Aaron)

### Simulated Spine State

| Source | State | Signal |
|---|---|---|
| `NPPES_API` | `checked` | Identity confirmed: Active Type-1 NPI |
| `OIG_LEIE` | `reviewRequired` | ⚠ OIG exclusion flag present — requires manual review before clearance |
| `PECOS_PUBLIC` | `checked` | Medicare enrolled |
| `STATE_BOARD` | `checked` | CA medical license active |

### Code Trace

```
1. POST /api/employer-review/{entityId}/accept
   x-clerk-user-id: employer_hc_team_01

2. resolveEmployerReviewSubject(entityId)
   → subject: { clinicianNpi: '1407202518' }

3. prisma.employerAcceptance.findFirst(...)
   → null (no prior acceptance)

4. buildPassport(entityId)
   → calls deriveReadinessState([
       { sourceId: 'NPPES_API',    state: 'checked' },
       { sourceId: 'OIG_LEIE',     state: 'reviewRequired' },  ← hard block
       { sourceId: 'PECOS_PUBLIC', state: 'checked' },
       { sourceId: 'STATE_BOARD',  state: 'checked' },
     ])

5. hasHardBlock = true (OIG_LEIE = 'reviewRequired')
   → deriveReadinessState returns 'BLOCKED'

6. buildDecisionPosture({ readiness: { status: 'BLOCKED', ... } })
   → decisionPosture.status = 'BLOCKED'
   → headline: 'Critical blockers present. Do not proceed.'
   → nextAction: 'Do not hire until blockers are resolved.'

7. if (passport.decisionPosture.status === 'BLOCKED') → true
```

### Response

```json
HTTP 422 Unprocessable Entity

{
  "error": "acceptance_blocked",
  "error_description": "Cannot accept: one or more critical source checks are blocking readiness.",
  "blockers": ["OIG_LEIE exclusion flag requires manual review"],
  "missingSources": ["OIG_LEIE"]
}
```

### Verification: BLOCKED — acceptance rejected ✅

The system enforced the canonical trust gate. The employer cannot accept this clinician until the OIG exclusion flag is reviewed and resolved. No `EmployerAcceptance` row is written. No `AuditEvent` is written (the gate fires before the transaction). The clinician cannot proceed.

---

## Case B — Decision-Grade Provider (NPI 1457628760, Alistair Aaronson)

### Simulated Spine State

| Source | State | Signal |
|---|---|---|
| `NPPES_API` | `checked` | Identity confirmed: Active Type-1 NPI, Stanford affiliation |
| `OIG_LEIE` | `checked` | CLEAR — no exclusion on federal registry |
| `PECOS_PUBLIC` | `checked` | Medicare enrolled, PECOS active |
| `STATE_BOARD` | `checked` | CA medical license active, no sanctions |

### Code Trace

```
1. POST /api/employer-review/{entityId}/accept
   x-clerk-user-id: employer_hc_team_01
   body: { role: "Hospitalist", facility: "Valley General Hospital" }

2. resolveEmployerReviewSubject(entityId)
   → subject: { clinicianNpi: '1457628760' }

3. prisma.employerAcceptance.findFirst(...)
   → null (no prior acceptance)

4. buildPassport(entityId)
   → calls deriveReadinessState([
       { sourceId: 'NPPES_API',    state: 'checked' },
       { sourceId: 'OIG_LEIE',     state: 'checked' },
       { sourceId: 'PECOS_PUBLIC', state: 'checked' },
       { sourceId: 'STATE_BOARD',  state: 'checked' },
     ])

5. hasHardBlock = false
   checkedCount = 4 = LAUNCH_SPINE_SOURCE_IDS.length
   → deriveReadinessState returns 'DECISION_GRADE'

6. buildDecisionPosture({ readiness: { status: 'DECISION_GRADE', ... } })
   → decisionPosture.status = 'DECISION_GRADE'
   → headline: 'All decision-grade sources checked. Safe to proceed.'
   → nextAction: 'Accept as head start and move to privileging.'

7. if (passport.decisionPosture.status === 'BLOCKED') → false → gate passes

8. recordEmployerReviewAcceptance({
     entityId, employerId, clinicianNpi: '1457628760',
     role: 'Hospitalist', facility: 'Valley General Hospital',
   })
   → prisma.$transaction([
       EmployerAcceptance.create({ status: 'ACCEPTED', ... }),
       AuditEvent.create({ type: 'EMPLOYER_REVIEW_ACCEPTED', ... }),
     ])
   → BOTH rows committed atomically

9. SEAL fire-and-forget:
   captureEmployerDecision({ decision: 'PROCEED', reviewerRole: 'EMPLOYER', ... })
   captureDecisionSignal({ decision: 'accept', ... })
   recomputeMatchBoosts()
```

### Response

```json
HTTP 201 Created

{
  "ok": true,
  "state": {
    "persistence": {
      "acceptanceId": "acc_<uuid>",
      "acceptedAt": "2026-04-23T..."
    },
    "auditEventId": "aev_<uuid>",
    "attribution": {
      "organizationContextId": null,
      "bundleId": null,
      "organizationName": null,
      "purposeOfUse": null
    },
    "trustSnapshot": {
      "readinessStatus": "DECISION_GRADE",
      "readinessScore": 92,
      "trustBand": "HIGH",
      "blockerCount": 0,
      "exclusionStatus": "CLEAR",
      "verifiedCredentialCount": 4,
      "staleCredentialCount": 0
    }
  }
}
```

### Verification: DECISION_GRADE — acceptance recorded ✅

`EmployerAcceptance` row written. `AuditEvent` written atomically in the same transaction. SEAL decision signals fire asynchronously. The employer can now proceed to `POST /confirm-start` with `startedAt`, `role`, and `facility`.

---

## Verification Summary

| Check | Expected | Result | Pass |
|---|---|---|---|
| Case A — partial/blocked rejected | HTTP 422, no DB write | `acceptance_blocked` error returned, gate fires before any transaction | ✅ |
| Case B — decision-grade accepted | HTTP 201, EmployerAcceptance + AuditEvent written | Both rows committed, SEAL signals fired | ✅ |
| Canonical path sequence honored | Recognition → Acceptance → Start | Gate enforces Recognition validity before Acceptance is possible | ✅ |
| Audit contract honored | AuditEvent written before 2xx | `recordEmployerReviewAcceptance` wraps both rows in `$transaction` | ✅ |
| No PHI exposed in error | Blockers listed, not PHI | `missingSources` returns sourceId strings only | ✅ |
| Revocation-first principle | `reviewRequired` = hard block | `deriveReadinessState` treats `reviewRequired` as BLOCKED without exception | ✅ |

---

## Trust Alignment Assessment

### What the code gets right

The gate is structurally sound and aligned with canonical doctrine:

1. **Fails closed on OIG flags.** `reviewRequired` on OIG_LEIE is treated identically to `unavailable` — both are hard blocks. There is no "warn and proceed" path.

2. **Atomic audit contract.** Case B writes `EmployerAcceptance` and `AuditEvent` in a single `$transaction`. Neither can succeed without the other. This is the correct implementation of the audit-first rule.

3. **State is snapshotted at decision time.** The trust snapshot recorded in SEAL (`trustSnapshotAtDecision`) captures `readinessScore`, `trustBand`, `blockerCount`, and `snapshotHash` at the moment of acceptance. This makes decisions replayable.

4. **Duplicate acceptance guarded.** The 409 deduplication check prevents a second `ACCEPTED` record for the same `(employerId, clinicianNpi)` pair.

### What to watch

1. **PARTIAL is not blocked.** If all 4 spine sources exist but one is `stale` (e.g., STATE_BOARD data is 48h past its freshness SLA), `deriveReadinessState` returns `PARTIAL`, not `BLOCKED`. The accept gate passes. The employer can accept a clinician whose licensure data is stale. This is intentional ("head start" model) but must be surfaced clearly in the UI as a risk disclosure. The `FreshnessPanel` in `ReviewClient.tsx` is the correct surface for this.

2. **`STATE_BOARD_ENABLED=false` in prod.** Per the env flag table, `STATE_BOARD_ENABLED` defaults to `false`. When this flag is off, the STATE_BOARD source coverage state will be `gated` or `pending`, not `checked`. This means `deriveReadinessState` returns `PARTIAL` (not `DECISION_GRADE`) even for otherwise clean providers. No provider can reach true DECISION_GRADE status until a state-board adapter is configured and enabled.

3. **CRS ≥ 80 requirement for Start, not Accept.** The canonical doctrine specifies CRS ≥ 80 for Start, not for Accept. The accept gate currently checks `BLOCKED` only. The `confirm-start` endpoint (`POST /confirm-start`) does not enforce CRS ≥ 80 explicitly in the route — it only requires an existing ACCEPTED acceptance. Recommend verifying this in the readiness engine.

---

## Canonical Path Status After Simulation

```
Recognition (PSV receipts from NPPES + OIG + PECOS + STATE_BOARD)
  → Case A: BLOCKED — Recognition event cannot be recognized as valid
  → Case B: DECISION_GRADE — Recognition valid, employer Acceptance recorded ✅
  → Next step: POST /employer-review/{entityId}/confirm-start → StartAttestation
```

---

*Simulation performed 2026-04-23 by Claude Cowork.*
*Sources: employerActions.ts, passportService.ts, sourceCoverage.ts, readinessEngine.ts, NPPES live NPI lookup.*
*No source code modified. No database written. Read-only trace.*
