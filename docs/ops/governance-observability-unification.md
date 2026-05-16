# Governance Observability Unification — W2-PR34A

**Wave:** W2-PR34A — Governance Observability Unification
**Date:** 2026-05-09
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory, structural verdict).
**Companion to:** [drift-explainability](drift-explainability.md), [dashboard-runtime-honesty](dashboard-runtime-honesty.md), [longitudinal-governance-survivability](longitudinal-governance-survivability.md), [operator-governance-integrity](operator-governance-integrity.md), [forensic-durability-understanding](forensic-durability-understanding.md).
**Builds on:** [trust-fabric-durability-cohesion](trust-fabric-durability-cohesion.md), [runtime-honesty-continuity](runtime-honesty-continuity.md).

---

## What this wave answers

PR11B Track B asked whether dashboards faithfully render the contract. PR12B Track A asked whether operators can name the *kind* of drift they see. PR11B Track D asked whether those defenses survive 12 months of contribution. **This wave asks the convergence question: do the five telemetry families — runtime, governance, replay, drift, override — emit into a single observability layer that an operator can query, correlate, and replay, or do they fragment into five parallel tracks that an investigator must reconcile by hand?**

The risk vector is *fragmentation by tradition*. Each family was built on its own schema for a defensible reason at its own wave. The cumulative effect is five separately-emitting, separately-typed, separately-stored signal streams whose only shared surface is the audit-event union. An operator who needs to ask "what happened in this incident" must read five tools — and the platform's claim to be observably governable rests on whether those five tools speak a common language.

This wave scores governance observability against the five REQUIREMENTS in the brief — ambiguity-visible, replay-visible, drift-visible, operator-readable, longitudinally queryable — and registers, for each of the seven IMPLEMENT bullets, what exists, what's wired, and what's missing.

---

## Definitions

- **Telemetry family:** a producer of governance-relevant signal that an operator may query during or after an incident. Five families are in scope: runtime (lane health), governance (audit events), replay (decision replay envelopes + R-CAT classification), drift (snapshot vs. live, recorded vs. recomputed), override (manual operator actions that mutate trust state).
- **Convergence:** the property that two telemetry families share a schema, a transport, or a correlation key that lets a query against one return rows joinable to the other.
- **Operator-readable:** the property that a non-author of the code can read the telemetry surface and correctly classify what it is showing, in the time available during incident response.
- **Longitudinally queryable:** the property that the surface answers questions of the form "show me all events of class X between T1 and T2" without re-running a per-row replay.
- **Span debt:** the gap between code paths that *could* emit OpenTelemetry spans and code paths that actually do.
- **Correlation debt:** the gap between unique IDs that exist (`traceId`, `correlationId`, `requestId`, `mutationFingerprint`) and the IDs that propagate end-to-end across all five families for a single user-visible action.

---

## Verdict scale

- 🟢 CONVERGED — surface unifies the family with at least one peer family via shared schema or correlation key, and the unification is enforced by code or CI
- 🟡 PARTIAL — partial unification (shared key but not shared transport, or shared schema but not enforced)
- 🟠 FRAGMENTED — independently emitting; correlation is reconstructible by hand but not by query
- 🔴 INVISIBLE — the family does not emit a queryable surface at all; events exist only in memory or as pure transforms

---

## Telemetry-family inventory

