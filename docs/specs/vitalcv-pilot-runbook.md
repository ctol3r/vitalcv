# VitalCV Pilot Runbook

**MISSION:** Execute the first live pilot without widening scope or reintroducing demonstration theater. This runbook defines the operator path, KPI rules, commercial truth, and fallback behavior for the pilot.

**Last updated:** 2026-03-30 (Wave 5)

---

## 1. Pilot Constraint Model

If a request falls outside these bounds, it is out of scope for the pilot:

- **One Buyer:** Healthcare staffing agency or facility credentialing / onboarding operator.
- **One Workflow:** RN credentialing for per-diem shift (or post-hire credentialing sprint from accepted offer to cleared clinical start).
- **One KPI:** **Time-to-Trusted-Start (TTS)** = median days from first employer review to recorded start outcome.
- **One Proof Story:** NPI -> license + sanctions -> employer packet -> start decision.

---

## 2. Required Environment Configuration

The pilot must run in a deterministic environment:

```env
REAL_NURSYS_ENABLED=false       # Set true ONLY when institutional E-Notify access is live
FSMB_ENABLED=false              # Set true ONLY when institutional agreement is signed and connector is active
OIG_LEIE_ENABLED=true           # OIG LEIE CSV cache — always on in prod
STATE_BOARD_ENABLED=false       # Set true when the launch-state board adapter is configured
PECOS_ENABLED=true              # CMS PECOS quarterly source-backed snapshot
MONITORING_SECRET="<secure-random-string>"  # Required for pilot ops endpoints
SEAL_TRAINING_EXPORT_ENABLED=false          # Only enable for authorized offline analysis
OCR_PROVIDER=stub               # Set to 'openai' when OpenAI key available
```

---

## 3. How to Onboard a Pilot Customer

### Step 3.1 — Qualify the Customer

Confirm:
- [ ] Customer is a healthcare staffing agency or facility with credentialing authority.
- [ ] Customer has a credentialing lead who can sponsor the pilot.
- [ ] Customer can provide a scoped NPI cohort (5-20 clinicians is ideal for pilot).
- [ ] Customer can designate an operator to capture start outcomes.
- [ ] Customer understands that VitalCV covers NPPES + OIG/LEIE + PECOS today, not all sources.

### Step 3.2 — Scope the Pilot

Record in the pilot tracking system:
- `orgContextId`: unique identifier for this organization
- `pilotId`: unique identifier for this pilot engagement
- `workflowLane`: "rn-perdiem" or "post-offer-credentialing"
- `geographyTag`: state/region (e.g., "CA-norcal")

### Step 3.3 — Share Access

1. Send the pilot customer a link to `https://vitalcv.com`.
2. No integration required — the pilot runs entirely on VitalCV's hosted platform.
3. Provide the employer review link template: `https://vitalcv.com/review/[entityId]`.
4. Confirm the customer can access the site via browser.

---

## 4. How to Create and Test a Clinician

### Step 4.1 — Select a Test Clinician

For **simulation** (pre-pilot testing):
- Use NPI `1003000126` (seeded demo data — Sarah Chen MD, expected state: READY L3).
- Alternative: `1558395519` (expected: PARTIAL or READY).
- For gap scenarios: `1942788324` (PECOS gap), `1841498016` (OIG exclusion).

