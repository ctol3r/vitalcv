# VitalCV Experience Constitution

**Status:** DRAFT R2 — restructured 2026-08-08 per founder UX-00 ruling (three-class layering). Awaiting FOUNDER UX-00 REVISION REVIEW. Phase 0 (EC-0) is founder-approved.
**Drafted:** 2026-08-08 (R1) · revised same day (R2)
**Successor-of-record to:** `VITALCV_CREATIVE_DIRECTION.md` (CD-1…CD-20), amended per CD-19 with a dated pointer forward — never a silent fork. CD remains a valid execution record; where the two documents disagree, this one wins.
**Companion:** `VITALCV_EXPERIENCE_OVERHAUL_PROGRAM_2026-08-08.md` (execution plan) · `PARKED_VISUAL_ERAS.md` (freeze record).

**The layering rule (R2).** Every clause belongs to exactly one class:

- **Class A — INVARIANT.** Binding regardless of visual direction. Rejection law today.
- **Class B — DIRECTION-LOCKED.** Not law until the UX-01 founder verdict fills EC-20. Prior visual eras are raw material here, never authority.
- **Class C — CONTEXTUAL GUIDANCE.** Strong defaults enforced by design review with named rationale — never by CI.

Every clause is numbered **EC-n**. Reject a PR by citing a number — but only Class A clauses and locked EC-20 rows reject; see EC-21. Every product PR carries a **Design Handoff References** section naming the EC clauses it implements.

---

## EC-0. The design-only boundary and the freeze — Class A, founder-approved

This text rides at the top of every overhaul wave, verbatim:

> **DESIGN-ONLY BOUNDARY**
> This wave may change UI, UX, visual design, interaction design, responsive behavior, animation, information hierarchy, customer-facing copy, navigation presentation, and brand expression.
> It may not change application truth, authentication, authorization, consent semantics, data models, APIs, readiness calculations, agent policy, source behavior, employer decisions, business logic, or pricing behavior.
> If the proposed experience requires one of those changes, record it as a product dependency and stop. Do not solve it inside the design PR.

**Operating rule:** Product contracts are inherited. Visual decisions are not. No wave inherits a prior visual treatment merely because it exists.

**The freeze.** A temporary UI PR freeze holds until UX-03 ships. **Exempt** (each still design-review gated): accessibility regressions; production-breaking UI defects; security/truth corrections; founder-authorized urgent fixes. No unrelated visual feature work rides an exemption.

---

## Part I — Class A: Invariants

### EC-1. Target feeling and the Easy Button frame

**Calm intelligence doing complicated work for you.** Not healthcare software you have to operate. The one product idea every surface serves: **"Enter your NPI. VitalCV does the rest."** The emotional target of the first session: *"That's it? VitalCV already knows this and is handling the rest?"*

The product must NOT primarily feel like: a credential wallet, an evidence network, a provenance system, a résumé builder, a credentialing vendor, a blockchain product, a data-viz project, a job board, or an AI chatbot. Complexity lives behind the screen.

### EC-2. The ten principles

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

### EC-3. Truth invariants

- **Truth outranks visual implication.** No treatment — color, motion, composition, chrome — may imply more certainty than the underlying data supports. This is direction-independent: it bans certainty-theatre on evidence in any palette.
- **No false verification, readiness, or employer claims.** Banned in customer-facing copy or attributes: "automatically verified", "guaranteed verification", "complete credentialing", "instant credentialing", "legally accepted", "risk transferred", "final verification without review", "source confirmed before response", "certified compliant", "HIPAA compliant" (→ HIPAA-aligned), "SOC2 certified", "NPDB" (as a customer-facing noun), "hire instantly", "blockchain-anchored", "zero-knowledge proof", "all 50 states", bare "Verified" as a status. Never a confirmed mark on gated (Nursys, FSMB) or non-integrated (NPDB, DEA, ABMS, SAM.gov, Doximity) sources.
- **Every asserted state is attributed:** what source, and how old. "Confirmed" is always qualified by what confirmed it and when. Freshness words never outrun the lane (`live`, `real-time`, `current` only where genuinely read per request). System-retrieved facts are never blurred with VitalCV-authored prose — *how* the distinction renders is Class B; *that* it renders is invariant.
- **Numbers animate only between real returned values.** Illustrative figures are static and labeled.
- **State-vocabulary freeze:** CD-5's six public states and the nine coverage + two review states in `packages/trust-state/sourceCoverage.ts` are reconciled by UX-02 via one mapping table. Until then neither vocabulary grows.

