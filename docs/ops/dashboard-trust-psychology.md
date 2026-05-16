# Dashboard Trust Psychology — W2-PR15B Track C

**Wave:** W2-PR15B — Operator Psychology + Constitutional Trust Awareness
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [constitutional-awareness-explainability](constitutional-awareness-explainability.md), [replay-warning-psychology](replay-warning-psychology.md), [constitutional-trust-continuity](constitutional-trust-continuity.md).
**Builds on:** [dashboard-runtime-honesty](dashboard-runtime-honesty.md), [governance-awareness-survivability](governance-awareness-survivability.md), [longitudinal-governance-survivability](longitudinal-governance-survivability.md), [containment-explainability](containment-explainability.md), [constitutional-failure-explainability](constitutional-failure-explainability.md), [escalation-explainability](escalation-explainability.md), [forensic-explainability](forensic-explainability.md).

---

## What this track answers

PR11B Track B inventoried the rendered dashboard surfaces and asked whether they disclose what the contract holds. **This track asks the psychology question: do the dashboards an operator looks at every day produce a calibrated trust state in the operator, or do they progressively induce overconfidence — survivability certainty, forensic completeness, badge complacency — that the underlying contract does not earn?**

The risk vector is **dashboard-induced overtrust**: a surface that is structurally honest (the literal is correct) can still psychologically mislead if its repeated rendering trains the operator to read the absence-of-warning as a positive claim of safety. The dashboard is the operator's daily anchor; the platform's daily anchor is the platform's anchor *in the operator's mental model*. If the dashboard's daily shape implies more than the contract holds, the operator's mental model drifts away from the contract at the rate of daily exposure.

This track grades each operator-facing dashboard surface for whether its repeated reading produces calibrated trust or progressive overconfidence, and locates the optimism vectors, complacency vectors, and integrity-fatigue vectors specific to dashboards.

## Definitions

- **Dashboard:** any rendered surface an operator interacts with on a recurring (daily / per-incident / per-export) basis whose absence-of-warning could read as a positive claim of safety. Includes: lane-health badge, employer dashboard, passport readiness pill, status page, audit timeline, bundle JSON (when read by an operator or recipient), replay envelope JSON (same).
- **Calibrated trust:** the property that an operator's confidence in the dashboard's claim is congruent with the contract's actual assertion. The operator who reads green correctly infers "the contract holds for the property the badge measures."
- **Overtrust:** the operator's confidence exceeds the contract's assertion. The operator reads green and infers a stronger property than the badge measures.
- **Optimism vector:** a specific dashboard rendering shape that systematically pushes operator confidence above the contract's assertion.
- **Survivability certainty:** the false belief that "the platform's underlying state is durable / complete / verified / signed" induced by a dashboard reading.
- **Forensic completeness:** the false belief that "what the dashboard / bundle shows is all there is" induced by a dashboard reading.
- **Badge complacency:** the operator habit of reading a green badge as a verified-positive rather than as an absence-of-known-failure.
- **Integrity fatigue:** the operator state in which the rendering surface produces so many low-information signals that the operator stops processing them and reads the dashboard as a single composite green/red.

## Per-surface dashboard psychology scoreboard

For each operator-facing dashboard surface, score across the five trust-psychology vectors named in the wave brief.

