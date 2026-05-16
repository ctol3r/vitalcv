# Governance Response Survivability — W2-PR14B Track D

**Wave:** W2-PR14B — Operator Constitutional Response Explainability
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [containment-explainability](containment-explainability.md), [escalation-explainability](escalation-explainability.md), [constitutional-response-continuity](constitutional-response-continuity.md).
**Builds on:** [governance-collapse-survivability](governance-collapse-survivability.md), [governance-awareness-survivability](governance-awareness-survivability.md), [longitudinal-governance-survivability](longitudinal-governance-survivability.md), [stress-state-explainability](stress-state-explainability.md), [silent-fragmentation-awareness](silent-fragmentation-awareness.md).

---

## What this track answers

PR13B Track D asked whether governance, integrity, forensic, and survivability properties survived three escalation modes (constitutional breach, fragmentation, degraded-runtime). PR12B Track D asked whether the *visibility* of governance, integrity, drift, and survivability survived four named degraded scenarios. **This track asks the third-tier survivability question: when the platform is mid-cascade, mid-fragmentation, mid-replay-collapse, mid-export-fragmentation, do the response surfaces themselves preserve five named visibilities — containment, escalation, replay honesty, survivability honesty, forensic caution — or does the response surface collapse precisely when the operator most needs it?**

The risk vector here is **awareness collapse during response**: the surface that would have warned an operator goes silent at the moment an operator is performing a high-stakes action, because the surface and the action share an underlying subsystem that is itself degraded. A platform whose response-surface honesty is conditional on the response-surface subsystem being healthy is a platform whose honesty fails when honesty is most needed.

This track scores five visibilities × four degradation modes.

## The five response-surface visibilities

- **Containment visibility:** the surface continues to render which CT-* state holds (CT-GREEN / CT-DEGRADED / CT-FRAGMENTING / CT-ESCALATING / CT-VIOLATION) during the degradation.
- **Escalation visibility:** the surface continues to render direction (escalating / holding / recovering) across the five vectors of [escalation-explainability](escalation-explainability.md).
- **Replay honesty:** the platform's claims about replay output ([runtime-honesty-continuity](runtime-honesty-continuity.md)) continue to hold — recorded fields are recorded, computed fields are computed, outer category is outer.
- **Survivability honesty:** the platform's claims about its own records ([runtime-honesty-continuity](runtime-honesty-continuity.md)) continue to hold — `pending_not_written` is not durability, `bundleHash` is not completeness.
- **Forensic caution:** the platform continues to refuse claims its rows do not earn — bundle remains best-effort, refusal floor remains zero (and visibly so), absent rows are not absent events.

## The four compounding degradation modes

- **Cascading degradation:** lane flap + capsule defer + replay age-out + bundle in flight, in sequence ([stress-state-explainability](stress-state-explainability.md) Scenario 1).
- **Constitutional fragmentation:** a CI-VIOLATION that hardens into operator habit over weeks; a banned-string regression caught at the wave; a regulator inquiry on a months-old bundle ([governance-collapse-survivability](governance-collapse-survivability.md) Escalation 1).
- **Replay collapse:** the replay envelope cannot be reconstructed cleanly across a window because trust-state artifacts have aged out and per-capsule provenance markers are absent ([stress-state-explainability](stress-state-explainability.md) Scenario 2).
- **Export fragmentation:** a bundle export completes "successfully" but represents a strict subset of the requested window; recipient cannot detect ([stress-state-explainability](stress-state-explainability.md) Scenario 3).

## Five-visibility × four-mode survivability scoreboard

Each cell scores whether the named visibility holds during the named degradation.

