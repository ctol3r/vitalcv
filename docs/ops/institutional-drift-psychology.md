# Institutional Drift Psychology — W2-PR16B Track C

**Wave:** W2-PR16B — Constitutional Institutional Awareness
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [constitutional-context-explainability](constitutional-context-explainability.md), [governance-memory-awareness](governance-memory-awareness.md), [constitutional-awareness-continuity](constitutional-awareness-continuity.md).
**Builds on:** [longitudinal-governance-survivability](longitudinal-governance-survivability.md), [silent-fragmentation-awareness](silent-fragmentation-awareness.md), [replay-warning-psychology](replay-warning-psychology.md), [governance-awareness-survivability](governance-awareness-survivability.md), [escalation-explainability](escalation-explainability.md), [constitutional-failure-explainability](constitutional-failure-explainability.md), [dashboard-runtime-honesty](dashboard-runtime-honesty.md), [forensic-durability-understanding](forensic-durability-understanding.md).

---

## What this track answers

Tracks A and B asked whether *individual contributors* could correctly read constitutional context (rationale-of-the-code) and warning meaning (memory-of-the-warning). **This track asks whether *organizations themselves* — the cumulative pull of teams, executives, customers, and incentive structures around VitalCV — would, over time, normalize the very degradations the platform's contract layer was built to flag.**

The risk vector here is **organizational normalization**: not a single contributor's misreading, not a single reviewer's miss, but the slow group consensus that "this is just how it is." The same way air-traffic-control systems normalized minor deviations until Tenerife, the same way nuclear-plant operators normalized leaking valves until Davis-Besse, the same way safety-critical systems eventually treat their own warnings as background — VitalCV is a safety-critical system with the same psychological pressure shape, applied to credentialing rather than aviation.

An individual contributor is reasoning about one PR. An organization is reasoning about quarters, headcount plans, customer SLAs, and the cumulative weight of "we have shipped this for two years now." That reasoning level is where institutional drift is silent and compounding. It is not visible at the PR level. It is not visible in the docs corpus. It is visible only in retrospect, after the drift has compounded into an event.

This track inventories five drift surfaces — replay ambiguity, export degradation, lineage incompleteness, override permanence, dashboard optimism — across the psychological mechanisms by which organizations normalize them. Each surface is graded for normalization-vulnerability, the optimism vectors that drive it, and the governance-amnesia vectors that compound it.

## Normalization-state vocabulary

The four organizational states a degradation surface can occupy as the institution forms a cumulative posture toward it:

- **🟢 RESISTED** — the organization has structural and cultural defenses that fight normalization. Reviewer attention is genuinely sustained. The defense is fresh on every contribution. New hires inherit the discipline. The degradation, when it occurs, gets noticed.
- **🟡 SLIPPING** — the organization's defenses are intact in writing but already slipping in habit. Reviewers still flag the issue but increasingly ask "is this really the hill?" The degradation gets noticed about half the time it occurs.
- **🟠 ACCEPTED** — the organization has settled into "this is how it works." The defenses still exist on paper; nobody is actively dismantling them. But nobody is actively defending them either. The degradation, when it occurs, is processed as routine.
- **🔴 NATURALIZED** — the organization has incorporated the degradation into its identity. Removing it would feel like a regression. The degradation has become the system's normal operating mode in everyone's mental model. New hires absorb the naturalization on day 1.

These four grades are independent of operator-awareness (PR15B) and contributor-awareness (PR16B Tracks A/B). An organization can have 🟢 AWARE operators (who notice the signal) and 🔴 NATURALIZED institutional posture (where the leadership team has decided "this is fine"). The decoupling is what makes institutional drift dangerous.

## Five drift surfaces under organizational pressure

For each surface, score the cumulative organizational posture today and project the trajectory.

| Drift surface | What gets normalized | Today | +12mo trajectory | Why |
|---|---|---|---|---|
| **Replay ambiguity** | recorded vs replay-time-computed indistinguishable in envelope | 🟡 SLIPPING | 🟠 ACCEPTED | reviewer attention is sustained on truth-contract literals; sustained on R-CAT outer-vs-inner is shallow |
| **Export degradation** | bundle silently drops capsules; recipient cannot detect | 🟠 ACCEPTED | 🔴 NATURALIZED | every successful "complete" bundle export reinforces the inflation; the artifact leaves the perimeter, so external feedback is delayed |
| **Lineage incompleteness** | C-1 / T0 / replay-time chain collapsed under "lineage" | 🟠 ACCEPTED | 🟠 ACCEPTED (bounded) | the runtime cohesion test prevents structural drift; the surface drift is not loud enough to escalate |
| **Override permanence** | declaration is in-process; UI overstates durability | 🟠 ACCEPTED | 🔴 NATURALIZED | every demo reuses the inflated UI without challenge; the defense is doctrine-only; the inflation is product-language |
| **Dashboard optimism** | constant-green status reads as positive claim | 🟡 SLIPPING | 🟠 ACCEPTED | the page is small and disclaimed today; expansion under "polish" pressure is the predictable trajectory |

