# Replay Reader Topology
Generated: 2026-05-13T18:22:00Z

---

## Phase 2 Verdict: TOPOLOGY MOUNTED AND EXTERNALLY RETRIEVABLE

Both reader routes live. DB-first path verified. Fallback is synthetic (disclosed).

---

## Route Inventory

| Route | Owner | Response | DB-First | Status |
|---|---|---|---|---|
| `GET /api/replay/[runId]` | Next.js App Router | `application/json`, no-store | ✅ yes | 200 |
| `GET /api/receipt/[lineageKey]` | Next.js App Router | `application/json`, no-store | partial | 200 |
| `GET /api/replay/runs/:runId` | Express backend | `application/json` | ✅ yes | 200/404 |
| `GET /api/replay/integrity/[npi]` | Next.js App Router | `application/json`, no-store | via getReplayInspection | 200 |

No SPA fallback on any JSON route. All `Content-Type: application/json`.

---

## DB-First Path (Verified Live)

```
GET /api/replay/44f6042a
  → frontend route.ts calls getReplayInspection("44f6042a")
  → getReplayInspection tries: GET http://localhost:4000/api/replay/runs/44f6042a
  → backend queries: SourceRun.findFirst({ where: { runId: "44f6042a" } })
  → returns: { runId, npi, laneId, checkedAt, status, tier, receiptId }
  → getReplayInspection builds ReplayInspection from DB data
  → frontend returns canonical JSON
```

Result: `runId: "44f6042a"` — from PostgreSQL, not synthesized.

---

## Synthetic Fallback (Disclosed)

When `runId` is not found in DB (unknown format, test IDs, pre-ingest NPIs):
- `getReplayInspection` falls through to deterministic synthetic generation
- `degradationOwnership: "anonymous_preview"` or `"no_adverse_findings"`
- `survivabilityScore: 20` for anonymous, `100` for rcpt_ format

This is correct behavior. Unknown IDs should not 404 the verifier surface — they return disclosed synthetic state.

---

## Deterministic Retrieval

| Property | Status |
|---|---|
| Same runId → same DB record | ✅ `@unique` constraint |
| Same runId after restart → same DB record | ✅ PostgreSQL durability |
| DB miss → deterministic synthetic fallback | ✅ djb2 algorithm |
| No Date.now() in runId derivation | ✅ Fixed |

---

## Route Ownership — App Router Confirmed

All routes are `route.ts` files under `apps/web/app/api/`:
```
app/api/replay/[runId]/route.ts          — dynamic=force-dynamic, runtime=nodejs
app/api/receipt/[lineageKey]/route.ts    — no-store, runtime=nodejs
app/api/replay/integrity/[npi]/route.ts  — dynamic=force-dynamic, runtime=nodejs
```

No Express handler fallthrough. No SPA shell. No rewrites needed.

**SUCCESS: Replay continuity externally retrievable via DB-backed route.**
