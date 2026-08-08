# source-health

Operational health for upstream credentialing sources (NPPES, OIG/LEIE, PECOS,
state boards).

> **Scope, in plain words:** this module reports whether a source is currently
> reachable. It does **not** make verification, certification, or compliance
> claims about provider data. Verification chrome (e.g. "VERIFIED") MUST NOT be
> driven by this module's output for non-`LIVE` states.

## State machine

| State          | Meaning                                                              | `isHealthy` | `canEvidenceBeUpgraded` |
| -------------- | -------------------------------------------------------------------- | ----------- | ----------------------- |
| `LIVE`         | Last probe got a 2xx response.                                       | true        | **true**                |
| `DEGRADED`     | Last probe got a 5xx response (server error).                        | false       | false                   |
| `UNAVAILABLE`  | Network error, timeout, or no response.                              | false       | false                   |
| `RATE_LIMITED` | Last probe got a 429.                                                | false       | false                   |
| `UNKNOWN`      | No reading, or response we cannot classify (no status, etc.).        | false       | false                   |

Truth invariant (encoded as predicates and tested in
`__tests__/source-health/sourceHealth.truthTable.test.ts`):

- `canEvidenceBeUpgraded(state)` is `true` **only** when `state === 'LIVE'`.
- `isHealthy(state)` is `true` **only** when `state === 'LIVE'`. `DEGRADED` is
  *not* healthy.

A 4 × 5 truth table (`SourceId × SourceHealthState`) is exhaustively tested.

## Banned-phrase contract

`unavailableLane()` produces user-facing copy via a deterministic table per
`(sourceId, state)`. The output **must never** contain any of the following
(case-insensitive), enforced by
`__tests__/source-health/unavailableLane.bannedPhrases.test.ts`:

- `real-time`, `real time`
- `live verification`
- `guaranteed`
- `always available`
- `verified`, `certified`
- `instant`
- `tamper-proof`
- `hipaa compliant`
- `soc2 certified`
- `ncqa verified`

If you need to update copy, edit the `copyFor()` table in
`unavailableLane.ts`. Do **not** weaken the banned-phrase test.

## Probes

Each probe under `probes/` exports `async function probe(deps)` and returns a
`SourceHealthSnapshot`. All probes:

- accept dependency-injected `fetchImpl`, `now`, and `timeoutMs` for tests
- never throw — failures are absorbed and reflected in `state` / `reason`
- delegate state classification to `runProbe()` so mappings are consistent

State mapping (in `runProbe.ts`):

| Outcome                  | State          |
| ------------------------ | -------------- |
| 2xx                      | `LIVE`         |
| 429                      | `RATE_LIMITED` |
| 5xx                      | `DEGRADED`     |
| network error / timeout  | `UNAVAILABLE`  |
| anything else            | `UNKNOWN`      |

The state-board probe is intentionally a no-op until per-state probes are
wired; it returns `UNKNOWN`. We do **not** fake `LIVE`.

## Aggregator

`aggregateLaneHealth(snapshots)` is pure and deterministic. It returns:

- `snapshots` — defensive copy of the input
- `unavailableLanes` — one `UnavailableLane` per non-`LIVE` snapshot, in
  input order
- `allHealthy` — `true` only if the input is non-empty and every snapshot is
  `LIVE`

## How to add a new source

1. Add the new id to `SourceId` in `sourceHealthTypes.ts` and to
   `ALL_SOURCE_IDS`.
2. Add a copy entry for every non-`LIVE` state in `unavailableLane.ts`
   (`SOURCE_DISPLAY_NAME` + `copyFor()` if the language differs).
3. Create `probes/<source>Probe.ts` that calls `runProbe(<id>, fetcher, deps)`.
4. Re-export from `probes/index.ts`.
5. Re-run the truth-table and banned-phrase tests — both iterate
   `ALL_SOURCE_IDS` × `ALL_SOURCE_HEALTH_STATES` and will automatically cover
   the new source.

## What this module does NOT do

