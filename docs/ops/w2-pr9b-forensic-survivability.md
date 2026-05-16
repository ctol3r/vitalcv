# Forensic Survivability — W2-PR9B Track C

**Wave:** W2-PR9B — Degraded Runtime Explainability
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [w2-pr9b-operator-failure-understanding](w2-pr9b-operator-failure-understanding.md), [w2-pr9b-degraded-trust-state-continuity](w2-pr9b-degraded-trust-state-continuity.md), [w2-pr9b-operational-trust-resilience](w2-pr9b-operational-trust-resilience.md).
**Builds on:** [forensic-explainability](forensic-explainability.md), [w2-pr7b-operational-trust-continuity](w2-pr7b-operational-trust-continuity.md).

---

## What this track answers

PR8B Track B audited per-capsule forensic explainability on the happy path. **This track asks whether a forensic investigator could still reconstruct what happened across a degraded period** — a 30-minute window where the issuer was slow, three retries fired, an export stalled, a row landed in `pending_not_written`, an actor was attributed `'unknown'`, and a bundle dropped two capsules silently.

A reconstruction that holds in the happy path can still fail in degradation. The question is which lineages survive, which become ambiguous, and which go forensically dark.

## Definitions

- **Forensic survival:** an investigator with the recorded evidence and no insider context can still reach a defensible conclusion.
- **Forensic blind spot:** a degradation event that leaves no recoverable trace.
- **Replay ambiguity zone:** a state where replay is *possible* but produces output that admits two different interpretations.
- **Attribution ambiguity:** an action whose recorded actor cannot be reliably bound to a real person, system, or AI agent.
- **Export-query ambiguity:** an exported artifact whose contents cannot be reliably mapped to the original request.

## Reconstructibility scoreboard under degradation

| Lineage | Survives under happy path? | Survives async lag? | Survives retry storm? | Survives partial export? | Survives attribution loss? |
|---|---|---|---|---|---|
| **Replay lineage** (capsule → reconstructed evidence) | ✅ deterministic | ✅ same inputs, same output | ⚠️ each retry replays cleanly; no row attributes the retry-relationship | ⚠️ dropped capsules leave no trace in the bundle | ✅ unaffected (actor not in derivation) |
| **Denial lineage** (which gate fired, why) | ⚠️ event type collapses three reasons | ⚠️ unchanged ambiguity | 🟠 multiple denials look distinct in event-type group-by | ⚠️ dropped capsules silently exclude denials | ⚠️ denial actor may be `'unknown'` |
| **Attribution continuity** (`actor.actorId`) | ⚠️ silent fallback to `'unknown'` | ✅ unaffected by lag | ✅ each retry records its actor or `'unknown'` independently | ⚠️ dropped capsules have unknown attribution by absence | 🔴 silent fallback is attribution dark |
| **Export continuity** (bundle integrity) | ⚠️ no signature, hash only | ✅ hash recomputable | ⚠️ retries may produce many bundles, no inter-bundle linking | 🔴 dropped capsules silent; bundle still hash-valid | ✅ bundle independent of actor |
| **Mutation lineage** (one mutation → fingerprint → audit → replay) | ✅ fingerprint deterministic | ✅ unaffected | 🟠 retries dedupe by fingerprint, never by surface | ⚠️ partial bundle = partial mutation history | ⚠️ unknown actor in fingerprint inputs |
| **Refusal lineage** (issuer-side `refusalGate`) | ❌ no audit row | ❌ unchanged | ❌ unchanged | ❌ never in bundle | ❌ never has actor row |

**Tally under degradation:** 5 ✅, 11 ⚠️, 4 🟠, 4 🔴, 6 ❌.

## Forensic blind spot register

Each row below is a degradation mode that produces no recoverable forensic record at all.

### Blind spot 1 — Issuer-side refusals during the window 🔴

`refusalGate` is a return value of `policyReview.ts` helpers. It does not produce an `ISSUER_REVIEW_REFUSED` audit row, an `EMPLOYER_REVIEW_REFUSED` row, or any row keyed by `event.type`. PR8B Track B: "issuer-side `refusalGate` does not flow into the audit row at all."

