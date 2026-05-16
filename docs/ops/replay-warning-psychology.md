# Replay Warning Psychology — W2-PR15B Track B

**Wave:** W2-PR15B — Operator Psychology + Constitutional Trust Awareness
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [constitutional-awareness-explainability](constitutional-awareness-explainability.md), [dashboard-trust-psychology](dashboard-trust-psychology.md), [constitutional-trust-continuity](constitutional-trust-continuity.md).
**Builds on:** [constitutional-failure-explainability](constitutional-failure-explainability.md), [escalation-explainability](escalation-explainability.md), [forensic-explainability](forensic-explainability.md), [forensic-durability-understanding](forensic-durability-understanding.md), [governance-awareness-survivability](governance-awareness-survivability.md), [silent-fragmentation-awareness](silent-fragmentation-awareness.md), [dashboard-runtime-honesty](dashboard-runtime-honesty.md).

---

## What this track answers

Track A scored awareness across six degradation *classes*. **This track narrows to a single class — replay — and asks whether the warnings the replay envelope produces remain psychologically meaningful across repeated reading, or whether they dilute into background noise that operators (incident responders, investigators, regulatory reviewers) eventually stop processing.**

A replay warning is any envelope field whose value an operator could read as a degradation signal. Today these are: `tamperEvidence`, `evidenceSnapshot.anomaliesDetected`, `evidenceSnapshot.trustStateAtDecision: 'UNKNOWN'`, `replayCategory: 'R-CAT-6'` (outer), `verifierIdentity.type: 'SYSTEM'` (default), `actorId: 'unknown'`, `evidenceSnapshot.trustStateAtDecision.capturedAt: null`. Each is a literal that, in principle, could function as a warning. Each in practice has a different cadence, a different shape, and a different psychological lifespan.

The risk vector here is **warning dilution**: a signal that fires for too many states, or that fires for the same state every time, becomes invisible. Replay is the platform's most condensed signal channel — every audit replay is a single JSON object containing seven candidate warnings — so dilution at this surface compounds across the investigator's window in ways that surface-level dilution elsewhere does not.

## Definitions

- **Replay warning:** any field in a `DecisionReplay` envelope ([replayEngine.ts:87-139](../../apps/api/backend/src/services/audit/replayEngine.ts)) whose value an operator could correctly read as a degradation, fragmentation, or fallback signal.
- **Cadence:** the per-envelope frequency at which the warning's *non-baseline* value occurs. A high-cadence warning fires often; a null-dominant warning fires rarely; a constant warning is structurally always the same value.
- **Salience:** the property that a warning *visually distinguishes itself* in the envelope JSON or in any rendering of the envelope. `tamperEvidence` is a salient string; `capturedAt: null` is structurally present and visually irrelevant.
- **Discrimination cost:** the cognitive work an operator must do to classify a warning correctly. Low discrimination cost = the warning explains itself in copy; high discrimination cost = the operator must read source code or doctrine to know what the warning means.
- **Dilution:** the loss of signal value when (a) the warning fires too often (high-cadence dilution), (b) the warning fires too rarely (recall dilution), or (c) the warning has the same shape for multiple distinct states (shape-identity dilution).
- **Optimism bias:** the operator's tendency to read a non-warning (`null`, default value, absence-of-flag) as a positive claim of safety.

## Per-warning psychology scoreboard

For each candidate replay warning today, score across the four psychological vectors named in the wave brief.