**Tally today: 0 🟢, 2 🟡, 3 🟠, 0 🔴.**
**Tally +12mo: 0 🟢, 0 🟡, 3 🟠, 2 🔴.**

**Pattern:** every drift surface is on a degradation trajectory. The trajectory is not aggressive — none drops two grades in 12 months — but the average direction across all five is slow erosion. Two surfaces (export, override) cross from 🟠 to 🔴 within the projection window. None ascends.

**Why no surface is 🟢 today:** the platform's structural defenses (truth-contract literals, runtime cohesion test, banned-strings list) are real and sustained — but none of them defends *organizational posture*. They defend code. The organization's posture is the unanchored layer.

## Per-surface drift psychology

### S.1 — Replay ambiguity (🟡 SLIPPING → 🟠 ACCEPTED)

**What gets normalized:** the indistinguishability between recorded and replay-time-computed fields in the envelope. The R-CAT-6 outer covering R-CAT-1…5 inner. The `'UNKNOWN'` trust state at decision time becoming modal as retention ages out.

**Organizational pressure mechanism:**
- Replay envelopes are read most often by engineers, occasionally by investigators, almost never by executives. The cumulative organizational posture toward the envelope is *engineer-shaped*.
- Engineers reading 200 replay envelopes during incident response reproduce the operator-psychology pattern from [replay-warning-psychology](replay-warning-psychology.md) MD-1 at the team level: the modal answer becomes the team's mental answer.
- After 12 months the team's onboarding instinct is "if you see R-CAT-6, that's just the envelope" — which is correct but elides why the masking was originally a flagged concern.

**Optimism vector:** "the replay envelope has all the fields it needs; we wrote the round-trip test." The round-trip test passes; the test asserts contract preservation, not surface preservation. The team's confidence in the envelope rises with each green CI run.

**Amnesia vector:** the rationale for the outer-vs-inner separation lives in the docs corpus, not in code. New contributors read the precedent; old contributors stop discussing it; the rationale fades from review threads after ~6 months.

**Erosion compounding:** RD-1 (semantic widening), RD-2 (overuse), RD-3 (recorded-vs-computed widening), RD-4 (authority chain inference normalization). Four named drift vectors per [longitudinal-governance-survivability](longitudinal-governance-survivability.md).

**Why the trajectory is 🟠 and not 🔴:** the truth-contract layer above (literal types, banned strings) holds firm. Replay ambiguity normalizes within the *forensic* lane; it does not propagate into the *trust-class* lane. The drift is bounded by the structural defenses around it.

### S.2 — Export degradation (🟠 ACCEPTED → 🔴 NATURALIZED)

**What gets normalized:** bundle exports drop capsules silently. `bundleHash` reads as completeness. `verificationInstructions.how` reads as offline verifiability. `bundle.issuer: 'VitalCV'` reads as cryptographic provenance.

**Organizational pressure mechanism (the export-degradation case is the canonical worst):**
- Bundles are the artifact most likely to leave VitalCV's perimeter — they go to regulators, auditors, opposing counsel, customer compliance teams.
- Outside the perimeter, no one has access to server logs that name dropped IDs.
- Inside the perimeter, every successful export reinforces "exports work." The team has no signal that drops are occurring at any rate.
- The cumulative customer story over 12–24 months is "we have exported N thousand bundles, never had a verification failure" — a literally true statement that is also a statement about a property the bundle does not assert.

**Optimism vector:** "the bundle has a hash, instructions, and an issuer field — what more does an audit artifact need?" The schema *looks* complete because it has every field a complete schema would have. The schema's silence about drops is invisible from inside the schema.

**Amnesia vector:** the rationale for adding `partialExport` / `requestedCount` / `droppedIds` exists in the docs corpus ([silent-fragmentation-awareness](silent-fragmentation-awareness.md) Surface 2). The trajectory of "let's add these fields in a future wave" is older than 6 months. Each quarter the wave gets re-prioritized below something else, not because the team disagrees with the rationale but because the urgency is contributor-memory-bound and contributor memory is rotating.

