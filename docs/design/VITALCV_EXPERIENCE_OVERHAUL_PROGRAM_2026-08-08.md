# VitalCV Experience Overhaul Program — Binding Execution Plan
**Date:** 2026-08-08 · **For:** Claude Code execution, founder-gated · **Status:** Ready to run

This plan merges the founder's Experience Overhaul Program (UX-00 → UX-16, three lanes, design-only boundary) with a full audit of everything design/brand/UX/motion/messaging-related found in the repo, design archives, and project knowledge on 2026-08-08. It is the single reference for every overhaul wave.

---

## THE DESIGN-ONLY BOUNDARY (top of every wave, verbatim)

> **DESIGN-ONLY BOUNDARY**
> This wave may change UI, UX, visual design, interaction design, responsive behavior, animation, information hierarchy, customer-facing copy, navigation presentation, and brand expression.
> It may not change application truth, authentication, authorization, consent semantics, data models, APIs, readiness calculations, agent policy, source behavior, employer decisions, business logic, or pricing behavior.
> If the proposed experience requires one of those changes, record it as a product dependency and stop. Do not solve it inside the design PR.

**Operating rule:** Product contracts are inherited. Visual decisions are not. No wave inherits a prior visual treatment merely because it exists.

---

## Part 1 — What the audit found (the ground truth every wave builds on)

### 1.1 The five visual eras (all still physically present in `apps/web`)

stark black/white YC MVP → Warm Minimalism / Liquid Glass blueprint → Antigravity (particles, glass, magnetic buttons) → **Calm Wave** paper+ink (waves 1500–1505) → **Creative Direction** "record, not dashboard" (July 2026). The Aug 7–8 homepage reset is the sixth proposal, awaiting verdict.

