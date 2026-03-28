# VitalCV Real Pilot Runbook

## SIMULATION vs. REAL PILOT

| | Simulation | Real Pilot |
|---|---|---|
| NPI | Use 1003000126 (seeded) | Use real active NPI |
| Sources | May use fixture data | Live NPPES/OIG/PECOS |
| Employer action | Can be self-performed | Requires real employer contact |
| Outcome capture | POST with future date | POST with confirmed real start date |
| Evidence | Not proof | Is proof |

Do NOT mix simulation data with real pilot evidence in the same evidence file.

---

## Prerequisites

- Access to https://vitalcv.com (production)
- `MONITORING_SECRET` for internal API calls
- One real clinician NPI (confirmed active in NPPES)
- One employer contact with authority to make a hiring/credentialing decision

## Step-by-Step

### Step 1 — Clinician Selection

- Choose a clinician with an active NPI in NPPES
- Confirm they are not on OIG/LEIE exclusion list (run the lookup first)
- Note: PECOS may show as PENDING — this is expected for quarterly cadence

### Step 2 — NPI Lookup

- Go to https://vitalcv.com
- Enter the NPI
- Wait for readiness reveal (~10–15 seconds)
- Screenshot: readiness state (READY / PARTIAL / BLOCKED)

### Step 3 — Passport View

- Click "View Passport" or navigate to `/passport?npi=[NPI]`
- Screenshot: identity + sanctions + enrollment sections
- Note any access-required or pending lanes

### Step 4 — Request Employer Review

- Navigate to `/review/request`
- Fill in: clinician NPI, employer context, purpose
- Submit — note the `contextId` returned
- Screenshot: confirmation screen

### Step 5 — Employer Review

- Navigate to `/review/[entityId]?contextId=[contextId]`
- Walk the employer through the readiness snapshot
- Note: employer sees source-backed lanes, not self-reported data
- Record the employer action taken: Proceed / Request Refresh / Route to Review

### Step 6 — Outcome Capture (Operator)

When a real start date is confirmed:

```bash
curl -X POST https://delightful-essence-production.up.railway.app/api/internal/pilot/start-outcome \
  -H "Content-Type: application/json" \
  -H "X-Monitoring-Secret: $MONITORING_SECRET" \
  -d '{
    "entityId": "[ENTITY_ID]",
    "startedAt": "[ISO_DATE]",
    "note": "[optional notes]"
  }'
```

Expected response: `202 Accepted` with `{ ok: true, queued: true, entityId, startedAt }`.

The system automatically derives velocity metrics (`daysFromFirstReview`, `daysFromShare`, `daysFromReady`) from prior events for this entity.

### Step 7 — Verify Outcome in Dashboard

- Visit `/pilot-ops` (internal, requires monitoring secret)
- Confirm `startOutcomes.totalStarts` incremented
- Export KPI CSV for record: `GET /api/internal/pilot/kpis/export`
- Or use the script: `./scripts/pilot-kpi-snapshot.sh $MONITORING_SECRET`

---

## What Counts as Success

- [ ] Readiness revealed without error for real NPI
- [ ] Employer review created with real contextId
- [ ] Employer action recorded (Proceed / Request Refresh / Route to Review)
- [ ] Start outcome captured (or honest note if start did not occur)
- [ ] TTS calculated: `startedAt` - first readiness check timestamp

## What Counts as Failure

These are expected states, not product failures — document them:

- **Source unavailable:** Note in pilot evidence. Network or upstream issue, not a VitalCV bug.
- **PECOS pending:** Expected. Quarterly cadence means data may be up to 90 days stale.
- **State board access-required:** Expected for pilot. Per-state agreements not yet in place.
- **Employer action not taken:** Record reason. Still valuable pilot data — shows where the process stalls.

---

## Outcome Capture Verification

Outcome capture is wired — no code changes needed. Confirmed:

1. `POST /api/internal/pilot/start-outcome` — registered in `apps/api/backend/src/routes/pilotKpi.ts`
2. `captureStartOutcome()` — implemented in `apps/api/backend/src/services/seal/sealEventCapture.ts`
3. `StartOutcomeEvent` model — defined in Prisma schema (`start_outcome_events` table)
4. KPI dashboard — shows `startOutcomes` in `/pilot-ops` page
