# Graph Runtime Notes

## Source of truth

- `graph_nodes` and `graph_edges` hold the durable materialized graph.
- `graph_snapshots` stores global and local query payloads keyed by deterministic filter signatures.
- `graph_build_runs` and `graph_suggestion_batches` act as durable worker/job records.
- `graph_link_suggestions`, `graph_link_decisions`, and `graph_reject_memory` keep AI linking inspectable and suppress repeat spam.

## Invalidation

- Prisma middleware invalidates all persisted graph snapshots when source tables mutate:
  - `PersonProfile`
  - `Organization`
  - `OrganizationProfile`
  - `WorkspaceMembership`
  - `Opportunity`
  - `Application`
  - `VerificationArtifact`
  - `DecisionCapsule`
  - `SourceRecord`
  - `ClaimRecord`
  - `SearchObject`
- Graph services explicitly invalidate snapshots after:
  - rebuild completion
  - AI suggestion generation
  - AI accept/reject decisions
  - manual edge rejection
- Preset and layout persistence does not invalidate graph data; filter schema changes roll forward through `GRAPH_FILTER_SCHEMA_VERSION`.

## Scaling controls

- Query responses are cached in-memory by snapshot signature for 60 seconds.
- Snapshots are durable in Postgres and reused until invalidated.
- Global/local queries support chunking via `limit` + `cursor`.
- Large, high-degree nodes are suggestion-rate-limited in the AI linker.
- `graph_cluster_assignments` persists cluster membership per snapshot and clustering mode.

## Operational notes

- Full rebuilds deactivate stale system/ingest edges and inactive nodes.
- Incremental, per-node, and stale rebuilds attempt targeted scopes first and fall back to full rebuilds when the target scope cannot be resolved safely.
- Reciprocal integrity is validated on rebuild; missing mirrors are surfaced through diagnostics and build warnings.