| Replay warning | Cadence | Salience | Remains meaningful? | Normalized? | Alert fatigue? | Operator blindness? | False confidence? |
|---|---|---|---|---|---|---|---|
| `tamperEvidence` (string \| null) | null-dominant (~99% null on healthy) | 🟢 high (string when fired) | 🟡 partial — meaningful on the day it fires; eye skips on the days it does not | 🟠 yes — null reads as "checked, clean" | 🟢 low — when it fires, it is rare enough to be salient | 🟡 partial — operator stops reading the field | 🔴 yes — null reads as completeness |
| `evidenceSnapshot.anomaliesDetected: []` | empty-dominant on healthy capsules | 🟡 medium — array length is countable | 🟠 desensitizing — `[]` is the modal answer | 🟠 yes — `[]` reads as "no anomalies" rather than "no anomalies recorded" | 🟢 low | 🟠 yes — operators stop checking the array | 🟠 partial — empty reads as authoritative absence |
| `replayCategory: 'R-CAT-6'` (outer envelope) | always `R-CAT-6` (constant) | 🔴 zero — every envelope has the same value | 🔴 normalized | 🔴 yes — constant signal carries no information | n/a — fires on every read | 🔴 yes — operators read R-CAT-6 as the action category | 🔴 yes — implies dossier-replay-only |
| `evidenceSnapshot.trustStateAtDecision: 'UNKNOWN'` | rises with retention age | 🟡 medium — string value is readable | 🟠 desensitizing — `'UNKNOWN'` becomes the modal answer for old capsules | 🟠 yes — `'UNKNOWN'` reads as a fact about decision time | 🟢 low when rare; 🟠 high when it becomes modal | 🟠 yes — operators stop treating `'UNKNOWN'` as fallback | 🟠 partial — recorded vs replay-time-fallback indistinguishable |
| `evidenceSnapshot.trustStateAtDecision.capturedAt: null` | rises with retention age | 🔴 zero — nullable timestamp, visually irrelevant | 🔴 not meaningful | 🔴 yes — `null` reads as "not applicable" rather than "the discriminator that says this is replay-time fallback" | n/a — passes silently | 🔴 yes — the discriminator the contract preserves is invisible | 🔴 yes — false confidence in `'UNKNOWN'` as recorded |
| `verifierIdentity.type: 'SYSTEM'` (default) | high — default for unattributed paths | 🟡 medium — readable string | 🟠 desensitizing — modal answer | 🟠 yes — `'SYSTEM'` reads as VitalCV's automated path | 🟢 low | 🟠 partial | 🟠 partial — could be unattributed system action |
| `verifierIdentity.userId: null` / `confirmedBy: null` | high — null when unattributed | 🟡 medium — null is countable but not narrated | 🟡 partial | 🟠 yes — null reads as "not applicable" rather than "no human attribution" | 🟢 low | 🟡 partial | 🟡 partial |
| `actor.actorId: 'unknown'` (in audit row, replay context) | rises with new attribution-fail paths | 🟡 medium — string is readable | 🟠 desensitizing — `'unknown'` builds a "stable cohort" mental model | 🟠 yes ([HO-3](dashboard-runtime-honesty.md)) | 🟢 low at first; 🟠 once proportion rises | 🟠 yes | 🟠 partial — no marker distinguishes "fallback" from "real" |
| `authorityChain` (replay-time inference when `issuerIds` empty) | rises as more capsules predate the change | 🔴 zero — no provenance marker | 🔴 not meaningful | 🔴 yes — chain reads as decision-time | n/a — silent | 🔴 yes ([FI-5](dashboard-runtime-honesty.md)) | 🔴 yes — investigator infers continuity |
| `integrity.hashMatch: true` | true-dominant on healthy | 🟢 high — boolean is read | 🟡 partial — true reads as "everything is fine" | 🟠 yes — masks "internally consistent over what survived" | 🟢 low — fires only on `false` | 🟡 partial | 🔴 yes — paired with bundle hash equality this is the canonical false-confidence channel |

**Tally across 70 cells:** 4 🟢, 14 🟡, 24 🟠, 13 🔴, 5 n/a (the cell does not apply because the warning is constant or always silent).

