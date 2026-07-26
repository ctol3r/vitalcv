# Wave Q — PilotLead (durable commercial lead capture)

**Status:** SQL plan checked in; NOT executed. Lands via the standard
`prisma migrate deploy` on the backend Railway service (same pending queue as
the signup-gate and Wave K migrations). No `prisma migrate dev` was run.

**Migration:** `apps/api/backend/prisma/migrations/20260705120000_pilot_leads/migration.sql`

## What it adds

One table, `PilotLead` — a durable row per submitted pilot request
(`/pilot` → `POST /api/pilot-request`) or pilot intake
(`/contact` → `POST /api/pilot-intake`), in addition to the existing Slack +
stdout delivery, which stays.

| column         | type          | notes                                        |
| -------------- | ------------- | -------------------------------------------- |
| id             | UUID PK       | generated client-side by Prisma (no DB default) |
| source         | TEXT          | `pilot_request` \| `pilot_intake`            |
| persona        | TEXT NULL     | intake persona (cvo, payer, …, concierge)    |
| organization   | TEXT          | buyer organization name                      |
| contactName    | TEXT NULL     |                                              |
| email          | TEXT          | contact email                                |
| message        | TEXT NULL     | free-text description                        |
| workflowTarget | TEXT NULL     | e.g. "Credentialing review"                  |
| sourceContext  | TEXT NULL     | originating surface (/pilot, /contact, …)    |
| payload        | JSONB         | full sanitized submission / structured record |
| slackDelivered | BOOLEAN       | operational delivery status (default false)  |
| createdAt      | TIMESTAMP(3)  | insert time                                  |

Indexes: `(createdAt)`, `(source, createdAt)`, `(email)`.

## Invariants

- **Audit-first.** Every insert is paired with an `AuditEvent`
  (`type = 'pilot.lead_captured'`) in the same transaction.
- **Never evidence.** Rows are buyer contact context only — no clinician
  credentials, no verification state, no trust-state inputs.
- **Deploy-order safe.** Until this migration deploys, both routes keep their
  existing behavior (stdout + Slack) and report `persisted: false` — a missing
  table never breaks lead capture.
- `slackDelivered` is operational status and may be updated after insert; the
  immutable trail is the AuditEvent.

## Rollback

```sql
DROP TABLE IF EXISTS "PilotLead";
```

No other objects are created; nothing references the table by FK.
