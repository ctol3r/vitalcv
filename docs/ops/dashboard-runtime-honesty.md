# Dashboard Runtime Honesty — W2-PR11B Track B

**Wave:** W2-PR11B — Operator Governance + Runtime Honesty Enforcement
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [operator-governance-integrity](operator-governance-integrity.md), [runtime-honesty-continuity](runtime-honesty-continuity.md), [longitudinal-governance-survivability](longitudinal-governance-survivability.md).
**Builds on:** [survivability-explainability](survivability-explainability.md), [forensic-durability-understanding](forensic-durability-understanding.md), [runtime-durability-continuity](runtime-durability-continuity.md).

---

## What this track answers

PR10B Track A asked whether an operator could correctly classify a state. **This track asks whether the platform's actual rendered surfaces — the dashboards, the timelines, the badges, the bundle JSON, the status page — disclose the survivability properties the contract layer holds, or whether they render as if the system is always on its happy path.**

The risk vector here is the gap between what the contract knows and what the screen shows. A platform whose contract is honest and whose surface is happy-path-shaped will, in repeat use, drift the operator's mental model toward the surface and away from the contract. Dashboard runtime honesty is the question of whether the rendering layer carries enough of the contract's truth that the operator does not have to read code to read reality.

## Definitions

- **Surface disclosure:** the property that a state visible to an operator on a dashboard or surface carries enough literal information that the operator can correctly classify it without source-code knowledge.
- **Hidden optimism:** a dashboard rendering that is correct on the happy path and silently mirrors the happy-path values for states the contract knows are degraded.
- **Implicit guarantee:** a default rendering whose absence-of-warning reads as a positive claim (e.g., a green badge that's just default styling, a row count that reads as comprehensive).
- **Survivability inflation:** a dashboard shape that implies a stronger durability property than the contract holds (e.g., a bundle that reads as complete when it is best-effort).
- **Forensic inflation:** a dashboard shape that implies a stronger reconstructibility property than the contract holds (e.g., a `bundleHash` field that reads as cryptographic provenance).
- **Survivability class:** one of `observable`, `durable`, `transactional` ([survivability-explainability.md](survivability-explainability.md)). The five values an operator must distinguish to read a state correctly.
- **Lineage class:** one of `C-1` (durable checkpoint), `T0` (originating mutation), or `replay-time computed` ([survivability-explainability.md](survivability-explainability.md)). Three classes that the surface today renders as one undifferentiated "lineage."

## Dashboard inventory

The actually-rendered runtime-honesty surfaces in the codebase, mapped to what they render:

| Surface | Path | What it renders | What it does not render |
|---|---|---|---|
| Lane health badge | [LaneHealthBadge.tsx](../../apps/web/components/source-health/LaneHealthBadge.tsx), [LaneHealthMount.tsx](../../apps/web/components/source-health/LaneHealthMount.tsx) | source-coverage availability, decoupled from trust state | nothing else |
| Employer dashboard | [employer/dashboard/page.tsx](../../apps/web/app/employer/dashboard/page.tsx) | employer-view lane-health section | survivability literals; `eventState`; fingerprint |
| Passport (entity) | [passport/[id]/PassportEntityClient.tsx](../../apps/web/app/passport/%5Bid%5D/PassportEntityClient.tsx) | passport readiness pill, lane-health mount | recorded-vs-replay separation; trust-band cause |
| Passport (root) | [passport/page.tsx](../../apps/web/app/passport/page.tsx) | root passport readiness, lane-health mount | as above |
| Status page | [status/page.tsx](../../apps/web/app/status/page.tsx) | compliance evidence shape (post DOCS-STATUS-1) | export-durability gaps; refusal floor; `pending_not_written` |
| Issuer review surface | [issuer/review/[requestId]/page.tsx](../../apps/web/app/issuer/review/%5BrequestId%5D/page.tsx) | demo-render of review (`recordedBy: 'demo'` explicit) | refusal-gate audit trail (no row exists) |
| Issuer policy review | [issuer/policy-review/[requestId]/page.tsx](../../apps/web/app/issuer/policy-review/%5BrequestId%5D/page.tsx) | demo-render of policy review (`recordedBy: 'demo'` explicit) | as above |
| Audit-bundle JSON | export of `buildAuditBundle` | per-capsule replays, `bundleHash`, `verificationInstructions`, custodyLog | requested-vs-survived; `partialExport`; signature; `eventState` |
| Replay envelope JSON | output of `replayDecision` | recorded fields + replay-time computed fields | provenance separation; outer-vs-inner R-CAT |
| Audit timeline (where rendered) | per-event rows | event types, payloads, timestamps | `eventState`; `mutationFingerprint`; denial reason as type |

**Pattern:** the rendering surfaces that exist do their narrow job (lane health, demo flagging, compliance shape). The survivability literals — `eventState`, `mutationFingerprint`, dual-cause `'UNKNOWN'`, outer-vs-inner R-CAT, `requestedCount` — have **no rendering binding at all**.

## Dashboard runtime-honesty scoreboard

Each row is one of the five disclosure questions in the wave brief, scored against the rendered surfaces.

| Disclosure question | Surface that should answer it | Currently renders? | Failure mode |
|---|---|---|---|
| Are survivability classes (observable / durable / transactional) exposed? | audit timeline + bundle schema | ❌ no | timeline rows do not carry `eventState`; bundle does not declare durability of source rows |
| Is replay fragility exposed (recorded vs computed, outer vs inner R-CAT, dual-cause `'UNKNOWN'`)? | replay envelope renderer | (no envelope renderer; JSON-only) | every replay reads `R-CAT-6`; trust-band cause indistinguishable; recorded-vs-computed merged |
| Is export delay (best-effort drop, no streaming, no manifest) exposed? | bundle schema | ❌ no | `capsuleCount` is survived; no `requestedCount`; no `droppedIds` |
| Is degraded lineage (`pending_not_written`, `'unknown'` actor, missing artifact, dropped capsule) exposed? | timeline + passport + bundle | ❌ no | surfaces mirror happy-path styling for degraded states |
| Is partial continuity (issuer-side refusals not rowed, replay invocations not rowed) exposed? | audit-table query path | ❌ no | "no row" reads as "no event"; absence is invisible |

**Tally: 0 of 5 disclosure questions are answered by a rendered surface.**

The five questions are all answered at the *contract* layer (the literals exist, the helpers compute correctly). The five questions are answered at *zero* rendering surfaces.

## Hidden optimism register

Each entry below is a rendered shape that is correct on the happy path and silently mirrors that shape for states the contract knows are degraded.

### HO-1 — Audit timeline reads as durable

**Surface:** any audit-event row rendered in a timeline.

**Hidden optimism:** the row's existence reads as "this row landed in durable storage at the timestamp shown." The rendering does not surface `eventState`, so a `pending_not_written` row is visually identical to a `persisted` row.

**Severity:** 🟠 — invisible default. The literal exists; the rendering does not bind it.

**Pre-existing finding:** [survivability-explainability.md](survivability-explainability.md) audit-timeline 🟠; [trust-fabric-durability-cohesion.md](trust-fabric-durability-cohesion.md) Gap 1.

### HO-2 — `bundleHash` + `verificationInstructions` read as completeness

**Surface:** bundle JSON exported by `buildAuditBundle` ([replayEngine.ts:550-607](../../apps/api/backend/src/services/audit/replayEngine.ts)).

**Hidden optimism:** the bundle's `verificationInstructions.how` says "verify integrity.hashMatch === true." The hash recomputes correctly over what survived ([replayEngine.ts:592](../../apps/api/backend/src/services/audit/replayEngine.ts) — survived count). A reader who follows the verification instructions concludes "this bundle is complete and verified."

**Severity:** 🔴 — the canonical highest-impact survivability inflation.

**Pre-existing finding:** [forensic-durability-understanding.md](forensic-durability-understanding.md) FA-1, TIV-1; [survivability-explainability.md](survivability-explainability.md) export-delayed paths.

### HO-3 — `actorId: 'unknown'` reads as a real actor

**Surface:** any rendering that displays `actor.actorId` without highlighting fallback.

**Hidden optimism:** `'unknown'` recorded faithfully, rendered as a string, looks like a real value to an operator scanning a list. Repeat use builds a habit of "user 'unknown' did N things this week."

**Severity:** 🟠 — habit-forming.

**Pre-existing finding:** [forensic-durability-understanding.md](forensic-durability-understanding.md) FA-2, TIV-3.

### HO-4 — `trustStateAtDecision: 'UNKNOWN'` reads as recorded fact

**Surface:** replay envelope `evidenceSnapshot.trustStateAtDecision`.

**Hidden optimism:** `'UNKNOWN'` reads as a fact about decision time when it can also be a replay-time fallback (the trust-state artifact aged out). The discriminator is `capturedAt: null`, which is structurally present and visually irrelevant.

**Severity:** 🟠 — worsens with retention age. The literal stays the same; the rate of false-recorded interpretation rises over time.

**Pre-existing finding:** [forensic-durability-understanding.md](forensic-durability-understanding.md) FA-7, HA-1.

### HO-5 — Bundle `custodyLog` reads as a chain of custody

**Surface:** bundle JSON.

**Hidden optimism:** "custodyLog" is a self-emitted two-event log (`BUNDLE_CREATED`, `HASH_COMPUTED`). The phrase carries forensic weight; the implementation is two log lines emitted by the same process that built the bundle.

**Severity:** 🟡 — defensible naming, optimism in connotation rather than literal.

**Pre-existing finding:** [runtime-durability-continuity.md](runtime-durability-continuity.md) Axis 3 surface.

### HO-6 — Issuer review surface reads as authoritative

**Surface:** [issuer/review/[requestId]/page.tsx](../../apps/web/app/issuer/review/%5BrequestId%5D/page.tsx).

**Hidden optimism:** review-page-shaped rendering reads as "this is the system's record of an issuer review." The page is a demo render — `recordedBy: 'demo'`, copy explicitly disclaims a real audit row. The doctrine-level gate is *active here*; the optimism risk is that future copy revisions soften the demo disclaimer without softening the underlying gap.

**Severity:** 🟢 today, ⚠️ prospective.

**Defended by:** explicit `recordedBy: 'demo'` and disclaimer copy in the surface, banned-strings list in [CLAUDE.md](../../CLAUDE.md).

### HO-7 — Status page reads as comprehensive uptime

**Surface:** [status/page.tsx](../../apps/web/app/status/page.tsx).

**Hidden optimism:** any "status" page reads, by category convention, as "this is the platform's full state." The DOCS-STATUS-1 commit (5d530f13) wires compliance evidence shape into the page, which is honest at the literal layer; the prospective risk is that a green status page reads as "everything underneath is durable" when the audit ↔ export seam still has known structural inflations.

**Severity:** 🟡 — depends on what the status page chooses to claim.

## Implicit guarantee register

Each entry is a rendered absence — a missing field or warning — that reads as a positive claim.

### IG-1 — No `partialExport` field implies complete export

The bundle schema has no `partialExport: true` flag. The absence-of-flag reads as "the export was complete." Any downstream tool that does not check for the flag (because it does not exist) cannot reason about completeness.

**Severity:** 🔴 — paired with HO-2.

### IG-2 — No `eventState` column implies durability

The audit-row schema has no surface field for `eventState`. The absence-of-column reads as "the row's existence implies it is durable." Operators cannot ask "show me the rows that have not yet landed."

**Severity:** 🟠 — paired with HO-1.

### IG-3 — No replay-event row implies no replay happened

A query for "replay invocations during the window" returns zero rows because no audit row is written for replays. The absence-of-row reads as "no replay was performed during the incident."

**Severity:** 🟠 — paired with GF-4 (operator governance integrity).

### IG-4 — No refusal-event row implies no refusal happened

Issuer-side `refusalGate` returns from `policyReview.ts` and writes no audit row. Six refusals can fire with zero rows. The absence-of-row reads as "no issuer refusal occurred during the window."

**Severity:** 🔴 — paired with GF-4.

### IG-5 — No retry-aggregate view implies retries are distinct events

No timeline view group-bys `mutationFingerprint`. Three retries render as three rows with three correlation IDs. The absence-of-aggregate reads as "three events happened."

**Severity:** 🟠 — paired with GF-5.

### IG-6 — No outer-vs-inner R-CAT separation implies replays are dossier replays

No surface separates outer envelope `R-CAT-6` from the inner `runtimeTrust.replayCategory`. The absence-of-separation reads as "100% of replays in the window were dossier replays."

**Severity:** 🟠 — paired with GF-12.

### IG-7 — No trust-band-cause field implies recorded-fact

No surface or schema separates `trustStateAtDecision: 'UNKNOWN'` (recorded) from `trustStateAtDecision: 'UNKNOWN'` (replay-time fallback). The absence-of-cause reads as "this is a fact about decision time."

**Severity:** 🟠 — paired with HO-4.

## Survivability inflation register

Each entry is a dashboard or schema shape that implies a stronger durability property than the contract holds.

| Inflation vector | Surface | Implies | Holds | Severity |
|---|---|---|---|---|
| `bundleHash` over included replays | bundle JSON | bundle is complete | bundle is internally consistent | 🔴 |
| `verificationInstructions.how` | bundle JSON | bundle is offline-verifiable | hash-only, transport-trusted | 🔴 |
| `bundle.issuer: 'VitalCV'` | bundle JSON | bundle has cryptographic provenance | string literal, no signature | 🔴 |
| `capsuleCount: N` | bundle JSON | N capsules requested | N survived | 🔴 |
| `eventState` defaulted silent | audit row schema | row is durable | `pending_not_written` is the default | 🟠 |
| `actor.actorId: 'unknown'` rendered as string | timeline rows | a user named 'unknown' acted | actor is unattributed | 🟠 |
| Outer envelope `R-CAT-6` | replay JSON | this is a dossier replay | every replay is `R-CAT-6` | 🟠 |
| `verifierIdentity.type: 'SYSTEM'` rendered without context | replay JSON | VitalCV's automated system did this | could be unattributed system path | 🟠 |
| `custodyLog` named as such | bundle JSON | multi-actor signed chain | self-emitted log lines | 🟡 |
| `'UNKNOWN'` trust band | replay JSON | trust band was unknown then | could be replay-time fallback | 🟠 |

**Tally:** 4 🔴, 5 🟠, 1 🟡. **Ten inflation vectors at the surface layer; four are categorically high-severity.**

## Forensic inflation register

Inflation vectors specifically scoped to the question of "what would a forensic reader (regulator, auditor, opposing counsel) misread?"

### FI-1 — Bundle reads as the audit record for the window

The bundle includes per-capsule replays. It does not include non-capsule events (denials with no capsule write, refusals, monitoring events). A forensic reader treating the bundle as comprehensive is reasoning from a partial slice.

**Severity:** 🔴 — paired with FA-3 (forensic durability understanding).

### FI-2 — Bundle reads as complete capsule-level

Per-capsule replay errors drop silently ([replayEngine.ts:568-573](../../apps/api/backend/src/services/audit/replayEngine.ts)). A bundle of 49 capsules from a 50-capsule request reads identically to a bundle of 50 from a 50-capsule request.

**Severity:** 🔴.

### FI-3 — `bundleHash` reads as proof-of-non-tampering

The hash detects in-transit tampering of the bundle's JSON content. It does not detect dropped capsules (those weren't in the JSON to begin with) and does not bind the bundle to VitalCV cryptographically.

