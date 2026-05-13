# Final Production Resilience State

**Scope:** describes resilience properties of `origin/main` runtime
**RIGHT NOW** (audit date 2026-05-13, post-#359). Distinguishes:

- **Durable** — state that survives a restart, deploy, or function cold-start.
- **Reconstructible** — state that doesn't persist but can be re-derived deterministically from durable inputs.
- **Volatile** — state that does not survive restart and cannot be reconstructed.
- **Absent** — the infrastructure to make this property meaningful does not ship on origin/main yet.

Excludes: roadmap, planned features, in-flight PRs, speculative
infrastructure. This document does not invent resilience features —
it reports the resilience characteristics of code that exists.

## §1 — What still breaks under restart?

| What restarts | What breaks | Durability classification |
|---|---|---|
| Vercel function cold-start | ES256 keypair when `RECEIPT_PRIVATE_KEY_JWK` env unset → fresh keypair → all pre-restart receipts fail signature verification | VOLATILE; fix is operator-side env var (`final-operator-activation-state.md` §1 row 4) |
| Vercel function cold-start | In-process caches (none load-bearing; framework state) | RECONSTRUCTIBLE (Next 15 stateless per invocation) |
| Vercel function cold-start | `LaneHealthMount` snapshots if probe runner hasn't repopulated | RECONSTRUCTIBLE in principle, but probe runner unscheduled per `runtime-gating-graph.md` §6, so the store stays UNKNOWN until operator schedules the cron |
| Railway Postgres restart | Nothing (Prisma client re-acquires connection on next query) | DURABLE |
| Railway Postgres restart | `lineageKey` / `runId` continuity | ABSENT — these identifiers are not persisted on origin/main, per `replay-topology-gap-analysis.md` §3. Restart-resilience is undefined because the data does not exist. |
| Railway Postgres restart | Receipt issuance records keyed by `jti` | ABSENT — receipts are signed on-demand from runtime state; no `Receipt(jti, …)` persistence table |
| Railway Postgres restart | Probe-runner-fed lane state | ABSENT — no persistent lane-state table on origin/main; LaneHealthMount reads `getLaneSnapshots` which is memory-keyed |
| Clerk session restart | Clerk-managed (out of our scope) | DURABLE via Clerk |
| Scheduled job restart (when schedulers exist) | Last-run timestamp | ABSENT — no scheduler is currently scheduled on apex |

**Verdict (§1):** the load-bearing restart vulnerability today is the
ES256 keypair when env unset (operator fix). Beyond that, the
"continuity survives restart" question is not answerable on
origin/main because no continuity layer exists.

## §2 — What still breaks under deploy propagation?

Deploy propagation = Vercel rebuilding an app, routing apex traffic to
the new build, invalidating CDN cache.

| What deploys | What breaks |
|---|---|
| New build of `apps/web` | Same VOLATILE keypair issue as restart (cold-start of every function on the new build) |
| New build | Receipt JWTs signed under the prior build's ephemeral keypair fail signature verification under the new build's kid. Verifiers caching the old JWKS see kid mismatch and reject. |
| New build with route additions | No issue — Next App Router file-based routing means added routes are mounted on the new build automatically; CDN cache for the new paths starts empty |
| New build with route removals | Possible client confusion if the old path is still cached at the edge; Vercel's default cache-control on App Router responses is short, so resolution is minutes-scale |
| New build with security-header changes | Global headers from `next.config.mjs` apply immediately on new requests; cached responses retain the old headers until evicted |
| Vercel cron schedule changes | Cron updates with the next scheduler tick; race-window-sized inconsistency for one tick |

**Verdict (§2):** the only meaningful deploy-propagation issue today
is the ephemeral keypair problem cascading across deploys. All other
deploy-propagation properties are Vercel's defaults; nothing in
`origin/main` code overrides them.

## §3 — What still breaks under edge divergence?

Edge divergence = apex CDN edge serving content inconsistent with the
origin function output (e.g. stale cache, regional split-brain).

| Scenario | Risk |
|---|---|
| Stale `/api/.well-known/jwks.json` at edge | Cache-Control header on the legacy handler is the framework default (`s-maxage=0, must-revalidate`); the edge generally proxies; no documented divergence on origin/main |
| Stale `/api/health` | Same — framework defaults make this a non-issue in practice |
| Stale `/api/receipt/*` (when canonical routes land) | The unmerged canonical handler emits `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` per `canonical-trust-route-map.md` row 8. After merge, an institutional verifier might receive a cached receipt up to 1 hour after the underlying NPI state changes. Whether this is a defect or a feature is contract-dependent. |
| Stale `/.well-known/jwks.json` (when canonical lands) | Cache-Control on the unmerged handler emits `public, max-age=3600, stale-while-revalidate=86400`. Key rotation requires a CDN purge or 1-hour wait. |
| Cross-region split | Vercel functions run in a single region by default for `apps/web`; no documented multi-region split. |
| CDN edge revalidating against origin while origin is cold-starting | Vercel's `stale-while-revalidate` semantics handle this; first request after expiration is served stale, revalidation fires async. |

**Verdict (§3):** no currently-known edge-divergence defect on
origin/main. Post-#349 merge, the 1-hour `stale-while-revalidate`
window on JWKS / DID / OID4VCI metadata becomes a key-rotation
constraint to design around, not a bug.

## §4 — What continuity is fully durable today?

Continuity = the property that two observations of the same logical
state produce the same output, regardless of restart, deploy, or
caller identity.

### Durable continuity (origin/main)

- **Provider identity continuity** via NPI primary key — `Entity` model row stable.
- **Decision capsule continuity** — `DecisionCapsule` Prisma rows are immutable post-insert; `/api/decisions/npi/:npi/timeline` deterministic per row.
- **Audit event continuity** — `audit_event` rows are immutable post-insert (per the wave that landed audit chain hardening).
- **VerificationArtifact continuity** — Prisma rows immutable; per-artifact retrieval deterministic.
- **Receipt-signature continuity for a single signing key** — as long as the ES256 keypair is stable (i.e., when `RECEIPT_PRIVATE_KEY_JWK` is set), a verifier with the JWKS can verify any receipt signed under that kid indefinitely.

### Reconstructible-but-not-durable continuity

- **Chronology by `DecisionCapsule.createdAt`** — derivable per query; ordering not pinned at the millisecond tiebreaker (per `replay-topology-gap-analysis.md` §5).
- **NPI → most-recent-trust-state** — `/api/trust-state/[npi]` computes on demand from latest VerificationArtifact rows; deterministic if the underlying rows are stable, non-deterministic if newer rows are added between calls.

### Absent (no durability layer exists)

- `lineageKey` continuity across runs
- `runId` continuity across restarts
- Receipt-by-`jti` retrieval (because not persisted)
- Continuity reconciler answering "is N continuous with N-1?"
- Revocation-list continuity (no revocation list exists)

**Verdict (§4):** durable continuity covers identity, decisions,
audit events, artifacts, and signature verification (when the key is
configured). Replay continuity (lineage, runId, receipt-by-lineage,
reconciliation) is wholly ABSENT on origin/main. The replay layer
exists only on the unmerged stack + the engineering backlog per
`replay-topology-gap-analysis.md` §7.

## §5 — What still prevents institutional-grade survivability?

The same three categorical blockers identified in
`mega-convergence-synthesis.md` §2.H, viewed through the resilience lens:

### Tier A — operator-side configuration

The five env vars + cron + seed not being configured is what makes
the "restart breaks ES256 receipts" failure observable. Once
`RECEIPT_PRIVATE_KEY_JWK` is set, the cold-start key churn stops;
once the probe cron runs, `LaneHealthMount` populates; once the
demo seed is in Railway, the `/passport` flow renders populated.
**Effort: ~60 min total in operator dashboards.**

### Tier B — merge train

PRs #345 / #349 / #355 / #358 / #360 add the canonical routes,
deterministic jti, public allowlist, and audit documentation. None
of these introduces new resilience risk; they unlock the surfaces
on which Tier C resilience properties become testable.
**Effort: 5 × `codex exec` runs + 5 × `gh pr merge`.**

### Tier C — replay persistence engineering (per `replay-topology-gap-analysis.md` §7)

This is the resilience-load-bearing tier. Without PR-α (Prisma
`ReplayRun` model + migration), there is no schema on which to test
"replay survives restart." Without PR-η (receipt-issuance persistence),
there is no record of "did we issue receipt X at T?" to query after
restart. Without PR-ζ (continuity reconciler), there is no
programmatic answer to "is receipt N continuous with N-1 under audit?"

These are the only net-new product changes the resilience requirements
imply. They are pre-designed; no new architecture follows from this
audit.

### Tier D — small resilience hardening on origin/main (newly identified)

These are fixes that can land independently and improve resilience of
existing code without needing the replay infrastructure first:

| Fix | Source | Effort |
|---|---|---|
| Add `AbortSignal.timeout(8000)` to the resolve-role fetch in `apps/web/middleware.ts:69` | upstream-fetch-topology §D | 1-line PR |
| Branch on `fallback: true` in `startPublicIngest` (so the client doesn't throw when `/api/ingest/[npi]` returns the masked-200 fallback body) | gating-graph §4 + upstream-fetch §A.X | small PR |
| Add `AbortSignal.timeout(8000)` to `report/*` cluster fetches (currently 20s/30s, exceeds Vercel hobby plan 10s execution cap) | upstream-fetch §A | small PR |
| Consolidate the 4 backend-URL resolvers to a single helper to eliminate the `localhost:4000` fallback in inline-resolver routes | upstream-fetch §A | medium PR |

PR #360 already lands two truth-contract fixes (typo'd env var, `/trust`
allowlist). The four resilience fixes above can be sequenced as
follow-ups without dependency on the merge train or replay tier.

---

## §6 — Summary table for the TASK 7 brief answers

| Brief question | Answer |
|---|---|
| What still breaks under restart? | ES256 keypair when `RECEIPT_PRIVATE_KEY_JWK` unset (operator fix). `lineageKey`/`runId`/receipt-by-jti continuity is ABSENT, so restart-resilience is undefined for those properties. |
| What still breaks under deploy propagation? | Same keypair issue (cascades across deploys). No other documented defect on origin/main. |
| What still breaks under edge divergence? | None currently documented. Post-#349 merge, the 1-hour `stale-while-revalidate` on JWKS/DID/OID4VCI metadata becomes a key-rotation constraint. |
| What continuity is fully durable today? | Identity, decision capsules, audit events, verification artifacts, ES256 signature verification (when key configured). Reconstructible: chronology by DecisionCapsule timestamps, NPI → latest trust state. ABSENT: lineageKey, runId, receipt-by-jti, reconciler, revocation list. |
| What still prevents institutional-grade survivability? | Tier A (5 operator config steps), Tier B (5-PR merge train), Tier C (6–7 engineering PRs for replay persistence per `replay-topology-gap-analysis.md` §7). Tier D adds 4 small origin/main resilience fixes that can land independently. **No new product concept required at any tier.** |

---

This document is the resilience analogue of `final-runtime-reality-state.md`.
Where that document answers "what is true," this one answers "what
survives." The two documents together close the resilience question
without introducing new infrastructure.
