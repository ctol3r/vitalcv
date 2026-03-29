# VitalCV KPI Dashboard

**MISSION:** The dashboard exists to prove whether the live wedge is reducing start delay without drifting from product truth.

**Last updated:** 2026-03-28 | **Full KPI funnel wired** | Wave 19 merged to main

## Wired Event Chain (as of 2026-03-28)

All events fire automatically. No manual instrumentation required for these steps:

| Step | Event | DB / Source |
|------|-------|------------|
| NPI submitted | `npi_submit_attempt` | `pilot_metric_events` |
| Readiness revealed | `readiness_revealed` | `pilot_metric_events` |
| Passport viewed | `passport_viewed` | `pilot_metric_events` |
| Review requested | `review_requested` | `pilot_metric_events` |
| Review opened | `review_opened` | `pilot_metric_events` |
| Employer action | `employer_action_clicked` | `pilot_metric_events` |
| Packet shared | `BundleShareEvent` | `bundle_share_events` |
| Employer decision | `EmployerDecisionEvent` | `employer_decision_events` |
| Start outcome | `StartOutcomeEvent` | `start_outcome_events` (operator-captured) |

**Only start outcome requires manual operator action.** See REAL_PILOT_RUNBOOK.md for the curl command.

## KPI API
- JSON: `GET /api/internal/pilot/kpis` (X-Monitoring-Secret required)
- CSV: `GET /api/internal/pilot/kpis/export`
- Quick report: `./scripts/pilot-kpi-report.sh $MONITORING_SECRET`

## Metric Hierarchy

- **Core KPI:** **Interview-to-Start Velocity** = median days from first employer review to recorded start outcome.
- **Launch targets:** first value under 30 seconds and packet-to-decision under 5 minutes.
- **Supporting metrics:** everything else exists to explain why the core KPI is moving, stalled, or untrustworthy.

## Canonical Formula Set

| Metric | Exact Rule | Why It Exists |
| --- | --- | --- |
| Interview-to-Start Velocity | Median of `recorded start outcome timestamp - first employer review timestamp` over the scoped cohort with recorded starts. | Commercial proof that the wedge is reducing start delay. |
| First value latency | Median of `first visible passport readiness snapshot - NPI submit timestamp` for approved pilot NPIs. | Launch proof that the wedge becomes useful fast enough to matter. |
| Packet-to-decision time | Median of `first persisted employer action - first employer review open timestamp`. | Operational proof that the packet can move a buyer to action quickly. |

## Global Rules

- Every metric must name its source table, event, or contract.
- Filtered views may use `orgContextId`, `pilotId`, `workflowLane`, and `geographyTag`.
- Filtered dashboards must never infer starts from unscoped `start_attestations`.
- Exported CSV and JSON must preserve the applied scope.
- Outcome metrics must render explicit nulls when the cohort has no valid outcome sample.
- Gaps stay explicit. Dashboard silence must never imply source coverage, billing coverage, or commercial success.

## Product Truth

| Metric | Definition | Source / Contract | Target / Interpretation |
| --- | --- | --- | --- |
| Wedge route completion rate | Percent of pilot sessions that make it through `vitalcv.com (NPI input)` -> `/passport?npi=[NPI]` -> `/review/request` -> `/review/[entityId]?contextId=[ctx]` on the canonical path. | Route analytics and operator walkthrough logs. | Should trend upward as the pilot becomes easier to run without human rescue. |
| First value latency | Median seconds from NPI submit to first visible readiness snapshot. | Onboarding + passport telemetry or manual stopwatch during launch gate. | Must stay under 30 seconds for approved pilot NPIs. |
| Packet truth parity | Percent of packet exports whose readiness and `sourceCoverage` match the employer review payload at export time. | Employer packet contract and review payload checks. | Must remain 100%. Any mismatch is a launch blocker. |
| Source coverage explicitness | Percent of rendered source checks carrying an explicit canonical coverage state. | Source coverage contract across passport, review, and packet surfaces. | Must remain 100%. |

## Holder Experience

