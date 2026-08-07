# UX Instrumentation Plan

Two client-side sinks exist. Pick by purpose and never split one funnel across
both — a funnel whose steps land in different sinks has no computable rate
(see `docs/ops/metrics-analytics.md`):

- **PostHog funnel** — `trackFunnelEvent()` from `@/lib/analytics/funnel`
  (`FUNNEL_EVENTS`). Anonymous acquisition and career-loop stage events.
  Dormant until `NEXT_PUBLIC_POSTHOG_KEY` is set.
- **Pilot Ops (first-party)** — `useUxTelemetry()` (`@/hooks/useUxTelemetry`)
  or `trackUxEvent()` (`@/lib/telemetry/ux-tracker`), both wrapping
  `trackPilotEvent`. UX friction and timing signals. Event names live in
  `lib/analytics/ux-events.ts` and must exist in `PilotMetricEventType`
  (`lib/pilot-ops/client.ts`).

## Live surfaces (already instrumented)

### Homepage `/` — components/home/career-loop/CareerLoopHome.tsx
- Mount → `FUNNEL_EVENTS.HOMEPAGE_VIEWED`; employer entry →
  `EMPLOYER_ENTRY_CLICKED`
- Career-loop stages (`lib/career-loop/useCareerLoop.ts`):
  `NPI_INPUT_STARTED`, `NPI_SUBMITTED`, `NPI_RESOLVED` /
  `NPI_RESOLUTION_FAILED`, `MATCH_FEED_VIEWED`, `MATCH_DEFAULTED`,
  `OPPORTUNITY_SELECTED`
- Apply/share leg (`components/apply/ApplyWithVitalCV.tsx`): `APPLY_OPENED`,
  `AUTHENTICATION_STARTED`, `OWNERSHIP_VERIFICATION_STARTED`,
  `SHARE_PREVIEWED`, `SHARE_COMPLETED`, `SHARE_REVOKED`
- `components/home/film/HorizontalCareerFilm.tsx` is the rollback variant and
  keeps its own `HOMEPAGE_VIEWED` / `EMPLOYER_ENTRY_CLICKED` producers.

### Guest lane `/onboarding` — app/get-ready/GetReadySurface.tsx
The anonymous acquisition funnel's terminal states, since `/passport` retired
(2026-08-07, #1096/#1099):
- `NPI_SUBMITTED` → `RESULTS_DISPLAYED` (`outcome: 'guest_record'`) or
  `DROPOFF_DETECTED` (`outcome: 'organization' | 'unavailable'`)
- Pilot-ops KPI continuity: `UX_EVENTS.PASSPORT_VIEWED` when the anonymous
  record displays
- Call sites pinned by `__tests__/funnel-instrumentation.test.ts`

### ReviewClient (components/review/) — /review/[entityId]
Via `trackUxEvent`: `review_opened`, `UX_EVENTS.EMPLOYER_ACTION_CLICKED`,
`employer_action_result`, `export_gate_blocked` / `export_gate_started` /
`export_gate_result`.

### Chrome & misc
- `components/layout/Navbar.tsx` → `UX_EVENTS.NAV_ITEM_CLICKED`
- `components/employer/RequestReviewPanel.tsx` → `UX_EVENTS.REVIEW_REQUESTED`
- `lib/analytics/not-found-tracker.tsx` → `dead_end_reached` on 404

## Events still to add

- **ReviewClient accordion** — item expanded →
  `track('accordion_expanded', metadata: { domain })`
- **EvidenceViewer** (`components/evidence/EvidenceViewer.tsx`, rendered
  inside the intelligence surfaces) — panel opened →
  `track('evidence_viewer_opened', metadata: { findingId })`
- **ApplyBundleView** (`components/apply/`, /apply/[requestUri]) — sign-in
  action bar → `track('employer_action_clicked',
  metadata: { action: 'sign-in-to-accept' })`
- **Holder share** (`components/holder/ShareBundleCard.tsx` — `/passport`'s
  Share ported here) — share/copy CTA →
  `track('share_cta_clicked', metadata: { method })`

## Declared but producer-less (retired era)

`npi_submit_attempt`, `npi_invalid`, `source_check_started`, and
`readiness_revealed` were planned for the hero `LiveTrustConsole`, which was
deleted with the `/passport` retirement (#1099) before they were wired. They
remain declared in `ux-events.ts` / `PilotMetricEventType`. Re-point or retire
them deliberately — do not resurrect a deleted surface to give them a producer.

## Storage

Pilot-ops events flow via `/api/pilot-ops/events` → PilotMetricEvent table;
query via `GET /api/internal/pilot-ops` (ADMIN route). PostHog funnel events
are vendor-side and inert without `NEXT_PUBLIC_POSTHOG_KEY`.