- It does not make verification claims.
- It does not certify providers or data.
- It does not promise availability ("always available", "guaranteed", etc.).
- It does not replace the existing `lib/status/sourceOps.ts` ops report; that
  module is a separate, broader operator-facing surface.

## Live Probe Scheduling (RELIABILITY-2)

### Cadence

The cron runs twice hourly at off-peak minutes (`7,37`), not every 15 minutes.
Nothing this probe feeds needs 15-minute resolution: the availability ledger
counts samples rather than wall-clock (a missed tick is UNMEASURED, see
`getLaneAvailability.ts`), its 30-day render gate needs one sample per
distinct day, and the snapshot store has no freshness contract tighter than
"periodically refreshed". GitHub throttles busy schedule minutes hard — the
old `*/15` cron delivered a median gap of 88 minutes — so off-peak minutes
deliver more reliably than a denser request would. Infra failures (runner
never acquired) are retried and reclassified by
`.github/workflows/monitor-rescue.yml`; see the probe workflow header for the
full infra-vs-signal contract.

### Architecture

```
GitHub Actions (cron 2×/hour on main, off-peak minutes)
        │
        │  POST  Authorization: Bearer ${{ secrets.CRON_SECRET }}
        ▼
/api/internal/source-health/probe
        │
        ▼
runAllProbes()  ──► nppesProbe / oigProbe / pecosProbe / stateBoardProbe
        │                          │
        │                          ▼
        │                   runProbe() — classifies
        │                   2xx → LIVE, 5xx → DEGRADED,
        │                   429 → RATE_LIMITED,
        │                   timeout/network → UNAVAILABLE,
        │                   else → UNKNOWN
        ▼
snapshotStore (in-memory, module-scope Map)
        ▲
        │
GET /api/internal/source-health/snapshots ◄── operator/dashboard
getLaneSnapshots() ◄── UI surfaces (UNKNOWN placeholder when cold)
```

### Cold-start truth

Snapshots are ephemeral. Vercel serverless cold starts reset the
in-memory store. This is acceptable for v1; durable persistence is
the next layer. When the store is cold, `getLaneSnapshots()` returns
four UNKNOWN placeholder snapshots — never LIVE — and the
`/snapshots` endpoint returns an empty array with `observedAt: null`.
This is the honest answer.

### Authentication

Both `/api/internal/source-health/probe` and `/snapshots` accept:

- `Authorization: Bearer <CRON_SECRET>` — preferred for scheduled
  callers (GitHub Actions, Vercel Cron).
- `x-monitoring-secret: <MONITORING_SECRET>` — legacy/manual operator
  path consistent with `/api/pilot-kpi-export`.

If neither header matches, the route returns 401. If both env
secrets are unset on the server, the route returns 500
(`no probe auth configured`) — fail closed.

### Secret rotation

`CRON_SECRET`:
1. Generate a new high-entropy value (e.g. `openssl rand -hex 32`).
2. Set the new value in the Vercel project env (Production +
   Preview), then redeploy.
3. Update the matching GitHub Actions repository secret
   `CRON_SECRET`.
4. Trigger a manual `workflow_dispatch` of "Source Health Probe" to
   confirm 200.
5. After confirmation, retire the old value.

`MONITORING_SECRET`:
1. Same generate-and-rotate pattern in Vercel.
2. Update any operator tooling and `/api/pilot-kpi-export` callers
   that depend on this secret. (This module is one consumer; not
   the only one — coordinate with `pilot-ops`.)

### Classification telemetry — required note

> Scheduled probe snapshots are classification telemetry, not
> credential verification and not clinician defects. A `DEGRADED`
> or `UNAVAILABLE` lane reflects upstream source health only — it
> never invalidates a clinician's profile, NPI, or any
> source-backed evidence captured during a `LIVE` window.

### Truth invariant restated

`LIVE` is emitted ONLY by a confirmed 2xx probe response from
`runProbe`. The placeholder seed in `getLaneSnapshots` returns
UNKNOWN for every source and never LIVE. The store never
fabricates a LIVE on cold start.