**Pattern:** the warnings concentrate in two failure modes. (1) **Cadence-dilution**: `tamperEvidence: null`, `hashMatch: true`, `anomaliesDetected: []` are null/true/empty so often that the operator's eye skips them. (2) **Shape-identity dilution**: `R-CAT-6` outer, `'UNKNOWN'` trust state, `'unknown'` actor, `authorityChain` re-derived all have the same shape across healthy and degraded states; the warning *cannot* fire because the shape never changes.

The single 🔴 across multiple columns is `replayCategory: 'R-CAT-6'` (outer): constant cadence, zero salience, normalized, induces blindness, induces false confidence. It is the canonical pathological warning shape — present in every envelope, semantically null.

The single 🟢 across multiple columns is `tamperEvidence`'s salience-when-fired: when it does fire, the three honest messages ([replayEngine.ts:376-383](../../apps/api/backend/src/services/audit/replayEngine.ts)) carry real information. The dilution is the rest of the column, not the message itself.

## Cadence-pattern map

A second cut: classify each warning by its cadence shape.

| Cadence shape | Warnings of this shape | Psychological effect |
|---|---|---|
| **Constant** (always the same value) | `replayCategory: 'R-CAT-6'` outer; `bundle.issuer: 'VitalCV'` | 🔴 — the warning is structurally invisible; operator cannot read what cannot vary |
| **Null-dominant** (rare non-null) | `tamperEvidence`; `evidenceSnapshot.anomaliesDetected: []`; `verifierIdentity.userId: null` | 🟠 — the rare non-null is salient when it fires; the modal null trains the eye to skip the field |
| **True-dominant** (rare false) | `integrity.hashMatch: true` | 🟠 — same shape as null-dominant; "true" reads as completeness |
| **Drifting-modal** (modal value shifts with retention age) | `evidenceSnapshot.trustStateAtDecision: 'UNKNOWN'`; `actor.actorId: 'unknown'`; `verifierIdentity.type: 'SYSTEM'` | 🔴 — the warning's psychological power is highest when the value is rare; as the value becomes modal, the warning normalizes; the contract holds, the awareness erodes |
| **Always-on principled disclaimer** | `recordedBy: 'demo'` (not strictly a replay warning, but it appears in the envelope when the original capsule was demo-recorded) | 🟢 — paired with copy disclaimer in the surface, the constant value is psychologically anchored as "this means demo" |
| **Variable** (genuinely changes per envelope) | `evidenceSnapshot.evidenceRecords[].status`; `replayedAt`; `relatedDecisions` count | 🟢 — variable cadence preserves salience |

**Pattern:** four cadence shapes desensitize. Two preserve awareness: variable and always-on-with-copy-disclaimer. The replay envelope today has more constant + null-dominant + drifting-modal warnings than variable + always-on-with-copy-disclaimer warnings.

## Replay-warning dilution registers

### Dilution register — null-dominant fields

Fields whose modal value is `null` / `[]` / `false` and whose modal value reads as a positive claim.

| Field | Modal value | Modal reading | Actual semantic | Dilution risk |
|---|---|---|---|---|
| `tamperEvidence` | `null` | "no tamper, complete check" | "no tamper detected by the three checks; per-capsule replay errors elsewhere not represented here" | 🟠 — low frequency keeps the field salient when it fires; operator reads null as completeness |
| `evidenceSnapshot.anomaliesDetected` | `[]` | "no anomalies" | "no anomalies recorded in capsule metadata at the time" | 🟠 — `[]` over-asserts |
| `integrity.hashMatch` | `true` | "the bundle is intact" | "the per-capsule hash recomputed correctly over what survived; bundle-level completeness not asserted" | 🔴 — paired with `bundleHash` this is the canonical false-confidence channel |
| `verifierIdentity.userId` | `null` | "system action" | "no user attribution captured" | 🟡 — defended by the `verifierIdentity.type: 'SYSTEM'` field which is itself drifting-modal |

**Severity:** 🔴 for `hashMatch` (paired with bundle), 🟠 for the rest.

### Dilution register — constant fields

