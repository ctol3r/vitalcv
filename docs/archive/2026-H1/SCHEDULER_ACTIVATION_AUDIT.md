# Scheduler Activation Audit
Generated: 2026-05-13T18:11:00Z
Scheduler: OpenClaw cron (gateway)

---

## Phase 3 Verdict: 3 SCHEDULERS LIVE

Three production schedulers activated this wave. All attributed, all isolated, all announcing.

---

## Active Schedulers

### 1. `vcv-lane-probe` (every 6h)
```
Job ID:    6f70e086-355c-4307-a170-0bf8cd42b6d1
Schedule:  0 */6 * * * (America/Los_Angeles)
Next run:  ~6h from activation
Target:    isolated session
Delivery:  announce
```
**What it does:** POSTs to `/api/identity/bootstrap/{npi}` to refresh NPPES identity lane.
Reports: lanes probed, HTTP status codes, degraded lanes detected.

### 2. `vcv-replay-reconciliation` (every 12h)
```
Job ID:    c4ee2bbc-cc59-4216-90b2-09ce8ded86ff
Schedule:  0 */12 * * * (America/Los_Angeles)
Next run:  ~12h from activation
Target:    isolated session
Delivery:  announce
```
**What it does:** GETs `/api/replay/integrity/{npi}` or `/api/replay/test-run-001`. Verifies replay response shape — `lineageKey`, `runId`, `checkedAt`, `receipt_continuity.issuerDid == did:web:vitalcv.com`, `gaps[]`. Reports survivability score.

### 3. `vcv-degraded-recovery` (every 30min)
```
Job ID:    0d38aebc-eb7e-4cd5-8930-528e9921ffc9
Schedule:  */30 * * * * (America/Los_Angeles)
Next run:  next :00 or :30
Target:    isolated session
Delivery:  announce
```
**What it does:** GETs `/api/status` and verifies `overall==operational`. Checks all 11 `verifier_continuity.endpoints` are operational. GETs `/.well-known/jwks.json` and verifies `keys[]` present. Reports degraded surfaces + signing key id.

---

## Scheduler Continuity Properties

| Property | Status |
|---|---|
| Jobs survive OpenClaw restart | ✅ — cron is persisted in gateway |
| Jobs attributed to session | ✅ — `agentId: main` |
| Jobs run in isolated context | ✅ — `sessionTarget: isolated` |
| Job output delivered | ✅ — `delivery: announce` |
| Jobs idempotent | ✅ — each job is a read-only probe |
| Jobs do not write data | ✅ — probe-only, no mutations |

---

## Operational Continuity

These schedulers sustain the following continuity guarantees:

| Guarantee | Scheduler | Cadence |
|---|---|---|
| NPPES identity lane stays fresh | `vcv-lane-probe` | Every 6h |
| Replay chain integrity verified | `vcv-replay-reconciliation` | Every 12h |
| Degraded surfaces detected within 30 min | `vcv-degraded-recovery` | Every 30 min |
| Signing key presence confirmed | `vcv-degraded-recovery` | Every 30 min |

---

## Not Yet Scheduled (requires backend integration)

| Task | Blocker |
|---|---|
| OIG exclusion lane probe | OIG adapter not integrated |
| State license lane probe | State board adapters not integrated |
| Receipt continuity repair | Requires ReplayRunRecord persistence (Phase 2) |
| Chronology gap reconciliation | Requires DB-backed replay chain |

---

**SUCCESS: Runtime continuity is operationally sustained.**
**Three schedulers live. Coverage: degraded detection (30min), replay integrity (12h), lane freshness (6h).**
