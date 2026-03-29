# VitalCV — Real Pilot Execution Tracker
**Version:** 1.0 · **Updated:** 2026-03-28
**Scope:** One buyer · One workflow · One KPI · One proof story
**Default terrain:** Northern California healthcare employer / credentialing team

> This is the live operations tracker for a real pilot case.
> Create one copy per case. Do NOT mix simulation and real data.
> File naming: `PILOT_CASE_[CASE_ID]_TRACKER.md`

---

## Pilot Structure (Locked)

| Dimension | Value |
|-----------|-------|
| Buyer type | Credentialing director / staffing ops / recruiting lead |
| Workflow | Already-qualified clinician nearing start → faster employer decision |
| Primary KPI | Interview-to-Start Velocity (TTS delta in days) |
| Proof story | NPI in → readiness → passport → employer head-start acceptance → start confirmed |
| Terrain | Northern California (or first available live buyer lane) |

---

## Case Header

```
Case ID:          PILOT-[YYYYMMDD]-[ORG_SHORT]
Organization:     [ORG NAME]
Buyer contact:    [NAME, TITLE, EMAIL]
Case opened:      [ISO DATE]
Case closed:      [ISO DATE or OPEN]
Clinician NPI:    [10-digit NPI]
```

---

## Step-by-Step Event Tracker

### 1. Baseline Capture (Human — Before VitalCV)

| Field | Value |
|-------|-------|
| Org's typical TTS (days, self-reported) | |
| Org's typical federal lookup time (min, estimate) | |
| How many portals checked manually | |
| Baseline captured by | |
| Baseline capture date | |

### 2. NPI Lookup + Readiness

| Field | Value |
|-------|-------|
| NPI entered at vitalcv.com | |
| Timestamp (UTC) | |
| NPPES state | ☐ checked ☐ unavailable |
| OIG/LEIE state | ☐ clear ☐ review_required ☐ unavailable |
| PECOS state | ☐ checked ☐ pending ☐ unavailable |
| State board state | ☐ access_required ☐ checked ☐ stale |
| Overall trust band | ☐ L3 ☐ L2 ☐ L1 ☐ L0 |
| Blockers at lookup | |
| Event fired: `readiness_revealed` | ☐ yes ☐ no |
| Screenshot taken | ☐ yes |

### 3. Passport View

| Field | Value |
|-------|-------|
| Passport URL | /passport?npi=[NPI] |
| Passport viewed timestamp | |
| Event fired: `passport_viewed` | ☐ yes ☐ no |
| Screenshot taken | ☐ yes |

### 4. Employer Review Request

| Field | Value |
|-------|-------|
| Review request submitted | |
| Context ID returned | |
| Review URL | /review/[entityId]?contextId=[contextId] |
| Event fired: `review_requested` | ☐ yes ☐ no |

### 5. Employer Review Opens

| Field | Value |
|-------|-------|
| Employer opens review link timestamp | |
| Review page loaded | ☐ yes ☐ no |
| Event fired: `review_opened` | ☐ yes ☐ no |
| DB event: `AdvisoryOutcomeEvent` captured | ☐ yes ☐ no (verify via KPI dashboard) |
| Screenshot taken | ☐ yes |

### 6. Employer Decision

| Field | Value |
|-------|-------|
| Decision timestamp | |
| Decision taken | ☐ PROCEED ☐ REQUEST_REFRESH ☐ ROUTE_TO_REVIEW ☐ HOLD ☐ REJECT |
| Event fired: `employer_action_clicked` | ☐ yes ☐ no |
| DB event: `EmployerDecisionEvent` captured | ☐ yes ☐ no (verify via KPI dashboard) |
| Notes from employer | |

### 7. Outcome Capture (Operator — Human Step)

When a real start date is confirmed, run:

```bash
curl -X POST https://delightful-essence-production.up.railway.app/api/internal/pilot/start-outcome \
  -H "Content-Type: application/json" \
  -H "X-Monitoring-Secret: $MONITORING_SECRET" \
  -d '{
    "entityId": "[ENTITY_ID_OR_NPI]",
    "startedAt": "[YYYY-MM-DDTHH:MM:SSZ]",
    "notes": "Case [CASE_ID] — [ORG_SHORT] — confirmed start"
  }'
```

| Field | Value |
|-------|-------|
| Start confirmed | ☐ yes ☐ no ☐ pending |
| Start date | |
| Start outcome POST sent | ☐ yes ☐ no |
| `StartOutcomeEvent` in KPI dashboard | ☐ yes ☐ no |
| If no start: reason | |

---

## KPI Calculation

After the case closes, run:

```bash
./scripts/pilot-kpi-report.sh $MONITORING_SECRET 30
```

Then fill in:

| KPI Metric | Value |
|------------|-------|
| Days from NPI lookup to employer decision | |
| Days from NPI lookup to confirmed start | |
| Org's TTS baseline (self-reported) | |
| **TTS delta (baseline − measured)** | |
| Manual lookup time replaced (estimated, min) | |
| Sources that were decisive (NPPES/OIG/PECOS) | |
| Blockers at lookup | |
| Employer action taken | |

**Verdict:**
- ☐ PROOF: TTS reduction measured, start confirmed
- ☐ PARTIAL: Employer acted, start pending
- ☐ DATA: No start — but pilot data collected, reason documented
- ☐ INCONCLUSIVE: Missing timestamps or baseline not captured

---

## Event Chain Verification

Use `GET /api/internal/pilot/kpis` (with `X-Monitoring-Secret`) to verify events fired:

| Event | DB Table | Expected Count | Actual Count | Status |
|-------|----------|---------------|--------------|--------|
| Passport shared | `bundle_share_events` | ≥ 1 | | ☐ |
| Employer review opened | `advisory_outcome_events` | ≥ 1 | | ☐ |
| Employer decision | `employer_decision_events` | ≥ 1 | | ☐ |
| Start outcome | `start_outcome_events` | ≥ 1 (if start confirmed) | | ☐ |

Full event chain KPI response field: `eventChain` in `/api/internal/pilot/kpis`.

---

## Notes / Timeline

```
[DATE] [TIME] — [NOTE]
```

---

## Evidence Files

| File | Description |
|------|-------------|
| `screenshots/step2-readiness-[CASE_ID].png` | NPI lookup result |
| `screenshots/step3-passport-[CASE_ID].png` | Passport view |
| `screenshots/step5-review-[CASE_ID].png` | Employer review |
| `screenshots/step6-decision-[CASE_ID].png` | Employer decision |
| `kpi-export-[CASE_ID].json` | KPI snapshot from `/api/internal/pilot/kpis` |

---

## Case Summary (Fill After Close)

**Org:** [ORG NAME]  
**NPI:** [NPI]  
**Clinician name:** [NAME if permitted]  
**Readiness state at lookup:** [READY / PARTIAL / BLOCKED]  
**Employer decision:** [PROCEED / etc.]  
**Start confirmed:** [YES / NO / PENDING]  
**TTS delta:** [N days faster / no change / inconclusive]  
**Verdict:** [PROOF / PARTIAL / DATA / INCONCLUSIVE]

---

*Pilot operator: [NAME] · Case opened: [DATE] · Case closed: [DATE]*