**Why the trajectory is 🔴:** export degradation is the only drift surface where (a) the artifact leaves the perimeter, (b) the recipient has no detection mechanism, (c) every successful export *reinforces* the inflation, and (d) external pushback would arrive only at an investigation moment when it is too late to defend retroactively. The naturalization mechanism is structural: the absence of signal is the absence of pressure.

### S.3 — Lineage incompleteness (🟠 ACCEPTED → 🟠 ACCEPTED, bounded)

**What gets normalized:** C-1 (durable checkpoint) vs T0 (originating mutation) vs replay-time-derived chain collapsed under the single word "lineage." Three retries (same `mutationFingerprint`) rendering as three rows. Outer R-CAT-6 masking inner action class.

**Organizational pressure mechanism:**
- Lineage questions arise in two contexts: forensic investigation (rare) and engineering debugging (frequent). Engineering debugging treats "lineage" as a unified mental object; the contract preserves three distinct objects.
- Over 12 months, the engineering team's working vocabulary collapses to "lineage" as one word. The C-1/T0 distinction lives in [runtimeTrustCohesion.ts](../../apps/api/backend/src/services/runtimeTrustCohesion.ts) and a single test ([replayEngine.runtimeCohesion.test.ts](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts)).
- New engineers join the team and absorb the collapsed vocabulary. The contract distinction is preserved structurally but not linguistically.

**Optimism vector:** "we have the round-trip test — lineage is solid." The test asserts that fingerprint, payloadHash, and correlationId flow verbatim through capsule metadata into replay. It does not assert that operators understand the distinction.

**Amnesia vector:** the C-1/T0 vocabulary lives in the docs corpus and the test name. Neither is read on a routine engineering task. The vocabulary becomes folk knowledge.

**Why the trajectory is bounded:** the runtime cohesion test prevents *structural* lineage drift — if the contract layer collapses, CI catches it. The drift here is *vocabulary*, not structure. Bounded drift can compound into worse states (an operator who collapses the vocabulary may inadvertently propose a contract change that collapses the structure), but the structural defense gives the drift a ceiling.

### S.4 — Override permanence (🟠 ACCEPTED → 🔴 NATURALIZED)

**What gets normalized:** `let emergencyModeActive = false` ([emergencyMode.ts:8](../../apps/api/backend/src/services/compliance/emergencyMode.ts)) is in-process. Declaration writes a `log('warn', …)` and no audit row. UI reads "Action permanently logged to Audit Scrapbook" ([EmergencySwitch.tsx:91](../../apps/web/components/employer/EmergencySwitch.tsx)) — an inflation relative to backend reality.

**Organizational pressure mechanism (the override-permanence case is the second worst):**
- The EmergencySwitch is the highest-visibility safety-posture surface in the product. Every demo includes it. Every pilot deck shows it. Every regulator-facing pitch references it.
- The team's ability to demo the surface convincingly *depends on* the inflated copy. Removing "permanently logged to Audit Scrapbook" weakens the demo before the durability lift completes. The team has incentive to leave the inflation in place until the durability is real.
- Once the durability lift lands (Redis-backed declaration, EMERGENCY_DECLARED audit type), the inflation should be resolved. But the team's mental model after 12 months of demoing the inflated language is "this is what our emergency surface says" — the language has become product identity.
- The naturalization is *cultural*: removing the inflation feels like reducing the product, even when the truth aligns.

**Optimism vector:** "we have the per-credential override row + 72-hour TTL + post-event reconciliation flag — that's a real audit trail." All three are real. The audit trail starts at first override, not at declaration. The inflation is "we permanently log the declaration"; the truth is "we permanently log every credential we override after the declaration." The substitution is one word ("declaration" → "override") but the institutional reading collapses them.

**Amnesia vector:** the rationale for the in-process toggle ("it's a placeholder for redis/db") lives in one inline comment. After 12 months, no one currently in the room may remember that the toggle is a placeholder rather than a design choice.

**Why the trajectory is 🔴:** override permanence is the surface where (a) the inflation is in product copy, (b) the demos depend on the inflation, (c) the durability fix is multi-component (Redis backing + audit type + UI reconciliation), and (d) every quarter the wave prioritization defers the fix in favor of features. The naturalization mechanism is incentive-aligned: the team is rewarded for shipping demos, the demos use the inflated copy, the inflation persists.

