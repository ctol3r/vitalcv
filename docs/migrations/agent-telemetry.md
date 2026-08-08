# Migration: `20260807000000_agent_telemetry`

Founder Wave A0 — Start Agent run telemetry. Three new tables backing the
learning chain `plan version → action → owner → outcome → elapsed time`.
No `prisma migrate dev` was run; the SQL is hand-written with
`CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` and a guarded
`DO $$` block for the foreign keys, so existing databases no-op on redeploy.
Applied twice against a fresh Postgres 16 locally: clean on first apply,
all-skips on second.

## Tables

### `agent_runs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID PK | app-generated (`randomUUID()`), no DB default |
| `plan_id` | TEXT | deterministic content hash `plan_<hex>` — deliberately NOT a UUID column |
| `subject_ref` | TEXT | opaque subject key (A0 route: Clerk user id) |
| `npi` | TEXT NULL | public-registry key when supplied |
| `context_class` | TEXT | e.g. `holder_api`, `bench_fixture` |
| `context_fingerprint` | TEXT | sha256 prefix of the consumed context |
| `policy_version` / `toolset_version` / `model_version` | TEXT (last NULL) | versioned provenance for replay/compare |
| `blockers` / `candidate_actions` / `ranked_action_ids` / `input_gaps` | JSONB | structured plan payloads — evidence REFS + template text only |
| `selected_action_id` | TEXT NULL | top of the ranked list |
| `confidence` | DOUBLE PRECISION NULL | reserved; the deterministic v1 policy writes none |
| `generated_at` / `created_at` | TIMESTAMP(3) | plan clock / row clock |

### `agent_run_actions`

One row per candidate action (`run_id` FK → `agent_runs`, `ON DELETE CASCADE`):
`action_id`, `action_type`, `owner`, `permission`, `status`, `priority`,
`rank_tier`, `created_at`. Exists so outcome learning can join on
owner/permission/type without unpacking JSONB.

### `agent_events`

Append-only outcome events (`run_id` nullable FK): `plan_id`, `subject_ref`,
`action_id`, `event_type` (vocabulary enforced in
`apps/web/lib/agent/telemetry/events.ts`), `owner`, `outcome`, `elapsed_ms`,
`related_kind` + `related_ref` (forward references for application /
interview / offer / accepted offer / start), `metadata`, `created_at`.

## Invariants

- Web writes go through `apps/web/lib/agent/telemetry/agent-run-store.ts`
  only, paired with an `AuditEvent` append (`agent.plan_generated`) in the
  same transaction, and degrade to `{ persisted: false }` pre-migration.
- No raw credential text, secrets, or document blobs may enter the JSONB
  columns — the `StartPlan` type carries only evidence refs and
  template-authored text, and the model-context tests pin the exclusions.
- Rows are never updated or deleted by product code; telemetry is
  append-only history.

## Rollback

```sql
DROP TABLE IF EXISTS "agent_events";
DROP TABLE IF EXISTS "agent_run_actions";
DROP TABLE IF EXISTS "agent_runs";
```