For **real pilot**:
- Use a real, active NPI provided by the pilot customer.
- Confirm the NPI is active in NPPES before starting (pre-validate at https://npiregistry.cms.hhs.gov/).

### Step 4.2 — Run the NPI Lookup

1. Navigate to `https://vitalcv.com/onboarding`.
2. Enter the NPI and submit.
3. Wait for readiness reveal (~10-15 seconds).
4. Confirm: identity resolved (NPPES), sanctions checked (OIG/LEIE), enrollment queried (PECOS).

### Step 4.3 — Verify Passport

1. Navigate to `/passport/[id]` (auto-redirected from onboarding, or via direct link).
2. Confirm all source lanes show correct states:
   - NPPES: CHECKED
   - OIG/LEIE: CHECKED (CLEAR or EXCLUDED)
   - PECOS: CHECKED (ENROLLED / NOT_FOUND / PENDING)
   - State Board: ACCESS_REQUIRED (expected for pilot)
3. Screenshot the passport for records.

---

## 5. How to Run the Full Wedge Flow

### Step 5.1 — NPI Intake

**URL:** `https://vitalcv.com/onboarding`

1. Enter clinician NPI.
2. Wait for readiness reveal.
3. Record: readiness state (READY / PARTIAL / BLOCKED), score, blockers.

### Step 5.2 — Passport Review

**URL:** `https://vitalcv.com/passport/[id]`

1. Review identity, sanctions, enrollment sections.
2. Note any ACCESS_REQUIRED or PENDING lanes.
3. Click "Share with employer" or copy the review link.

### Step 5.3 — Employer Review

**URL:** `https://vitalcv.com/review/[entityId]`

1. Walk the employer through the readiness snapshot.
2. Explain: source-backed data, not self-reported.
3. Show the FreshnessPanel timestamps.
4. Click `Export packet` to download evidence.

### Step 5.4 — Employer Decision

**URL:** Same review page.

1. Employer clicks one of:
   - `Accept as head start` — clinician is cleared to start (maps to PROCEED)
   - `Request refresh` — stale or missing data needs updating (maps to REQUEST_REFRESH)
   - `Route to review` — needs manual review queue (maps to ROUTE_TO_REVIEW)
2. Wait for success confirmation with visible `auditEventId`.
3. Record the decision type and timestamp.

### Step 5.5 — Verify Audit Log

After each employer action, confirm the audit trail:

```bash
# Check the most recent audit events (operator access)
curl -s "https://delightful-essence-production.up.railway.app/api/internal/pilot/kpis?days=1" \
  -H "X-Monitoring-Secret: $MONITORING_SECRET" | jq '.eventChain'
```

Expected: `employerDecisionEvents` count incremented, `employerAcceptances` incremented (if accept).

---

## 6. How to Capture Start Outcomes

When a real clinician start date is confirmed by the pilot customer:

```bash
curl -X POST "https://delightful-essence-production.up.railway.app/api/internal/pilot/start-outcome" \
  -H "Content-Type: application/json" \
  -H "X-Monitoring-Secret: $MONITORING_SECRET" \
  -d '{
    "entityId": "[ENTITY_ID]",
    "startedAt": "[ISO_DATE, e.g. 2026-04-15T00:00:00Z]",
    "note": "RN started per-diem shift at [facility]",
    "orgContextId": "[ORG_CONTEXT_ID]",
    "pilotId": "[PILOT_ID]",
    "workflowLane": "rn-perdiem",
    "geographyTag": "CA-norcal"
  }'
```

Expected response: `202 Accepted` with `{ ok: true, queued: true, entityId, startedAt }`.

The system automatically derives:
- `daysFromFirstReview` — days from first employer review to start
- `daysFromShare` — days from first packet share to start
- `daysFromReady` — days from first readiness event at L2+ to start

---

## 7. How to Export KPI Reports

### JSON Snapshot

```bash
curl -s "https://delightful-essence-production.up.railway.app/api/internal/pilot/kpis?days=30" \
  -H "X-Monitoring-Secret: $MONITORING_SECRET" | jq .
```

### CSV Export

```bash
curl -s "https://delightful-essence-production.up.railway.app/api/internal/pilot/kpis/export" \
  -H "X-Monitoring-Secret: $MONITORING_SECRET" > pilot-kpis-$(date +%Y%m%d).csv
```

### ROI Summary

```bash
curl -s "https://delightful-essence-production.up.railway.app/api/internal/pilot/roi-report" \
  -H "X-Monitoring-Secret: $MONITORING_SECRET" | jq .
```

### Script Shortcut

```bash
./scripts/pilot-kpi-snapshot.sh $MONITORING_SECRET
```

### Scoped Reports

Add scope parameters to filter by pilot:

```bash
curl -s "https://delightful-essence-production.up.railway.app/api/internal/pilot/kpis?days=30&orgContextId=ORG_ID&pilotId=PILOT_ID" \
  -H "X-Monitoring-Secret: $MONITORING_SECRET" | jq .
```

---

## 8. How to Check Source Health

### Via API

```bash
curl -s "https://delightful-essence-production.up.railway.app/api/mission-ops/sources" \
  -H "X-Monitoring-Secret: $MONITORING_SECRET" | jq .
```

Expected: each launch-spine source (NPPES, OIG/LEIE, PECOS) shows status and last-checked timestamp.

### Via Dashboard

Navigate to `/internal/pilot-ops` (requires `MONITORING_SECRET`):
- Source health panel shows per-source freshness and alerts.
- Pilot diagnostics panel shows failing steps.
- `spineStatus` should be `HEALTHY` or `DEGRADED` (not `CRITICAL`).

---

## 9. Canonical Pilot Routes

| Step | Route | Purpose |
| --- | --- | --- |
| Intake | `/onboarding` | NPI entry + credential ingestion |
| Passport | `/passport/[id]` | Full trust passport by entity UUID |
| Public share | `/p/[slug]` | NPI-based public share surface |
| Employer review | `/review/[entityId]` | Employer decision surface |
| Pilot ops | `/internal/pilot-ops` | KPI dashboard + source health (internal) |

**Do not use:** `/demo/*`, `_archive/*`, or any route not in this table.

---

## 10. Scope Discipline

When the pilot is scoped, operators must carry the same scope everywhere:

- `orgContextId` for organization drilldown
- `pilotId` for engagement identity
- `workflowLane` for lane or hire type
- `geographyTag` for state/region when relevant

Manual start capture must preserve the active scope. Filtered pilot reporting must never infer scoped starts from unscoped `start_attestations`.

---

## 11. Fallback Behavior

When a source is unavailable or contract-gated:

- **Do not hallucinate.** Show `Gated`, `Unavailable`, or `Unchecked`.
- Keep readiness honest — unresolved source gaps block a clean top readiness state unless the employer explicitly accepts an exception.
- Offer the operator a manual document path or exception path. Never silently clear the clinician.
- If `spineStatus` is `CRITICAL`, halt the pilot flow and escalate to engineering.

---

## 12. KPI Definitions

| Metric | Definition | Source |
| --- | --- | --- |
| **TTS (primary)** | Median days from first employer review to recorded start outcome | `velocity.medianDaysFirstReviewToStart` |
| Packets shared | Distinct bundle share events | `packetShares.total` |
| Reviews opened | Employer review events | `reviewsOpened.total` |
| Decisions made | Employer decision events by type | `decisions.total` (with PROCEED/HOLD/REQUEST_REFRESH/ROUTE_TO_REVIEW/REJECT breakdown) |
| Review to decision | Median days from first review to first decision | `velocity.medianDaysFirstReviewToDecision` |
| Blocker resolution | Open/resolved counts + avg/median resolution days | `blockers[].avgResolutionDays` |

---

## 13. Pricing and Buyer Truth

Operators must describe pricing the same way every time:

- Buyers pay for verified pull utility, monitoring refreshes, exports, and integration utility.
- Repeat access inside the same freshness band is **not** a second charge.
- A new freshness band can create a new billable pull.
- Government and registry fees are pass-through at cost with no markup.
- If public card checkout is not live, say that plainly and use the approved manual invoice/contact flow.

---

## 14. Explicit Non-Promises

Do not imply any of the following unless they are truly live for the pilot:

- Nursys or FSMB coverage
- NPDB, DEA, ABMS, or SAM checks
- Nationwide geography beyond the scoped pilot geography
- Fully automated public checkout
- General recruiting, sourcing, or top-of-funnel workflow support
- Guaranteed savings or ROI beyond the measured pilot KPI

---

## 15. What Counts as Success

- [ ] Readiness revealed without error for real NPI
- [ ] Employer review created with real contextId
- [ ] Employer action recorded (Proceed / Request Refresh / Route to Review)
- [ ] Audit trail visible with `auditEventId`
- [ ] Start outcome captured (or honest note if start did not occur)
- [ ] TTS calculated: `startedAt` - first employer review timestamp
- [ ] KPI export matches the live pilot scope

## 16. What Counts as Failure (Expected States, Not Bugs)

Document these — they are pilot data, not product failures:

- **Source unavailable:** Network or upstream issue. Note in pilot evidence.
- **PECOS pending:** Expected. Quarterly cadence means data may be up to 90 days stale.
- **State board access-required:** Expected. Per-state agreements not yet in place.
- **Employer action not taken:** Record reason. Still valuable — shows where the process stalls.
- **No start outcome:** Record reason. Not every pilot case leads to a start.
