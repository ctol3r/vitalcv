# Operator Query Understanding — W2-PR8B Track A

**Wave:** W2-PR8B — Operational Trust Fabric Explainability
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [forensic-explainability](forensic-explainability.md), [trust-fabric-continuity](trust-fabric-continuity.md), [runtime-query-explainability](runtime-query-explainability.md).
**Builds on:** [w2-pr7b-runtime-semantics-cohesion](w2-pr7b-runtime-semantics-cohesion.md), [w2-pr4d-operator-understanding](w2-pr4d-operator-understanding.md).

---

## What this track answers

Given a real operator (support, audit, compliance, oncall) trying to ask the platform a forensic question, can they:

1. Form the query in the vocabulary the platform actually exposes?
2. Find the right endpoint or surface?
3. Read the answer without misinterpreting a literal?

PR4D measured surface coverage. PR7B measured semantic cohesion. **This track measures whether the operator can run the query at all, and whether the answer they get back is shaped like the question they asked.**

## Operator-facing query surfaces

Inventory of every surface an operator could plausibly use to ask a forensic question today.

| Query | Endpoint / Surface | File | Vocabulary |
|---|---|---|---|
| Decision timeline for an NPI | `GET /api/decisions/npi/:npi/timeline?type=&status=&limit=` | [auditReplay.ts:199-265](../../apps/api/backend/src/routes/auditReplay.ts) | `decisionType` (HIRING / PRIVILEGING / DEPLOYMENT / RENEWAL); `status` (VALID / AT_RISK / INVALID) |
| Evidence at decision time | `GET /api/decisions/:id/evidence` | [auditReplay.ts:42-64](../../apps/api/backend/src/routes/auditReplay.ts) | capsuleId only |
| Authority chain | `GET /api/decisions/:id/chain` | [auditReplay.ts:77-110](../../apps/api/backend/src/routes/auditReplay.ts) | capsuleId only |
| Self-verifying audit bundle | `GET /api/decisions/:id/bundle?format=json\|ndjson&include=` | [auditReplay.ts:122-186](../../apps/api/backend/src/routes/auditReplay.ts) | capsuleId, format, include subset |
| Audit bundle for all NPI capsules | `GET /api/decisions/export/:npi` | [decisionCapsules.ts](../../apps/api/backend/src/routes/decisionCapsules.ts) | NPI only |
| Append verifier attestation | `POST /api/decisions/:id/attest` | [auditReplay.ts:282-313](../../apps/api/backend/src/routes/auditReplay.ts) | capsuleId + attestation body |
| Trust state for an NPI | `GET /api/trust-state/:npi` | [trustStateEngine.ts:1-6](../../apps/api/backend/src/routes/trustStateEngine.ts) | NPI only |
| Employer review packet export | `GET /api/employer-review/:entityId/packet?format=zip\|json` | [employerActions.ts](../../apps/api/backend/src/routes/employerActions.ts) | entityId only |
| Wallet export (CHAPI / SHC) | `GET /api/credentials/export/wallet` | [openapi.ts](../../apps/api/backend/src/routes/openapi.ts) | wallet target |

That is the complete operator-query layer. There is no CLI, no admin console, no SIEM stream, no CSV export, no row-level audit query API.

## What is queryable today