Physical residue, audited on branch `wave/career-evidence-network-alignment`:
- `apps/web/app/globals.css` imports **13+ stylesheets**: `vds.css`, `design-tokens.css`, `tokens.css`, `vitalTokens.css`, `matcha.css`, `matcha-zen.css`, `graph.css`, `intelligence.css`, `blueprint-overrides.css`, plus `antigravity.css` via layout — competing token prefixes (`--vt-`, `--ag-`, `--palette-`, `--vital-`, `--gf-`, `--trust-`, `--infra-`, `--glue-`, `--ops-`, `--mz-`, …).
- A **global `*` transition rule** (280ms on all color properties) — forbidden by the wave-1505 motion doctrine it coexists with.
- `apps/web/app/fonts/` is **empty**: display serif aside, body and mono still resolve to system stacks. The product's typography is currently whatever the visitor's OS ships.
- **Two parallel component systems** (`design-system/` from PR-E #209 vs shadcn-era `components/ui/`); a `Badge` import resolves differently by path; **≥30 status/badge components** express the same truth states.
- `check-design-lint.ts` exists **only in the `.worktrees/retire-speed-claim` worktree** — the CI enforcement gate never landed on mainline.

**Conclusion:** the doctrine is largely written and good; almost none of it is enforced in the shipped product. This program is ~20% new decisions, ~80% execution + enforcement.

### 1.2 Reference material (parked, not deleted — Phase 0)

| Source | Location | Status in this program |
|---|---|---|
| **Creative Direction** (CD-1…CD-20, est. 2026-07-25, amended 2026-08-01) | `docs/design/VITALCV_CREATIVE_DIRECTION.md` | Primary raw material for UX-00. Its five laws, mono law, state law, kill list, geometry semantics, motion rules, and competitive asymmetries (CD-20 vs Medallion/Carefam) carry forward. Its palette/type sections are **subject to the UX-01 verdict** ("winner becomes global"). Amend per CD-19, never fork. |
| **Wave 1505 design system** | `design-handoff/claude-design-2026-07-12-wave1505/wave1505/` (`DESIGN_SYSTEM.md`, `DESIGN_LINT.md`, `REGRESSION_MATRIX.md`) | Best token/component architecture (`--vt-*` semantic layer, StateChip contract, HonestyLabel, z-scale, 10 lint rules, `/dev/design` arbiter). Carries forward as UX-02's skeleton, re-skinned to the winning direction. |
| **Homepage reset** (2026-08-07/08) | `design-lab/homepage-reset/` — MASTER-BRIEF, 3 direction BRIEFs, 3 critiques, full Playwright evidence + motion.mp4 | **This IS UX-01, ~80% complete.** All three directions passed critique pass 1. Remaining: founder verdict. |
| Competitive mandate (six-scene film) | `VitalCV_Competitive_Mandate_and_Claude_Code_Waves_2026-07-21.md` — **not found at shallow paths; locate or record missing in UX-00** | Superseded on homepage composition by the reset; strategic copy content salvaged into UX-16. |
| UI inventory | `docs/design/current-ui-inventory.md` (2026-05-27) | Stale but structurally right; refreshed by the Browser inventory task. |
| Other audits | `docs/design/reference-experience-atlas.md`, `DESIGN_GODMODE_MASTER_TASKLIST.md`, `p0-wave-plan-2026-07-18.md`, `docs/VCV_UI_DOCTRINE.md`, `docs/UI_PRIMITIVES.md`, `docs/VDS_REFERENCE.md`, zenlike-ui-doctrine | Reference material; mine for unfinished P0s during the Browser inventory. |
| Project-knowledge strategy signals | *VCV Sell Strategy* 03-20 ("multiple visual systems fighting… brand does not feel singular"), *Steve Jobs feedback* 04-13 (first two minutes; "this already did work for me"), *UI/UX Review* 04-13 (evidence-first UI, progressive disclosure) | All three independently converge on the Easy Button + calm-intelligence direction. Cited in UX-00 as rationale. |

### 1.3 The three directions awaiting verdict (UX-01 output)

All three express **"Enter your NPI. VitalCV does the rest."**, the four-owner model, the hard eyebrow spec (Palantir/Zoox-measured, 56–72px constant instrument bar), the 5-beat no-NPI explainer, agent-as-operator (no chat), the truth contract, and full desktop/mobile/motion/reduced-motion coverage:

- **A — Operational Calm.** Bone `#F1F0EC` + one spruce accent `#175E4C`; Instrument Sans + IBM Plex Mono; quiet work-ledger hero. Calmest; nearest to existing paper+ink instincts. Critique: PASS across the board; distinctiveness "partial by design."
- **B — Intelligent Product.** Warm graphite dark `#141517` + work-green; Geist + Geist Mono; the product visibly works in the hero (14–18s single autoplay). Strongest easy-button demonstration; biggest brand statement; watch autoplay pacing.
- **C — Precision / Editorial.** Gallery white `#FBFAF7`, drafted black rules, expanded Archivo at 88–110px, scarce vermilion `#D8451D`. Strongest five-second test; most distinctive ("nothing in healthcare software looks like this"); the far pole from calm.

---

## Part 2 — Program structure

Three lanes; never two waves editing the same surface simultaneously.

```
Lane A — Foundation   UX-00 → UX-01(verdict) → UX-02 → UX-03   (must complete first)
Lane B — Clinician    UX-04 → UX-05 → UX-06 → UX-07 → UX-08 → UX-09 → UX-10
Lane C — Employer     UX-11 → UX-12 → UX-13   (after foundation settles)
Continuous            UX-14 motion · UX-15 mobile · UX-16 messaging · CI gate (§4)
```

**Claude operating model, every wave:**
1. **Claude Browser first** — observe the live surface, capture BEFORE evidence, name exactly what is wrong.
2. **Claude Code** — build one coherent solution on a clean branch off latest `main`.
3. **Claude Browser** — critique the result using the design-lab template (five-second / easy-button / distinctiveness / trust / product / employer / eyebrow tests) + Playwright captures at 1440×900 and 390×844 + reduced-motion (harness: `design-lab/homepage-reset/evidence/capture.mjs`).
4. **Founder visual gate** — GO / REVISE / HOLD / REJECT. CI green is necessary, never sufficient.

**Standing copy law (machine-checkable from UX-02 onward):** banned anywhere in customer-facing copy or attributes — "automatically verified", "guaranteed verification", "complete credentialing", "instant credentialing", "legally accepted", "risk transferred", "final verification without review", "source confirmed before response", "certified compliant", "HIPAA compliant" (→ HIPAA-aligned), "SOC2 certified", "NPDB", "hire instantly", "blockchain-anchored", "zero-knowledge proof", "all 50 states", bare "Verified" as a status. Never a confirmed mark on gated (Nursys, FSMB) or non-integrated (NPDB, DEA, ABMS, SAM.gov, Doximity) sources.

---

## Part 3 — The waves

### PHASE 0 — Freeze the visual churn (immediate, ~1 hour)

- Declare a UI PR freeze until UX-03 ships: no visual PRs outside this program.
- Park (do not delete) all unapproved visual treatments; add `docs/design/PARKED_VISUAL_ERAS.md` listing each era, its stylesheets/islands, and its parked status.
- Add the Design-Only Boundary + operating rule to `CLAUDE.md` so every agent inherits it.

**Gate:** the boundary text is in `CLAUDE.md`; parked-eras doc committed.

---

### UX-00 — VitalCV Experience Constitution (Lane A, first)

**Goal:** one binding document defining the experience — feeling, principles, and locked brand decisions — that every subsequent wave inherits.

**Target feeling:** *Calm intelligence doing complicated work for you.* Not healthcare software you have to operate.

**The ten principles (verbatim into the constitution):**
1. Easy outside, sophisticated inside.
2. Show users what VitalCV did, not all the machinery used to do it.
3. One obvious next action.
4. Value before commitment.
5. Work completed is more important than data displayed.
6. Explain consequences, not system states.
7. Trust through clarity, not trust vocabulary.
8. AI manifests as work, not chat.
9. Mobile is designed independently.
10. Motion explains transformation.

**Build instructions for Claude Code:**
- Author `docs/design/VITALCV_EXPERIENCE_CONSTITUTION.md` as the successor-of-record to `VITALCV_CREATIVE_DIRECTION.md` (amend CD per CD-19 with a dated rationale and a pointer forward — never a silent fork).
- Carry forward from CD, intact: the five laws (truth outranks beauty; state never by color alone; meaning never lives in motion/hover/GPU; glass on chrome, solid on evidence; one system), the mono law (machine facts mono, prose sans, argument display), state law (glyph + word + source + age), geometry semantics (near-sharp stamps; pills retired), the kill list (CD-13: graphs/constellations, carousels, metric-counter theatre, gradients-as-surface, glow, stock clinicians, emoji-as-UI, blockchain/wallet/DID iconography in the acquisition path — extended with the reset's bans: glowing AI gradients, purple/blue AI blobs, endless bento boxes, glassmorphism, fake browser windows, film/scene model), the accessibility floor (AA, grayscale-legible, keyboard-complete, 44px targets, reduced-motion as first-class composition), and CD-20's four competitive asymmetries (give the product away in the first viewport; show one artifact, not claimed numbers; speak to the clinician; demonstrate, don't assert).
- Add the reset-era doctrine: the Easy Button frame; the four-owner vocabulary (**VitalCV handles / Needs your approval / Needs you / Employer decides**); agent behavior ladder (*observe → explain → recommend → prepare → execute with consent → escalate*) as the source of all agent-state UI; the acquisition-surface vocabulary ban (§UX-16 list); the hard eyebrow spec as the navigation constitution.
- **Brand decisions to lock** (values filled by the UX-01 verdict, structure locked now): typography family · type scale · grid · page width · eyebrow geometry · button grammar · border/rule grammar · icon family · corner-radius philosophy · spacing rhythm · neutral palette · interaction/accent treatment · product-UI treatment · illustration treatment (only images VitalCV publishes are its own artifacts) · motion timings/easing (80–150ms control feedback / 150–250ms state transitions / 250–450ms product transformation / 450–800ms rare narrative; nothing loops gratuitously; numbers animate only between real returned values).
- Locate `VitalCV_Competitive_Mandate_and_Claude_Code_Waves_2026-07-21.md`; mark its homepage-composition authority superseded, or record the file missing.

**Gate:** founder reads and approves the constitution. It becomes citable-by-clause; PRs are rejected by citing a number.

---

### UX-01 — Three-Direction Exploration → Verdict (Lane A) — **~80% ALREADY DONE**

The exploration was executed 2026-08-07/08 in `design-lab/homepage-reset/`. Remaining work:

1. Extend `design-lab/homepage-reset/index.html` into a side-by-side review page: per-direction hero shots, `motion.mp4`, reduced-motion frames, mobile frames, critique PASS tables.
2. Write a one-page decision memo: since the winner goes global, what does each direction commit the whole product to? (A → light bone/spruce workspace surfaces; B → dark-first brand with light-band rules to define; C → gallery-white drafted rules product-wide; each → its typeface pair.)
3. Founder verdict → `design-lab/homepage-reset/DECISION.md` (direction or named hybrid, e.g. "A's palette + C's eyebrow").
4. Back-fill the locked values into the constitution (UX-00) same day.

**Gate:** DECISION.md exists; constitution's brand-decision table has no TBDs.

---

### UX-02 — Brand Foundation (Lane A)

**Goal:** the shared visual operating system, implemented once. No page redesigns yet.

1. **Typography:** self-host the winning faces as variable `woff2` via `next/font/local` in `apps/web/app/fonts/` (never `next/font/google` — a build-time fetch is what silently dropped fonts to Georgia before). Wire `--font-display`/`--font-body`/`--font-mono`; delete system-stack mappings; apply the mono law (`tabular-nums`, `slashed-zero`) to all machine facts.
2. **Tokens:** one semantic token layer, prefix `--vt-`, three files (`01-primitives.css → 02-semantic.css → 03-themes.css`) per the wave-1505 architecture, values from the verdict: grounds, ink ramp, rules, ONE interaction accent, state hues. Signal-vs-state separation is law: the brand accent never borrows a state hue; the work/confirmed color means exactly one thing.
3. **Controls:** button grammar (primary/secondary/quiet/destructive; ≥44px targets), fields (incl. `NpiInput` with "Public identifier — not PHI" microcopy), one focus-ring token on every interactive element.
4. **Status:** ONE `StateChip` in `apps/web/design-system/components/` — `<StateChip state source asOf />` with source and timestamp **required at the type level** (unattributed state = compile error); glyph + word always paired; stamp geometry, not pills. Reconcile the public state words with the nine coverage states in `packages/trust-state/sourceCoverage.ts` via one mapping table (type preserves canonical state; chip renders the human word). Then migrate the ~30 badge components (`LaneStateBadge`, `BadgeStatus`, `StatusBadge`, `trust-status-badge`, `claim-badge`, `VerificationBadge`, `ExclusionBadge`, `ReceiptVerificationBadge`, `MonitoringStatusBadge`, `SanctionRiskBadge`, `DecisionBadge`, …). Orthogonal axes (proof tiers, OIG outcomes) keep their components but delegate state visuals to the chip.
5. **Cards/rules, skeletons, animation primitives, responsive rules, product-illustration treatment** per the constitution. Remove the global `*` transition; motion becomes opt-in with house curve + the four timing bands.
6. **De-islanding (mechanical tail, many small PRs):** alias legacy prefixes to `--vt-`, migrate, delete aliases; collapse `globals.css` to ≤4 imports; archive retired era stylesheets to `docs/archive/css-eras/`; `components/ui/` → re-exports → deleted; unscope `.mz`/`.w14`/`.w1505`/`.vs-root` islands.
7. Rebuild `/dev/design` as the living arbiter: tokens, ramp, all chip states, do/don't gallery, motion specimens.

**Gate:** zero system-stack body text (computed-style check); `tsc` fails on unattributed StateChip; grep finds no retired hex or foreign prefixes outside token files; `globals.css` ≤ 4 imports; visual-regression matrix (10 routes × 3 viewports) shows only intended diffs; grayscale passport/review screenshots fully readable.

---

### UX-03 — Wide Eyebrow + Navigation (Lane A, own wave)

**Goal:** a wide, shallow eyebrow structurally faithful to the Palantir/Zoox treatment. Not a SaaS navbar.

Spec (from the master brief, now constitution law): full-width, ONE continuous horizontal instrument, 56–72px constant height, gutters matching the page grid (28–32px); restrained wordmark left; middle = max 3 quiet items or contextual product state; right = quiet Sign in + at most one dominant square-cornered instrument and/or menu control; 1px hairline structure; **banned:** floating rounded container, SaaS pills, centered-link-row-as-main-event, backdrop-blur-navbar-with-thin-line, ordinary hamburger sheet.

Cover: desktop · scroll behavior (bar architecturally stable; may gain solid ground + bottom rule) · inversion over dark/light bands with identical geometry · full-takeover menu canvas · route/product state in the middle zone · deliberate mobile recomposition at same height discipline · motion · keyboard path · reduced motion.

**Gate:** founder GO, then **shared chrome freezes** unless a later usability finding reopens it.

---

### UX-04 — Homepage (Lane B start)

**Goal:** rebuild `/` from scratch in the winning direction. The homepage's one job: make the clinician want to try VitalCV.

Structure: Eyebrow → **"Enter your NPI. VitalCV does the rest."** → illustrated no-NPI explainer (5 beats: masked seed → sourced facts with named sources → what remains, owner-labeled → work resolving with one approval pause → role/first-day momentum; plays once; Replay affordance; static annotated composition under reduced motion; never a fake live result, never a real 10-digit NPI) → four-owner section → jobs/outcome → employer doorway ("Hiring clinicians? Find people who fit. Know what remains. Keep the hire moving." → `/employers`) → real NPI CTA → concise footer.

Port from the winning prototype — it is a port, not a re-imagining. Real entry submits to the canonical flow (`/onboarding?npi=`); the explainer teaches, the real entry executes, never blurred. Homepage vocabulary ban enforced (§UX-16). Kill dead-CTA seams (the historical marketing-app `/clinician` class of bug); one public homepage, one visual system — fold or park `apps/marketing`.

**Gate:** the seven design-lab tests re-run PASS on the production build; Lighthouse a11y ≥ 95; banned-string sweep clean; end-to-end hero → onboarding works; founder GO on preview.

---

### UX-05 — NPI → Recognition (the magic moment; may matter more than the homepage)

**Goal:** enter NPI → *"Poof. VitalCV found me."* The feeling is the product (Steve Jobs review: the user should feel "this already did work for me").

Design: loading sequence (honest, no fake progress) → resolution reveal (identity assembling from named sources) → source-backed facts vs unknowns rendered with equal typographic confidence (the not-checked state as beautifully set as confirmed) → correction path → identity transition (anonymous → recognized) → error states (fail-closed, plain: "Nothing was recorded as successful.") → unavailable-source state (full opacity, explicit, never hidden).

**No:** giant provenance tables (progressive disclosure instead — plain-English top layer; source-by-source; raw receipts beneath), generic completion percentage, administrative terminology, premature forms. This is where the entire visual budget concentrates: the moment an NPI resolves should be genuinely arresting; everything around it stays near-silent so it lands.

**Gate:** founder runs it with a real NPI, cold, on desktop + phone; the emotional beat lands or it's REVISE.

---

### UX-06 — Claim + Activation

**Goal:** `preview → prove it's you → review → approve → VitalCV gets to work` — without the cliff from nice homepage into enterprise configuration wizard.

Every screen answers exactly three questions: *What does VitalCV already know? What does VitalCV need from me? What happens after I answer?* No re-entry of anything already found; consent moments explain consequences, not system states. (Consent semantics themselves: inherited, untouched — boundary.)

**Gate:** cold-run activation by founder; count of user inputs ruthlessly minimized; every step has one obvious next action.

---

### UX-07 — Start Agent Experience (signature interaction system)

**Goal:** a visual vocabulary for agent work — never a chat transcript, no bubbles, no mascots, no "Ask VitalCV anything."

Seven canonical work-states (each: glyph + word + one-line consequence + timestamp; mono for machine facts):
- **VitalCV did it** — "License information refreshed."
- **VitalCV prepared it** — "Ready for your approval."
- **VitalCV needs you** — "Confirm this preference."
- **Someone else controls it** — "The hospital must review this step."
- **Something changed** — "New information was found."
- **Something is blocked** — "This cannot continue until X happens."
- **Finished** — "Done."

Map visuals 1:1 to the agent behavior ladder (observe → explain → recommend → prepare → execute with consent → escalate) so the ladder is visually obvious. Approval moments are the sacred interaction: nothing moves without the clinician, and the UI makes that legible. Activity renders as a work ledger/receipt stream (the direction-A/B hero grammar, productized).

**Gate:** a non-founder reader can narrate "what VitalCV did for this person this week" from the surface alone.

---

### UX-08 — Activated Clinician Home

**Goal:** after activation the product is a living operating surface, not a profile editor. Landing: *"Here's where things stand."* Then: one next action · VitalCV activity · opportunities · upcoming deadlines · approvals waiting · external blockers · recently completed work. Profile editing exists but is not the product.

**Gate:** the first screenful answers "what should I do next?" in one glance; zero dashboard-widget sprawl (one primary action per screen).

---

### UX-09 — VitalCV Jobs

**Goal:** discovery rebuilt around *"Why does this role fit me?"* Every role shows: employer · role · location · schedule · compensation where available · why it may fit · what the employer needs · what VitalCV already has · what remains · whether Apply with VitalCV is supported. **No mysterious readiness number.** Fit is explained in owner-vocabulary sentences, not scored.

**Gate:** a clinician can rank two roles from the cards alone without opening either.

---

### UX-10 — Apply with VitalCV

**Goal:** almost absurdly easier than a traditional application. Centerpiece: *"Here is exactly what the employer will receive."* Then: VitalCV already has this · I need this approval · Employer decides the rest. Primary action: **Apply with my VitalCV profile**.

**Gate:** application start → submit in under a minute for an activated profile; the will-receive preview is literally the artifact the employer sees.

---

### UX-11 — Employer Acquisition (Lane C)

Rebuild `/employers` leading with the hiring outcome, not evidence architecture: *"Find clinicians. Know what remains. Keep every hire moving toward start."* Then prove trust: one real (honestly-labeled) artifact, source coverage stated plainly, the boundary line (*a head start for employer review — not a final credentialing decision*). No uncertified badges, no unlabeled metrics (the `DEMO_METRICS` 12,847/284 class of problem: label "illustrative" or remove), no demo-gating of everything — let them operate something.

### UX-12 — Employer Product Surface

IA reduced to **Roles · Candidates · Starts**. Design: role creation · candidate fit · remaining work · blockers · actions · employer decisions · time-to-start. Employer decision semantics inherited untouched (accept / request refresh / route to review; audit behavior unchanged).

### UX-13 — Trust Simplification

Ordinary-user layer says exactly: *We tell you where information came from. We distinguish what you provided from what a source reported. You decide what gets shared. Employers make their own decisions.* All technical proof (receipts, freshness, coverage states, standards) remains available beneath, via progressive disclosure. The Trust Center stays deep; the default surfaces stop speaking protocol.

**Lane C gates:** founder GO per surface; truth-contract sweeps; no confirmed-marks on gated/non-integrated sources anywhere.

---

### UX-14 — Motion + Microinteraction Pass (continuous, unifying)

Unify hover · focus · reveal · page transitions · success · loading · error · approval · completion · agent activity · eyebrow transitions · menu choreography. One easing family, four timing bands (80–150 / 150–250 / 250–450 / 450–800ms narrative-rare). One scroll owner per page. Single-shot reveals; nothing loops gratuitously (exceptions: skeleton shimmer, /status pulse); numbers animate only between real returned values; reduced-motion reviewed as a composition. All keyframes in `motion.css`.

### UX-15 — Mobile Product Sweep (continuous, after desktop settles)

Not "make it responsive" — redesign the important flows for a 390px device, in priority order: Homepage → NPI → Activation → Start Agent → Jobs → Apply → Employer → Trust. Eyebrow recomposes deliberately at the same height discipline; touch targets ≥44px; no horizontal scroll from 360px.

### UX-16 — Brand + Product Language convergence (continuous, final sweep)

The system talks about: **VitalCV · your profile · jobs · applying · next actions · work VitalCV handles · hiring · starting.**
Not (customer-facing): packets · artifacts · lanes · evidence networks · holder · readiness score · passport · wallet · graph · receipt · recognition (as UI nouns) · technical credential constructs. The complexity lives behind the screen.

Encode the full banned list + required phrasings into `scripts/copy-rules.json`; sweep `apps/web` (and any marketing surface) to zero hits; fix all catalogued legacy violations (zero-trust-ledger phrasing, "hire instantly", "Zero-Trust Credentialing Infrastructure", "graph"/"ledger" body copy, SOC 2/NCQA badges, Nursys checkmarks, misrouted demo CTA). Voice: calm, declarative; facts with lineage ("read 2h ago via NPPES"), never enthusiasm; errors never apologize twice, never "oops".

---

## Part 4 — Enforcement infrastructure (lands with UX-02, runs forever)

1. Port `check-design-lint.ts` + baseline out of `.worktrees/retire-speed-claim` onto mainline `scripts/`; CI-blocking beside `pnpm lint` + `tsc --noEmit`.
2. Rules (wave-1505's ten, extended): raw hex outside token files · foreign token prefixes · new stylesheet imports · pill radii on state markers · gradients/glass/shadow on evidence surfaces · banned copy strings (`copy-rules.json`) · checkmark-on-gated-source · infinite keyframes outside the two exceptions · literal z-index · `next/font/google`.
3. Visual regression in CI: 10 routes × 3 viewports + reduced-motion, masked dynamics; baseline updates require a CHANGES.md link.
4. Every PR carries a **Design Handoff References** section citing constitution clauses; reviewers reject by number.

**Proof:** a deliberately-violating PR (raw hex + banned string + pill state marker) fails CI on all three counts.

---

## Part 5 — Start tomorrow (three parallel tracks)

1. **UX-00 Experience Constitution** — Claude Code drafts from this plan + CD + wave-1505; founder approves.
2. **UX-01 verdict** — extend the existing design-lab review page, write the global-commitment memo, founder picks A / B / C / hybrid → DECISION.md.
3. **Claude Browser whole-product inventory** — audit every public + authenticated surface (before-evidence screenshots, per-surface violations of the constitution, dead CTAs, era-mixing), producing the prioritized redesign backlog that feeds Lanes B/C. Refresh of `docs/design/current-ui-inventory.md`.

Then immediately: **UX-02 + UX-03.** After that, every clinician wave inherits an approved design language instead of reinventing VitalCV.

---

## Continuation block

**CURRENT STATE:** Doctrine strong, enforcement absent. Five visual eras coexist in `apps/web`; fonts unhosted; lint gate stranded in a worktree; ≥30 status components; UX-01's three-direction exploration already built and critiqued in `design-lab/homepage-reset/` awaiting verdict.
**NEXT STEPS:** Phase 0 freeze → UX-00 constitution → UX-01 verdict → UX-02/03 foundation → Lane B clinician waves.
**OPEN QUESTIONS:** final visual personality (A/B/C/hybrid); how much of `design-system/` survives re-skinning vs rebuild; canonical clinician home surface once the Start Agent is visible; whereabouts of the 2026-07-21 competitive mandate file.
**BOUNDARY:** design-only, product contracts inherited — the paragraph at the top of this document rides at the top of every wave.