**Severity:** 🔴.

### FI-4 — Replay envelope reads as decision-time snapshot

Recorded and computed fields share the envelope. A forensic reader reading "the replay says X" is reading a mix of recorded-at-decision and computed-at-replay.

**Severity:** 🟠.

### FI-5 — Authority chain reads as decision-time chain

`replayDecision` constructs the authority chain at replay time from current artifact rows ([replayEngine.ts:441-456](../../apps/api/backend/src/services/audit/replayEngine.ts) for issuer inference). If the artifact rows have changed since decision, the chain has changed. The envelope does not declare which it is.

**Severity:** 🟠.

### FI-6 — `tamperEvidence` literal reads as completeness check

`tamperEvidence` distinguishes hash mismatch, evidence-spine mismatch, generic replay failure ([replayEngine.ts:376-383](../../apps/api/backend/src/services/audit/replayEngine.ts)). It does not detect dropped capsules. A reader following the literal as a completeness signal misses the export-time gap.

**Severity:** 🟡 — partially defended by the three-message specificity.

## Where dashboard runtime honesty holds

**The lane-health badge is the only rendered surface in the codebase that honestly disclosures one of the survivability classes.** It renders source-coverage availability, decoupled from trust state, with explicit `CHECKING` / `BLOCKED` readiness states ([trust-fabric-durability-cohesion.md](trust-fabric-durability-cohesion.md) Defense 5). Lane red does not become trust red. The decoupling is honest.

