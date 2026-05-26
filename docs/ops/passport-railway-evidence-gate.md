# Passport Railway Deployment Evidence Gate — NPI 1699264564

**Date:** 2026-05-25
**Author:** Claude Code Terminal
**Trigger:** Post-merge verification of PR #419 (`fix(passport): show NPPES source-confirmed when identity payload returned`)

## Summary

PR #419 (defensive web-side passport truth-state fix) is merged to `wave-10a/docs-status` as commit `1d1b8175` and confirmed live on `vitalcv-web` Railway service. Live runtime evidence shows the backend ingest pipeline still emits `source_complete status: FAILED` for NPPES when the identity payload is intact but downstream claim derivation produces zero records. A backend-side guard is added in this wave to bring backend truth-state into agreement with web-side mapping.

## Evidence

### Railway — `vitalcv-web` (provider identity wedge — Next.js app)

| Field | Value |
|---|---|
| Latest deployment commit SHA | `1d1b8175` |
| Deployment ID (from operator Claude Code web verdict) | `3c3d3358-9f6e-4524-b329-7881f98aa754` |
| Active since | `2026-05-25T03:51:51Z` |
| Source branch | `wave-10a/docs-status` |
| Status | Success / live |
| Auto-deploy | ON |
| PR #419 fix appears deployed? | **YES** — route chunk `/_next/static/chunks/app/passport/page-de565de42d82b3b2.js` (42,429 bytes) contains all four new error-copy strings: `Source temporarily unavailable`, `Federal exclusion lane is not connected`, `Medicare enrollment lane is not connected`, `Identity source returned` |
| Open known caveats | Railway "Edited / 2 Changes" staged badge present on the `vitalcv-web` tile (operator review required before any future deploy — not touched by Claude Code) |

### Live `/passport?npi=1699264564`

| Surface | Web mapping output (after PR #419) | Honest truth-state |
|---|---|---|
| NPPES row | `Source-backed` badge, identity-confirmed card renders | Identity from NPPES is source-confirmed |
| OIG / LEIE row | `Not connected` + "Federal exclusion lane is not connected in this build…" | OIG lane has no live evidence in this build |
| CMS PECOS row | `Not connected` + "Medicare enrollment lane is not connected in this build…" | PECOS lane has no live evidence in this build |
| Configured state board lane | `Access required` (unchanged) | State board has no live adapter in this build |
| Readiness card | Contextual note: "Identity source returned. Additional credential lanes require source access or are not connected in this build. Institution review is still required for any final decision." | Truthful framing |
| Misleading copy on terminal states (`Checking in the background — we'll update when it arrives.`) | Removed | — |

### Backend SSE evidence (captured during PR #419 reproduction)

Raw `source_complete` event for NPPES (NPI 1699264564) currently emitted by `apps/api/backend/src/services/ingest/ingestOrchestrator.ts::finalizeSourceResult`:

```json
{
  "sourceId": "nppes",
  "status": "FAILED",
  "resultStatus": "FAILED",
  "claimCount": 0,
  "credentialIds": [],
  "entityId": "d70373b4-7485-4e2c-be16-199c355bf98e",
  "displayName": "VICTORIA ELIZABETH FISCHER, MD",
  "identityStatus": "ACTIVE",
  "specialty": "Neurological Surgery",
  "taxonomies": [...],
  "address": {...},
  "credentials": "MD",
  "enumerationDate": "2018-05-07",
  "lastUpdated": "2026-02-11"
}
```

Backend pipeline trace:
- `resolveEntityFromNpi(1699264564)` resolves identity (displayName, status ACTIVE, entityId) BEFORE the ingest pipeline runs.
- `ingestClinicianIdentity` calls `executeSourceIngestion` for NPPES_API. `parseSource` returns `status: 'SUCCESS'` when the NPPES adapter returns identity data (see `apps/api/backend/src/services/identity/identityIngestionPipeline.ts:1496-1521`).
- Some later stage inside `executeSourceIngestion`'s try block throws (claim derivation / artifact write / delta detection / alert job). The catch block at line 1476 returns `status: 'FAILED', claimsEmitted: 0`. `artifactId` and `sourceRunId` are still populated because they were assigned before the throw.
- `finalizeSourceResult` then emits `source_complete` with `status: 'FAILED'` even though the orchestrator already holds the authoritative identity payload via `extras`.

## Classification

**FIX LIVE BUT BACKEND STILL MISCLASSIFIES**

The web-side defensive mapping shipped in PR #419 already shows NPPES as source-confirmed in the user's browser. The backend's coarse `status: FAILED` flag still leaks into the SSE event payload, which other consumers (downstream readiness aggregators, audit log readers, anyone building on the same SSE feed) would see as a failure. Bringing the backend truth-state into agreement is the next minimal step.

## Recommended action

Patch `apps/api/backend/src/services/ingest/ingestOrchestrator.ts::finalizeSourceResult` to derive an effective `source_complete` status for NPPES from the identity payload (`displayName + identityStatus !== UNKNOWN + entityId`). When NPPES identity is intact, emit `status: 'SUCCESS'` regardless of the upstream coarse failure flag. OIG / LEIE / PECOS / STATE_BOARD / FSMB / NURSYS are not promoted — those sources have no identity-only success signal.

Add regression tests in `apps/api/backend/__tests__/ingestOrchestrator.test.ts`:
- NPPES identity payload intact + `status: FAILED` from pipeline → emitted `status: SUCCESS`
- NPPES empty payload + `status: FAILED` → emitted `status: FAILED` (preserved)
- OIG / PECOS empty payload + `status: FAILED` → emitted `status: FAILED` (no promotion)
- Persisted `IngestSourceRun.status` for promoted NPPES → `DONE`, `errorCode: null`

After backend patch lands and the `delightful-essence` API service redeploys, re-capture the live SSE event for NPI 1699264564 and verify the `status: SUCCESS` outcome.

## Out of scope

- DNS, domain bindings, Railway env vars
- Railway service config (the "Edited / 2 Changes" staged badge is flagged for operator review, not touched here)
- Re-touching web-side mapping (PR #419 already correct; the defensive guard stays in place even after backend lands its agreement fix)
- OIG / PECOS adapter wiring (those lanes remain "not connected in this build" until live integrations are added in a separate wave)
- Auth/CORS regression on `/api/ingest/*` observed during operator probe (file separately if relevant)
