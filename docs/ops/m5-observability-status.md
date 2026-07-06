# M5 — Observability, Reliability & Ops Maturity — Status

**Date:** 2026-07-06

## Shipped this wave

- **M5-1 Sentry PII scrubbing.** Sentry was already wired on web (`@sentry/nextjs`,
  `sentry.{server,client,edge}.config.ts`) but had **no PII scrubbing**. Added a
  shared `scrubEvent` `beforeSend` hook (`apps/web/lib/observability/sentryScrub.ts`)
  + `sendDefaultPii: false` on all three runtimes. Redacts email/NPI/SSN/bearer in
  message+exception, drops auth/cookie/clerk/org headers, reduces `user` to a bare
  id, scrubs `extra`/`request.data`/breadcrumbs. Proven by
  `apps/web/__tests__/sentry-scrub.test.ts` (4 cases). **Code-complete.**
  - **Owner action:** set `NEXT_PUBLIC_SENTRY_DSN` on Railway web (prod health
    currently reports `sentry: false` because the DSN is unset).

## Already present on main

- **M5-2 Structured logging** — `obs/logger.ts` `log()` in the backend.
- **M5-3 Status/health** — deep health endpoints (`/api/health`, `/health`,
  `/api/version`) + `apps/status-api` + `source-health-probe.yml`. Prod health
  live and green.

## Follow-up (infra / ops — not code-completable here)

| Item | Disposition |
|---|---|
| **M5-6 Backups & DR** | Railway Postgres has managed backups; needs a documented RPO/RTO + one timed restore drill (owner, needs prod access). **P0 ops.** |
| **M5-7 SLO + synthetic checks** | Add an external synthetic check on the wedge path (NPI → passport → packet); alert on 2 consecutive fails. Needs a monitor + owner alert channel. |
| **M5-4 Source-ops W16 polish** | UI: remediation hints + absolute-ISO timestamps + panel polling in `SourceHealthPanel`/`PilotDiagnosticsPanel`. Frontend follow-up. |
| **M5-5 Ingestion resilience** | Queue + retry/backoff + circuit-breaker + dead-letter surface. Real build. |
| **M5-9 Load baseline** | k6/artillery profile of ingest+passport+review; P95 targets. Needs a load-test env. |

## Assessment

The concrete P0 observability gap (Sentry capturing PII) is closed in code — the
only remaining step for live error tracking is the owner setting the DSN. Backups
DR-drill and SLO monitoring are genuine ops tasks needing prod access.
