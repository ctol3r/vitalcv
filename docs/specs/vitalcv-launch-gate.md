# VitalCV Launch Gate

**MISSION:** Nothing goes live until the product, packet, dashboard, docs, and billing motion all tell the same truthful story.

**Last updated:** 2026-03-30 (Wave 5)

## Gate Operating Rule

- The launch gate is green only when every gate below is green on the same release candidate.
- Evidence beats narration. If the product needs explanation to make a gate look green, the gate is red.
- If a gate turns red, the answer is either a smaller truthful scope or a product fix. Better storytelling is not a remedy.
- The wedge remains the only launch motion until this gate is revised explicitly.

---

## 1. Truthful Public Shell

| # | Check | Evidence Required |
| --- | --- | --- |
| T1 | Homepage, `/employers`, `/billing`, and all public surfaces describe only live routes and honest source states | Manual copy review — no route, source, or pricing claim outpaces the product |
| T2 | No banned strings in production HTML or JS bundles (see `public-copy-guard.ts` blocklist) | Build-time assertion or bundle grep |
| T3 | Governance/wave/phase labels stripped from public-facing pages | Route inspection of `/developers` and other public pages |
| T4 | Copy guard test suite passing: `postrelease-truth-cleanup.test.tsx` | CI green |

## 2. Canonical Wedge Routes

| # | Check | Evidence Required |
| --- | --- | --- |
| W1 | The only launch wedge is `/onboarding` -> `/passport/[id]` -> `/review/[entityId]` -> `/pilot-ops` / start capture | Product walkthrough recorded on the live environment |
| W2 | No archived `/demo/*` route or off-wedge operator backdoor is required to complete the flow | Walkthrough does not touch `_archive` routes |
| W3 | NPI input at `/onboarding` resolves identity and begins launch-spine checks | Live NPI test (approved pilot NPI or `1003000126`) |
| W4 | `/passport/[id]` shows identity + sanctions + enrollment + source coverage with per-source status | Screenshot evidence |
| W5 | `/review/[entityId]` loads employer review with readiness snapshot + action buttons | Screenshot evidence |
| W6 | Shared surfaces (`/p/[slug]`, `/interview`) point back to the same packet truth, not separate data | Route inspection |

## 3. Packet and Export Trustability

| # | Check | Evidence Required |
| --- | --- | --- |
| P1 | `GET /api/employer-review/:entityId/packet` returns stored facts, timestamps, and `sourceCoverage` | Live packet export — compare payload to review screen |
| P2 | Packet and review UI agree on readiness score, source states, and blocker list | Side-by-side comparison |
| P3 | Packet contains explicit limitation language for gated/pending/access-required sources | Payload inspection |
| P4 | KPI CSV and JSON exports match the live pilot scope | Export comparison: `GET /api/internal/pilot/kpis` vs `GET /api/internal/pilot/kpis/export` |

## 4. Employer Decision Persistence

| # | Check | Evidence Required |
| --- | --- | --- |
| E1 | `Accept as head start` writes `EmployerDecisionEvent` + `AuditEvent` before returning 2xx | One successful action with visible `auditEventId` |
| E2 | `Request refresh` writes `EmployerDecisionEvent` + `AuditEvent` before returning 2xx | One successful action with DB row verification |
| E3 | `Route to review` writes `EmployerDecisionEvent` + `AuditEvent` before returning 2xx | One successful action with DB row verification |
| E4 | Review UI surfaces audit confirmation after each action | Screenshot showing audit trail recorded |
| E5 | Employer action cannot succeed without a persisted audit record | Code review of `employerActions.ts` transaction boundary |

## 5. Blocker Metrics and Resolution

| # | Check | Evidence Required |
| --- | --- | --- |
| B1 | Blockers are synced via `syncBlockerEvents()` and persisted to `blocker_resolution_events` | DB query showing blocker rows |
| B2 | KPI dashboard shows open/resolved blocker counts | `/pilot-ops` screenshot |
| B3 | Blocker resolution methods tracked: `SOURCE_UPDATE`, `MANUAL_UPLOAD`, `WAIVED`, `EXPIRED` | KPI export showing blocker breakdown |
| B4 | Average and median resolution days computed per blocker code | KPI export field `blockers[].avgResolutionDays` |

## 6. Start-Outcome Capture