Under degradation: if six refusals fire during the window (six different gates, six different clinicians), the audit table has zero rows attributable to those refusals. A forensic investigator searching the bundle for "what was refused during the window" returns nothing.

**Forensic floor: zero.** The data exists in helper return values that are not persisted.

### Blind spot 2 — Replay invocations during the incident 🔴

A forensic investigator asking "who replayed capsule X yesterday?" gets nothing. PR8B Track C: "replay is a verb without a noun." Under degradation, this is more consequential — investigators routinely run replays during an incident, and those replays leave no trace.

**Forensic floor: zero.** The replay output exists in memory and HTTP responses; nothing is durable.

### Blind spot 3 — Dropped capsules in `buildAuditBundle` 🔴

[replayEngine.ts:568-573](../../apps/api/backend/src/services/audit/replayEngine.ts) catches per-capsule replay throws, logs them, and continues. The bundle reports the survived count as `capsuleCount`. The `obs/logger` log line is durable but not bound to the bundle.

Under degradation (e.g., a partial DB outage that affects 5 of 50 capsules), the bundle delivered to a forensic consumer contains 45 capsules and an internally-consistent hash. A reader cannot tell from the bundle that 5 were dropped. The log lines have the dropped capsule IDs; the bundle does not reference the log lines.

**Forensic floor: bundle-internal integrity high; bundle-vs-request integrity zero.**

### Blind spot 4 — Audit-write failures and `pending_not_written` 🟠

The `eventState` literal exists in code. The transition from `pending_not_written` to `persisted` is the period where a real mutation has happened but the audit table does not yet say so.

Under degradation (e.g., a database hiccup that delays audit writes by 60 seconds), the gap between mutation and audit row reflects exactly this state. After the hiccup resolves, the rows land. Forensically, every row has its real timestamp, but during the hiccup, the audit table is incomplete.

**Forensic floor: timestamps survive; gap-aware reconstruction is operator-burden, not surface-burden.**

### Blind spot 5 — Retry attribution 🟠

Three retries by the same human produce three audit rows with three correlation IDs and one fingerprint. A forensic reader who group-bys correlation reads three distinct events. A reader who group-bys fingerprint reads one. A reader who group-bys neither (the typical SIEM flatten) reads three.

**Forensic floor: data exists, conclusion ambiguous.**

### Blind spot 6 — Unknown-actor mutations 🔴

`actorId === 'unknown'` is recorded. Recording is not the same as identifying. A forensic investigator asking "who did this?" gets back the literal `'unknown'`. The audit row says someone acted; the audit row does not say who.

PR8B Track B forensic ambiguity #8: "a forensic record is worse than nothing if it pretends to know who acted." Under degradation (auth flakiness, legitimate cross-system calls, header propagation bugs), the rate of unknown-actor mutations rises, and so does the rate of forensic dark spots.

**Forensic floor: zero on attribution; non-zero on temporal and action data.**

## Replay ambiguity zones under degradation

These are zones where replay produces output that admits two interpretations.

### Zone 1 — Outer R-CAT-6 vs. inner R-CAT-X 🔴

PR8B Track B / Track D both flagged this. Under degradation, every replay an investigator runs against the incident window produces an envelope with `replayCategory: 'R-CAT-6'`. The inner mutation carries the original R-CAT. **A SIEM aggregating on `replayMetadata.replayCategory` reads 100% R-CAT-6**, regardless of what the underlying actions were.

### Zone 2 — Recorded vs. computed in the replay envelope 🟠

PR8B Track B forensic ambiguity #6: `DecisionReplay` mixes fields recorded at decision time (decision, evidence, authority chain) with fields computed at replay time (`integrity.recomputedHash`, `replayedAt`, replay metadata). Under degradation, the computed fields are computed against whatever state survived the degradation. An investigator reading the envelope cannot mark which fields are time-of-decision vs. time-of-replay without source-code knowledge.

### Zone 3 — Trust state at decision vs. partial reconstruction 🟠

[replayEngine.ts:343-359](../../apps/api/backend/src/services/audit/replayEngine.ts) reads the most recent `TRUST_STATE_ENGINE` artifact at or before decision time. If artifacts are missing, falls back to `'UNKNOWN'`/`0`. Under degradation, missing artifacts are common; the literal `'UNKNOWN'` is the silent indicator that reconstruction was partial.

