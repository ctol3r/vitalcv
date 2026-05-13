# Live Replay Discoverability Audit

**PR-γ TASK 6 deliverable.** Audits replay continuity discoverability
post PR-α + PR-β + PR-γ (this PR), grouped by who can reach each
piece of state.

## §0 — Honest scope note on TASK 5

The brief asked me to verify externally:

```
curl -i https://vitalcv.com/api/replay/runs/by-npi/1346053246
curl -i https://vitalcv.com/api/replay/chain/1346053246
```

I cannot run those probes from this build environment. The probes are
operator-side post-deploy. The expected responses (200 / JSON / shape)
are pinned by:
- Backend `tsc --noEmit` clean
- 42/42 Jest tests passing (pure-function coverage of every helper)
- Web build 13/13 successful

If the operator runs the probes and observes a divergence from the
shapes documented in §1 below, that is a real defect worth diagnosing.

## §1 — Externally discoverable today

Routes that an institutional verifier or operator can hit over HTTP
(no SQL, no internal access) post-deploy:

### Identity surfaces
| Path | Returns |
|---|---|
| `GET /api/replay/[runId]` | `{ run, events }` for a single run |
| `GET /api/replay/[runId]/integrity` | `{ runId, ok: true | false, ...verdict }` |
| `GET /api/replay/lineage/[lineageKey]/runs` (backend) | full chronology of runs for a lineage |
| `GET /api/lineage/[lineageKey]/runs` (web proxy) | same shape |
| `GET /api/replay/lineage/[lineageKey]/receipt` (backend) | receipt-derivation inputs + `derivedJti` |
| `GET /api/receipt/by-lineage/[lineageKey]` (web proxy) | same shape |

### NPI-keyed discovery (NEW in PR-γ)
| Path | Returns |
|---|---|
| `GET /api/replay/runs/by-npi/[npi]` | newest-first run chronology for the canonical entity bound to the NPI |
| `GET /api/replay/chain/[npi]` | per-lineage summary: `lineageKey`, `historyCount`, `latestRunId`, `latestCheckedAt`, `continuityState ∈ {stable, extended, diverged}` |

### Pre-existing surfaces (origin/main, unchanged by this stack)
| Path | Returns |
|---|---|
| `GET /api/health` | `{ status, service, timestamp, config }` |
| `GET /api/.well-known/jwks.json` | legacy-path JWK set |
| `GET /.well-known/apple-app-site-association` | iOS Universal Link manifest |
| `GET /.well-known/assetlinks.json` | Android equivalent |
| `GET /api/decisions/npi/:npi/timeline` | DecisionCapsule-keyed timeline |

## §2 — Still requires DB / operator access

| State | Why it's not yet externally discoverable |
|---|---|
| Receipt JWT issuance log (which jti was issued at T?) | No `IssuedReceipt` table exists. Receipt signing is on-demand from runtime state; no persistence by jti. |
| Per-run event chronology populated with real events | The `ReplayEvent` table exists but the orchestrator's PR-β writer only records the `ReplayRun` row, not per-source events. Decoded events surface today is empty (`events: []` on `GET /api/replay/[runId]`). |
| Direct query "give me all entities for a given lineageKey" | No reverse index exposed. Walk via `GET /api/replay/lineage/:lineageKey/runs` + read `entityId` from each row. |
| Continuity reconciler ("what changed between lineageKey A and lineageKey B for entity E?") | No dedicated endpoint; derivable by walking `GET /api/replay/chain/:npi` and diffing the `artifactChecksums` of the latest run of each lineage. |
| ReplayRun rows for entities that have never been ingested | Discovery endpoints return `{ entityId: null, runs: [] }` — by design, since the entity row doesn't exist yet. Operator who wants to seed an entity must do it via the normal ingest path. |

## §3 — Institutionally inspectable

The full institutional traversal an external auditor (CVO, NCQA reviewer,
Joint Commission) can perform with only the NPI:

