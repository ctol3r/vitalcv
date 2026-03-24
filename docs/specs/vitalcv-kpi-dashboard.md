# VitalCV KPI Dashboard

## Dashboard Philosophy

The dashboard exists to prove one thing: whether the live credentialing wedge is reducing time from employer review to actual clinical start.

## Primary KPI

**Interview-to-Start Velocity**

- Definition: median days from first employer review to recorded start outcome
- Scope: may be filtered by `orgContextId`, `pilotId`, `workflowLane`, and `geographyTag`
- Rule: filtered dashboards must not infer starts from unscoped canonical `start_attestations`

## Supporting Operational Metrics

- Packets shared
- Reviews opened
- Decisions made by type
- Median days, first review to decision
- Median days, first review to ready
- Median days, share to decision
- Blocker open/resolution counts and timing
- Event-chain health across share, advisory, decision, blocker, and start tables

## Export Contract

Exports are for contractor handoff and buyer reporting, so they must stay machine-readable:

- CSV rows use `section,label,value`
- JSON exports preserve the applied scope
- Gaps are explicit, never hidden
- Source or billing limitations must stay in the surrounding pilot docs, not be inferred from dashboard silence

## Constraints

- No vanity SaaS metrics
- No inferred pilot health from unrelated product surfaces
- No unscoped start inflation in filtered views
- No KPI wording drift from the pilot brief or runbook