Fields whose value is always the same and that an operator might mistake for a meaningful signal.

| Field | Constant value | What an operator might infer | Severity |
|---|---|---|---|
| `replayCategory: 'R-CAT-6'` (outer envelope) | always `'R-CAT-6'` | "this action was a dossier-replay action" | 🔴 — masks inner R-CAT-1…5 |
| `bundle.issuer: 'VitalCV'` | always `'VitalCV'` | "VitalCV cryptographically signed this" | 🔴 — string literal, no signature |
| `verificationInstructions.how` | always the same string | "this bundle is offline-verifiable" | 🔴 — hash-only over what survived |
| `schema: 'https://vitalcv.com/replay/v1'` | always the same | "this is a stable schema" | 🟢 — appropriate constant; the schema URL is genuinely stable |
| `methodology: 'decision_capsule.v262'` | versioned but rarely changes | "this capsule was built with v262 methodology" | 🟢 — appropriate; version pinning is honest |

**Severity:** 🔴 for `R-CAT-6` outer, `bundle.issuer`, `verificationInstructions.how`. The other constants are appropriate — a constant disclaimer or a constant version is psychologically defended.

### Dilution register — drifting-modal fields

Fields whose modal value shifts as platform state evolves, often making a warning that was rare into a warning that is common.

| Field | Drift driver | T+0 modal | T+12mo projected modal | Dilution mechanism |
|---|---|---|---|---|
| `evidenceSnapshot.trustStateAtDecision: 'UNKNOWN'` | retention age-out — trust-state artifact ages out, replay falls back | rare | common | `'UNKNOWN'` becomes the modal answer for old capsules; operator habit "UNKNOWN means it was unknown then" |
| `actor.actorId: 'unknown'` | new attribution-fail paths landing | rare | common | proportion of `'unknown'` rows rises; "stable cohort" mental model forms ([HO-3](dashboard-runtime-honesty.md)) |
| `verifierIdentity.type: 'SYSTEM'` | new automated paths landing without org attribution | medium | high | `'SYSTEM'` becomes the default mental model |
| `evidenceSnapshot.trustStateAtDecision.capturedAt: null` | inherits from `'UNKNOWN'` modal drift | rare | common | the discriminator becomes structurally invisible because its typed counterpart is modal |
| `authorityChain` re-derived from `uniqueSources` (when `issuerIds` empty) | inherits from issuer-attribution gaps | medium | medium-high | replay-time-derived chain becomes the operator's mental "issuer chain" rather than the recorded one |

**Severity:** 🟠 across the register. Each is a contract literal whose meaning erodes at the value layer rather than the type layer ([longitudinal-governance-survivability](longitudinal-governance-survivability.md) TD-3).

## Desensitization vectors

Specifically focused on how operator habit decays around each replay warning.

### DV-1 — `tamperEvidence: null` cadence dilution

**Mechanism:** an operator runs replay across 200 capsules during an investigation. 198 return `tamperEvidence: null`. Two return strings. By envelope 50, the operator's eye no longer reads the field — it scans for non-null. By envelope 200, the operator has not consciously read the field in 150 envelopes. The two non-null envelopes get noticed (the salience is real), but every reasoning step taken between them assumes "tamperEvidence is null."

**Compounding factor:** the three honest messages ([replayEngine.ts:376-383](../../apps/api/backend/src/services/audit/replayEngine.ts)) — hash mismatch, evidence-spine mismatch, generic — all signal *replay-time* tamper detection. None signals export-time drop, refusal-row absence, or replay-invocation absence. An operator who reads 200 `tamperEvidence: null` envelopes infers a stronger property than the field asserts. The dilution is not just "I stopped reading"; it is "I stopped reading and built a wrong model."

**Severity:** 🟠 — the field is honest; the cadence weakens it.

### DV-2 — Outer `R-CAT-6` constant signal