| Surface | Induces overconfidence? | Hides fragmentation? | Implies survivability certainty? | Implies forensic completeness? | Creates badge complacency? |
|---|---|---|---|---|---|
| Lane-health badge ([LaneHealthBadge.tsx](../../apps/web/components/source-health/LaneHealthBadge.tsx)) | 🟢 no — variants distinguish honestly | 🟢 no — single axis (source-coverage) | 🟢 no — decoupled from trust state | 🟢 no — scoped to lane only | 🟢 no — variable cadence preserves salience |
| Lane-health section (employer dashboard / passport mounts) | 🟢 no — same badge, three mounts | 🟡 partial — lane health is one axis; rest of dashboard is silent | 🟡 partial — operators may infer the rest is also lane-style honest | 🟠 partial — lane health does not declare audit-event coverage | 🟡 partial — green section reads as "everything I monitor is fine" |
| Employer dashboard ([app/employer/dashboard/page.tsx](../../apps/web/app/employer/dashboard/page.tsx)) | 🟠 yes — green-shaped layout reads as complete-positive | 🔴 yes — `eventState`, `mutationFingerprint`, denial reasons not surfaced | 🟠 yes — happy-path styling for everything not lane-health | 🟠 yes — no surface field reports audit-table coverage | 🟠 yes — daily-use surface trains "no red = fine" |
| Passport readiness pill (entity / root) | 🟡 partial — pill is a composite | 🟠 yes — pill collapses recorded-vs-replay separation | 🟠 partial — readiness implies a property the contract narrows | 🟠 partial — pill cannot declare bundle gaps | 🟡 partial — composite is colored, single read |
| Status page ([app/status/page.tsx](../../apps/web/app/status/page.tsx)) | 🟢 today — explicit "Foundation status preview" disclaimer; `uptimeGuaranteeImplied: false` rendered as literal | 🟡 partial — page is small and honest; expansion under "polish" pressure could soften | 🟢 today — disclaimer copy actively defends | 🟡 partial — page does not declare which events are rowed | 🟢 today — disclaimer is psychologically anchoring |
| Audit timeline (rendered rows) | 🔴 yes — every row visually identical regardless of `eventState` | 🔴 yes — three retries render as three rows; `mutationFingerprint` not group-by'd; denial reasons collapsed | 🔴 yes — row existence reads as durable | 🔴 yes — absent rows read as absent events | 🔴 yes — daily scrolling habit |
| Bundle JSON (read by operator or recipient) | 🔴 yes — `bundleHash`, `verificationInstructions`, `custodyLog`, `bundle.issuer` all read as completeness | 🔴 yes — survived-vs-requested elided | 🔴 yes — canonical false-survivability surface | 🔴 yes — canonical false-completeness surface | 🔴 yes — every successful export reinforces "complete" |
| Replay envelope JSON (read by operator or investigator) | 🟠 yes — `tamperEvidence: null`, `hashMatch: true` read as positive claims | 🠠 yes — outer R-CAT-6, recorded-vs-computed elided | 🟠 yes — `'UNKNOWN'` trust state reads as recorded | 🟡 partial — envelope is scoped to one capsule, recipient reads as snapshot | 🟠 yes — repeated reads form "envelope is the fact" |
| Issuer review surface (demo) | 🟢 today — explicit `recordedBy: 'demo'` and disclaimer copy | 🟢 today — surface explicitly disclaims | 🟢 today — copy says no audit row exists | 🟢 today — copy disclaims | 🟢 today — disclaimer anchors |
| EmergencySwitch label | 🟡 partial — "EMERGENCY ACTIVE" is salient when shown | 🟠 partial — UI label survives only in-process; no durable record | 🔴 yes — copy says "Action permanently logged to Audit Scrapbook" but declaration writes no audit row | 🟠 yes — label implies a durable declaration record | 🟢 low — control is rare enough not to anchor complacency |

**Tally across 50 cells:** 11 🟢, 14 🟡, 14 🟠, 11 🔴.

**Pattern:** the platform has two clusters of psychologically-honest surfaces (lane-health pipeline and the demo/status disclaimer surfaces), one cluster of psychologically-mixed surfaces (passport pill, replay envelope), and three psychologically-misleading surfaces (employer dashboard, audit timeline, bundle JSON). The 🔴 cluster is concentrated in the three highest-frequency-of-reading surfaces — the daily scroll (timeline), the daily use (employer dashboard), the high-stakes export (bundle).

## Dashboard optimism vector register

Each entry is a specific dashboard rendering shape that systematically pushes operator confidence above the contract's assertion.

### DOV-1 — Implicit-green-as-positive on the employer dashboard

**Surface:** [app/employer/dashboard/page.tsx](../../apps/web/app/employer/dashboard/page.tsx).

**Mechanism:** the dashboard's default styling renders a green-shaped layout. Lane-health badge is the one explicit signal; the rest of the page uses default component styling. An operator reads "no red = fine."