| Family | Canonical emit site | Storage | Shared key out | Operator surface |
|---|---|---|---|---|
| Runtime (lane health) | [`sourceHealthTypes.ts`](../../apps/web/lib/source-health/sourceHealthTypes.ts), [`source-health/snapshots/_handler.ts`](../../apps/web/app/api/internal/source-health/snapshots/_handler.ts) | in-memory snapshot map | none (`observedAt` only) | [`LaneHealthMount`](../../apps/web/components/source-health/LaneHealthMount.tsx) on `/passport`, `/passport/[id]`, `/employer/dashboard` |
| Governance (audit) | [`auditService.emitAuditEvent()`](../../apps/api/backend/src/services/audit/auditService.ts), [`auditLedger.appendAuditEvent()`](../../apps/api/backend/src/services/audit/auditLedger.ts) | in-memory ledger + Postgres `auditEvent` (dual-write) | `traceId` (mandatory), `receiptHash` (SHA-256) | timeline rows where rendered (no general timeline UI yet) |
| Replay | [`replayEngine.replayDecision()`](../../apps/api/backend/src/services/audit/replayEngine.ts), [`runtimeTrustCohesion.ts`](../../apps/api/backend/src/services/runtimeTrustCohesion.ts) | computed on read; capsule metadata stores `runtimeTrust` | `correlationId`, `mutationFingerprint`, `capsuleId` | JSON-only; no envelope renderer |
| Drift | inline in [`replayEngine.ts`](../../apps/api/backend/src/services/audit/replayEngine.ts) `IntegrityCheck.tamperEvidence` | string field on replay envelope | none (string payload) | none |
| Override | [`employerReviewActions.ts`](../../apps/api/backend/src/services/entity/employerReviewActions.ts) `buildRuntimeMutationMetadata()` | nested in capsule metadata + audit row payload | `correlationId`, `mutationFingerprint`, `actor` | none specific (rolled into audit row) |

**Pattern:** three of five families (runtime, drift, override) have *no dedicated operator surface*. They emit signal but no surface aggregates the signal as a queryable telemetry stream of its own. The audit-event union is the closest thing to a unified bus, and it covers two of five families cleanly (governance and override) and one (replay) only partially.

---

## Track A — OpenTelemetry governance schema (status)

**Verdict: 🟠 FRAGMENTED — SDK is initialized; audit/replay/drift/override flows do not emit spans.**

The OpenTelemetry SDK is wired in [`telemetry.ts`](../../apps/api/backend/src/telemetry.ts) (BasicTracerProvider + OtlpHttpSpanExporter), and [`apps/api/backend/package.json`](../../apps/api/backend/package.json) imports the full `@opentelemetry/{api,context-async-hooks,core,resources,sdk-trace-base,semantic-conventions}` stack. **`getGenAiTracer()` is the only consumer.** No span is emitted from `auditService`, `replayEngine`, `employerReviewActions`, `runtimeTrustCohesion`, or any source-health probe.

**What works:** the SDK is present; adding spans is a code change, not a dependency change. `traceId` already flows on the audit ledger, which would be the natural span-context anchor.

**What doesn't:** there is no governance schema for spans — no `vitalcv.governance.v1` resource attribute, no semantic conventions for `governance.event.type`, no span-kind discipline for "audit-emit" vs. "replay-recompute" vs. "override-record." The first wave that wires spans into governance flows will *invent* the schema. If that wave is not deliberate, the schema will reflect the file that emitted the first span, not the family-level taxonomy.

**Span debt:** governance ledger writes (every audit event), replay recomputes (every `replayDecision`), override actions (every `employerReviewActions.recordAction()`), source-health snapshot mutations. **Estimated four high-volume span sites currently silent.**

**Operator overconfidence risk:** medium. No span surface exists today, so no live mis-inference; but the risk is that a future "let's add OTel" wave produces spans whose schema does not encode the governance taxonomy, locking in a schema that future spans inherit.

---

## Track B — Governance event streams (unification)

**Verdict: 🟡 PARTIAL — audit events have a unified union; runtime, drift, and override are not on the bus.**

[`auditEventTypes.ts`](../../apps/api/backend/src/types/auditEventTypes.ts) is the canonical union (post-W2-PR4A normalization), covering `VERIFICATION_*`, `MONITORING_*`, `ARTIFACT_*`, `EMPLOYER_REVIEW_*`, `TRUST_CHAIN_*`, `OPERATIONAL_*`, `RESEARCH_*`. Override actions (accept, refresh, route-to-review, deny) emit through this union. Replay invocations *do not* — confirmed by [`forensic-durability-understanding.md`](forensic-durability-understanding.md) FA-3 and IG-3 in [`dashboard-runtime-honesty.md`](dashboard-runtime-honesty.md).