### S.5 — Dashboard optimism (🟡 SLIPPING → 🟠 ACCEPTED)

**What gets normalized:** the constant-green status page reads as a positive claim about the platform. Compliance evidence section literals (`redactionLive`, `retentionEnforced`, `allAdaptersLive`) read as enforced policies. Future status-page expansions inherit the "render-the-literal-as-status" pattern.

**Organizational pressure mechanism:**
- Status pages are sales surfaces. Customer success teams reference them. Procurement reviews reference them. The team has incentive to expand the page over time as the platform's compliance posture matures.
- The current page is psychologically defended by its disclaimer header ("Status surfaces are foundation previews. No uptime guarantee is implied.") and by the literal-not-status rendering (boolean values, not "OK"/"UNHEALTHY"). Both are sustained today.
- Expansion under "polish" pressure is the predictable trajectory: a new section lands rendering a green check rather than a boolean value. The disclaimer in the header stays unchanged. Each individual section is honest at the literal layer; the cumulative reading is "compliance dashboard."

**Optimism vector:** "we have the disclaimer at the top." The disclaimer is real and sustained. Its psychological weight diminishes as the page accumulates more sections — readers process the header once and the sections N times.

**Amnesia vector:** the rationale for the literal-not-status rendering ("we render `redactionLive: false` not 'NOT YET LIVE'") lives nowhere in code other than the page itself. A future contributor adding a new section may render it as `'OK'` / `'PENDING'` / `'NEEDS_ATTENTION'` strings without realizing the existing convention.

**Why the trajectory is bounded at 🟠:** the disclaimer header is a strong present-time defense. Expansion will erode it gradually. The surface is small enough today that the erosion will not naturalize within 12 months — but every wave that adds to the page is an opportunity for the convention to slip without anyone noticing.

## Organizational optimism vectors

The cumulative pressures that drive an organization toward normalizing each drift surface, named and ranked.

### OV-1 — Demo dependency on inflated language

**Mechanism:** the team's most visible surfaces (EmergencySwitch UI, status page sections, audit trail descriptions in pitch decks) depend on language that overstates the underlying contract. Removing the inflation weakens the demo. The team defers the fix until "after the durability lift" — and the durability lift is multi-component, so the deferral compounds.

**Affected surfaces:** override (canonical), dashboard (rising), forensic (audit trail descriptions).

**Severity:** 🔴 — incentive-aligned, hard to dislodge.

### OV-2 — Customer absence of feedback

**Mechanism:** the artifacts most likely to suffer drift (bundles, audit queries, replay envelopes) leave the perimeter. Customers who consume them have no signal of the gaps the artifacts contain. The organization receives no pushback. Absence of pushback is read as confirmation.

**Affected surfaces:** export (canonical), forensic, replay (in customer-facing investigation contexts).

**Severity:** 🔴 — silent and compounding.

### OV-3 — Wave-prioritization decay

**Mechanism:** every wave plan begins with constitutional fixes (durability, signed bundles, audit completeness) on the roadmap. Each wave's actual scope prioritizes feature delivery over constitutional repair. The constitutional fixes roll forward each quarter. After four quarters they are "always on the roadmap."

**Affected surfaces:** all five — but especially export, override, forensic.

**Severity:** 🟠 — predictable but mitigable by explicit constitutional-only waves.

### OV-4 — Internal-knowledge concentration

**Mechanism:** the rationale for each constitutional defense is concentrated in a small number of contributors who wrote it. The docs corpus preserves the rationale, but the docs corpus is large. New contributors do not read the corpus serially; they read what their PR forces them to read. The rationale's *living-knowledge* density drops as turnover proceeds.

**Affected surfaces:** all five.

**Severity:** 🟠 — slow and steady.

### OV-5 — Doctrine layer overconfidence

**Mechanism:** the truth-contract literals (V.3 in Track A) are 🟢 PRESERVED. The team observes that constitutional defense *is* possible and may infer that the platform's constitutional posture is generally well-defended. The inference is wrong: the trust-class family is the only family that holds across all four institutional-memory criteria.

**Affected surfaces:** the meta-layer — the team's belief about how strong the platform is overall.

**Severity:** 🟠 — invisible while operating; consequential during incident response when the gap surfaces.

## Governance amnesia vectors

The mechanisms by which institutional knowledge of *why* a defense exists fades over time.

### GA-1 — Contributor turnover

**Mechanism:** the contributors who wrote the truth contract, the round-trip test, the demo-flag propagation know exactly why each is shaped the way it is. Reviewers who join the project later inherit the *what* but not the *why*. Each contributor turnover removes a layer of unwritten rationale.