**Hidden assertion:** operator infers "every property the platform tracks is healthy." Contract earns "lane health is healthy and we've rendered nothing else."

**Severity:** 🟠 — daily-use surface; trains the operator habit that defines all other dashboard reading on the platform.

**Pre-existing finding:** [HO-7](dashboard-runtime-honesty.md), [IG-2](dashboard-runtime-honesty.md), [DD-2](longitudinal-governance-survivability.md).

### DOV-2 — Audit timeline row-existence-as-durable

**Surface:** any audit timeline rendering.

**Mechanism:** every row that the timeline displays is visually identical regardless of `eventState`. A `pending_not_written` row looks the same as a `persisted` row. The rendering layer does not bind the contract literal.

**Hidden assertion:** operator infers "this row landed in durable storage at the timestamp shown." Contract earns "this row exists in our query result; its `eventState` is whatever it is."

**Severity:** 🔴 — daily-incident-response surface; the canonical operator habit-formation site.

**Pre-existing finding:** [HO-1](dashboard-runtime-honesty.md), [IG-2](dashboard-runtime-honesty.md), [GF-8](operator-governance-integrity.md).

### DOV-3 — Bundle hash-as-completeness

**Surface:** bundle JSON.

**Mechanism:** `bundleHash` is computed over `JSON.stringify({ bundleId, exportedAt, replays })` ([replayEngine.ts:579-580](../../apps/api/backend/src/services/audit/replayEngine.ts)). `verificationInstructions.how` tells the recipient "verify integrity.hashMatch === true." The recipient verifies; the hash matches; the recipient infers completeness.

**Hidden assertion:** recipient infers "this bundle contains every capsule the requestor asked for; the hash is proof of non-tampering." Contract earns "this bundle's bytes are internally consistent; per-capsule replays may have been silently dropped during construction."

**Severity:** 🔴 — the canonical false-completeness channel.

**Pre-existing finding:** [HO-2](dashboard-runtime-honesty.md), [FI-2](dashboard-runtime-honesty.md), [FI-3](dashboard-runtime-honesty.md), [GF-3](operator-governance-integrity.md).

### DOV-4 — `bundle.issuer: 'VitalCV'` as cryptographic provenance

**Surface:** bundle JSON.

**Mechanism:** the field's name (`issuer`) and value (`'VitalCV'`) read as cryptographic identity. The implementation is a string literal ([replayEngine.ts:593](../../apps/api/backend/src/services/audit/replayEngine.ts)).

**Hidden assertion:** recipient infers "this bundle is signed by VitalCV." Contract earns "the bundle says `issuer: 'VitalCV'` because the code emits the literal."

**Severity:** 🔴.

**Pre-existing finding:** [GF-10](operator-governance-integrity.md), inflation-register row 3 in [dashboard-runtime-honesty.md](dashboard-runtime-honesty.md).

### DOV-5 — `verificationInstructions` as offline-verifiable

**Surface:** bundle JSON.

**Mechanism:** the field's name and the prose it contains ("For each replay, verify integrity.hashMatch === true") read as instructions for offline re-verification. The actual capability is hash-only over the included replays; transport-trusted; no detached signature; no completeness proof.

**Hidden assertion:** recipient infers "I can verify this bundle without contacting VitalCV." Contract earns "the recipient can verify the bundle's bytes are internally consistent."

**Severity:** 🔴.

**Pre-existing finding:** [GF-15](operator-governance-integrity.md), inflation-register row 2 in [dashboard-runtime-honesty.md](dashboard-runtime-honesty.md).

### DOV-6 — `custodyLog` as multi-actor chain

**Surface:** bundle JSON.

**Mechanism:** `custodyLog` is a two-event self-emitted log (`BUNDLE_CREATED`, `HASH_COMPUTED`) emitted by `replayEngine` ([replayEngine.ts:602-605](../../apps/api/backend/src/services/audit/replayEngine.ts)). The phrase "chain of custody" carries forensic weight in operator vocabulary; the literal is two log lines from the same process.