| Visibility | Cascading degradation | Constitutional fragmentation | Replay collapse | Export fragmentation |
|---|---|---|---|---|
| **Containment visibility** | 🟠 (lane-health holds; `pending_not_written` invisible; bundle silent) | 🟠 (doctrine + lane-health hold; cumulative CT-DEGRADED count unrendered) | 🟢 (replay engine `tamperEvidence` distinguishes hash vs spine; recovered chain not pretended) | 🔴 (CT-FRAGMENTING moment is invisible during the loop; bundle's structural shape inflates) |
| **Escalation visibility** | 🟠 (lane `lastSuccessAt` is the one direction signal; cross-tie absent) | 🔴 (cumulative habit-hardening has no surface; T+0 → T+7d → T+30d trajectory invisible) | 🟠 (cross-capsule replay drift trajectory invisible; investigator's own replays unrowed) | 🔴 (bundle drop rate across quarter has no signal; bundle response itself is not direction-aware) |
| **Replay honesty** | 🟡 (envelope is correct per capsule; cross-capsule provenance unmarked) | 🟢 (doctrine layer holds replay claims) | 🟠 (per-capsule replay carries `replayedAt`; envelope shape elides recorded-vs-computed under aged artifacts) | 🟡 (bundled replays carry their per-capsule provenance; the bundle envelope does not surface drop-vs-include separation) |
| **Survivability honesty** | 🔴 (`pending_not_written` invisible; bundle implies completeness; deferred rows compound silently) | 🟠 (doctrine layer holds; structural layer self-widens with each new event type and bundle field) | 🟡 (replay survivability is honest within capsule; window-survivability is not asserted) | 🔴 (bundle's `capsuleCount` is survived not requested; no `partialExport`) |
| **Forensic caution** | 🟠 (recorded actions remain durable; non-rowed actions remain not-rowed) | 🟠 (refusal floor zero; replay invocations not rowed; cumulative gap grows) | 🟢 (replay engine refuses claims its inputs cannot support — `tamperEvidence` is detection, not prevention; bundle hash methodology is named) | 🔴 (bundle is best-effort; `verificationInstructions.how` reads as offline-verifiable; recipient has no log access) |

**Tally across 20 cells:** 2 🟢, 4 🟡, 8 🟠, 6 🔴.

**Pattern:**

- **Containment visibility** survives best in replay collapse (the replay engine's existing tamper-evidence machinery is a real defense), worst in export fragmentation (the bundle is itself the moment of fragmentation, with no rendered signal).
- **Escalation visibility** is uniformly the weakest row — direction signals exist only on lane-health, and degrade across every mode.
- **Replay honesty** is the most resilient row (one 🟢, two 🟡, one 🟠) — the doctrine layer + per-capsule determinism do most of the work.
- **Survivability honesty** is the second-weakest row — two 🔴 in cascading and export fragmentation, where the platform's structural claims (bundle = complete, `eventState` not rendered) inflate against the contract.
- **Forensic caution** is uneven — 🟢 in replay collapse (the replay engine is the locus of caution), 🔴 in export fragmentation (the bundle is the locus of inflation).

## Sub-property survivability roll-up

Aggregating across the four modes (worst-cell-wins for the safety call):

| Visibility | Worst cell | Best cell | Composite verdict |
|---|---|---|---|
| Containment visibility | 🔴 (export) | 🟢 (replay collapse) | 🟠 PARTIAL — survives replay collapse; collapses during the export loop |
| Escalation visibility | 🔴 (constitutional, export) | 🟠 (cascading) | 🔴 BROKEN — no mode preserves direction across vectors |
| Replay honesty | 🟠 (replay collapse) | 🟢 (constitutional) | 🟡 PARTIAL — doctrine layer holds; per-field provenance does not |
| Survivability honesty | 🔴 (cascading, export) | 🟠 (constitutional) | 🔴 BROKEN — structural inflation compounds across modes |
| Forensic caution | 🔴 (export) | 🟢 (replay collapse) | 🟠 PARTIAL — replay engine cautious; bundle is not |

**Two visibilities BROKEN, three PARTIAL, none CLEAR.** The same pattern PR13B identified at the constitutional layer projects into response-surface space: doctrine survives every escalation mode; structure and surface survive only when no compounding mode involves the export path or the cumulative-habit trajectory.

## Where awareness collapses during response

Five named collapse points an operator can hit while performing a high-stakes response action:

1. **Cascade-into-bundle (worst).** An operator handling a multi-subsystem cascade triggers `buildAuditBundle` to attach to an incident. The same cascade that produced deferred capsules and dropped audit rows produces a bundle that silently drops their replays. The bundle handed up the chain inflates; the cascade context is lost. Survivability honesty 🔴, forensic caution 🔴, escalation visibility 🟠.
2. **Cumulative-violation handoff.** Three quarterly bundles handed to compliance over nine months each dropped one or two capsules. By month nine the operator habit "bundles are complete" is rock-solid; the regulator inquiry on month one's bundle finds the drop only after a forensic-grade query. Escalation visibility 🔴 (no rate-of-change signal across the quarter), survivability honesty 🟠.
3. **Replay-during-investigation.** An investigator runs replay on six capsules across a 30-day window. The trust-state artifact for two of them aged out at day 14. Five replays return clean; one returns `'UNKNOWN'`. The investigator narrates "five clean, one anomalous"; the contract narrates "one anomalous, two with replay-time fallback (indistinguishable from anomalous), three clean." Replay honesty 🟠.
4. **Emergency-declared-then-deployed.** An operator declares emergency at 09:00; a deploy lands at 09:42; emergency state resets to `false` silently. The next operator on rotation sees `isEmergencyActive(): false` and infers the emergency cleared. Escalation visibility 🔴, survivability honesty 🔴 (the declaration was never durable to survive a deploy).
5. **Fragment-during-export.** The bundle export loop runs for ~30 seconds across 50 capsules. During those 30 seconds two capsules' replay throws (per-capsule). The loop completes, returns 48 replays. The 30-second window during which fragmentation was *active* emits no signal. Containment visibility 🔴, forensic caution 🔴.

Five collapse points; export-related modes account for three of them.

## What survives best — and why

The two 🟢 cells in the 20-cell scoreboard:

- **Containment visibility / Replay collapse 🟢:** the replay engine's `tamperEvidence` field is the single most operator-honest piece of structural code in the platform. It distinguishes three failure modes (hash mismatch, evidence-spine digest mismatch, generic replay validation failure; [replayEngine.ts:376-383](../../apps/api/backend/src/services/audit/replayEngine.ts)) and refuses to claim a recovered chain. This is the model for how response-surface honesty should look.
- **Forensic caution / Replay collapse 🟢:** same surface — the replay engine's caution about what it cannot reconstruct is the load-bearing forensic property the platform has earned.

Both 🟢 cells are in the same column (Replay collapse) and the same locus (`replayEngine.ts`). The replay engine is the platform's strongest example of an existing response surface that survives compounding stress.

The 🟡 cells (4 of 20) cluster in **Replay honesty** under cascading and export modes — the per-capsule replay shape is honest enough that even when bundled or cascaded, the per-capsule honesty does not invert. It does not survive cleanly (provenance markers absent), but it does not invert.

## What collapses first — and why

The 🔴 cluster (6 of 20) maps to two structural roots:

1. **Bundle export inflation:** `capsuleCount` over survived not requested; no `partialExport`; `verificationInstructions.how` reads as offline-verifiable. Three 🔴 cells trace to this single locus ([replayEngine.ts:550-607](../../apps/api/backend/src/services/audit/replayEngine.ts)). Recovery requires `partialExport` flag + `requestedCount` field + `how` rewrite.
2. **In-process escalation toggle:** `emergencyModeActive` is a module-local boolean ([emergencyMode.ts:7-9](../../apps/api/backend/src/services/compliance/emergencyMode.ts)). One 🔴 cell traces here. Recovery requires durable storage + audit row at declaration + cross-process consistency.

The remaining two 🔴 cells (cumulative habit trajectory in constitutional fragmentation, escalation visibility in export fragmentation) are *consequences* of the same two roots playing out over time.

**Two structural roots, six 🔴 cells.** Closing either root closes three cells. Closing both closes the whole 🔴 cluster.

## Risks and what is not in scope here

- This track does not propose closures. PR15B+ are the implementation lanes for `partialExport`, durable emergency-declaration audit, per-field replay provenance, and `eventState` rendering.
- The 🟢 column on Replay collapse should not be read as "the replay engine is fully solved." [forensic-explainability](forensic-explainability.md) and [silent-fragmentation-awareness](silent-fragmentation-awareness.md) Surface 1 register replay drift as 🟠 elsewhere; the 🟢 cells here are about the *engine's* internal honesty, not about cross-capsule recoverability.
- The composite "no row CLEAR" verdict reflects PR14B's wave brief — this is a response-surface track, not a contract-layer track. The contract layer (PR13B's CI-* analysis) has stronger results because doctrine self-heals; response surfaces depend on structure and copy that does not.

---

*See also: [containment-explainability](containment-explainability.md), [escalation-explainability](escalation-explainability.md), [constitutional-response-continuity](constitutional-response-continuity.md). PR13B's [governance-collapse-survivability](governance-collapse-survivability.md) for the constitutional-layer survivability framing this track projects into response-surface space.*