**What works:** dual-write to in-memory ledger + Postgres means a single emission surface (`emitAuditEvent`) lands signal in both transports. `traceId` is mandatory on every row. The audit union is one file, structurally.

**What doesn't:** runtime (lane health) does not emit audit rows — health snapshots live in memory and are read directly by `LaneHealthMount`. Drift does not emit audit rows — `tamperEvidence` is a per-replay string, not an event. Replay invocations do not write rows. Two of the five families (runtime, drift) have **zero presence** on the governance bus; one (replay) has partial presence (the action that produced the capsule lands a row; the replay of that capsule does not).

**Stream-merge candidates:** lane-health state transitions could emit `MONITORING_LANE_TRANSITION` events with `(sourceId, fromState, toState, observedAt)`; replay invocations could emit `OPERATIONAL_REPLAY_RECOMPUTED`; drift detections could emit `MONITORING_DRIFT_DETECTED` with the drift class as a sub-field. **None of these event types exist today.**

**Operator overconfidence risk:** high. An audit query that filters on event type appears to answer "what happened in the window," but the answer omits at least three of five families.

---

## Track C — Replay anomaly traces

**Verdict: 🟠 FRAGMENTED — anomalies emit a string, not a trace; outer-vs-inner R-CAT masking is structural.**

`tamperEvidence` ([`replayEngine.ts`](../../apps/api/backend/src/services/audit/replayEngine.ts) `IntegrityCheck`) emits one of three messages when `hashMatch === false`: hash mismatch, evidence-spine mismatch, generic replay failure. The `runtimeTrustCohesion.test.ts` and `replayEngine.runtimeCohesion.test.ts` tests pin the round-trip determinism of the recorded fields, but **not** the anomaly path.

**What works:** the literal exists; the three messages are distinct enough that an operator reading the JSON can name the anomaly class. The capsule round-trip is tested; recorded fields survive into the envelope.

**What doesn't:** there is no separate trace stream for replay anomalies. A bundle export with three failed capsule replays drops them silently ([`replayEngine.ts:568-573`](../../apps/api/backend/src/services/audit/replayEngine.ts) per [`dashboard-runtime-honesty.md`](dashboard-runtime-honesty.md) FI-2) — the dropped capsules do not emit an anomaly event. The replay envelope unconditionally wraps everything in `replayCategory: 'R-CAT-6'` (dossier_replay) regardless of inner classification, masking R-CAT-1…5 ([`drift-explainability.md`](drift-explainability.md) A.1, [`runtimeTrustCohesion.test.ts:52`](../../apps/api/backend/src/services/__tests__/runtimeTrustCohesion.test.ts)).

**Anomaly classes that should emit traces but don't:**

| Class | Today | Should be |
|---|---|---|
| Hash mismatch (in-bundle) | `tamperEvidence` string | `OPERATIONAL_REPLAY_TAMPER_DETECTED` event with capsuleId, recordedHash, recomputedHash |
| Capsule drop (export-time silent failure) | (silent) | `OPERATIONAL_REPLAY_CAPSULE_DROPPED` event with capsuleId, error class |
| Outer-vs-inner R-CAT divergence | merged | recorded as discriminator field in the envelope, not a separate event |
| Evidence-spine mismatch | `tamperEvidence` string | `OPERATIONAL_REPLAY_SPINE_MISMATCH` event with diff |
| Authority chain inferred at replay-time | (silent) | provenance flag on the envelope (`authorityChainSource: 'recorded'\|'inferred'`) |

**Operator overconfidence risk:** high. A bundle that drops capsules reads identical to a bundle that did not. A replay envelope that ran clean reads identical to one whose chain was inferred. The contract knows the distinction; the trace stream does not surface it.

---

