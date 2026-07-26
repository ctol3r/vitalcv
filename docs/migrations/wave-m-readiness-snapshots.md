# Wave M — ReadinessSnapshot (persisted reusable readiness snapshot)

**Status:** SQL plan checked in; NOT executed. Lands via the standard
`prisma migrate deploy` on the backend Railway service (same pending queue as
the Wave K/Q migrations). No `prisma migrate dev` was run.

**Migration:** `apps/api/backend/prisma/migrations/20260705150000_readiness_snapshots/migration.sql`

## What it adds

One table, `ReadinessSnapshot` — the share-once / reuse-by-many evidence
artifact. A row is issued at apply-share time (inside
`applyShareService.shareBundle`) and served to any number of reviewers via
`GET /api/snapshot/:id`.

| column               | type          | notes                                             |
| -------------------- | ------------- | ------------------------------------------------- |
| id                   | UUID PK       | capability id; generated client-side by Prisma    |
| npi                  | TEXT          | subject clinician (public identifier)             |
| entityId             | UUID NULL     | resolved VcvEntity at issue time                  |
| bundleId             | UUID NULL     | the apply bundle this snapshot was issued with    |
| contentHash          | TEXT          | sha256 over the canonical content — immutability pin |
| content              | JSONB         | readiness summary + canonical source-coverage report, as issued |
| scope                | JSONB NULL    | {organizationId, organizationName, purposeOfUse} at issue |
| issuedAt             | TIMESTAMP(3)  |                                                   |
| revokedAt            | TIMESTAMP(3)  | direct snapshot revocation                        |
| revokedByClerkUserId | TEXT NULL     |                                                   |

Indexes: `(npi, issuedAt)`, `(bundleId)`, `(contentHash)`.

## Invariants

- **Immutable content.** `content` is never updated; `contentHash` pins it.
  Freshness (stale-beyond-SLA per `sourceCatalog.refreshSlaHours`) is computed
  at read time as an overlay in the response, never written back.
- **Every access audited.** Each `GET /api/snapshot/:id` writes an
  `AuditEvent` — `snapshot.accessed` on success, `snapshot.access_denied` on
  fail-closed reads (revoked / unknown).
- **Revoked fails closed.** Own `revokedAt`, or any revoked
  `BundleShareEvent` for the linked `bundleId` (the clinician's existing
  share-revoke control), returns 410 with no content.
- **Zero PHI / zero on-chain writes.** Content is readiness states, source
  ids, and timestamps only.
- **Deploy-order safe.** Until this migration deploys, snapshot issuance
  inside the share flow degrades to `readinessSnapshotId: null` and sharing
  proceeds unchanged.

## Rollback

```sql
DROP TABLE IF EXISTS "ReadinessSnapshot";
```

No other objects are created; nothing references the table by FK.