| # | Check | Evidence Required |
| --- | --- | --- |
| S1 | `POST /api/internal/pilot/start-outcome` accepts `entityId`, `startedAt`, `note` | One successful 202 response |
| S2 | System automatically derives `daysFromFirstReview`, `daysFromShare`, `daysFromReady` | Start outcome row with computed velocity fields |
| S3 | Start outcome inherits active scope (`orgContextId`, `pilotId`, `workflowLane`, `geographyTag`) | Field inspection of captured start event |
| S4 | Filtered reporting never invents scoped starts from unscoped `start_attestations` | Scoped KPI snapshot comparison |

## 7. Source-Health Visibility

| # | Check | Evidence Required |
| --- | --- | --- |
| H1 | `/internal/pilot-ops` shows source health panel with freshness + alerts | Screenshot |
| H2 | `/api/mission-ops/sources` returns current source status for NPPES, OIG/LEIE, PECOS | API response |
| H3 | Pilot diagnostics panel shows failing steps when a source is down | Simulated degradation or historical evidence |
| H4 | `spineStatus` returns `HEALTHY`, `DEGRADED`, or `CRITICAL` | API response showing status field |
| H5 | Silent source failures surface as `UNAVAILABLE` / `ERROR`, not as `CLEAR` / `VERIFIED` | Code review of error handling in source adapters |

## 8. Build and Typecheck

| # | Check | Evidence Required |
| --- | --- | --- |
| C1 | `pnpm turbo build` passes on the release candidate SHA | CI log or local build output |
| C2 | `pnpm turbo typecheck` passes with zero errors | CI log or local typecheck output |
| C3 | No `ignoreBuildErrors` or `ignoreDuringBuilds` in `next.config.mjs` | File inspection |
| C4 | Test suite passes: all assertion files green | CI test results |

## 9. KPI Truth Locked

| # | Check | Evidence Required |
| --- | --- | --- |
| K1 | Primary KPI defined identically everywhere: **Interview-to-Start Velocity** = median days from first employer review to recorded start outcome | Cross-document wording comparison |
| K2 | Pilot brief, runbook, KPI dashboard, exports, and buyer-facing materials all use the same definition | Manual review |
| K3 | Secondary metrics (packets shared, reviews opened, decisions made) are labeled as secondary, not primary | Dashboard and export review |

## 10. Pricing Truth Locked

| # | Check | Evidence Required |
| --- | --- | --- |
| R1 | `/billing` page matches pricing doctrine: clinicians free, orgs pay for workflow execution | Route inspection |
| R2 | Same-band repeat access is not re-billed — rule visible in pricing materials | Copy review |
| R3 | Government fees described as pass-through at cost, no markup | Copy review |
| R4 | No claim of live self-serve checkout when access is still manual/mailto-gated | `/billing` page inspection |

---

## Required Evidence Pack Before Green

Do not mark the gate green without all of the following in hand:

- [ ] Screen-recorded wedge walkthrough on the live pilot environment
- [ ] Live packet export from `/api/employer-review/:entityId/packet`
- [ ] CSV and JSON KPI export from the live pilot ops flow
- [ ] At least one visible audit confirmation per employer action type
- [ ] At least one start outcome row (or explicit note that outcome measurement has not started yet)
- [ ] Source health panel showing current spine status
- [ ] Build + typecheck passing on the release candidate SHA
- [ ] Wording review across pilot brief, launch gate, KPI dashboard, demo script, pricing doctrine, and pilot runbook

## Automatic Fail Conditions

Launch is blocked immediately if any of the following are true:

- Public or pilot-facing copy implies decision-grade coverage for a source that is gated, pending, access-required, preview-only, or not integrated
- The wedge requires archived demo routes or unsupported operator backdoors
- Packet export and review payload disagree on readiness or source coverage
- An employer action succeeds without a persisted audit record
- Filtered pilot reporting is built from unscoped starts
- The first-value or packet-to-decision story only works with narration and not with the actual product
- Pricing language implies live card checkout when access is still routed through manual approval
- A source failure silently renders as clean/verified instead of surfacing as an error
- Build or typecheck is failing on the release candidate

## Exit Rule

If a gate is red, the answer is not better storytelling. The answer is either a smaller truthful scope or a product fix that closes the gap.