## Track D — Longitudinal governance dashboards

**Verdict: 🔴 INVISIBLE — no longitudinal query surface exists for any family.**

[`auditLedger.getAuditPage(cursor: AuditCursor)`](../../apps/api/backend/src/services/audit/auditLedger.ts) supports cursor-based read but **no time-range, category, or actor filter**. Runtime (lane-health) snapshots are point-in-time; no historical API exists. Drift is per-replay-invocation; trends require running `replayDecision` for every capsule in the window. Override aggregates do not exist; retries do not group by `mutationFingerprint` ([`dashboard-runtime-honesty.md`](dashboard-runtime-honesty.md) IG-5).

**Existing dashboards that touch any family:**

| Surface | Path | Family it dashboards | Time range |
|---|---|---|---|
| `/employer/dashboard` | [`employer/dashboard/page.tsx`](../../apps/web/app/employer/dashboard/page.tsx) | runtime (lane health) — live only | now |
| `/passport`, `/passport/[id]` | [`passport/page.tsx`](../../apps/web/app/passport/page.tsx) | runtime (lane health) — live only | now |
| `/status` | [`status/page.tsx`](../../apps/web/app/status/page.tsx) | compliance evidence shape (post DOCS-STATUS-1) | now |

**Three of five families have zero rendered dashboard.** None of the three rendered dashboards admit a time-range query.

**Longitudinal questions an operator cannot answer from a dashboard today:**

- "How many replay anomalies fired in the last 24h?"
- "What is the drift rate between recorded and computed authority chains over the last week?"
- "How many overrides did actor X record in the past 7 days?"
- "What is the trend in lane-health degradations for source NPPES over the last month?"
- "How many `'unknown'` actor rows landed this week?"
- "What is the audit-row write rate, broken down by `eventState`?"

**Operator overconfidence risk:** high. The absence of a longitudinal surface reads as "trends do not exist" rather than "trends are unqueryable." Operators reason from spot checks; trends accumulate invisibly.

---

## Track E — Operator telemetry correlation

**Verdict: 🟡 PARTIAL — `traceId` and `correlationId` exist; end-to-end propagation is not enforced.**

Five candidate IDs exist in the codebase:

| ID | Type | Origin | Propagates to |
|---|---|---|---|
| `traceId` | UUID | [`auditLedger.ts:135`](../../apps/api/backend/src/services/audit/auditLedger.ts) `randomUUID()` if absent | audit row metadata |
| `correlationId` | string | client request header `x-trace-id` or generated | `RuntimeTrustMetadata`, capsule metadata, audit row payload |
| `requestId` | string | [`requestObservability.ts`](../../apps/api/backend/src/middleware/requestObservability.ts) injects from `x-request-id` | request-level logs only |
| `mutationFingerprint` | SHA-256 | [`runtimeTrustCohesion.ts`](../../apps/api/backend/src/services/runtimeTrustCohesion.ts) of action+actor+entityId+payloadHash | capsule metadata; not propagated to audit row payload as queryable column |
| `receiptHash` | SHA-256 | [`auditLedger.ts`](../../apps/api/backend/src/services/audit/auditLedger.ts) of audit row | audit row metadata |

**What works:** `traceId` is mandatory on the ledger. `correlationId` propagates from request → capsule metadata → replay envelope. `receiptHash` content-addresses the audit row.

**What doesn't:** lane-health snapshots carry no ID at all (no `traceId`, no `correlationId`). Drift detections inherit the replay envelope's `correlationId` but emit no joinable column. `mutationFingerprint` lives in capsule metadata but is not surfaced in the Postgres audit row payload as an indexed column — joining "all events with this fingerprint" requires JSON-path queries. Three retries of the same action emit three rows with three correlation IDs and one fingerprint, but no view group-bys the fingerprint ([`dashboard-runtime-honesty.md`](dashboard-runtime-honesty.md) IG-5). `requestId` from the middleware is not propagated into the audit ledger row.