A naive reader of the replay envelope reads `trustBand: 'UNKNOWN'` as "the trust band was unknown at decision time." That is sometimes true and sometimes "the artifacts to compute it were missing at replay time." The two are forensically different and structurally indistinguishable in the envelope.

### Zone 4 — Hash match on a partial reconstruction 🟠

`integrity.hashMatch` compares stored hash to recomputed hash. Recomputation walks whatever artifacts the engine could read. If artifacts were dropped between decision time and replay time (e.g., by a retention policy), the recomputation produces a *different* hash from the stored one and `hashMatch: false` — but the cause is artifact loss, not tamper. The `tamperEvidence` literal includes "Evidence spine digest mismatch — referenced verification artifacts or receipts no longer replay to the stored trust-critical spine" ([replayEngine.ts:380-381](../../apps/api/backend/src/services/audit/replayEngine.ts)) which addresses this — **provided** the reader knows to read it.

A SIEM that group-bys `tamperEvidence != null` will mix tamper detections with retention-induced reconstruction failures. The literal distinguishes; the metric does not.

## Attribution ambiguity register

| Ambiguity | Where it surfaces | Severity under degradation |
|---|---|---|
| `actorType: 'unknown'` is silent fallback | every mutation row | 🔴 high |
| `attributionSource: 'x-clerk-user-id'` exports header name into forensic record | every mutation row with known attribution | 🟡 low today, increases over time (PR8B runtime explainability finding #6) |
| `verifierIdentity.userId: null` when metadata lacks it | replay envelope, bundle | 🟡 medium |
| `actorType: 'human'` for any non-`'unknown'` actor | mutation row | 🟠 medium — `'AI_AGENT'` is in the `VerifierIdentity` enum ([replayEngine.ts:58](../../apps/api/backend/src/services/audit/replayEngine.ts)) but not in the `RuntimeTrustActor.actorType` enum ([runtimeTrustCohesion.ts:32-36](../../apps/api/backend/src/services/runtimeTrustCohesion.ts)); a non-human non-`'system'` actor is silently typed `'human'` |
| Identical actor across many retries reads as many actions | timeline | 🟠 medium |

The most consequential under degradation: **`'unknown'` is structurally a silent fallback, and `'AI_AGENT'` has no representation in the mutation actor model.** Per PR8B Track B forensic ambiguity #8, these are forensically dark in different ways: `'unknown'` honestly says "we don't know"; the missing AI_AGENT taxonomy means an AI-driven mutation is recorded as `'human'`.

## Export-query ambiguity register

| Ambiguity | Surfaces in | Cause |
|---|---|---|
| Bundle reports `capsuleCount: <survived>` | `buildAuditBundle` output | Per-capsule throws are caught and dropped silently |
| Bundle has no `requested` count | bundle schema | Schema does not include "what was asked for" |
| `bundleHash` is internally consistent over `<survived>` | bundle integrity | Hash is over the included replays, not the requested set |
| Per-capsule replay errors logged to `obs/logger` only | logger | No bundle field references the log line |
| Multiple bundles produced for the same NPI are not linked | bundle schema | No `parentBundleId`, `previousBundleId`, or `lineageId` on the bundle |
| `verificationInstructions.how` does not mention partial-export semantics | bundle schema | Says "verify integrity.hashMatch === true" — and it will be true for survived capsules |

**The export-query ambiguity is concentrated in one place: the bundle does not encode the difference between "I exported what was asked for" and "I exported what survived."**

## Mutation lineage under degradation

A clean mutation has a clean lineage:
- HTTP request → route handler → `buildRuntimeMutationMetadata` → audit row + side effect → reproducible via fingerprint.

Under degradation, the lineage develops gaps at predictable seams:

| Seam | Behavior | Forensic consequence |
|---|---|---|
| **Request** → **route handler** | rate-limit / auth gate fires | `RATE_LIMIT_HIT` or `VALIDATION_ERROR` audit row; not bound to the `runtimeTrust` mutation taxonomy |
| **Route handler** → **`buildRuntimeMutationMetadata`** | always runs on the actual write path | clean |
| **`buildRuntimeMutationMetadata`** → **audit row** | depends on persistence layer; `pending_not_written` is the default | the row may not yet be durable when the response is returned |
| **Audit row** → **side effect** | side effect happens regardless of audit durability | side effect can outrun audit; the inverse is impossible by construction |
| **Audit row** → **replay** | only durable rows replay; pending rows are not in the bundle | a replay run during the durability gap is missing the most recent action |
| **Replay** → **bundle export** | per-capsule errors are dropped silently | bundle is best-effort |

**The seam that concentrates degradation lineage risk is `audit row → replay`**, not because it fails, but because it depends on the `audit row → durable storage` transition that is invisible at every operator surface.

## What an outside auditor sees in the degraded window

Imagine a HIPAA-trained compliance auditor opening the export bundle for the 30-minute degraded window described in this doc.

| Question | Can the auditor answer it? |
|---|---|
| What decisions completed during the window? | ✅ — bundle replays preserve them |
| What decisions were attempted but did not complete? | ❌ — no row for incomplete attempts |
| What was refused during the window? | ⚠️ — employer-side denials appear; issuer-side `refusalGate` does not |
| Were any of the recorded actions retries of the same logical mutation? | ⚠️ — fingerprint group-by reveals it; bundle does not flag it |
| Was every action attributable to a known actor? | ⚠️ — `'unknown'` rows are visible; the rate is reader-derived |
| Did any audit row land outside the window's timestamps? | ❌ — `eventState` not in the bundle; durability lag invisible |
| Were any capsules dropped from this export? | ❌ — bundle does not encode requested-vs-delivered |
| Were any replays performed during the incident? | ❌ — replay is a noun without a row |
| Was any AI agent involved? | ❌ — `actorType` does not encode `'AI_AGENT'` |
| Were any source-coverage lanes degraded? | ✅ — `MONITORING_STATUS_CHANGE` rows |
| Did any tamper detection fire? | ✅ — `tamperEvidence` populated |

**Score: 3 ✅, 3 ⚠️, 5 ❌.** Per-capsule reconstruction holds; cross-degradation reconstruction has five forensic dark spots, three of which are 🔴 (refusal lineage, replay invocation lineage, dropped-capsule lineage).

## Verdict

**Forensic survivability is high inside a single capsule, fragmented across the degraded window, and dark at six specific seams.**

The contract-layer hashes hold. The replay envelope is deterministic. The bundle is internally consistent. Every mutation that lands in the audit table is reconstructible from that table. A forensic investigator handed a bundle for an undegraded capsule walks away with a coherent story.

The fragmentation appears at exactly the seams that PR8B Track B identified — issuer-side refusal lineage, replay-as-verb-without-noun, bundle-as-best-effort, attribution silent-fallback — and degradation amplifies their consequence rather than introducing new ones.

The six forensic blind spots in the register, ranked by how much they hide:

1. **Issuer-side refusals during the window** (Blind spot 1) — zero forensic record.
2. **Replay invocations during the incident** (Blind spot 2) — zero forensic record.
3. **Dropped capsules in `buildAuditBundle`** (Blind spot 3) — bundle integrity intact, requested-vs-delivered invisible.
4. **Unknown-actor mutations** (Blind spot 6) — actor recorded, identity dark.
5. **Audit-write durability lag** (Blind spot 4) — timestamps survive, gap invisible.
6. **Retry attribution** (Blind spot 5) — fingerprint distinguishes, no surface group-bys.

The first three are the structural shape of the wave's deliberate ordering: contract over surface, recorded over queryable, internal consistency over external manifest. They are intentional today. They become next-wave work the moment a regulator, an SRE postmortem, or a customer-success investigation needs to read the system back.

**Track C score: 🟠 PARTIAL with three 🔴 hotspots.** Strongest forensic surface: per-capsule replay determinism, robust under all five degradation modes. Weakest forensic surface: requested-vs-delivered bundle integrity. Most concentrated forensic dark spot: issuer-side refusal lineage. **Forensic survivability is high in a healthy bundle and partial across a degraded window — the recorded data is honest, the cross-event reconstruction surface is unfinished.**