```
1. Identity   → GET /api/replay/chain/<npi>
                returns lineages[] with historyCount + latestRunId + continuityState

2. Drill-in   → GET /api/replay/runs/by-npi/<npi>
                returns full run chronology with decoded sourceSummary
                + status (DONE / PARTIAL_ERROR / MIXED / UNKNOWN)

3. Specific run → GET /api/replay/<runId>
                returns { run, events } with run-level identity columns

4. Lineage    → GET /api/lineage/<lineageKey>/runs
                returns the canonical chronology bound to that lineage

5. Receipt    → GET /api/receipt/by-lineage/<lineageKey>
                returns the deterministic derivation payload
                (runId, payloadDigest, derivedJti = receipt:<runId>)

6. Integrity  → GET /api/replay/<runId>/integrity
                returns { ok: true | false, ...verdict on tampering }
```

Every step is JSON, every step is a single HTTP request, no schema
knowledge required beyond the documented field names.

## §4 — Still opaque

| State | Opaqueness reason |
|---|---|
| Receipt signature continuity across deploys when `RECEIPT_PRIVATE_KEY_JWK` env unset | Operator-side env, unchanged. Verifier can detect signature drift via kid changes in `/api/.well-known/jwks.json`, but cannot pre-validate without prior knowledge of the expected kid. |
| Lane-health continuity | `LaneHealthMount` reads from a memory-keyed snapshot store; the operator-reported "Unavailable" symptom is unchanged until the probe runner is scheduled. Not a replay-stack issue. |
| Why a particular lineage diverged (the artifact-set delta) | The `continuityState: diverged` flag fires on the chain endpoint, but the specific artifact-checksum delta between the prior and current lineage is not yet exposed as a single endpoint (derivable client-side). |
| Whether a receipt was ever revoked | No revocation list exists. |

## §5 — Required final answers

### 1. What replay continuity is externally discoverable now?

The NPI-keyed walk is fully traversable: an auditor with only the NPI
can pull the full run chronology, group by lineage, see per-lineage
continuity state (stable / extended / diverged), drill into a specific
run, verify integrity, and derive the canonical receipt input — all
via JSON HTTP requests, no SQL, no internal access.

### 2. What continuity still requires DB access?

- Reverse lineage → entities query (one-to-many that's not exposed).
- The raw `artifactChecksums` string array on a ReplayRun row is decoded
  on the wire today, but the underlying string format itself is internal
  knowledge.
- Direct correlation between a `replay_writer_failed` warning in backend
  logs and the specific NPI that failed (requires log access).

### 3. What continuity is institutionally inspectable?

The six-step traversal in §3. An institutional verifier can rebuild
the full replay topology for any NPI without prior coordination.

### 4. What continuity remains opaque?

- Per-event chronology (the `ReplayEvent` table exists but is unpopulated
  by the current orchestrator writer — events array is empty in
  `GET /api/replay/[runId]`).
- Pre-deploy receipt validity guarantees (requires stable kid → requires
  the operator to set `RECEIPT_PRIVATE_KEY_JWK`).
- The specific artifact-set delta when `continuityState: diverged` —
  derivable client-side but not a single endpoint.

### 5. What blocks self-contained verifier replay continuity?

In dependency order:

1. **Event writer integration** — the orchestrator records the `ReplayRun`
   row but does not yet record per-source events into `ReplayEvent`.
   Once it does, the `events: []` array becomes populated and
   per-event chronology becomes inspectable. Estimate: 1 PR.
2. **Receipt-issuance persistence by `jti`** — without an `IssuedReceipt`
   table, "was this receipt issued at T?" is unanswerable. Estimate: 1 PR.
3. **`priorJti` / `priorLineageKey` claim on signed receipts** — closes
   the in-receipt continuity gap. Estimate: 1 PR (touches the receipt-
   signing path on the unmerged #349 stack).
4. **Continuity reconciler endpoint** — exposes the artifact-set delta
   for diverged lineages as a single call. Estimate: 1 PR.
5. **Writer expansion to non-orchestrator ingest sites** — wire the
   same fire-and-forget call into `/api/passport/[npi]/refresh` and any
   other ingest entry. Estimate: 1 PR per site (~5 lines each).
6. **Operator-side closures already enumerated** — Vercel env, Railway
   seed, codex exec, scheduled cron.

No new architecture required. All six items are pre-designed in prior
audits on PR #358.

## §6 — Verdict

The combined PR (α + β + γ) makes replay continuity **externally
navigable from the NPI alone**. The remaining gap to self-contained
institutional verifier continuity is the six-step engineering backlog
above plus the operator-side closures, none of which require new
product concepts.
