# Migration: `20260807120000_agent_consents`

Founder Wave A1 — the agent consent ledger. One table backing Level-3
consented execution. No `prisma migrate dev` was run; the SQL is hand-written
with `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`. Applied
twice against a fresh Postgres 16 locally: clean on first apply, all-skips on
second.

## Table `agent_consent_events`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID PK | app-generated (`randomUUID()`), no DB default |
| `subject_ref` | TEXT | clinician subject key (Clerk user id on the web path) |
| `scope` | TEXT | e.g. `share_packet:opportunity:opp-42` |
| `kind` | TEXT | `granted` \| `revoked` |
| `seq` | INTEGER | per-(subject_ref, scope) monotonic counter; **UNIQUE with (subject_ref, scope)** |
| `event_hash` | TEXT | sha256 over the event **including its id and seq** |
| `action_id` / `plan_id` | TEXT NULL | provenance for which plan/action prompted the decision |
| `metadata` | JSONB | |
| `created_at` | TIMESTAMP(3) | |

Indexes: a **UNIQUE** index on `(subject_ref, scope, seq)` — load-bearing, see
below — plus `(subject_ref, scope, seq)` for the fold and `(created_at)` for
sweeps.

## Why `seq` exists

Authorization state must not be decided by `created_at` (millisecond
resolution, so ties are real) or by uuid tiebreak (random, so the "latest"
row chosen that way is arbitrary). Each event carries a per-(subject_ref,
scope) monotonic `seq`, and the unique constraint is what **serializes**
concurrent transitions: appending reads the head and inserts at `head.seq +
1`, so two racing appends compute the same `seq` and exactly one survives.
The loser's transaction rolls back whole — audit row included — and retries
against the new head.

Proven against real Postgres in
`apps/web/__tests__/start-agent-consent-db.test.ts`: simultaneous grants
produce exactly one event, grant-vs-revoke and revoke-vs-re-grant land in a
definite order with a dense gapless `seq`, and dropping the unique index
makes those tests fail (the constraint is load-bearing, not decorative).

## Why a new table rather than extending `ConsentGrant`

`ConsentGrant` (`consent_grants`) remains the canonical **disclosure** record
bound to a sealed packet and handoff receipt. It cannot serve as an agent
authorization ledger:

- its `grant_hash` is content-addressed over the grant, so a
  grant → revoke → re-grant cycle collides with the original hash and returns
  the revoked row — the cycle is structurally unrepresentable;
- `organization_id`, `recipient`, `purpose`, and `action` are NOT NULL and
  cannot be populated at plan time, before a packet or employer row exists;
- `scope` is unindexed JSON, and nothing in the repo writes its `revoked_at`.

Retrofitting it would also mutate hash-verified records that
`HandoffReceipt` and `ApplicationPacket` replay against.

The split: **`agent_consent_events` answers "may the agent run this?"**;
when a share is actually exercised, the canonical capability
(`POST /api/apply/share`) writes its own bundle, share event, and audit
trail, and the agent's completion event references those ids.

## Invariants

- Append-only. Rows are never updated or deleted; revocation is a new row.
- Written only through `apps/web/lib/agent/consent/consent-store.ts`,
  audit-first in one transaction (`agent.consent_granted` /
  `agent.consent_revoked`).
- Consent writes are **strict**: a failed write returns `persisted: false`
  and the route answers 503. Unlike telemetry, there is no degrade-to-ok
  path for an authorization.
- Revoking a scope gates FUTURE agent execution only. It does not recall a
  share that already ran — that remains the `BundleShareEvent` revocation
  surface, and the two are deliberately separate.

## Rollback

```sql
DROP TABLE IF EXISTS "agent_consent_events";
```