**Affected surfaces:** all five.

**Severity:** 🟠 — universal, slow.

### GA-2 — Docs corpus scaling

**Mechanism:** the docs corpus has grown past 100 entries in `docs/ops/` (`ls docs/ops/ | wc -l` = 100). Cross-references are dense, and a contributor reading any single doc must follow N links to land at the canonical-most rationale. After 12 months of growth, no individual reader has read the full corpus. The corpus is institutionally complete and individually unreadable.

**Affected surfaces:** all five — the rationale is in the corpus; the corpus is not in any one reader.

**Severity:** 🟠 — scaling-induced.

### GA-3 — Reviewer attention budget

**Mechanism:** every PR reviewer has a finite attention budget. Reviews catch the most flagrant issues first; the slow drift vectors (a new event-type collapsing subtypes, a new computed envelope field without provenance, a new dashboard section without literal-not-status discipline) are below the attention threshold. The organization's review attention is correctly weighted toward present-time correctness; institutional drift is a future-time concern that loses the prioritization battle.

**Affected surfaces:** replay (RD-1…4), forensic (TD-1…2), dashboard (DD-1…4).

**Severity:** 🟠 — load-bearing on reviewer recall.

### GA-4 — Wave-doc rotation

**Mechanism:** each wave produces docs. Each new wave's docs supersede older wave docs as the canonical reference. Older wave docs become snapshot-shaped. After 4–6 waves, the W2-PR4B/PR7B rationale is partially historical-only — still correct, but not the active reference.

**Affected surfaces:** the docs corpus itself.

**Severity:** 🟡 — mitigable by canonical-doc rollups (the [longitudinal-governance-survivability](longitudinal-governance-survivability.md) pattern is the right shape).

### GA-5 — Naturalization in onboarding

**Mechanism:** new hires absorb whatever the platform looks like on day 1. If the EmergencySwitch UI says "permanently logged" and the backend has no row, the new hire reads both as the *normal* state. They have no encounter with the contradiction; the contradiction is invisible to them. After 6 months they cannot reconstruct the rationale because they never had it.

**Affected surfaces:** override (most acute), dashboard, forensic.

**Severity:** 🔴 — accelerates with hiring growth.

## Replay-caution erosion vectors

Specific to the replay surface — the platform's most condensed signal channel.

### RC-1 — `tamperEvidence` cadence dilution

**Mechanism:** ([replay-warning-psychology](replay-warning-psychology.md) DV-1 at organizational scale.) The team observes 99%+ null cadence in production. After 12 months of seeing null, the cumulative team posture is "tamperEvidence is the field that fires when something is broken" — which is correct but elides "tamperEvidence fires for three specific failure modes; it does not fire for export drops, refusal-row absence, or replay-invocation absence."

**Severity:** 🟠.

### RC-2 — `R-CAT-6` outer naturalization

**Mechanism:** every replay envelope has `replayCategory: 'R-CAT-6'` outer. After 12 months, the engineering team treats the field as a constant. Onboarding documentation may even start to describe it as a constant. The recovery — "outer is the envelope-class, inner is the action-class" — fades from active vocabulary.

**Severity:** 🔴 in the onboarding-docs path; 🟠 in active engineering.

### RC-3 — `'UNKNOWN'` modal drift

**Mechanism:** as retention ages out, `evidenceSnapshot.trustStateAtDecision: 'UNKNOWN'` becomes the modal answer for old capsules. The team's reading of `'UNKNOWN'` shifts from "this is a fallback" to "this means it was unknown then." The shift is value-layer (TD-3 from [longitudinal-governance-survivability](longitudinal-governance-survivability.md)); the type holds, the meaning erodes.

**Severity:** 🟠.

### RC-4 — Authority chain replay-time-inference normalization

**Mechanism:** ([longitudinal-governance-survivability](longitudinal-governance-survivability.md) RD-4 at organizational scale.) Each new replay path that lacks `issuerIds` falls into the inference branch ([replayEngine.ts:441-456](../../apps/api/backend/src/services/audit/replayEngine.ts)). After 12 months, "the chain is in the envelope" becomes the team's mental model — without distinction between recorded chain and inferred chain.

**Severity:** 🟠 — self-widens with new replay paths.

### RC-5 — Round-trip test overconfidence