The badge is also the wave's clearest counter-example to the dashboard pattern: it is a rendered surface that takes a contract literal and binds it to a visual state without inflating the meaning. It is the proof that the platform *can* render survivability honestly when it builds a surface for it.

The mount points ([employer/dashboard/page.tsx:11](../../apps/web/app/employer/dashboard/page.tsx), [passport/[id]/PassportEntityClient.tsx:85](../../apps/web/app/passport/%5Bid%5D/PassportEntityClient.tsx), [passport/page.tsx:750](../../apps/web/app/passport/page.tsx)) propagate the honesty across the three primary user-facing pages.

The demo-flag rendering is the second strongest. `recordedBy: 'demo'` propagates from the audit row through the bundle through the replay envelope; the issuer review surfaces explicitly disclaim audit-row reality. This is doctrine-level disclosure that survives every degradation mode.

## Where dashboard runtime honesty holds worst

**The bundle JSON is the dashboard surface where the most consequential survivability inflation occurs**, even though it is not visually a "dashboard." The artifact's shape — `bundleHash`, `verificationInstructions`, `capsuleCount`, `custodyLog`, `bundle.issuer: 'VitalCV'` — concentrates four 🔴 inflation vectors and one 🟡. It is the artifact most likely to leave VitalCV's perimeter and the surface least likely to declare its actual properties.

