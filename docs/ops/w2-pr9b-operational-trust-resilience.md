# Operational Trust Resilience — W2-PR9B Track D

**Wave:** W2-PR9B — Degraded Runtime Explainability
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [w2-pr9b-operator-failure-understanding](w2-pr9b-operator-failure-understanding.md), [w2-pr9b-degraded-trust-state-continuity](w2-pr9b-degraded-trust-state-continuity.md), [w2-pr9b-forensic-survivability](w2-pr9b-forensic-survivability.md).
**Builds on:** [w2-pr8b-runtime-query-explainability](runtime-query-explainability.md), [trust-fabric-continuity](trust-fabric-continuity.md), [w2-pr7b-operational-trust-continuity](w2-pr7b-operational-trust-continuity.md).

---

## What this track answers

When VitalCV is partially degraded — a slow issuer, a retry storm, a stalling export, a missing actor header — does the platform preserve **operational trust**?

Operational trust is a four-property promise:

1. **The platform tells the truth** even when the inputs are partial.
2. **The platform is explainable** even when the operator surface is silent.
3. **The platform survives investigation** even when the trace is incomplete.
4. **The platform stays honest about its own state** even when its own state is degraded.

The interesting failure mode is not loud failure — error pages, 500s, broken pipes — but the silent kind: the surface still renders, the audit still records, the bundle still hashes, and the platform reads as healthy when it is not.

This track audits all four properties under degradation.

## Property 1 — Operational trust preservation

The doctrine-level anti-trust-inflation gates ([CLAUDE.md](../../CLAUDE.md)) define the floor:

- `decisionGrade` is the literal `false` for `ReceiptCandidate` and `PSVReceiptCandidate`.
- Banned strings: `'automatically verified'`, `'guaranteed'`, `'certified compliant'`, etc.
- No status label may be the bare word `Verified`.
- `recordedBy: 'demo'` is structural, not cosmetic.

Under degradation:

| Truth-floor property | Holds under retry storm? | Holds under partial export? | Holds under attribution loss? | Holds under audit-write lag? |
|---|---|---|---|---|
| `decisionGrade: false` literal preserved | ✅ | ✅ | ✅ | ✅ |
| No banned strings in copy | ✅ | ✅ | ✅ | ✅ |
| `recordedBy: 'demo'` preserved | ✅ | ✅ | ✅ | ✅ |
| `proofTier` ladder preserved | ✅ | ✅ | ✅ | ✅ |
| `tamperEvidence` populates on hash mismatch | ✅ | ✅ | ✅ | ✅ |

**The truth floor holds under all five tested degradation modes.** Not one degradation mode in the codebase causes a literal to inflate, a banned string to leak, or a demo path to read as real. This is the strongest property of the platform under degraded conditions, and it is load-bearing.

**Resilience score for property 1: 🟢 PRESERVED.**

## Property 2 — Explainability preservation

Explainability under degradation is the question PR8B Track D / runtime query explainability answered for the happy path: do runtime literals remain self-describing when read in isolation? Under degradation the same question reappears with a different frame: do runtime literals remain self-describing when read **alongside missing literals**?

| Literal | Self-describing on happy path? | Self-describing under degradation? |
|---|---|---|
| `'EMPLOYER_REVIEW_MUTATION_DENIED'` | ✅ | ⚠️ — three reasons collapse; degradation increases volume of denials, not granularity |
| `'DENIED_MUTATION'` (mutation classification) | ✅ | ⚠️ — same collapse |
| `'R-CAT-1'`…`'R-CAT-6'` | 🔴 | 🔴 — degradation amplifies (more replays = more R-CAT-6) |
| `'unknown'` actor | ⚠️ — silent fallback | 🟠 — degradation drives unknown-actor rate up |
| `'pending_not_written'` | 🟡 | 🟠 — degradation = exactly the period this state holds |
| `'demo_not_persisted'` | 🟢 | 🟢 — unaffected |
| `'tamperEvidence'` populated | 🟢 | 🟢 — populated honestly |
| `'UNKNOWN'` trustBand in replay | 🟡 | 🟠 — degradation = artifacts missing = `'UNKNOWN'` is the dominant value |
| `'CHECKING'` / `'BLOCKED'` / `'PARTIAL'` readiness | 🟢 | 🟢 — preserved |
| `acceptance_blocked` denial reason | 🟡 — restatement | 🟡 — same |
| `refusalGate` (issuer side) | ❌ — no audit row | ❌ — same, more occurrences |

**Of 11 literals tracked, 4 hold under degradation, 4 thin, 3 fail (R-CAT codes, refusalGate-without-row, unknown-actor at scale).**

The pattern: **literals that depend on a downstream surface to be explainable lose explainability fastest under degradation.** R-CAT codes, `refusalGate`, and `'unknown'` actor are all explainable in code with helper context; under degradation they appear in higher volume in places (logs, exports) without the helper context, and their opacity becomes the dominant signal.