**Hidden assertion:** recipient infers "this bundle has a chain of custody attesting to non-tampering through multiple parties." Contract earns "two events were logged by the same code that built the bundle."

**Severity:** 🟡 — defensible naming, optimism in connotation rather than literal.

**Pre-existing finding:** [HO-5](dashboard-runtime-honesty.md).

### DOV-7 — Passport readiness pill as composite-positive

**Surface:** passport entity / root pages.

**Mechanism:** the pill renders a composite trust state. A green pill reads as "this clinician is trustworthy." The pill collapses recorded-vs-replay separation, source-coverage state at decision time vs now, and any held degradation.

**Hidden assertion:** operator infers "this clinician is verified, current, fully-credentialed, and the platform has no concerns." Contract earns the narrower property the pill literally measures.

**Severity:** 🟠 — composite collapsing is the canonical pattern PR12B [governance-awareness-survivability](governance-awareness-survivability.md) #4 named. Worsens with retention age.

### DOV-8 — Replay envelope `hashMatch: true` as completeness

**Surface:** replay envelope JSON.

**Mechanism:** mirrors DOV-3 at the per-capsule level. The recipient who reads `integrity.hashMatch: true` reads "this capsule's record is intact."

**Hidden assertion:** recipient infers "this capsule's full record is present, intact, and verifiable." Contract earns "the capsule's stored hash matches the recomputed hash."

**Severity:** 🟠 — paired with DOV-3 the false confidence is 🔴.

### DOV-9 — `EmergencySwitch` "Action permanently logged" copy

**Surface:** [EmergencySwitch.tsx:91](../../apps/web/components/employer/EmergencySwitch.tsx) — "Action permanently logged to Audit Scrapbook" copy in the confirmation dialog.

**Mechanism:** the copy asserts that the declaration is durably logged. The implementation ([emergencyMode.ts:23-35](../../apps/api/backend/src/services/compliance/emergencyMode.ts)) writes `log('warn', ...)` and toggles in-process state; no audit row is written for the declaration itself. (The downstream `evaluateEmergencyOverride` writes per-credential `EMERGENCY_ESCALATION` rows; the *declaration* itself does not.)

**Hidden assertion:** operator infers "my declaration is permanently in the audit scrapbook." Contract earns "a warn-level log line was emitted."

**Severity:** 🔴 — the copy is a constitutional-violation-class assertion at the surface layer.

**Pre-existing finding:** [escalation-explainability](escalation-explainability.md) Vector 4, [constitutional-response-continuity](constitutional-response-continuity.md) escalation row.

## Survivability complacency vector register

Each entry is a dashboard rendering shape that, through repetition, induces in the operator the false belief that the platform's underlying state is more durable than it is.

### SCV-1 — Daily green dashboard induces "platform is durable"

**Surface:** employer dashboard, passport readiness pill, status page (today).

**Mechanism:** an operator who reads the dashboard daily over 6 months and sees green every day forms the mental model "this platform is durable; degradation would show up here." The mental model is not falsifiable from the dashboard alone because the dashboard does not render the survivability literals (`eventState`, `pending_not_written`, `mutationFingerprint`, refusal-row absence) that would distinguish "durable" from "rendered as durable."

**Compounding factor:** operators new to the platform inherit the existing operators' habit. By onboarding turnover N, the "platform is durable" model is doctrine.

**Severity:** 🟠.

### SCV-2 — Bundle export reinforces "exports are complete"

**Surface:** bundle JSON read by recipient or sender.

**Mechanism:** every successful bundle export, hash-verified, no per-capsule errors visible to the recipient, reinforces "bundles are complete." After 12 months of bundle exports, the habit is unimpeachable from operator experience.

**Compounding factor:** the recipient (regulator, auditor, opposing counsel) is not the sender; the sender's server logs are not the recipient's verification surface; there is no cross-party signal that would interrupt the habit.

**Severity:** 🔴 — paired with DOV-3.

### SCV-3 — Replay envelope reinforces "replay is forensic snapshot"

**Surface:** replay envelope JSON.

**Mechanism:** an investigator who runs replay across an investigation reads each envelope as "the snapshot of decision time." The contract preserves decision-time fields and re-derives others; the surface does not separate. After the investigator's first investigation, the habit forms; subsequent investigations inherit.