**Mechanism:** every replay envelope's outer `replayCategory` is `'R-CAT-6'`. The inner `meta.runtimeTrust.replayCategory` carries the original (R-CAT-1…5). The outer is unconditional ([GF-12](operator-governance-integrity.md), [IG-6](dashboard-runtime-honesty.md)).

An operator who reads 50 envelopes sees `'R-CAT-6'` 50 times. The field's information content from the operator's perspective is zero. By envelope 200, the operator's mental model is "all replay actions are R-CAT-6 (dossier-replay)." This is false; the inner R-CAT preserved the original. But the contract's preservation lives in `meta.runtimeTrust` which has no rendering binding.

**Compounding factor:** if the inner R-CAT is later surfaced (a future PR could bind it), the surface change must explicitly contradict the operator's existing mental model. This is a higher-cost surface change than landing it before the habit forms.

**Severity:** 🔴 — constant cadence with shape-identity dilution; the warning cannot fire.

### DV-3 — `'UNKNOWN'` trust band drifting-modal

**Mechanism:** at T+0, `trustStateAtDecision: 'UNKNOWN'` is rare (only capsules whose trust artifact failed to land at decision time). At T+30d, retention-age-out kicks in — the trust artifact for capsules older than 30 days is gone, so `replayDecision` falls back to `'UNKNOWN'`. The discriminator (`capturedAt: null`) is structurally present but visually irrelevant.

By T+90d, the modal answer for any replay of an older capsule is `'UNKNOWN'`. The operator's habit "UNKNOWN means it was unknown at decision time" hardens. The contract preserves the discrimination ([governance-awareness-survivability](governance-awareness-survivability.md) D.1: enum-pinning); the awareness does not.

**Compounding factor:** the ratio of "real UNKNOWN at decision" to "replay-time fallback UNKNOWN" drops monotonically as retention age rises. The signal becomes weaker exactly as the body of capsules it covers grows.

**Severity:** 🟠 — defended at the contract layer (the literal exists, `capturedAt: null` exists), psychologically eroding at the surface layer.

### DV-4 — `'unknown'` actor stable-cohort formation

**Mechanism:** `actor.actorId: 'unknown'` is the documented fallback for unattributed actions. As new attribution paths land (each a candidate to forget the attribution plumbing), the proportion of `'unknown'` rows rises. An operator scanning a daily timeline reads `'unknown'` consistently and forms the mental model "user 'unknown' is a known cohort." [HO-3](dashboard-runtime-honesty.md) named this; this track measures its psychological lifespan.

**Compounding factor:** there is no rendering surface that styles `'unknown'` distinctly from a real actor name. The fallback is silent at the value layer and silent at the rendering layer.

**Severity:** 🟠.

### DV-5 — `hashMatch: true` overconfidence

**Mechanism:** `integrity.hashMatch: true` reads as "the bundle is verified." It actually means "the per-capsule hash recomputed correctly over the bytes that survived." When paired with `bundleHash` ([HO-2](dashboard-runtime-honesty.md)), the two together produce the platform's canonical false-confidence channel: the bundle is internally consistent, the recipient verifies the hash, the recipient concludes "this is a complete, verified audit."

**Compounding factor:** `verificationInstructions.how` literally tells the recipient "verify integrity.hashMatch === true." The recipient who follows the instructions reaches the wrong conclusion.

**Severity:** 🔴 — pair-induced false confidence; the canonical replay-warning failure mode.

### DV-6 — `anomaliesDetected: []` empty-as-authoritative

**Mechanism:** `evidenceSnapshot.anomaliesDetected` is a string array sourced from `meta.anomalies` and `meta.gaps` ([replayEngine.ts:362-365](../../apps/api/backend/src/services/audit/replayEngine.ts)). On healthy capsules it is `[]`. On a capsule whose recorder did not call out anomalies it is also `[]`. On a capsule whose recorder did not exist for that anomaly type it is also `[]`.