| Question an operator wants to ask | Available? | How they would do it | Score |
|---|---|---|---|
| "Show me the last decisions for clinician 1234567890" | ✅ | `GET /api/decisions/npi/1234567890/timeline?limit=50` | 🟢 UNDERSTANDABLE |
| "Pull the full audit record for capsule X" | ✅ | `GET /api/decisions/X/bundle` | 🟢 UNDERSTANDABLE |
| "What evidence existed at decision X?" | ✅ | `GET /api/decisions/X/evidence` | 🟢 UNDERSTANDABLE |
| "Append my verifier attestation to capsule X" | ✅ | `POST /api/decisions/X/attest` | 🟢 UNDERSTANDABLE |
| "Show me all denials for entity X" | ⚠️ | No endpoint. Denials are `EMPLOYER_REVIEW_MUTATION_DENIED` rows in `AuditEvent`; would require direct DB or log query. | 🟠 CONFUSING |
| "Why was this acceptance denied?" | ⚠️ | Reason is in audit row payload (`denial_reason`), not in event type. Requires reading raw payload. | 🟠 CONFUSING |
| "Show me all denials grouped by reason yesterday" | ❌ | Single event type collapses three reasons; reason field requires payload introspection. | 🔴 MISLEADING (group-by-type lies) |
| "Did this audit event actually persist?" | ❌ | `eventState` exists in code (`pending_not_written` / `demo_not_persisted`) but no operator surface exposes it. | 🟠 CONFUSING |
| "Show me all replays in the last hour" | ❌ | Replay is invocation-on-demand, not a recorded event. No replay-event audit row. | 🟠 CONFUSING |
| "Which actor (person) accepted entity X?" | ⚠️ | `actor.actorId` is in `runtimeTrust` metadata; no surface exposes it. Requires bundle parse. | 🟡 PARTIAL |
| "Which mutations did human user U make today?" | ❌ | Indexable in metadata, not queryable by API. | 🔴 MISLEADING (no answer ≠ no mutations) |
| "Show me read-only-attempted mutations" | ❌ | `readonly.attemptedByReadonly` flag exists in metadata, no operator surface. | 🟠 CONFUSING |
| "Which decisions used a stale issuer response?" | ❌ | No surface; requires walking issuer-response and decision rows manually. | 🟠 CONFUSING |
| "Which capsules have a hash mismatch?" | ⚠️ | `IntegrityCheck.hashMatch` is computed at replay time, not pre-aggregated. Requires per-capsule replay calls. | 🟡 PARTIAL |
| "Which lanes are unhealthy right now?" | ✅ | LaneHealthBadge surfaces on `/passport/[id]`; programmatic answer via `/api/trust-state/:npi`. | 🟢 UNDERSTANDABLE |
| "Show me everything for application A across NPIs" | ❌ | Application object lives in employer-review domain; no cross-NPI replay. | 🟠 CONFUSING |
| "Show me all `unable_to_verify` issuer responses" | ❌ | No issuer-side query API surface. | 🟠 CONFUSING |
| "Was this `unable_to_verify` a response or a review state?" | ⚠️ | Both are present; literal type distinguishes; copy collapses. | 🟡 PARTIAL |

**Tally:** 5 🟢, 4 🟡, 7 🟠, 2 🔴.

## Vocabulary the operator must know

To form a query at all, an operator must hold these vocabularies in their head:

| Vocabulary | Where defined | Operator-readable? |
|---|---|---|
| `decisionType` (HIRING / PRIVILEGING / DEPLOYMENT / RENEWAL) | [auditReplay.ts:199-265](../../apps/api/backend/src/routes/auditReplay.ts) | Yes |
| `status` (VALID / AT_RISK / INVALID) | [auditReplay.ts:199-265](../../apps/api/backend/src/routes/auditReplay.ts) | Yes |
| Source outcome (VERIFIED / EXPIRED / NOT_FOUND / FAILED / PENDING) | [replayEngine.ts:45-46](../../apps/api/backend/src/services/audit/replayEngine.ts) | Yes |
| `proofTier` (`receipt_candidate` / `psv_receipt_candidate` / `psv_receipt`) | [issuer-verification/](../../apps/web/lib/issuer-verification/) | Required for trust contract; not a query parameter today |
| `decisionGrade` (literal `false` / `true`) | [issuer-verification/](../../apps/web/lib/issuer-verification/) | Critical for honesty; not exposed as query parameter |
| `TrustBand` (GREEN / YELLOW / RED) | [packages/trust-state/contracts.ts](../../packages/trust-state/contracts.ts) | Yes |
| `ReadinessStatus` (DECISION_GRADE / CHECKING / BLOCKED / PARTIAL) | [packages/trust-state/contracts.ts](../../packages/trust-state/contracts.ts) | Compresses to 3 visual buckets in UI; query layer uses 4 |
| `RuntimeMutationClassification` (8 values incl. `DENIED_MUTATION`, `DOSSIER_REPLAY`) | [runtimeTrustCohesion.ts:22-30](../../apps/api/backend/src/services/runtimeTrustCohesion.ts) | Not exposed in query layer |
| `RuntimeReplayCategory` (R-CAT-1…6) | [runtimeTrustCohesion.ts:14-20](../../apps/api/backend/src/services/runtimeTrustCohesion.ts) | Not exposed in query layer |
| `AuditEventType` (~25 literals across 7 families) | [auditEventTypes.ts](../../apps/api/backend/src/types/auditEventTypes.ts) | Indirectly via timeline; no event-type filter |
| `denial_reason` (≥3 values; employer-side: `already_accepted` / `passport_unavailable` / `acceptance_blocked`; with NPI variants ≥6 in route handler) | [employerActions.ts](../../apps/api/backend/src/routes/employerActions.ts) | Inside payload; not a query parameter |
| `refusalGate` (6 issuer-side values) | [policyReview.ts:67-122](../../apps/web/lib/issuer-verification/policyReview.ts) | Not bound to any UI ([w2-pr4d-operator-understanding.md](w2-pr4d-operator-understanding.md)) |

**Two refusal vocabularies, no shared namespace.** An operator looking for "everything that refused" today must query two different state machines with two different vocabularies. The two never meet.

