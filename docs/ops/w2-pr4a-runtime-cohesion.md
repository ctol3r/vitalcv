# W2-PR4A - Runtime Trust Cohesion

**Wave:** W2-PR4A - Runtime Trust Cohesion Hardening
**Date:** 2026-05-09
**Status:** Implemented on the W2 employer-review runtime seam. No merge performed.
**Risk class:** SAFE for the touched surfaces.

## Grounding

Implementation was grounded against:

- The W2 artifact bundle already in `docs/ops/`, especially PR1 route classification, PR2B adversarial review/simulation, and PR3C/PR3D truth/coherence reviews.
- `https://vitalcv.com` public surface as the live product target.
- `https://github.com/ctol3r/vitalcv` as the canonical repository.

## Scope

PR4A hardens runtime cohesion without changing Prisma schema. The change writes normalized runtime metadata into existing JSON audit metadata and forwards correlation headers across the web proxy.

In scope:

- `POST /api/employer-review/:entityId/accept`
- `POST /api/employer-review/:entityId/request-refresh`
- `POST /api/employer-review/:entityId/route-to-review`
- `GET /api/employer-review/:entityId/packet`
- `POST /api/employer-review/:entityId/share-packet`
- `POST /api/employer-review/:entityId/confirm-start`
- `GET /api/employer-review/share-token/:token`
- Decision replay output from `replayEngine`

Out of scope:

- Schema-level replay dedupe indexes.
- New RBAC or tenant ownership enforcement.
- Non-employer-review mutation families.
- Prisma migrations.

## Runtime Metadata Contract

Every successful mutation audit row in the touched seam now carries:

| Field | Meaning |
|---|---|
| `correlationId` | Request trace ID, forwarded from the web proxy when present or generated server-side. |
| `mutationFingerprint` | Replay-stable SHA-256 fingerprint derived from action, actor, entity, and redacted payload hash. |
| `actor` | Normalized actor attribution with `actorId`, `actorType`, and `attributionSource`. |
| `mutationClassification` | Canonical mutation taxonomy used by routes, audit metadata, and replay traces. |
| `replayCategory` | `R-CAT-*` replay bucket. |
| `payloadHash` | SHA-256 of a redacted payload envelope. |
| `runtimeTrust` | Full normalized metadata envelope for consumers that prefer one nested object. |

## Runtime Taxonomy

| Action family | Mutation classification | Replay category |
|---|---|---|
| Accept | `TRUST_ACCEPTANCE` | `R-CAT-1` |
| Request refresh | `TRUST_REFRESH_REQUEST` | `R-CAT-2` |
| Route to review | `TRUST_REVIEW_ROUTING` | `R-CAT-2` |
| Packet export | `TRUST_PACKET_EXPORT` | `R-CAT-3` |
| Share packet | `TRUST_PACKET_SHARE` | `R-CAT-3` |
| Confirm start | `TRUST_START_ATTESTATION` | `R-CAT-4` |
| Denied mutation | `DENIED_MUTATION` | `R-CAT-5` |
| Dossier replay | `DOSSIER_REPLAY` | `R-CAT-6` |

## Cohesion Gains

- Route handlers and service-level audit writers now use the same helper: `apps/api/backend/src/services/runtimeTrustCohesion.ts`.
- Employer-review action audit rows include runtime metadata in both nested `employerReviewAction` records and downstream outbox payloads.
- Packet export, share packet, and confirm-start were brought into the same taxonomy instead of emitting bespoke metadata only.
- Share-token resolution now preserves scoped context in `reviewHref` when `organizationContextId` / `bundleId` are present.
- The Next.js proxy forwards `x-correlation-id` and readonly-role hints to the backend.

## Verification

Focused tests were added or updated for:

- Payload hash propagation and replay-stable mutation fingerprints.
- Replay category consistency for `R-CAT-1` through `R-CAT-6`.
- Denial-path telemetry and audit metadata.
- Mutation classification normalization.
- Proxy and backend correlation survivability.

Commands:

```bash
DATABASE_URL='postgresql://user:pass@localhost:5432/vitalcv_test' pnpm exec jest src/services/__tests__/runtimeTrustCohesion.test.ts src/routes/__tests__/employerActions.test.ts src/services/entity/__tests__/employerReviewActions.test.ts src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts --runInBand
pnpm exec vitest run __tests__/employer-review-proxy.test.ts
```

## Remaining Inconsistencies

- Replay dedupe is metadata-only. The W2-PR2B schema-level unique index on actor and payload hash remains a separate required hardening step.
- Pre-subject validation failures and unauthenticated failures still cannot always write a subject-bound audit row because the clinician NPI/entity may be unknown.
- Mutation families outside the W2 employer-review seam still need a sweep before repo-wide "all mutations" can be claimed.