**Cross-family lineage gap:**

| Family pair | Shared key today | Missing |
|---|---|---|
| Runtime ↔ Governance | none | a `traceId` on lane-health snapshots |
| Governance ↔ Replay | `correlationId`, `mutationFingerprint` | indexed column on audit row for `mutationFingerprint` |
| Governance ↔ Drift | inherited via replay envelope | no audit row for drift detections |
| Governance ↔ Override | shared (override emits as audit row) | no `actor.actorId: 'unknown'` discriminator at the column layer |
| Replay ↔ Drift | shared envelope | no separate event for the drift detection |
| Replay ↔ Override | `correlationId`, `mutationFingerprint` | outer R-CAT-6 masks inner override category |
| Drift ↔ Override | none | no shared key; drift detections do not reference override metadata |

**Operator overconfidence risk:** high. An operator running an incident can find the audit row for an action by `correlationId`, but cannot pivot from there to the lane-health state at the same wall-clock instant, the replay anomalies for that capsule, or the override count for that actor — three of those pivots have no queryable join key.

---

## Track F — Observability chaos tests

**Verdict: 🔴 INVISIBLE — no chaos test asserts cross-family coherence under failure.**

The existing tests pin per-family shape:

- [`replayEngine.runtimeCohesion.test.ts`](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts) — replay envelope structure (R-CAT-6, correlationId, mutationFingerprint preservation)
- [`runtimeTrustCohesion.test.ts`](../../apps/api/backend/src/services/__tests__/runtimeTrustCohesion.test.ts) — runtime cohesion round-trip
- [`employerActions.test.ts`](../../apps/api/backend/src/routes/__tests__/employerActions.test.ts) — R-CAT classification per action
- [`auditLedger.test.ts`](../../apps/api/backend/__tests__/auditLedger.test.ts) — audit entry hash + receiptHash
- [`telemetry.test.ts`](../../apps/api/backend/src/routes/__tests__/telemetry.test.ts) — mocked trust alerts + cache ratio + resolver latency

**Per-family coverage holds.** **No test asserts:**

- That a `correlationId` on a runtime lane-health event matches the `correlationId` on the audit row that mutated trust state in the same request
- That a replay anomaly emits both a `tamperEvidence` string and a queryable audit row
- That under DB write failure, the in-memory ledger and Postgres ledger diverge gracefully (one of: both fail, one fails with explicit `eventState: 'pending_not_written'`, neither fails silently)
- That under OTel exporter failure, governance flows continue (spans are best-effort, not load-bearing)
- That under source-health flap (LIVE → UNAVAILABLE → LIVE in 100ms), the snapshot stream emits all three transitions and the audit query can correlate them to in-flight overrides

**Chaos tests that should exist but don't:**

| Failure mode | Cross-family invariant | Today |
|---|---|---|
| Postgres audit-write fails after in-memory append | `eventState: 'pending_not_written'` propagates to both surfaces | not tested |
| OTel exporter fails | governance flow continues; no audit data lost | not tested (no spans emitted) |
| Source-health probe times out | snapshot transitions to `UNKNOWN` and audit row carries the same observedAt | not tested |
| Capsule drop during bundle export | drop emits an audit row; bundle declares `partialExport: true` | not tested (capsule drops are silent per FI-2) |
| Replay reconstructs different authority chain than recorded | envelope declares `authorityChainSource: 'inferred'` | not tested (no provenance flag on envelope) |

**Operator overconfidence risk:** medium today (no chaos surfaces are exposed for operators to misread); high prospective (every wave that adds an emit site without a chaos test compounds the cross-family coherence debt).

---

## Track G — Governance observability CI gates

**Verdict: 🟠 FRAGMENTED — per-family CI exists; no cross-family gate enforces convergence.**

Existing CI gates (per package.json scripts and turbo pipelines):

