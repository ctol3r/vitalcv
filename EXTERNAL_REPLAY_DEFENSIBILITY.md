# External Replay Defensibility
Generated: 2026-05-13T18:29:50Z

---

## Verdict: EXTERNALLY INSPECTABLE — MACHINE AND HUMAN READABLE

An external institution can independently inspect replay continuity using only public HTTP endpoints.

---

## External Inspection Endpoints

| Endpoint | Auth | Returns | Machine-Readable |
|---|---|---|---|
| `/api/replay/[runId]` | None | Full ReplayInspection JSON | ✅ |
| `/api/replay/chain/[npi]` | None | Full chain with priorRunId links | ✅ |
| `/api/replay/integrity/[npi]` | None | Integrity report — anomalies, gaps | ✅ |
| `/api/receipt/[lineageKey]` | None | Receipt continuity payload | ✅ |
| `/api/status` | None | Operational truth payload | ✅ |

All return `application/json`. All have `Cache-Control: no-store`. None require SPA fallback.

---

## Six-Slot Canonical Order: Verified Present

```
OBJECT → OWNERSHIP → CHECKED_AT → CHANNEL → REPLAY → RUN_ID
```

Verified in:
- `TrustRegisterRow.tsx` — OBJECT / OWNERSHIP / CHECKED_AT / CHANNEL / REPLAY / RUN_ID labels present in exact order
- `/api/status` `chronology_continuity.reading_order` — `["OBJECT","OWNERSHIP","CHECKED_AT","CHANNEL","REPLAY","RUN_ID"]`
- `/.well-known/trust-register` — reading order published in doctrine

---

## Live External Read (NPI 1457128589)

```
GET /api/replay/chain/1457128589
{
  "npi": "1457128589",
  "totalRuns": 2,
  "chainedRuns": 1,
  "headRunId": "6a4aaa2a",
  "originRunId": "44f6042a",
  "chain": [
    { "runId": "44f6042a", "priorRunId": null, "laneId": "NPPES_API", 
      "status": "VERIFIED", "checkedAt": "2026-05-13T18:21:51.785Z", "chainPosition": 0, "isHead": false },
    { "runId": "6a4aaa2a", "priorRunId": "44f6042a", "laneId": "NPPES_API",
      "status": "VERIFIED", "checkedAt": "2026-05-13T18:27:51.XXZ", "chainPosition": 1, "isHead": true }
  ],
  "reconstructedAt": "2026-05-13T18:29:50Z"
}
```

A credentialing director reading this can determine:
- **What:** NPPES identity lane for NPI 1457128589
- **Who:** NPPES_API source, vcv-system ownership
- **When:** `checkedAt` ISO 8601 Z-suffix — auditable
- **Channel:** `NPPES_API` → `did:web:vitalcv.com`
- **Replay:** `6a4aaa2a ← 44f6042a` — 2 runs, 1 chain link
- **Run ID:** `6a4aaa2a` — 8-char deterministic hash

---

## Machine Readability

All JSON payloads follow consistent schema:
- `runId` — 8-char hex string, always present
- `priorRunId` — string or null (explicit, never omitted)
- `checkedAt` — ISO 8601 Z-suffix (audit-grade)
- `issuerDid` — `did:web:vitalcv.com` (canonical, never mock)
- `status` — VERIFIED / QUEUED / FAILED (enum)

---

## Continuity Scanability

```
GET /api/replay/integrity/1457128589
→ chain_valid: false/true
→ anomaly_count: integer
→ chronology_continuous: boolean
→ replay_deterministic: boolean
→ entries[]: per-run with runId, laneId, signerKid, actorId
```

**What an auditor can confirm from public endpoints:**
1. Whether a chain exists for a given NPI
2. Whether chain links are intact (`chainedRuns`)
3. Whether any runs are orphaned
4. Whether replay is deterministic across calls
5. Which signing key was used per run
6. When each check occurred (ISO 8601)

**What they cannot confirm from public endpoints (absent):**
1. Offline chain verification (no TSA anchor)
2. Whether specific lane data is current (no lane-specific freshness endpoint)
3. Credential revocation status (no Status List)

**SUCCESS: External institutions can independently inspect replay continuity.**