| Metric | Definition | Source / Contract | Target / Interpretation |
| --- | --- | --- | --- |
| NPI submit success rate | Percent of NPI submissions that resolve into a passport without manual operator repair. | Onboarding events and passport resolution outcomes. | Shows whether the holder can enter the wedge cleanly. |
| Readiness visible rate | Percent of successful passport loads that display readiness score, blockers, and source coverage together. | Passport rendering contract. | Value is only real if the holder can see what is proven and what is missing. |
| Packet share count | Distinct share / packet events created for employers. | `bundle_share_events`. | Tells us whether holders are actually using the packet outside a rehearsed demo. |
| Share-to-review open rate | Percent of packet shares that lead to an employer review open. | `bundle_share_events` plus employer review advisory events. | Measures conversion from holder effort to buyer attention. |

## Buyer / Commercial

| Metric | Definition | Source / Contract | Target / Interpretation |
| --- | --- | --- | --- |
| Reviews opened | Distinct employers opening `/review/[entityId]`. | Employer review advisory events. | Measures buyer engagement with the packet. |
| Packet-to-decision time | Median minutes from first review open to persisted buyer action during the live wedge. | Employer review timing plus decision events; launch gate stopwatch until fully instrumented. | Target is under 5 minutes for a trained operator. |
| Decisions by type | Count of `PROCEED` (`Accept as head start` in the UI), `REQUEST_REFRESH`, `ROUTE_TO_REVIEW`, `REJECT`, and `HOLD`. | `employer_decision_events`. | Shows whether the packet leads to action instead of ambiguity. |
| Billable pulls by freshness band | New organization-paid credential access events by `static`, `monthly-monitoring`, and `continuous-monitoring`. | Pricing access summary. | Keeps pricing tied to workflow execution, not seats or vague value claims. |
| Included repeat views | Repeat same-org, same-credential, same-band access events not re-billed. | Pricing access summary. | Proves the no-double-pay doctrine is holding in practice. |
| Export runs | Count of packet or report exports requested by operator or buyer. | Export event counts. | Strong signal that the packet is being used in a real operating loop. |

## Trust Operations

| Metric | Definition | Source / Contract | Target / Interpretation |
| --- | --- | --- | --- |
| Launch-spine source mix | Coverage state distribution for `NPPES_API`, `OIG_LEIE`, `STATE_BOARD`, and `PECOS_PUBLIC`. | Canonical source coverage contract. | Tells ops whether the wedge is honest, degraded, or blocked. |
| Audit write success rate | Percent of employer actions that surface a valid `auditEventId` after persistence. | Employer action routes and audit ledger. | Must remain 100%; otherwise the wedge cannot be trusted. |
| Blocker categories | Open and resolved blocker counts by blocker code. | `blocker_resolution_events`. | Shows what is actually slowing starts. |
| Median blocker resolution time | Median days from blocker open to blocker resolved. | `blocker_resolution_events`. | Indicates whether the wedge is shortening the cleanup loop. |
| Event-chain health | Presence of share, review, decision, blocker, and start events in the expected order. | Pilot KPI snapshot event-chain section. | Prevents false confidence from partial telemetry. |

## Outcome Metrics

| Metric | Definition | Source / Contract | Target / Interpretation |
| --- | --- | --- | --- |
| Interview-to-Start Velocity | Median days from first employer review to recorded start outcome. | `start_outcome_events` plus employer review events. | This is the one metric that proves the pilot is commercially valuable. |
| Median days review -> decision | Median days from first employer review to first employer decision. | `employer_decision_events`. | Leading indicator for the core KPI. |
| Median days review -> ready | Median days from first employer review to first readiness at L2+ / score >= 60. | Advisory events plus readiness threshold. | Shows whether truth is becoming decision-grade fast enough. |
| Ready-at-first-review rate | Percent of reviewed clinicians already at readiness score >= 60 when the buyer first opens review. | Latest advisory score by reviewed clinician. | Measures how often the wedge helps the buyer immediately. |
| Starts recorded | Count of scoped start outcomes captured in the pilot window. | `start_outcome_events` and start attestation chain. | Without starts, the pilot cannot prove ROI. |

## Export Contract

Exports are contractor-safe and buyer-safe only if all of the following remain true:

- CSV rows use the machine-readable `section,label,value` contract.
- JSON exports preserve the applied scope and sample sizes.
- Outcome metrics carry explicit nulls when sample size is missing.
- Source and pricing limitations stay explicit in the surrounding pilot docs instead of being hidden by omission.

## What Does Not Belong Here

- vanity traffic metrics
- generalized marketplace activity unrelated to the wedge
- inferred pilot wins from unscoped or synthetic data
- alternate KPI language that competes with Interview-to-Start Velocity