- `pnpm typecheck` — TS compile across the monorepo (catches type-shape regressions in `auditEventTypes.ts`, `RuntimeTrustMetadata`, replay envelope schemas)
- `pnpm lint` — ESLint per workspace
- per-test-suite vitest gates (the tests listed in Track F)
- `next.config.mjs` enforces TS + ESLint on build (no ignore flags)
- CLAUDE.md banned-strings list — caught at review/lint, not build

**What's enforced today (per family):**

- Audit-event union: typecheck rejects unknown event types ✅
- Replay envelope shape: round-trip test pins recorded-field preservation ✅
- Override action classification: R-CAT category test pins per-action mapping ✅
- Receipt hash: ledger hash generation tested ✅
- Lane health badge copy: deterministic from `statusCopy.ts` ✅

**What's NOT enforced (cross-family):**

| Gate | Today | Risk |
|---|---|---|
| OTel governance schema lint | none | first wave that adds spans defines the schema by accident |
| Audit-row presence for replay invocations | none | replay invocations remain rowless ([forensic FA-3](forensic-durability-understanding.md)) |
| Cross-family `correlationId` propagation | none | runtime / drift can ship without joinable keys |
| `eventState` column surface binding | none | `pending_not_written` is silent at the rendering layer |
| Outer-vs-inner R-CAT discriminator | none | every new replay path inherits the masking |
| `partialExport` field on bundle exports | none | every new bundle field compounds completeness implication |
| `mutationFingerprint` indexed column | none | retry-aggregate views cannot be built without re-scanning |
| Drift class as event subtype | none | `tamperEvidence` strings remain string-typed |

**Pattern:** the per-family CI catches per-family regressions. **No CI gate catches a regression in convergence.** A wave can add a new lane-health surface without a `correlationId`, a new override path without a `mutationFingerprint`, or a new replay anomaly that emits a new `tamperEvidence` string without an audit row — none of these regressions fail CI.

---

## Cross-cut: requirements scoreboard

The five REQUIREMENTS in the wave brief, scored against current state:

| Requirement | Current state | Verdict | Why |
|---|---|---|---|
| Ambiguity-visible | dual-cause `'UNKNOWN'`, `'unknown'` actor, outer-vs-inner R-CAT all merge into the same surface field | 🟠 | the literals exist; no surface discriminates |
| Replay-visible | replay envelope is JSON-only; `tamperEvidence` is a string; capsule drops are silent | 🟠 | recorded fields survive; anomalies do not emit dedicated traces |
| Drift-visible | per-replay `IntegrityCheck`; no drift event; no drift dashboard | 🔴 | drift is computed but never aggregated |
| Operator-readable | three of ten incident questions answerable on dashboards (per [`dashboard-runtime-honesty.md`](dashboard-runtime-honesty.md)) | 🟠 | lane health is sharp; the rest is silent |
| Longitudinally queryable | `getAuditPage(cursor)` only; no time-range, no category, no fingerprint group-by | 🔴 | no longitudinal surface exists for any family |

**Tally: 0 🟢, 0 🟡, 3 🟠, 2 🔴.** None of the five requirements are met by current observability surfaces. Three are partially met by contract literals that have no rendering binding; two are structurally absent.

---

## What unifies the families today (the convergence gain that already exists)

The audit ledger's `traceId` + the in-memory `correlationId` + the capsule's `mutationFingerprint` form a **three-key correlation chain** that, where it propagates, lets an investigator pivot from request → capsule → audit row → replay envelope. The chain is the wave's strongest existing convergence asset:

- `traceId` mandatory on the audit ledger ([`auditLedger.ts:135`](../../apps/api/backend/src/services/audit/auditLedger.ts))
- `correlationId` flows from client header through `RuntimeTrustMetadata` into capsule metadata
- `mutationFingerprint` content-addresses the override action and survives into the replay envelope
- `receiptHash` content-addresses the audit row itself

Three of five families (governance, replay, override) participate in this chain. The chain is the reason cross-family pivots are *possible at all* today — without it, even the manual reconstruction would be lossy.

---