The audit-row timeline is the second worst because the daily-use surface for incident response inherits all the implicit-guarantee absences (`eventState`, `mutationFingerprint`, denial reason, retry collapse, replay invocation absence). Operator habits form here.

## What an operator running an incident sees on dashboards today

A 30-minute degradation: issuer slow, source-coverage flapping, three capsule writes deferred, two refusals fired, one bundle export request in flight.

| Operator question | Dashboard surface | Can they answer? |
|---|---|---|
| "Is source coverage degraded?" | lane-health badge | ✅ |
| "Is the system in a degraded state at all?" | lane-health badge | ⚠️ partial — only source coverage |
| "Did the deferred audit rows land yet?" | (no surface) | ❌ |
| "Did the bundle I just exported include everything in the window?" | bundle JSON | ❌ |
| "Were any issuer-side refusals recorded for this entity?" | audit query | ❌ — no rows exist |
| "Is the timeline I'm looking at the durable record?" | timeline | ❌ — `eventState` invisible |
| "Are these three rows three events or one retried event?" | timeline | ❌ — no fingerprint group-by |
| "What category was the original action that produced this replay?" | replay JSON | ⚠️ — outer R-CAT-6 masks inner |
| "Was the trust band genuinely unknown at decision, or did the artifact age out?" | replay JSON | ⚠️ — `capturedAt: null` discriminates, not visually distinct |
| "Did anyone replay capsules during the incident?" | (no surface) | ❌ |

