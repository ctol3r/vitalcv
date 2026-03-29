# VitalCV Pilot Metric Definitions

> Every metric the pilot reports, grounded in the actual data model.
> Sourced from `PilotKpiSnapshot` (see `apps/web/lib/pilot/pilotKpiTypes.ts`).

---

## Funnel Metrics

### Packets Shared
- **Definition:** Count of bundle share events — a clinician's readiness passport was shared with an employer.
- **Source:** `BundleShareEvent` table (`bundle_share_events`)
- **KPI field:** `packetShares.total` (total events), `packetShares.distinctEntities` (unique clinicians), `packetShares.distinctOrgs` (unique organizations)
- **Status:** Instrumented and persisted to database.

### Employer Reviews Opened
- **Definition:** Count of employer review events — an employer opened a review link to view a clinician's readiness.
- **Source:** `AdvisoryOutcomeEvent` table (`advisory_outcome_events`) where `eventType = 'EMPLOYER_REVIEW'`
- **KPI field:** `reviewsOpened.total`, `reviewsOpened.distinctEntities`
- **Status:** Instrumented and persisted to database.

### Decisions Made
- **Definition:** Count of employer decision events — an employer took an action on a clinician's readiness.
- **Source:** `EmployerDecisionEvent` table (`employer_decision_events`)
- **KPI field:** `decisions.total`, with breakdown: `decisions.proceedCount`, `decisions.refreshCount`, `decisions.routeCount`, `decisions.rejectCount`, `decisions.holdCount`
- **Decision types:** PROCEED / HOLD / REQUEST_REFRESH / ROUTE_TO_REVIEW / REJECT
- **Status:** Instrumented and persisted to database.

### Start Outcomes
- **Definition:** Count of confirmed clinician starts — an operator records that the clinician actually started.
- **Source:** `StartOutcomeEvent` table (`start_outcome_events`)
- **KPI field:** `startOutcomes.totalStarts`, `startOutcomes.distinctEntities`
- **Capture method:** Operator POST to `/api/internal/pilot/start-outcome` (monitoring-secret gated)
- **Status:** Instrumented and persisted to database. Requires manual operator action to record.

---

## Velocity Metrics (Time to Start)

### First Review → Decision (median days)
- **Definition:** Median days from first employer review event to first employer decision event, per entity.
- **KPI field:** `velocity.medianDaysFirstReviewToDecision`
- **Sample size:** `velocity.sampleSizes.reviewToDecision`
- **Status:** Derived automatically from event timestamps. Requires both review and decision events to exist.

### First Review → Ready (median days)
- **Definition:** Median days from first employer review to first advisory event with readiness score ≥ 60 (L2+).
- **KPI field:** `velocity.medianDaysFirstReviewToReady`
- **Sample size:** `velocity.sampleSizes.reviewToReady`
- **Status:** Derived automatically. Requires readiness score capture in advisory events.

### First Review → Start (median days) — PRIMARY KPI
- **Definition:** Median days from first employer review event to confirmed start date.
- **KPI field:** `velocity.medianDaysFirstReviewToStart`
- **Sample size:** `velocity.sampleSizes.reviewToStart`
- **Also stored per-event:** `StartOutcomeEvent.daysFromFirstReview`
- **Status:** Derived automatically when both review and start outcome events exist. This is the primary TTS metric.

### First Share → Decision (median days)
- **Definition:** Median days from first packet share to first employer decision.
- **KPI field:** `velocity.medianDaysShareToDecision`
- **Sample size:** `velocity.sampleSizes.shareToDecision`
- **Status:** Derived automatically from event timestamps.

---

## Readiness Distribution

### Readiness at Lookup
- **Definition:** Distribution of clinicians by readiness tier at time of employer review.
- **Tiers:** READY (score ≥ 60) / PARTIAL (score 30–59) / BLOCKED (score < 30) / No Score
- **KPI field:** `readinessDistribution.ready`, `.partial`, `.blocked`, `.noScore`, `.total`
- **Status:** Derived from advisory event `readinessScoreAtEvent` field.

### Readiness at Start
- **Definition:** Average and median readiness score at the time of confirmed start.
- **KPI field:** `startOutcomes.readinessAtStart.avgScore`, `.medianScore`, `.withBlockers`
- **Status:** Captured in `StartOutcomeEvent.readinessScoreAtStart`. Requires operator to include score at capture time.

---

## Blocker Metrics

### Blocker Resolution
- **Definition:** Per blocker code — how many are open, resolved, and how long resolution takes.
- **Source:** `BlockerResolutionEvent` table (`blocker_resolution_events`)
- **KPI field:** `blockers[].code`, `.openCount`, `.resolvedCount`, `.avgResolutionDays`, `.medianResolutionDays`
- **Resolution methods:** SOURCE_UPDATE / MANUAL_UPLOAD / WAIVED / EXPIRED
- **Status:** Instrumented. Blockers are synced automatically via `syncBlockerEvents()`.

---

## Event Chain Health

### Raw Event Counts
- **Definition:** Total events in each SEAL event table within the KPI window.
- **KPI fields:** `eventChain.bundleShareEvents`, `.advisoryOutcomeEvents`, `.employerDecisionEvents`, `.blockerResolutionEvents`, `.startOutcomeEvents`, `.employerAcceptances`, `.startAttestations`
- **Status:** Direct count queries. Useful for diagnosing pipeline gaps.

---

## Data Freshness and Instrumentation Notes

| Metric | Data Source | Persistence | Notes |
|---|---|---|---|
| Packet shares | BundleShareEvent | DB (Postgres) | Fire-and-forget capture, non-blocking |
| Reviews opened | AdvisoryOutcomeEvent | DB (Postgres) | Fire-and-forget capture |
| Decisions | EmployerDecisionEvent | DB (Postgres) | Fire-and-forget capture |
| Start outcomes | StartOutcomeEvent | DB (Postgres) | Requires manual operator POST |
| Velocity (TTS) | Derived from above | Computed at query time | Requires events in multiple tables to produce values |
| Blocker resolution | BlockerResolutionEvent | DB (Postgres) | Auto-synced by `syncBlockerEvents()` |
| Readiness distribution | AdvisoryOutcomeEvent | DB (Postgres) | Derived from `readinessScoreAtEvent` |

### What is real (instrumented and persisted)
- All event tables above are backed by Postgres via Prisma
- Events are captured via `sealEventCapture.ts` — write-only, append-only
- KPI snapshot is computed live at query time from these tables

### What requires operator action
- **Start outcomes** must be manually captured via API — the system does not auto-detect starts
- **TTS velocity** only computes when both review and start events exist for the same entity

### What is available at the API
- `GET /api/internal/pilot/kpis?days=N` — full `PilotKpiSnapshot` as JSON
- `GET /api/internal/pilot/kpis/export` — CSV export of the snapshot
- `GET /api/internal/pilot/roi-report` — ROI executive summary
- All endpoints require `X-Monitoring-Secret` header

### Scoping / Filtering
All metrics support optional scoping by: `orgContextId`, `pilotId`, `workflowLane`, `geographyTag` — passed as query parameters to the KPI endpoint or as metadata fields in event capture.