### EC-4. Meaning is never carried by color, motion, or hover alone

Every state renders as glyph + word (plus attribution per EC-3). Remove all color and the screen stays fully readable and fully honest. Meaning never lives exclusively in motion, hover, GPU, or a shader: reduced-motion, no-JS, and static fallbacks are first-class compositions, reviewed as such. One scroll owner per page (standing XS-1 law, `VITALCV_EXPERIENCE_SYSTEM_2026.md`).

### EC-5. The accessibility floor

AA minimum everywhere. Every state legible in grayscale and to a screen reader without color reference. Visible focus on every interactive element — never `outline: none`. Full keyboard path through every flow. 200% text zoom with no clipped control. 44px minimum touch targets. Motion, GPU, JS, and network all optional for meaning.

### EC-6. Mobile is designed independently

Every priority flow is composed for a 390px device deliberately — never stacked desktop. No horizontal scroll from 360px up. The eyebrow recomposes deliberately at the same height discipline (EC-10).

### EC-7. Ownership and control — presentation preserves the controller

The product's canonical ownership model is inherited and is not redefined by UI vocabulary. Work is controlled by exactly one of: **the clinician · VitalCV · the employer · an institution (hospital, health system, board) · a source**. Presentation may simplify; it may never semantically collapse controllers.

Preferred presentation vocabulary:

- **VitalCV handles**
- **Needs your approval**
- **Needs you**
- **Waiting on / controlled by [the specific external actor]** — *"The hospital must review this step."*, *"Waiting on the state board."*

**"Employer decides" is used only when the employer actually decides the matter.** A licensing-board or hospital-controlled dependency is never labeled an employer decision.

### EC-8. The agent manifests as work, not chat

No chat bubbles, no fake transcripts, no giant conversational prompt, no "Ask VitalCV anything", no bot mascots. The agent behavior ladder — *observe → explain → recommend → prepare → execute with consent → escalate* — is an inherited product contract, untouched by design waves. **The ladder produces a bounded family of user-visible work states** (currently: VitalCV did it · VitalCV prepared it · VitalCV needs you · someone else controls it · something changed · something is blocked · finished). The family is presentation and may be tuned by design review; the ladder is not.

Approval moments are the sacred interaction: nothing moves without the clinician, and the UI makes that legible. Clinician control and consent remain visibly clear at every step. Activity renders as completed work — a record of what happened, by whom, when (see EC-9 for the nouns).

### EC-9. Customer-facing language

The system talks about: **VitalCV · your profile · jobs · applying · next actions · work VitalCV handles · hiring · starting.**

Never customer-facing: packets · artifacts · lanes · evidence networks · provenance · holder · readiness score · passport · wallet · graph · trust tier · dossier · credential object · recognition (as a UI noun) · any technical credential construct.

**Receipt, resolved:** `receipt` is an internal and audit concept. It remains lawful on audit and trust-center surfaces. Customer-facing surfaces say **"Activity"** or **"Completed work."** The same noun is never simultaneously banned and mandated.

The machine-checkable subset lands in `scripts/copy-rules.json` (UX-16). Voice: calm, declarative; facts with lineage, never enthusiasm; errors never apologize twice, never "oops."

### EC-10. The eyebrow — structural form is invariant

The site chrome is a **wide, shallow eyebrow**: full browser width, ONE continuous horizontal instrument, deliberately shallow at a **constant 56–72px**, content vertically centered, gutters consistent with the page grid. LEFT: restrained identity. MIDDLE: max 3 quiet items or contextual product state. RIGHT: quiet sign-in + at most one dominant instrument and/or a menu control. Architecturally stable on scroll (same height; ground/rule may change). Menu opens as a full-takeover canvas. Mobile recomposes deliberately at the same height discipline.

**Banned forms:** floating rounded container, SaaS pills, centered-link-row-as-main-event, backdrop-blur-navbar-with-thin-line, ordinary hamburger sheet.

Exact geometry inside this form — height value, gutter value, rule treatment, corner language, inversion behavior — is Class B and locks in EC-20. After UX-03 ships with founder GO, shared chrome freezes unless a usability finding reopens it.

### EC-11. Value before commitment, and the four asymmetries

Value before commitment; one obvious next action on every surface. Against the named competitive bar (Medallion, Carefam — employer-first, demo-gated, unauditable claims, speed heroes):

