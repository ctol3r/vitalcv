# UX Instrumentation Plan

## Hook available
`@/hooks/useUxTelemetry` — use `track()` + `startTimer()` for all UX events.

## Events to add when locks clear

### LiveTrustConsole (hero/) — UX-2 owns
- Form submit → `startTimer('npi-to-result')`
- Ingest started → track('source_check_started')
- Preview visible → track('readiness_revealed', 'npi-to-result') [includes duration_ms]

### ReviewClient (components/review/) — UX-3 owns
- Accordion item expanded → track('accordion_expanded', metadata: { domain })
- Accept/request-refresh/route-to-review clicked → track('employer_action_clicked', metadata: { action })

### PassportShareActions (components/passport/) — UX-3 owns
- Share/copy CTA clicked → track('share_cta_clicked', metadata: { method: 'copy'|'link'|'embed' })

### EvidenceViewer (components/evidence/) — UX-4 owns
- Panel opened → track('evidence_viewer_opened', metadata: { findingId })

### ApplyBundleView (components/apply/) — UX-5 owns
- Sign-in action bar clicked → track('employer_action_clicked', metadata: { action: 'sign-in-to-accept' })

## Storage
All events stored via `/api/pilot-ops/events` → PilotMetricEvent table.
Query via `GET /api/internal/pilot-ops` (ADMIN route).