## Score-by-query-class

🟢 **UNDERSTANDABLE**

- Decision timeline by NPI
- Evidence / authority chain by capsule
- Audit bundle export by capsule
- Trust state by NPI
- Wallet export (closed-shape, well-documented)

These queries have a literal name, a typed parameter, an OpenAPI surface, a shape that maps cleanly onto the operator question, and a vocabulary the operator can learn in one read of [auditReplay.ts:199-265](../../apps/api/backend/src/routes/auditReplay.ts).

🟡 **PARTIAL**

- Actor identity behind a mutation (in metadata, not queryable)
- Hash-mismatch capsules (computable per-capsule via replay; not pre-aggregated)
- `unable_to_verify` cross-meaning (literal type distinguishes; copy collapses)
- Audit event filtering by type (timeline returns decisions, not raw audit events)

The data exists; the query layer doesn't expose it shaped the way operators ask. Pulling the answer requires either reading bundle JSON or a per-capsule call.

🟠 **CONFUSING**

- Denial inspection (event-type group-by misleads; reason lives in payload)
- Audit-write durability (state exists in code, no operator-facing answer)
- Replay history (replay is on-demand; no audit row for "replay happened")
- Cross-NPI / cross-application queries
- Issuer-side refusal queries (`refusalGate` returned, never rendered)
- Read-only-attempted mutations (flag exists, no surface)
- Stale-issuer-response queries

The operator forms the question; the platform has no path that returns the answer in the shape the question implies. Existing data must be reassembled by hand.

🔴 **MISLEADING**

- "Group denials by event type" — three reasons collapse to one event type; metric reads as "all denials are the same kind." Granularity collapse is a forensic bias, not just a missing field.
- "Show me mutations by actor U" — no API surface; an empty result reads as "U did nothing" when the system has no way to answer.

These are the only two answer shapes in the inventory where what the operator gets back is **structurally wrong** rather than incomplete.

## Cross-cutting observations

### The query-layer vocabulary is narrower than the trust fabric vocabulary

The audit-event taxonomy has ~25 literals across 7 families (verification, monitoring, artifact, employer-review, trust-chain, operational, research) per [auditEventTypes.ts](../../apps/api/backend/src/types/auditEventTypes.ts). The query layer surfaces three of those families as filterable parameters: `decisionType`, `status`, and (via timeline-and-bundle endpoints only) `decisionType` again. **An operator cannot directly ask a question shaped like an audit-event taxonomy** today. They can only ask decision-shaped questions.

### Two refusal vocabularies with no bridge

The issuer-side `refusalGate` (6 values) and the employer-side `denial_reason` (3 values, 6 with NPI variants) describe the same operational shape — a gate fired, a request was refused — in two non-overlapping namespaces. Neither is exposed as a query parameter; one is not bound to any UI ([w2-pr4d-operator-understanding.md](w2-pr4d-operator-understanding.md)). An operator asking "show me all refusals today" has **no single query that answers**.

### Replay is a noun and a verb, with only the verb queryable

`DOSSIER_REPLAY` / R-CAT-6 is the runtime classification for the act of replay. There is no audit row that says "a replay happened." Replay output is computed on demand, returned, and not durably recorded. An operator asking "who replayed capsule X yesterday?" gets nothing — not because the answer is private, but because no event was written.

### The operator vocabulary is `runtimeTrust`-blind

Eight runtime mutation classifications, six replay categories, an actor object, a fingerprint, a payload hash, a readonly flag. None of these are query parameters. The metadata is faithfully recorded and replayed; nothing is queryable by it. **The runtime trust cohesion plumbing is invisible to the operator-query layer.**

## Verdict

**The operator-query layer is honestly scoped: it answers exactly the questions it was designed to answer, with no inflation.**

The forensic gap is not in the queries that exist (those are 🟢) but in the questions that have no query at all (those drift to 🟠 and 🔴 by absence). The biggest single gap is **denial inspection** — the runtime taxonomy unifies three structural reasons under one event type, which is correct as a taxonomy and misleading as a metric. The next-biggest gap is **actor and runtime-classification queryability** — the data exists, written deterministically, never queried.

If a compliance reviewer arrived today and asked "show me everything that was refused, by reason, yesterday, across both issuer and employer surfaces" they would receive nothing useful from the API. They would need to parse audit bundles by hand. That gap is not a bug — it is the unfinished edge of a wave that prioritized cohesion over query.

**Track A score: 🟡 PARTIAL** — the queryable answers are clean; the non-queryable answers are absent rather than wrong, with two 🔴 exceptions (denial group-by-type, actor-keyed mutations) that produce structurally misleading metrics. **Operator-query understanding is honest where it exists and silent where it doesn't.**