**Mechanism:** the runtime cohesion test ([replayEngine.runtimeCohesion.test.ts](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts)) passes. The team reads "the test passes" as "replay is solid." The test asserts contract preservation across a known set of fields; it does not assert *all* the fields the operator reads, *the surface*, or *the recorded-vs-computed boundary*.

**Severity:** 🟠 — quiet overconfidence.

## Five organizational normalization rings

The institutional psychology of drift, modeled as concentric rings of pressure.

### Ring 1 — Engineering team

The innermost ring. Reads code daily, sees the truth-contract literals constantly, runs the round-trip test on every CI cycle. Strongest defense layer. Vulnerable to: reviewer attention budget (GA-3), turnover (GA-1).

**Pressure direction:** correctness-preserving. Engineers want the code to be right.

### Ring 2 — Product and design

Reads code rarely. Reads UI copy frequently. Authors UI copy occasionally. Owns the inflated copy ("permanently logged to Audit Scrapbook"). Vulnerable to: demo dependency (OV-1).

**Pressure direction:** clarity-preserving toward customers, occasionally at the expense of contract-faithfulness.

### Ring 3 — Sales and customer success

Reads UI and deck content. Owns the customer-facing language. References status page, audit trail features. Vulnerable to: customer absence-of-feedback (OV-2).

**Pressure direction:** demo-velocity-preserving. Inflation that wins demos persists.

### Ring 4 — Executive leadership

Reads roadmap, board decks, customer pipeline. References constitutional defenses occasionally. Owns wave prioritization. Vulnerable to: wave-prioritization decay (OV-3).

**Pressure direction:** ship-velocity-preserving. Constitutional repair waves lose to feature waves.

### Ring 5 — Customers and regulators

Reads bundles, status pages, audit trail descriptions. No internal feedback path. Vulnerable to: nothing — they are the canary that arrives at the investigation moment.

**Pressure direction:** retroactive-trust-revocation. When the canary chirps, the trust loss is large and structural.

**Pattern:** the rings furthest from the code (rings 3, 4, 5) cannot read the constitutional defenses. The rings closest to the code (rings 1, 2) shoulder the entire defense load. As organizational scale grows, the proportion of ring-1+2 decision-makers drops. Institutional drift is the gradient pull from outer rings toward inner-ring relaxation.

## Verdict

**Institutional drift psychology is intact today (no surface 🔴) and trending toward erosion (two surfaces 🔴 within 12 months).**

Three drift surfaces are 🟠 ACCEPTED today: export degradation, lineage incompleteness, override permanence. Two are 🟡 SLIPPING: replay ambiguity, dashboard optimism. None is 🟢 RESISTED. The organization's structural defenses (truth-contract literals, runtime cohesion test, banned-strings list) hold; the organization's *cumulative posture* toward each degradation is on a slow slide that no individual defense interrupts.

The two surfaces with 🔴 NATURALIZED trajectories — export degradation and override permanence — share a common shape: the artifact most relevant to external readers carries inflated language, the external readers have no feedback path, and the team's incentive structure rewards the inflation (export-as-evidence-completeness, override-UI-as-safety-claim). The naturalization mechanism in both is structural: the absence of pressure becomes the basis of confidence.

Five organizational optimism vectors drive the drift: demo dependency on inflated language (🔴), customer absence of feedback (🔴), wave-prioritization decay (🟠), internal-knowledge concentration (🟠), doctrine-layer overconfidence (🟠).

Five governance-amnesia vectors compound the drift: contributor turnover (🟠), docs corpus scaling (🟠), reviewer attention budget (🟠), wave-doc rotation (🟡), naturalization in onboarding (🔴).

**Strongest organizational defense:** the truth-contract literal types — type-pinned, test-defended, banned-strings-defended, CLAUDE.md-prose-defended. Five overlapping anchors mean even an organization slipping at the cultural level has a structural floor that fails the build before the inflation reaches a customer.

**Biggest governance-amnesia risk:** GA-5 — naturalization in onboarding. New hires absorb the platform's current state as baseline; they have no encounter with the contradictions (UI copy vs backend behavior, audit floor vs claim of completeness). The naturalization compounds at the rate of headcount growth, which is faster than the rate of constitutional repair.

**Track C score: 🟠 ACCEPTED (drifting toward 🔴).** 0 🟢, 2 🟡, 3 🟠, 0 🔴 today; 0 🟢, 0 🟡, 3 🟠, 2 🔴 projected at +12 months. **No drift surface ascends in trajectory. Two cross into NATURALIZED. The organization's structural defenses hold the floor; the organization's posture is the unanchored layer where drift compounds.**
