# Wave K — OpportunityAction (server-persisted clinician opportunity actions)

**Status:** SQL plan checked in; NOT executed. Lands via the standard
`prisma migrate deploy` on the backend Railway service (same pending queue as
the 2026-07-04 signup-gate migrations). No `prisma migrate dev` was run.

**Migration:** `apps/api/backend/prisma/migrations/20260705000000_opportunity_actions/migration.sql`

## What it adds

One append-only table, `OpportunityAction` — the clinician's Save / Connect /
Decline decisions on MATCHA opportunities, keyed by the authenticated Clerk
user id (identity from Clerk `auth()` in the web route, never a caller-supplied
header).

| column        | type         | notes                                          |
| ------------- | ------------ | ---------------------------------------------- |
| id            | UUID PK      | generated client-side by Prisma (no DB default — fleet Postgres has no `gen_random_uuid`) |
| clerkUserId   | TEXT         | acting clinician (Clerk user id)               |
| npi           | TEXT NULL    | NPI in context at action time, when known      |
| opportunityId | TEXT         | MATCHA opportunity id (string key, not an FK)  |
| action        | TEXT         | `saved` \| `connected` \| `declined` \| `cleared` |
| source        | TEXT         | producing surface, default `web`               |
| createdAt     | TIMESTAMP(3) | insert time                                    |

Indexes: `(clerkUserId, opportunityId, createdAt)`, `(opportunityId)`,
`(createdAt)`.

## Invariants

- **Append-only.** Every decision — including clearing one back to "new" via
  `action = 'cleared'` — inserts a NEW row. Rows are never updated or deleted.
  Current state = latest row per `(clerkUserId, opportunityId)`.
- **Audit-first.** Every insert is paired with an `AuditEvent` row
  (`type = 'MATCHA_OPPORTUNITY_ACTION'`) in the same transaction.
- **Not evidence.** Rows are the clinician's own workflow decisions — never
  credentials, never verification state, never inputs to trust-state/CRS.
- **Deploy-order safe.** Until this migration deploys, the web route degrades
  to `persisted: false` and the client keeps its localStorage cache — no 500s
  in the signed-in experience (same pattern as `MatchaPreference`, PR #534).

## Rollback

```sql
DROP TABLE IF EXISTS "OpportunityAction";
```

No other objects are created; nothing references the table by FK.