**Compounding factor:** investigators are not daily readers; they form the habit on their first deep-read and apply it across cases. The habit is harder to interrupt because the cadence does not invite re-evaluation.

**Severity:** 🟠.

### SCV-4 — Issuer review surface reinforces "review is recorded"

**Surface:** [issuer/review/[requestId]/page.tsx](../../apps/web/app/issuer/review/%5BrequestId%5D/page.tsx).

**Mechanism:** the demo surface today is *defended* by `recordedBy: 'demo'` and copy disclaimer. The complacency risk is *prospective*: a future "polish the demo" wave that softens the disclaimer copy would convert this from 🟢 to 🔴 overnight ([GE-5](longitudinal-governance-survivability.md) demo-gate softening pressure).

**Compounding factor:** demo paths are visually similar to production paths; the disclaimer is the only psychological anchor.

**Severity:** 🟢 today, 🔴 if disclaimer relaxes.

### SCV-5 — `EmergencySwitch` UI reinforces "declarations are durable"

**Surface:** [EmergencySwitch.tsx](../../apps/web/components/employer/EmergencySwitch.tsx).

**Mechanism:** the visually arresting "EMERGENCY ACTIVE" label and the "Action permanently logged" copy together induce the operator belief that emergency declarations are durable records. A process restart erases the declared state ([emergencyMode.ts:8](../../apps/api/backend/src/services/compliance/emergencyMode.ts) `let emergencyModeActive = false`); the operator who returns the next day after a deploy and sees `false` may rationalize ("someone cleared it") rather than discover the in-process toggle.

**Severity:** 🔴 — the survivability claim is structurally false; the operator has no surface-level cue that would interrupt the rationalization.

## Integrity fatigue vector register

Each entry is a dashboard pattern that produces enough low-information signals that operators stop processing them and read the dashboard as a single composite.

### IFV-1 — Audit timeline scroll fatigue

**Mechanism:** an operator scanning a daily timeline sees rows with similar shapes. The eye optimizes — scans event types, glances at timestamps, ignores `actorId` if it is "system" or "unknown" most of the time. The signal channels the contract carries (denial reason, mutation fingerprint, eventState, payload hash) are below the operator's per-row attention budget.

**Compounding factor:** as the timeline grows, per-row attention drops further. By 1000 rows in a day, the operator reads "type" + "timestamp" only.

**Severity:** 🟠.

### IFV-2 — Bundle JSON shape fatigue

**Mechanism:** the bundle JSON has many fields. An operator or recipient who reads it once develops a parsing habit — scans `capsuleCount`, `bundleHash`, `exportedAt`; treats the rest as boilerplate. The fields that *would* warn (if `partialExport` existed, if `requestedCount` existed) are not in the schema, but the absence of any warning surface in a 50-field JSON object is itself a fatigue vector.

**Compounding factor:** every new field added to the bundle compounds the fatigue (each new field is one more thing the eye learns to skip).

**Severity:** 🟠.

### IFV-3 — Replay envelope JSON shape fatigue

**Mechanism:** mirrors IFV-2 at the per-capsule level. The envelope is a large JSON object; the eye learns to scan a small set of fields (`status`, `decisionType`, `tamperEvidence`).

**Compounding factor:** the warnings that would matter (R-CAT-6 outer, `'UNKNOWN'` trust state, `capturedAt: null`) are in fields that fall below the operator's attention budget. The contract holds; the attention does not.

**Severity:** 🟠.

### IFV-4 — Composite-pill consolidation fatigue

**Mechanism:** the passport readiness pill collapses N axes into one color. The operator who would, in principle, want to know all N learns to read the pill. The collapse is itself the fatigue mechanism.

**Severity:** 🟠.

### IFV-5 — Status page expansion fatigue (prospective)

**Mechanism:** the status page today is small (three compliance evidence categories: data classification, retention, authority adapters). Each is rendered as a literal (`redactionLive: false`, `retentionEnforced: false`, `allAdaptersLive: false`) with descriptive subtext. As the page expands (a future wave adds more categories), the literals become a list the operator scans rather than reads. The honest framing today is psychologically defended by the page's small size.