**Resilience score for property 2: 🟡 PARTIAL.** Most literals self-describe under degradation. Three concentrated failures amplify with the degradation rate.

## Property 3 — Survivability preservation

Survivability is the forensic-investigation property: can a future reader reconstruct what happened? Under degradation, survivability tests at five seams:

| Seam | Survives? | Why |
|---|---|---|
| **Per-capsule replay** | ✅ | Determinism is the design constraint; same inputs, same output, every time |
| **Bundle integrity** (within delivered set) | ✅ | Hash over delivered replays, recomputable end-to-end |
| **Cross-capsule timeline** | ⚠️ | Timeline endpoint exists; per-capsule queries succeed; no surface for cross-capsule semantic queries |
| **Cross-system reconstruction** (issuer ↔ employer) | ⚠️ | Both sides record; refusal seam gaps from PR8B Track B persist |
| **Bundle requested-vs-delivered** | 🔴 | Dropped capsules silently excluded; bundle hash is over delivered set only |
| **Replay-of-replay continuity** | ⚠️ | Replay is on-demand; replay history is not durable; an investigator running multiple replays leaves no trace |
| **Audit-row durability** | ⚠️ | `pending_not_written` invisible; transition to durable is unobservable |
| **Attribution preservation** | ⚠️ | `'unknown'` is the silent fallback; recording is honest, identification is not |
| **Tamper detection** | ✅ | First-class output, three distinguishable failure modes |

**Survivability holds at the per-capsule, hash-and-tamper, and lane-health surfaces. Survivability thins or fails at requested-vs-delivered, replay-of-replay, audit durability, and attribution.**

The single concentrated survivability failure is **bundle requested-vs-delivered**. Of the 🔴 findings across all four W2-PR9B tracks, the bundle dropping capsules silently is the one where the platform reads as preserving forensic state and is in fact discarding it.

**Resilience score for property 3: 🟡 PARTIAL.** Per-capsule survivability is the platform's strongest property; cross-capsule survivability under partial export is the platform's weakest under degradation.

## Property 4 — Runtime honesty preservation

Runtime honesty is the property that the platform does not represent itself as healthier than it is.

The five doctrine-level anti-inflation gates:

1. **No banned strings.** ✅ Holds under all degradation modes (Property 1).
2. **No bare `Verified`.** ✅ Holds.
3. **`decisionGrade: false` is literal, not boolean-coerced.** ✅ Holds.
4. **`recordedBy: 'demo'` is preserved.** ✅ Holds.
5. **`tamperEvidence` populates honestly.** ✅ Holds.

Beyond the doctrine, runtime honesty under degradation depends on whether the platform actively represents its own degraded state.

| Self-representation gate | Holds? |
|---|---|
| **Lane health badge updates** when a lane degrades | ✅ |
| **`tamperEvidence` populates** when a hash mismatch occurs | ✅ |
| **Readiness regresses** to `CHECKING`/`BLOCKED`/`PARTIAL` when source coverage drops | ✅ |
| **Trust band regresses** when underlying state changes | ✅ |
| **`'unknown'` actor** is recorded | ✅ |
| **`pending_not_written`** is recorded in code | ✅ |
| **Audit-write durability state** is surfaced to operator | ❌ |
| **Bundle reports requested-vs-delivered** | ❌ |
| **Replay reports degraded reconstruction** (e.g., partial artifacts) | ❌ |
| **Retry storm flagged as a storm** | ❌ |
| **Issuer-side refusal flagged in audit table** | ❌ |
| **Cross-capsule failure summarized** | ❌ |

**6 of 12 self-representation gates hold; 6 do not.**

The pattern: **the platform tells the truth about *current state* (lane, hash, readiness, trust band, actor) and is silent about *past degraded state* (durability, request manifest, retry pattern, refusal lineage, cross-capsule fragility).** Runtime honesty is preserved at the moment-of-degradation; runtime honesty is partial about the historical record of degradation.

**Resilience score for property 4: 🟡 PARTIAL.** No representations are dishonest. Half the self-representation surfaces that *would* fully describe degradation do not exist yet.

## The four-property resilience matrix

|  | Truth | Explainability | Survivability | Honesty |
|---|---|---|---|---|
| **Retry storm** | 🟢 | 🟡 | 🟡 | 🟡 |
| **Async lag** | 🟢 | 🟡 | 🟡 | 🟡 |
| **Export lag** | 🟢 | 🟡 | 🟠 | 🟡 |
| **Partial export** | 🟢 | 🟡 | 🔴 | 🟠 |
| **Attribution loss** | 🟢 | 🟠 | 🟠 | 🟢 |
| **Audit-write lag** | 🟢 | 🟠 | 🟡 | 🟠 |
| **Hash mismatch** | 🟢 | 🟢 | 🟢 | 🟢 |
| **Lane degradation** | 🟢 | 🟢 | 🟢 | 🟢 |

**Truth is the single column where every cell is 🟢.** Across 8 degradation modes × 4 properties = 32 cells, the truth column is unbroken. The other columns thin in concentrated places.