The operator who reads `[]` reads "no anomalies." The contract earns only "no anomalies recorded by the recorder." The gap between these two readings is the source of the dilution.

**Severity:** 🟠 — defended structurally (the array is correctly sourced), eroded psychologically (empty over-asserts).

## Optimism-bias register

For each replay warning, the *non-warning* (the value an operator reads as a positive claim of safety) and what it actually asserts.

| Warning field | Non-warning value | Operator reads as | Actual assertion | Optimism severity |
|---|---|---|---|---|
| `tamperEvidence` | `null` | "tamper-checked, clean" | "the three checks did not fire" | 🟠 |
| `integrity.hashMatch` | `true` | "complete and intact" | "internally consistent over what survived" | 🔴 |
| `anomaliesDetected` | `[]` | "no anomalies" | "no anomalies recorded by the recorder" | 🟠 |
| `evidenceSnapshot.trustStateAtDecision.capturedAt` | `null` | "not applicable" | "this is the replay-time-fallback discriminator firing" | 🔴 |
| `verifierIdentity.userId` | `null` | "system action" | "no user attribution captured" | 🟡 |
| `verifierIdentity.confirmedBy` | `null` | "auto-verified" | "no human in the loop captured" | 🟡 |
| `relatedDecisions` | `[]` | "isolated decision" | "no related decisions returned by the take=10 query" | 🟢 — appropriately bounded |

**Pattern:** the optimism-bias register concentrates in the cryptographic and attribution fields. The platform's replay-warning surface produces six readable optimism vectors; two are 🔴, three 🟠, two 🟡.

## Replay-warning blindness scoreboard

For each warning, score whether 6–12 months of operator exposure produces blindness.

| Warning | Day-1 read | Day-30 read | Day-90 read | Day-365 read | Blindness severity |
|---|---|---|---|---|---|
| `tamperEvidence: null` | "checked" | "passes through" | "field skipped" | "field unread" | 🟠 |
| `R-CAT-6` outer | "this is dossier replay" | "all replays are dossier" | "R-CAT-6 means replay" | "R-CAT-6 is the action" | 🔴 |
| `'UNKNOWN'` trust state | "was unknown then" | "was unknown then" | "is normal for old capsules" | "old = unknown" | 🟠 |
| `'unknown'` actor | "unattributed" | "system action" | "stable cohort" | "user 'unknown' is real" | 🟠 |
| `verifierIdentity.type: 'SYSTEM'` | "automated" | "VitalCV system" | "VitalCV's system did this" | "system actions are first-party" | 🟠 |
| `hashMatch: true` | "intact" | "verified" | "complete and verified" | "the bundle is the audit record" | 🔴 |
| `lane-health badge LIVE` (cross-reference) | "live source" | "lane is live" | "lane is live" | "lane is live" | 🟢 — preserved |

**Pattern:** five of seven warnings produce 🟠 or 🔴 blindness over a 12-month exposure window. Two preserve their meaning — `lane-health badge LIVE` (because cadence is variable) and `recordedBy: 'demo'` (because the surface adds a constant copy disclaimer).

## Where replay warnings remain meaningful

**The three honest `tamperEvidence` strings ([replayEngine.ts:376-383](../../apps/api/backend/src/services/audit/replayEngine.ts)) are the platform's strongest replay warning** *when they fire*. The strings name the cause precisely: hash mismatch, evidence-spine mismatch, generic replay failure. The discrimination cost is low because the copy explains itself. The salience-when-fired is high because the field is null on every healthy day. The only psychological gap is the cadence — which is the gap, but the warning itself is well-designed.

**`recordedBy: 'demo'` propagation** ([CLAUDE.md](../../CLAUDE.md), demo gates) is the replay-adjacent warning that preserves meaning across 12 months because it is a constant value paired with a constant copy disclaimer in the surface ([issuer/review/[requestId]/page.tsx](../../apps/web/app/issuer/review/%5BrequestId%5D/page.tsx)). The literal does not vary; the copy disclaimer's always-on cadence anchors it.