**Severity:** 🟢 today, 🟡 prospective.

## Dashboard-induced false-belief register

The composite vectors — what an operator who has read the platform's dashboards daily for 12 months actually believes vs what the contract earns.

| Operator belief at month 12 | Source dashboard | Contract assertion | Gap |
|---|---|---|---|
| "Lane health is the platform's general health" | lane-health badge | lane health is source-coverage availability | 🟠 — over-generalization |
| "If no red, the platform is fine" | employer dashboard | the platform has not rendered red on the surfaces it has signals for | 🔴 — implicit-as-positive |
| "The audit table is the audit record" | timeline | the audit table is what was rowed | 🔴 — refusal/replay/declaration absence |
| "Bundles I send are complete" | bundle JSON | bundles contain what survived the per-capsule replay loop | 🔴 — survived ≠ requested |
| "Bundles I receive are signed by VitalCV" | bundle JSON | `issuer: 'VitalCV'` is a string literal | 🔴 — no signature |
| "Replay envelopes are decision-time snapshots" | replay envelope | replay envelopes mix recorded and replay-time-computed fields | 🟠 — provenance mixing |
| "All replay actions are R-CAT-6 (dossier)" | replay envelope outer | inner R-CAT preserved but unrendered | 🔴 — outer masks inner |
| "Demo data is clearly disclaimed" | issuer review surface | demo flag + copy disclaimer propagated end-to-end | 🟢 — defended today |
| "The status page is honest about what it is" | status page | "Foundation status preview" literal + `uptimeGuaranteeImplied: false` | 🟢 — defended today |
| "Emergency declarations are permanently logged" | EmergencySwitch | `log('warn', ...)` line + in-process toggle | 🔴 — copy violates |
| "User 'unknown' is a known cohort" | timeline | `'unknown'` is the unattributed-action fallback | 🟠 — habit normalization |
| "If a row exists, the event happened durably" | timeline | row existence does not assert `eventState: 'persisted'` | 🟠 — missing field |

**Pattern:** twelve daily-formed beliefs; six are 🔴, four are 🟠, two are 🟢 (defended). The 🟢 cluster is doctrine-protected (demo flag + status page disclaimer). The 🔴 cluster is concentrated in the three surfaces most likely to leave the perimeter (bundle JSON, audit table, emergency declaration record).

## Where dashboard trust is calibrated

**The lane-health pipeline is the platform's only fully calibrated dashboard.** The badge variants distinguish honestly, the cadence is variable, the decoupling from trust state is structural, the `lastSuccessAt` narrates direction. An operator who reads the lane-health badge daily across 12 months retains a calibrated mental model of source-coverage availability. The badge does not over-assert.

**The status page is calibrated today** by virtue of explicit disclaimer copy ("Status surfaces are foundation previews. No uptime guarantee is implied.") and rendered literals (`uptimeGuaranteeImplied: false`, `productionStatusPageLive: false`). The page does not promise more than the contract earns. The calibration is defended by the page's small size and principled framing; the prospective risk is expansion under "polish" pressure.

**The issuer review surface is calibrated today** by `recordedBy: 'demo'` propagation + explicit copy disclaimer. The three-layer defense (literal + propagation + disclaimer) is the strongest dashboard-calibration pattern in the codebase. The prospective risk is a future demo-polishing wave that softens the disclaimer ([GE-5](longitudinal-governance-survivability.md)).

These three calibrated surfaces all share the same pattern: the rendering layer combines a *contract literal* with a *constant honest copy disclaimer*. The combination is what calibrates; either alone does not.

## Where dashboard trust is over-induced

**The bundle JSON is the dashboard surface that most over-induces trust** for two compounding reasons. First, four 🔴 inflation vectors concentrate in the schema (`bundleHash`, `verificationInstructions`, `bundle.issuer`, `capsuleCount` as survived). Second, it is the artifact most likely to leave the perimeter, so the over-induction reaches the recipient at the moment when the operator's calibration is least available to interrupt it. Every successful export reinforces the false-completeness habit at both sender and recipient.