## What fragments the families today

**Five fragmentations of consequence:**

1. **Runtime is not on any bus.** Lane-health snapshots are in-memory only; no `traceId`, no `correlationId`, no audit row. An incident that begins with a source-coverage degradation has no audit-table footprint at the moment of degradation.
2. **Drift is a string, not an event.** `tamperEvidence` is human-readable and per-replay; it does not aggregate, does not group by drift class, does not emit a queryable row.
3. **Replay invocations write no row.** Reading the audit table for "replays during the incident" returns zero rows; the absence reads as "no replay happened."
4. **OTel is wired but only for GenAI.** Span debt is four high-volume sites silent; the schema for governance spans is undefined.
5. **No longitudinal API.** Cursor pagination is the only query surface; time-range and category filters do not exist on the audit ledger.

---

## Convergence-rate priority

Ordered by 12-month convergence-debt growth from highest to lowest, assuming current conventions hold:

1. **Audit-event taxonomy expansion without new family bindings** (🔴) — every new event type that does not bind to a family compounds the schema-without-taxonomy pattern.
2. **OTel span schema invented by accident** (🔴) — the first governance span sets the precedent; absence of a schema means the precedent is the schema.
3. **Runtime stays off the bus** (🔴) — every new source-health surface lands without a `traceId`, widening the runtime ↔ governance gap.
4. **Drift stays string-typed** (🟠) — every new `tamperEvidence` message dilutes the connotation; no aggregate query exists.
5. **Longitudinal queries reconstructed by per-incident scripts** (🟠) — every incident-response runbook embeds a one-off scan; the queries do not graduate to APIs.
6. **`mutationFingerprint` not indexed** (🟠) — retry-aggregate views remain impossible without table scans.
7. **Outer R-CAT-6 unconditional** (🟠) — masking persists; per [`drift-explainability.md`](drift-explainability.md) A.1, fixing it later means changing API output.

The top three are the structural convergence debts. The bottom four are the surface convergence debts. The wave's deliberate ordering — close the contract before the surface — is congruent with this projection only if the next wave specifically targets cross-family bindings rather than another per-family surface.

---

## Final output

### Strongest observability convergence gain (today)

**The three-key correlation chain — `traceId` + `correlationId` + `mutationFingerprint`.** Three of five families (governance, replay, override) propagate the chain end-to-end through the request → capsule → audit row → replay envelope path. This is the *only* existing convergence asset in the codebase that lets a single cross-family pivot succeed without manual reconstruction. It is also the natural anchor for OpenTelemetry span context: `traceId` maps directly to OTel's `trace_id`, `correlationId` to a span attribute, `mutationFingerprint` to a content-addressed event ID. The wave's strongest single observability investment to date is propagating these three keys through three of the five families.

### Strongest replay telemetry gain (today)

**The `replayEngine.replayDecision()` round-trip determinism guarantee, pinned by [`replayEngine.runtimeCohesion.test.ts`](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts).** Recorded fields (correlationId, mutationFingerprint, R-CAT-1…5 inner classification, capsule reference) survive into the envelope and recompute identically across runs. The test is a single anchor that protects an invariant the rest of the system depends on. Combined with the three-message `tamperEvidence` literal and the `IntegrityCheck.hashMatch` boolean, replay telemetry is the *only* family in which the contract layer emits structurally distinguishable signal for both the success path and three named failure paths. Replay telemetry's contract is the strongest of the five families.

### Biggest remaining telemetry blind spot

**Drift telemetry.** Drift is the family with the highest stakes (a divergence between two views of the same trust fact is the canonical incident shape) and the weakest emit surface (a per-replay string in `tamperEvidence`, no aggregate, no event, no dashboard, no audit row, no longitudinal query). Six drift classes are enumerated in [`drift-explainability.md`](drift-explainability.md) (replay, survivability, export, dashboard, taxonomy, lineage); zero have a queryable trace stream; three are 🟠 CONFUSING. A drift event taxonomy (`MONITORING_DRIFT_DETECTED` with `driftClass` as a sub-field), a drift dashboard with class-level aggregates, and a drift-trend longitudinal query are all absent.

