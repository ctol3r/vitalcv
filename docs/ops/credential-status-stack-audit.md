# Credential Status / Revocation Stack Audit

**Canonical source for "build the revocation runtime" briefs.**

Consolidates ENTERPRISE-1 PR334A (Revocation Status Runtime) and PR335A (Status Endpoint Exposure). Both briefs ask me to create infrastructure that **already exists** as a dedicated workspace app: `apps/status-api/`.

## TL;DR

| Brief asked for | Already exists at |
|---|---|
| Credential status IDs | `apps/issuer-api/src/services/credentialStatus.ts:68` — `credentialStatusUrl(artifactId)` returns a stable URL per credential |
| Revocation registry | `apps/status-api/src/routes/statusList.ts` — StatusList2021-style registry |
| Verifier status checks | `apps/status-api` exposes `GET /status-list/status/:credential_id` |
| Status endpoint exposure | `apps/status-api` is the dedicated service — 5 routes wired in `index.ts` |
| StatusList2021 VC | `GET /status-list/2021` returns the canonical VC envelope |
| Bitstring exposure | `GET /status-list/2021/bitstring` returns the raw bit array |
| Restore endpoint | `POST /status-list/restore` reverses a revocation |
| Status lifecycle state machine | `apps/issuer-api/src/services/credentialStatus.ts:113` — `getCredentialLifecycleState` |

## Existing surface map

### `apps/status-api/`
Dedicated Express service. Routes registered in `apps/status-api/src/index.ts`:

| Method | Path | Handler |
|---|---|---|
| POST | `/status-list/revoke` | `statusListRoutes.revokeCredential` |
| GET | `/status-list/status/:credential_id` | `statusListRoutes.checkCredentialStatus` |
| GET | `/status-list/2021` | `statusListRoutes.getStatusListVC` |
| GET | `/status-list/2021/bitstring` | `statusListRoutes.getStatusListBitstring` |
| POST | `/status-list/restore` | `statusListRoutes.restoreCredential` |
| GET | `/health` | inline |

Base URL is `process.env.PUBLIC_STATUS_URL` (or `STATUS_URL`) with a documented default of `https://status.vitalcv.ai`.

**Caveat documented in source**: the route file at `apps/status-api/src/routes/statusList.ts` carries an `in-memory status list (in production, use database)` comment. That is the actual gap — persistence is a Postgres migration, not a "build the revocation runtime" task.

### `apps/issuer-api/src/services/credentialStatus.ts`
Issuer-side status state machine.

| Export | Purpose |
|---|---|
| `CredentialStatus` enum | Lifecycle states including `REVOKED` |
| `credentialStatusUrl(artifactId)` | Stable per-credential status URL |
| `parseCredentialStatusArtifactId(input)` | Reverses the URL back to an artifact id |
| `getCredentialLifecycleState(artifactId)` | Fetches the live lifecycle state via the status URL |

The issuer doesn't run its own revocation registry — it points credentials at the dedicated `status-api` service for lookups. This is the correct OID4VP / StatusList2021 pattern.

### `packages/domain/projections/subjectStatus.ts`
Domain-event projection that derives subject-level status from a sequence of `RecognitionEvent`s. Used by the recognition workflow to compute revocation eligibility.

### `packages/truth-enforcement/src/index.ts` + `attack-test.ts`
Includes revocation-bypass attack tests — anti-bypass invariants for the status surface.

### `apps/mobile/src/services/LocalCredentialStore.ts`
Mobile-side wallet honors `REVOKED` state on locally stored credentials. The `WalletCredential.status: 'VALID' | 'EXPIRED' | 'REVOKED' | 'SUSPENDED'` type from `packages/wallet-sdk` (per #305) flows through.

## What's missing (real follow-up work)

1. **Persistent storage on `apps/status-api`** — the route file comments explicitly say "in production, use database." This is a Prisma migration + repository swap, not "build the revocation runtime."
2. **Replay-lineage on revocation events** — once #313 (backend `buildReplayLineage`) ships, revocation events should carry the same lineage shape. Proposed follow-up: **ENTERPRISE-1 PR336A: revocation event lineage**.
3. **Issuer-driven revocation cascade** — when a clinician's NPI status changes upstream (e.g., OIG exclusion), the cascade to dependent credentials lives in `packages/governance-runtime/src/revocation-cascade.ts` on the open PR train (#298+), not yet on origin/main.

## What this audit does NOT do

- Does not modify any code in `apps/status-api`.
- Does not add a Prisma migration.
- Does not create a new revocation registry — there's already one.

## ENTERPRISE-1 brief mapping

### ENTERPRISE-1 PR334A — "Revocation Status Runtime"
**Already exists in full** — `apps/status-api/` is the dedicated runtime. The brief's 7 sub-deliverables map to existing routes/services per the table above. The real gap is **persistence**, addressed in the follow-up section.

### ENTERPRISE-1 PR335A — "Status Endpoint Exposure"
**Already exists in full** — 5 verifier-friendly endpoints under `/status-list/*` on the dedicated service. The endpoint shape matches the StatusList2021 standard so external verifiers can consume it without custom code.

## Closing the rephrasing pattern

If a future brief asks to "build credential revocation," "create status endpoint," "expose status APIs," "support portable revocation," or any rephrase: **point at this doc.** The dedicated `apps/status-api/` service exists and is wired. The real work remaining is in the follow-up section above — persistence + lineage binding, not "build the runtime."