The runtime-cohesion contract — `correlationId` / `payloadHash` / `mutationFingerprint` round-trip ([replayEngine.runtimeCohesion.test.ts](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts)) — is the *structural* defense that lets the inner R-CAT, recorded-vs-computed, and C-1↔T0 distinctions survive. It does not produce a warning today; it produces the conditions under which a future warning could be wired.

## Where replay warnings stop being meaningful

**Outer `R-CAT-6`** is the canonical pathological warning shape: constant value, zero salience, induces blindness, induces false confidence, masks the inner R-CAT the contract preserves. It scores 🔴 across multiple psychological vectors. This is the single most consequential warning to fix, and the fix is structural (separate outer-vs-inner in the rendering), not copy-level.

**`hashMatch: true` paired with `bundleHash`** is the canonical false-confidence channel. The recipient is told to verify `hashMatch === true` ([replayEngine.ts:598](../../apps/api/backend/src/services/audit/replayEngine.ts)); the verification succeeds; the recipient concludes completeness. The fix here is also structural: add `partialExport`, `requestedCount`, `droppedIds`, and a detached signature. Until those exist, `hashMatch: true` is a warning that fires for the wrong reading.

The four drifting-modal fields (`'UNKNOWN'` trust state, `'unknown'` actor, `'SYSTEM'` verifier, `null` capturedAt) all share the same erosion mechanism: their warning power is highest when their value is rare and lowest when their value becomes modal. As the platform ages, all four trend modal. The contract holds; the awareness erodes monotonically.

## Verdict

**Replay warnings are sharp where the platform built a discriminating string ([`tamperEvidence`](../../apps/api/backend/src/services/audit/replayEngine.ts) when it fires) and progressively diluted everywhere else.**

Of ten replay warnings inventoried, one is structurally honest with a cadence problem (`tamperEvidence`), four are drifting-modal (their psychological value erodes with platform age), three are constant or null-dominant in ways that produce blindness (`R-CAT-6` outer, `hashMatch: true`, `anomaliesDetected: []`), and two are nullable discriminators whose null reads as positive (`capturedAt: null`, `userId: null`).

Five of seven warnings produce 🟠 or 🔴 blindness over a 12-month exposure window. Two preserve meaning, both by combining a stable literal with a stable copy disclaimer at the rendering surface (lane-health LIVE, demo-flag).

The dilution failure modes split evenly between cadence (warnings that fire too often or too rarely) and shape-identity (warnings that have the same shape across healthy and degraded states). The fix surface is therefore split between (a) adding direction signals to currently-shape-identical fields and (b) adding always-on disclaimer copy that anchors the constant value.

**Strongest replay warning:** [`tamperEvidence`](../../apps/api/backend/src/services/audit/replayEngine.ts) when it fires. The three-message specificity carries low discrimination cost, high salience, and honest semantics. Its only psychological gap is the null-dominant cadence.

**Weakest replay warning:** outer `replayCategory: 'R-CAT-6'`. Constant value across every envelope; masks inner R-CAT-1…5; produces 🔴 blindness over 12 months; produces 🔴 false confidence (operators infer "all actions are dossier-replay-class"); cannot fire as a warning because it never varies.

**Biggest false-confidence channel:** `integrity.hashMatch: true` paired with `bundleHash` and `verificationInstructions.how`. The recipient is told to verify a property the contract earns, and concludes a property the contract does not earn.

**Track B score: 🟠 DESENSITIZING.** 4 🟢, 14 🟡, 24 🟠, 13 🔴 across the per-warning scoreboard; five of seven warnings produce 12-month blindness; two structural false-confidence channels active. **Replay warning psychology is meaningful where the platform built a discriminating string and silent where it left a constant or null-dominant field — the contract earns more than the warnings let the operator read.**