1. They gate the product; **we give it away in the first viewport** — an NPI field that returns real state, no account.
2. They claim numbers; **we show one artifact** with source, timestamp, scope, and what it does not decide.
3. They speak to the back office; **we speak to the clinician.**
4. They say "AI-powered"; **we demonstrate it.**

### EC-12. Inheritance

Product contracts are inherited. Visual decisions are not. No wave inherits a prior visual treatment merely because it exists — including every era in `PARKED_VISUAL_ERAS.md` and every value in `VITALCV_CREATIVE_DIRECTION.md`'s palette and type sections.

---

## Part II — Class B: Direction-locked

### EC-13. The direction-locked register

The following are **not law until the UX-01 founder verdict fills EC-20**. Until then: prior-era rules in these domains (the CD mono law, CD pill retirement, CD glass/solid law, gradient bans, Calm Wave and 1505 values) are *candidate defaults and raw material* — they may not be cited to reject work, and no wave may ship new values in these domains outside an approved UX-01 exploration (the EC-0 freeze covers this).

1. Typography (faces, scale)
2. Palette (grounds, ink, accent)
3. Radius
4. Pill policy
5. Mono presentation policy (which facts render mono, and how)
6. Card grammar
7. Glass treatment
8. Gradient treatment
9. Rule/border treatment
10. Illustration policy (the EC-14 own-artifacts default supplies the interim posture)
11. Light/dark doctrine — including whether dark-first public exists; a dark verdict must explicitly supersede "light is the only public mode", wave-1505 LINT-04, and CD's 2026-08-02 one-Ink-chapter amendment
12. Exact eyebrow geometry inside EC-10's structural form
13. Product-UI visual density
14. Animation character and easing (the program's four timing bands are the working default structure; values lock at verdict)

EC-3 still applies inside every one of these domains — no locked or candidate treatment may imply false certainty.

---

## Part III — Class C: Contextual guidance

### EC-14. The guidance register

Strong defaults. A surface that departs from them is a **design-review finding requiring named rationale** — never a CI failure, never an automatic rejection.

- **Imagery:** the default is that VitalCV publishes its own artifacts — a real result, a real requirement list, rendered honestly. Stock clinician photography, isometric illustration, and decorative 3D are default-rejected at review; founder sign-off can override.
- **Section patterns:** avoid generic headers ("Features", "Why VitalCV") in favor of sections that say something.
- **Card usage:** cards earn their box; prefer structure from rules/space over container sprawl.
- **Editorial composition:** one argument per surface; density serves comprehension.
- **Where visual boldness is spent:** **NPI resolution is the first signature product moment** and the current concentration of the visual budget — but not constitutionally the only one. The Start Agent doing real work, approval moments, and successful completion are candidate signature moments the winning direction may elevate. Quietness elsewhere exists so signature moments land.
- **Public vs workspace register:** acquisition surfaces argue; working surfaces operate. The exact registers are shaped by the verdict.

*(EC-15 – EC-19 are retired in R2; see Appendix A for where each clause went.)*

---

## Part IV — Locked brand decisions

### EC-20. The brand decision table

The **structure** is locked now. The **values** are filled by the UX-01 verdict (`design-lab/homepage-reset/DECISION.md`, once final) and locked thereafter. A wave that ships before back-fill inherits nothing visually — it waits. Verdict status: **reopened by the founder 2026-08-08 — no back-fill authorized** (see EC-24).

| Decision | Value | Status |
|---|---|---|
| Typography — display / body / mono faces | TBD (A: Instrument Sans + IBM Plex Mono · B: Geist + Geist Mono · C: Archivo expanded + IBM Plex Mono) | AWAITING VERDICT |
| Type scale | TBD | AWAITING VERDICT |
| Grid + page width | TBD | AWAITING VERDICT |
| Eyebrow exact geometry (within EC-10's form) | TBD | AWAITING VERDICT |
| Button grammar (primary/secondary/quiet/destructive; ≥44px targets locked via EC-5) | TBD | AWAITING VERDICT |
| Rule/border treatment | TBD | AWAITING VERDICT |
| Icon family | TBD | AWAITING VERDICT |
| Corner-radius philosophy + pill policy | TBD | AWAITING VERDICT |
| Spacing rhythm | TBD | AWAITING VERDICT |
| Neutral palette (grounds, ink ramp, rules) | TBD (A: bone `#F1F0EC` · B: warm graphite `#141517` · C: gallery white `#FBFAF7`) | AWAITING VERDICT |
| Interaction/accent treatment — incl. whether brand accent and work color merge (A/B) or stay separate (C) | TBD | AWAITING VERDICT |
| Mono presentation policy | TBD | AWAITING VERDICT |
| Card grammar | TBD | AWAITING VERDICT |
| Glass treatment | TBD | AWAITING VERDICT |
| Gradient treatment | TBD | AWAITING VERDICT |
| Light/dark doctrine (incl. supersessions named in EC-13.11) | TBD | AWAITING VERDICT |
| Product-UI visual density | TBD | AWAITING VERDICT |
| Illustration treatment | TBD (interim default: EC-14 own-artifacts) | AWAITING VERDICT |
| Animation character/easing + band values | TBD (band structure is the working default) | AWAITING VERDICT |
| Font delivery | Self-hosted variable `woff2` via `next/font/local` in `apps/web/app/fonts/`; never `next/font/google` | LOCKED |

State hues may never be spent as decoration (EC-3); whether the brand accent doubles as the work color is a verdict decision recorded here.

---

## Part V — Governance

### EC-21. Citability

- **Rejection law:** Class A clauses (EC-0…EC-12) and **locked** EC-20 rows. Cite the number.
- **Class B (EC-13):** not citable as law until its EC-20 row locks. Neither prior eras nor new inventions may be asserted as authority in these domains before the verdict.
- **Class C (EC-14):** rejections happen in design review, citing the clause **plus a named rationale**. Never automated.

### EC-22. Amendment

Class A clauses and locked EC-20 rows change only by editing this file with a dated rationale, founder-approved. A PR may not introduce a local exception. Class C guidance evolves through recorded amendments as review precedent accumulates. Parked eras (`PARKED_VISUAL_ERAS.md`) return only via amendment.

### EC-23. Enforcement — CI enforces contracts, review enforces taste

**CI-blocking (objective, lands with UX-02):**

- Truth/copy safety: the EC-3 banned strings and false-claim patterns (`scripts/copy-rules.json`); checkmark-on-gated-or-non-integrated-source
- Accessibility contracts: focus ring presence, target sizes, contrast floors
- Reduced-motion presence: every animated surface ships a reduced-motion composition
- State never by color alone: glyph + word pairing at the component level
- Token architecture: no raw values outside token files, no foreign prefixes, no new stylesheet imports, no literal z-index, `next/font/local` only
- Duplicate design-system infrastructure **after UX-02** (second badge systems, parallel component libraries, new scoped islands)

**Design/founder review (taste — never CI):** typography, palette, gradients, cards, radius, imagery, composition, visual density, animation character.

Subjective July-era taste is not encoded as CI law before the reset direction is chosen. The `check-design-lint.ts` port from `.worktrees/retire-speed-claim` is scoped to the objective list above; taste rules from wave-1505's set (pill radii, shadow discipline, dark-on-public) join CI only if and when the verdict locks the matching EC-20 row. Proof obligation stands: a deliberately-violating PR must fail CI on every objective count before the gate is considered live.

### EC-24. Records

- **R2 restructure (2026-08-08):** founder ruling — Phase 0 approved; UX-00 revised into the three-class layering; PR #1160 held draft at reviewed head `9568a4db1e`; merge blocked pending FOUNDER UX-00 REVISION REVIEW.
- **UX-01 verdict state:** a parallel lane recorded a Direction-B `DECISION.md` (dated 2026-08-07, recorded 2026-08-08). The founder's 2026-08-08 ruling **reopens the verdict** — hybrid (B's product behavior + the strongest eyebrow treatment) under consideration; REVISE THE SET allowed; no EC-20 back-fill authorized. `DECISION.md` carries a reopened-status banner. Downstream work that assumed a final B verdict (UX-02 census PR #1165's skipped teardown Phase 4) must be revisited at the true verdict.
- `VITALCV_EXPERIENCE_SYSTEM_2026.md` (XS-1…XS-10, est. 2026-08-02, deriving from `founder-rulings-2026-08.md`) is canonical for *interaction and progression* and was missed by the program audit. Carried forward: XS-1 (one scroll owner, cited in EC-4), XS-7 (reduced motion as deliverable), XS-9 (performance floor), XS-10 (the NPI field outranks the journey — aligned with EC-1). Its homepage-journey mechanisms (XS-3 media rail, XS-4 chapter menu) serve the retired journey model; **UX-04 must amend XS per its own rules** — a recorded dependency, not a silent supersession.
- Mainline CD carries the **2026-08-02 "One public Ink chapter" amendment**; any dark-public verdict must supersede it explicitly (EC-13.11).
- `VitalCV_Competitive_Mandate_and_Claude_Code_Waves_2026-07-21.md` — **recorded missing** (searched 2026-08-08, repo root / docs / design-handoff, depth ≤4). Homepage-composition authority rests with the homepage reset; the film/scene model is retired. If it surfaces, its strategic copy is UX-16 salvage only.
- The wave-1505 design system (`design-handoff/claude-design-2026-07-12-wave1505/wave1505/`) remains the best token/component architecture in the codebase — UX-02's skeleton, re-skinned to the verdict; its taste rules are Class B raw material (EC-13, EC-23).
- Working-tree copies of CD on long-lived branches were found **stale** against `origin/main` during R1 drafting. Doctrine reads come from `origin/main`, never a branch's working copy.
- The UX-01 exploration record lives in `design-lab/homepage-reset/` (master brief, three direction briefs + prototypes, three pass-1 critiques — all PASS, Playwright evidence at 1440×900 / 390×844 + reduced-motion + motion captures).

---

## Appendix A — R1 → R2 revision map

| R1 clause | R2 disposition |
|---|---|
| EC-0 boundary | **Retained invariant** (EC-0) + freeze exceptions added |
| EC-1 target feeling | **Retained invariant** (EC-1) |
| EC-2 ten principles | **Retained invariant** (EC-2) |
| EC-3 five laws | **Split:** truth + meaning-not-color-alone + one-system → EC-3 / EC-4 / EC-23; glass law → **moved to EC-20 register** (EC-13.7) |
| EC-4 mono law | **Moved to EC-20 register** (EC-13.5); truth kernel (facts attributed, never blurred with prose) retained in EC-3 |
| EC-5 state law | **Split:** attribution + glyph/word retained invariant (EC-3, EC-4); stamp/hue rendering → EC-13; vocabulary freeze retained (EC-3) |
| EC-6 geometry semantics | **Moved to EC-20 register** (EC-13.3, EC-13.4) |
| EC-7 kill list | **Dissolved as a unitary rejection list:** truth/copy items → EC-3 (invariant); gradient/glass/pill/bento/glassmorphism → EC-13 (direction-locked); imagery/section/composition items → EC-14 (guidance) |
| EC-8 accessibility floor | **Retained invariant** (EC-5) |
| EC-9 asymmetries | **Retained invariant** (EC-11) |
| EC-10 visual budget on NPI moment | **Downgraded to guidance and revised** (EC-14): first signature moment, not the only permitted one |
| EC-11 truth contract | **Retained invariant** (EC-3) |
| EC-12 glass on chrome / solid on evidence | **Moved to EC-20 register** (EC-13.7); certainty kernel retained in EC-3 |
| EC-13 Easy Button frame | **Retained invariant** (merged into EC-1) |
| EC-14 four-owner vocabulary | **Corrected and retained invariant** (EC-7): controller preserved; external actors named specifically; "Employer decides" only when the employer actually decides |
| EC-15 agent ladder 1:1 mapping | **Corrected** (EC-8): the ladder produces a bounded family of work states; 1:1 claim removed; ladder contract preserved |
| EC-16 operator-not-chatbot | **Retained invariant** (EC-8); "receipt stream" wording removed |
| EC-17 vocabulary ban | **Retained invariant** (EC-9); receipt contradiction resolved — internal/audit noun kept, customer-facing "Activity" / "Completed work" |
| EC-18 eyebrow spec | **Split:** structural form retained invariant (EC-10); exact geometry → EC-20 (EC-13.12) |
| EC-19 motion law | **Split:** reduced-motion presence, number-truth, one scroll owner retained invariant (EC-3, EC-4); bands/easing/character → EC-13.14 |
| EC-20 brand table | **Retained** (EC-20), expanded to cover all Class-B domains |
| EC-21 citability | **Revised** (EC-21): rejection law = Class A + locked EC-20 rows only |
| EC-22 amendment | **Retained** (EC-22) |
| EC-23 enforcement | **Revised** (EC-23): CI = objective contracts; founder/design review = taste; no July-era taste as CI law pre-verdict |
| EC-24 records | **Retained** (EC-24) + R2 and verdict-state records added |