**Score: 1 ✅, 3 ⚠️, 6 ❌.** Out of ten incident-shape questions about runtime honesty, dashboards answer one cleanly.

## Verdict

**Dashboard runtime honesty is sharp on the one surface that exists for it (lane health) and largely absent everywhere else.**

The five disclosure questions in the wave brief — survivability classes, replay fragility, export delay, degraded lineage, partial continuity — receive zero clean rendered answers. The contract layer is honest about each; the rendering layer binds none. The pattern is consistent with the wave's deliberate ordering ([trust-fabric-durability-cohesion.md](trust-fabric-durability-cohesion.md) cross-honesty verdict): the contract is load-bearing, the surface is silent.

The hidden-optimism count is seven, the implicit-guarantee count is seven, the survivability-inflation count is ten, the forensic-inflation count is six. None are banned-string violations. All are shape-level renderings that imply a stronger property than the contract holds.

The one defense that works at the rendering layer — lane health — is the proof that dashboard runtime honesty is achievable when the platform invests in a rendering surface. The path forward is not new contracts; it is binding existing contract literals (`eventState`, `mutationFingerprint`, `requestedCount`, `partialExport`, dual-cause `'UNKNOWN'`) to rendered surfaces.

**Strongest dashboard honesty surface:** the `LaneHealthBadge` + `LaneHealthMount` chain. The only rendered surface that takes a survivability literal and presents it without inflation.

**Biggest dashboard inflation risk:** the bundle JSON. The artifact most likely to leave VitalCV concentrates four 🔴 inflation vectors (`bundleHash` as completeness, `verificationInstructions` as offline-verifiable, `bundle.issuer` as cryptographic provenance, `capsuleCount` as requested) and is rendered without any partialExport / requestedCount / signature defense.

**Track B score: 🟠 DRIFT-PRONE.** Zero of five disclosure questions answered, ten survivability-inflation vectors, six forensic-inflation vectors, one strong rendered defense. **Dashboard runtime honesty is sharp where the platform built a surface and silent where the platform left the literal in code — the operator's screen carries strictly less truth than the operator's filesystem.**