The two cells that are 🔴 / 🟠 in survivability and honesty are both partial export. **Partial export is the single most consequential degradation mode in the codebase**, because it produces a bundle that reads as healthy when the underlying data behind it was incomplete.

## Channels intentionally undefended under degradation

Some apparent degradation gaps are right calls.

### No retry-deduplication contract at the audit layer

A retry-dedup contract would require correlation IDs to be caller-supplied (and idempotent over the audit table). The current design lets each call generate its own correlation ID and records each as its own row. PR8B Track A: "the runtime trust cohesion plumbing is invisible to the operator-query layer" — the data to detect retries is recorded; the layer to reason about retries is operator-side.

This is correct for the audit layer. It is wrong for the operator layer when retries become noisy.

### No replay-of-replay event

PR8B Track C: "replay is a verb without a noun." Under heavy investigation, this means investigation activity does not pollute the audit table. The cost is that investigation history is not reconstructible.

This is the right call for the audit table. It is the wrong call for the investigator surface.

### No "this bundle is best-effort" marker

`buildAuditBundle` reports `capsuleCount: <survived>`. Without a `requested` count, the bundle reads as "complete." Adding a manifest would change the schema; the wave was scoped to leave the contract layer unbroken.

This is a deferred call, not a wrong one. It becomes wrong the moment a regulator reads a partial bundle as complete.

## Resilience improvements that are in-scope for this analysis

This document does not recommend implementations. It identifies the *resilience improvements that would have the highest return* if scheduled into a future wave, ranked by where they sit on the four-property matrix.

| Improvement (named, not designed) | Property addressed | Cells improved | Cost |
|---|---|---|---|
| Bundle manifest field (`requestedCapsuleCount`, `deliveredCapsuleCount`, `droppedCapsuleIds`) | Survivability + Honesty | partial-export 🔴 → 🟡 | 1 schema field |
| `REPLAY_PERFORMED` audit event type with `actor`, `capsuleId`, `replayedAt` | Survivability + Honesty | replay-incident invisibility → visible | 1 event type, no derivation change |
| `audit_write_durability` query / metric | Honesty + Explainability | `pending_not_written` invisible → readable | 1 metric, the data exists in code |
| `mutation_fingerprint` group-by query parameter on the timeline endpoint | Survivability + Honesty | retry storm fragmented → coherent | 1 query parameter, the data exists |
| `ISSUER_REVIEW_REFUSED` audit event type bound to `refusalGate` | Survivability + Explainability | issuer-side refusal lineage → recorded | 1 event type, 1 helper write |
| R-CAT human-label sidecar (the lookup that PR8B runtime query explainability already named) | Explainability | R-CAT-6 outer envelope masking → labeled | 1 static map, 1 enrichment field |
| `actorType: 'AI_AGENT'` extension to `RuntimeTrustActor.actorType` | Survivability + Honesty | AI-driven mutations recorded as `'human'` → `'AI_AGENT'` | 1 enum value, 1 code path |

Each item is a small, surgical, contract-additive change. None redesign architecture. None merge as part of this wave.

The resilience improvement with the **highest leverage** is the **bundle manifest field** (item 1). It promotes a 🔴 cell to 🟡 in two of the four properties, addresses the single most consequential silent failure in the codebase, and costs one schema field. Nothing else in the matrix has a comparable ratio of impact to scope.

## Verdict

**Operational trust resilience is anchored in truth and silent in the surfaces around truth.**

Across 32 cells (8 degradation modes × 4 properties), the truth column is unbroken; the explainability, survivability, and honesty columns thin in concentrated, predictable places, with two 🔴 cells both attributable to partial export.

The four-property profile under degradation:

- **Truth: 🟢 PRESERVED.** No banned string, no inflation, no demo-vs-real bleed, no hash dishonesty, no `decisionGrade` widening.
- **Explainability: 🟡 PARTIAL.** R-CAT codes, `refusalGate`-without-row, and unknown-actor-at-scale dominate when degradation amplifies them.
- **Survivability: 🟡 PARTIAL.** Per-capsule survival is the platform's strongest property; bundle requested-vs-delivered is its weakest.
- **Honesty: 🟡 PARTIAL.** The platform tells the truth about its current state and is silent about its historical degraded state.

The wave's contract-over-surface ordering is the correct one. The truth floor is the load-bearing property; everything else builds on top of it. The surfaces that go silent under degradation go silent without breaking the floor.

The single resilience improvement with the highest leverage is the **bundle manifest field**. It is a one-field schema addition that converts the most consequential silent failure in the codebase from 🔴 to 🟡 and is contract-additive (no removals, no migrations, no UI required to be correct).

**Track D score: 🟡 PARTIAL.** Strongest resilience property: truth-floor preservation. Weakest resilience property: requested-vs-delivered honesty under partial export. **Operational trust resilience is high where it matters most (the truth contract) and partial in the surfaces around it — exactly where the wave was scoped to leave it, and exactly where degradation makes the next wave necessary.**