The runtime family is a close second (no audit row presence at all), but runtime degradations are at least visible on a live dashboard. Drift is invisible *both* live and historically.

### Governance observability verdict

**🟠 FRAGMENTED — convergence holds across three of five families via the three-key correlation chain; runtime and drift are not on the bus; longitudinal queries do not exist; OTel is wired but silent on governance flows; no cross-family CI gate exists.**

The platform's contract layer for governance observability is honest and complete: every literal an investigator needs to classify an event exists in the code (`eventState`, `mutationFingerprint`, dual-cause `'UNKNOWN'`, outer-vs-inner R-CAT, `tamperEvidence` three-message). The transport layer for those literals is the gap: three of the five families do not emit into the audit-event bus, the OTel SDK is initialized but not wired into governance flows, and no surface answers a longitudinal question for any family.

The wave's convergence verdict is congruent with the platform's broader pattern: contract-strong, surface-silent, projection-absent. The three-key correlation chain proves convergence is achievable when the platform invests in the keys; the runtime and drift gaps prove the absence of a chain costs more than the absence of a contract.

**Strongest convergence path forward:** wire OpenTelemetry spans into the four high-volume sites (audit emit, replay recompute, override record, source-health snapshot mutation) with a `vitalcv.governance.v1` schema that binds `traceId` → OTel trace context, `mutationFingerprint` → span event ID, and `driftClass` → span attribute. This single investment converts three 🟠 requirements (ambiguity-visible, replay-visible, operator-readable) toward 🟢 and creates the join key that the runtime and drift families need to land on the bus.

**Largest convergence cost still owed:** a longitudinal query API for the audit ledger (time-range, category, actor, fingerprint group-by) and a drift-event taxonomy. Without these, the trace surface is forensic-only and not operational; an operator running an incident still cannot ask "how often does this drift class fire" or "what did this actor do in the last hour."

---

## 📊 Governance Observability Board

| Metric | % | Rationale |
|---|---|---|
| **Telemetry Unification** | **40%** | 2 of 5 families on the audit bus (governance, override); replay partially; runtime and drift off-bus. Three-key correlation chain exists for 3 of 5 families. |
| **Replay Visibility** | **55%** | Round-trip determinism pinned; recorded fields survive; three-message `tamperEvidence` exists. Outer R-CAT-6 masks inner classification; capsule drops silent; no separate anomaly trace. |
| **Drift Observability** | **15%** | Six drift classes named in docs; one (replay drift) has a string-typed signal; five have no surface. No drift event, no drift dashboard, no longitudinal trend. |
| **Operator Correlation Fidelity** | **45%** | `traceId` + `correlationId` + `mutationFingerprint` propagate across 3 of 5 families. `requestId` not joined to ledger. `mutationFingerprint` not indexed for retry-aggregates. Lane-health snapshots carry no key. |
| **Governance Operational Visibility** | **25%** | Per-family CI exists; cross-family CI absent. OTel SDK initialized; governance flows emit no spans. No longitudinal query for any family. Three of ten incident questions answerable on dashboards. |

**Weighted observability convergence score: ~36%.** The platform converges where it built the three-key correlation chain (governance / replay / override) and fragments where it did not (runtime / drift). The wave's next convergence investment with the highest leverage is wiring OpenTelemetry into the four silent emit sites with a deliberate governance schema; the largest cost still owed is a longitudinal query API and a drift-event taxonomy.

**Wave verdict: 🟠 FRAGMENTED.** Three telemetry families converged via correlation keys; two off-bus; zero longitudinal queries; OpenTelemetry wired but silent. **Governance observability holds where the platform invested in shared keys and fragments where it left the family on its own transport — the contract knows what happened; the surface cannot answer when, how often, or how it relates to anything else.**