**The employer dashboard is the daily-frequency over-induction surface.** Implicit-green-as-positive trains every other dashboard read. The lane-health badge does its honest job; the rest of the page silently mirrors happy-path styling for states the contract knows are degraded ([HO-7](dashboard-runtime-honesty.md), [DOV-1](#dov-1--implicit-green-as-positive-on-the-employer-dashboard)).

**The audit timeline is the operator-habit-formation surface.** Daily scrolling, row existence as durable, three retries as three events, `actorId: 'unknown'` as a stable cohort, denial reasons collapsed under one event type — every habit-forming pattern in the platform crystallizes here.

The `EmergencySwitch` is the highest-stakes single false-belief inducer because the copy "Action permanently logged to Audit Scrapbook" is a CI-VIOLATION-class assertion at the surface layer ([constitutional-failure-explainability](constitutional-failure-explainability.md)). It is one screen, low frequency, but the assertion is structurally false.

## Verdict

**Dashboard trust psychology is calibrated where the platform layered three defenses (literal + propagation + copy disclaimer) and over-induced everywhere else.**

Of ten operator-facing dashboard surfaces inventoried, three are calibrated today (lane-health pipeline, status page, issuer review demo surface), two are mixed (passport pill, replay envelope), and five over-induce (employer dashboard, audit timeline, bundle JSON, EmergencySwitch label, lane-health section's halo effect on the rest of the dashboard).

Of nine optimism vectors, four are 🔴 (DOV-2 timeline durable, DOV-3 bundle hash completeness, DOV-4 bundle issuer cryptographic, DOV-5 verification instructions offline-verifiable, DOV-9 EmergencySwitch logged). Of five survivability complacency vectors, two are 🔴 (SCV-2 export completeness habit, SCV-5 emergency declaration durability). Of five integrity fatigue vectors, four are 🟠 (timeline scroll, bundle shape, envelope shape, composite collapse). Of twelve dashboard-induced operator beliefs at month 12, six are 🔴 false beliefs.

The pattern is congruent with PR11B Track B's verdict: dashboard runtime honesty is sharp on lane health and silent everywhere else. PR15B Track C extends the finding: the same surfaces also produce calibrated trust where they exist and over-induced trust where the platform left the literal in code. The doctrine layer (banned strings, demo flag, status disclaimer) defends operator psychology; the structural-gap layer erodes it.

**Strongest constitutional-awareness surface (calibration):** the [LaneHealthBadge](../../apps/web/components/source-health/LaneHealthBadge.tsx) + [LaneHealthMount](../../apps/web/components/source-health/LaneHealthMount.tsx) chain. The only dashboard where rendering layer combines variable cadence + direction signal + visually distinct variants + decoupling. An operator's mental model stays congruent with the contract across 12 months of daily exposure.

**Biggest dashboard-overtrust risk:** the [bundle JSON](../../apps/api/backend/src/services/audit/replayEngine.ts). Four 🔴 optimism vectors concentrate here; it is the artifact most likely to leave VitalCV's perimeter; recipient-side calibration is structurally absent (recipient has no log access, no completeness proof, no signature to verify). Every successful export reinforces a false-completeness belief in both sender and recipient.

**Biggest single false-belief inducer:** the `EmergencySwitch` "Action permanently logged to Audit Scrapbook" copy paired with the in-process `emergencyMode.ts` toggle. The copy asserts a durable record; the contract earns a `log('warn', ...)` line. This is the platform's most direct constitutional-violation-class assertion at the surface layer.

**Track C score: 🟠 OVER-INDUCING.** 11 🟢, 14 🟡, 14 🟠, 11 🔴 across the per-surface scoreboard; 4 🔴 + 4 🟠 + 1 🟡 across the optimism vectors; 12 daily-formed operator beliefs split 6 🔴 / 4 🟠 / 2 🟢. **Dashboard trust psychology is calibrated where the platform built a layered defense and progressively over-inducing everywhere else — the surfaces that face outward induce the strongest trust the contract does not earn.**
