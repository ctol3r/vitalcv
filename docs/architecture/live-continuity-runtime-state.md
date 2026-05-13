# Live Continuity Runtime State

**PR-β TASK 7 deliverable.** Describes the continuity state of the
combined PR-α + PR-β stack on `wave/replay-alpha-foundation` (post-PR-β
commit). Honest about what this PR ships vs what only an actual
deploy + live ingest run can verify.

## §0 — Honest scope note on TASKs 4–6

PR-β's brief asked me to:
- TASK 4: "Run one real ingest flow" → verify `ReplayRun` populated, etc.
- TASK 5: "Simulate Prisma failure, missing tables, DB disconnect..."
- TASK 6: "Verify continuity survives restart"

These three tasks require a live deployed environment with the
migration applied. I cannot perform them from this build environment:
no Railway DB, no production NPI flow, no apex Vercel proxy. The
code that MAKES those verifications meaningful is what this PR ships.
The verifications themselves are operator-side and must run post-deploy.

What I CAN attest from inside the build:
- Backend `tsc --noEmit` clean
- 30/30 Jest pure-function tests pass (replay identity + ingest input builder)
- Web build 13/13 successful

What only the operator can attest post-deploy:
- A real `/api/ingest/[npi]` flow populates `ReplayRun`
- `GET /api/replay/lineage/<lineageKey>/runs` returns the populated row
- Replay infrastructure stays graceful (503 `replay_infrastructure_unavailable`) if for any reason the migration didn't apply
- Restart leaves the row durable (the durability is a Postgres property; the writer's only contribution is "did we ever write")

## §1 — Continuity classification (post PR-α + PR-β merge, post-migration-applied)

### Durable

- `ReplayRun` rows (Postgres, indexed on lineageKey + entityId + checkedAt)
- `ReplayEvent` rows (Postgres, unique on (replayRunId, sequenceNumber))
- Deterministic `lineageKey` / `runId` generator (`apps/api/backend/src/services/replay/replayIdentity.ts`) — pure SHA-256, no entropy
- Tamper-detection verifier `verifyReplayRunIntegrity` (re-derives identifiers from stored fields)
- 4 GET reader endpoints + 3 web App Router proxies (PR-α)
- The fire-and-forget writer call on the orchestrator success path (PR-β)
- Per-run artifact-checksum-set canonicalization (`buildReplayWriterInputFromIngest`)

### Recoverable

- A `ReplayRun` row whose stored identifiers no longer match the canonical re-derivation can be flagged via `GET /api/replay/runs/:runId/integrity`. Recovery action: re-derive identifiers from authoritative inputs and rewrite the row. (Recovery handler is not in scope for PR-β; the integrity check is the prerequisite.)

### Derivable

- `priorJti` / `priorLineageKey` linkage between consecutive receipts — derivable by querying `findReplayRunsByLineageKey(lineageKey)` and walking the sorted result. Not yet exposed as a single endpoint.
- The full chronology of runs for an entity, given any one lineageKey on that entity — same query.
- The deterministic `jti = 'receipt:' + runId` exposed by `/api/replay/lineage/:lineageKey/receipt`. Signed-JWT issuance from this remains in a future PR.

### Volatile

- ES256 receipt-signing keypair when `RECEIPT_PRIVATE_KEY_JWK` env unset (unchanged from prior audits; operator-side fix).
- `LaneHealthMount` snapshot store when probe runner unscheduled (unchanged; operator-side fix).
- Currently-running fire-and-forget writes — if the Node process crashes between `completeIngestRun(...)` and the writer's actual INSERT, the `ReplayRun` row is lost for that one ingest. The next ingest run recovers (deterministic identifier; no orphan state).

### Absent

- Receipt-issuance persistence by `jti` (no `IssuedReceipt` model; receipts are still signed on-demand).
- Continuity reconciler endpoint that, given two lineageKeys for the same entity, returns the artifact-set delta.
- UI primitives (`TrustHeader`, `ReplayLineage`, etc.) on `origin/main`.
- Replay reader from the web layer using deterministic browser-side identity (no `clientReplayIdentity.ts` in this PR; the schema audit verified its absence).
- Writer integration in `/api/passport/[npi]/refresh` or any other ingest-adjacent surface (only `ingestOrchestrator` is wired in this PR).

## §2 — Required final answers

### 1. What continuity is now materially live?

**Post PR-α merge + migration applied + PR-β merge:**

- The deterministic replay identity (lineageKey + runId) becomes a persisted database record on every successful passport-bound ingest run.
- The chronology of runs for any lineage becomes externally retrievable via `GET /api/lineage/[lineageKey]/runs`.
- The receipt-derivation inputs (canonical jti, payload digest) become externally retrievable via `GET /api/receipt/by-lineage/[lineageKey]`.
- The integrity-check verdict for any persisted run becomes externally retrievable via `GET /api/replay/runs/:runId/integrity`.

In plain terms: an institutional verifier holding a `lineageKey` can hit apex and pull the full ordered run-history for that lineage, with a deterministic receipt-input pointer they can re-derive locally.

### 2. What continuity remains empty topology?

- Receipt JWT signing under the deterministic `jti`. The endpoint emits `derivedJti: 'receipt:<runId>'` but does not return a signed JWT body. Signed-receipt issuance lives in a future PR (the unmerged Lane B / #349 stack contains the signing path).
- Writer integration on ingest paths OTHER than `ingestOrchestrator`. `/api/passport/[npi]/refresh` and any other re-ingest endpoint will not populate the table until they get the same fire-and-forget wiring (each is a small follow-up).
- Continuity reconciler ("what changed between lineage A and lineage B for entity E?"). Derivable from the existing reader; not yet exposed as a single endpoint.

### 3. What continuity still volatile?

- Receipts themselves remain runtime-signed and never persisted by jti. Two re-signings of the same lineageKey produce two different `iat` claims and thus two different JWT bodies even though the canonical jti is identical. Audit-trail-by-jti retrieval is still impossible.
- The fire-and-forget writer can drop one write across a process crash. The system is eventually consistent (next ingest run recovers, deterministic identifier), but a single run's record is volatile under crash.
- Lane-health continuity (unchanged from prior audits; operator-side fix).

### 4. What continuity still operator-dependent?

The same operator-side items from prior audits, unchanged:

- Apex Vercel env vars (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `RECEIPT_PRIVATE_KEY_JWK`, `VITALCV_ISSUER_ORIGIN`)
- Apex probe runner cron (`CRON_SECRET`/`MONITORING_SECRET`)
- Railway production-DB demo seed
- `codex exec` SAFE verdicts on PRs #358 / #360 / #361 / (this PR)
- Railway apply-migrations step on deploy (Prisma's `migrate deploy`)

Specific to PR-β: the operator must verify post-deploy that an
ingest run actually populates a `ReplayRun` row. The `replay_writer_failed`
log line is the canary; absence of that line + `SELECT COUNT(*) FROM "ReplayRun"`
incrementing on each ingest is the smoke test.

### 5. What blocks institutional-grade replay survivability?

In dependency order:

1. **Receipt-issuance persistence by `jti`** — without a `IssuedReceipt` Prisma model + writer, audit-of-issuance is impossible. Estimate: 1 PR.
2. **Continuity reconciler endpoint** — `GET /api/lineage/:lineageKey/diff/:otherLineageKey` → artifact-set delta. Estimate: 1 PR; depends on Prisma model from item 1 for deeper audit linkage.
3. **`priorJti` / `priorLineageKey` claim on signed receipts** — closes the in-receipt continuity gap so a verifier holding only two receipts can determine continuity. Estimate: 1 PR (touches the receipt-signing path on the unmerged #349 stack).
4. **Writer expansion to non-orchestrator ingest sites** — wire the same fire-and-forget call into `/api/passport/[npi]/refresh` and any other ingest entry that produces a passport. Estimate: 1 PR per site (each is ~5 lines).
5. **Operator-side closures already enumerated** — Vercel env, Railway seed, codex exec, scheduled cron.

No new architecture is required. All five items are pre-designed in prior audits.

## §3 — Closing claim

PR-α gave us durable infrastructure. PR-β gives us live writes against that infrastructure on the canonical ingest path. Together they convert replay continuity from "absent" to "live runtime state for one ingest entry point."

The next material institutional-defensibility step is **receipt-issuance persistence** + **`priorJti` in receipt claims** — the smallest two PRs that make receipt-to-receipt continuity verifiable by an external party holding only the receipts.
