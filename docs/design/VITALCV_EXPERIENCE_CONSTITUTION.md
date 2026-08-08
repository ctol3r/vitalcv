# VitalCV Experience Constitution

**Status:** DRAFT — awaiting founder approval (UX-00 gate). Becomes canonical on approval.
**Drafted:** 2026-08-08
**Successor-of-record to:** `VITALCV_CREATIVE_DIRECTION.md` (CD-1…CD-20), amended per CD-19 with a dated pointer forward — never a silent fork. CD remains a valid execution record; where the two documents disagree, this one wins.
**Companion:** `VITALCV_EXPERIENCE_OVERHAUL_PROGRAM_2026-08-08.md` (the execution plan) · `PARKED_VISUAL_ERAS.md` (the freeze record).

Every clause is numbered **EC-n**. Reject a PR by citing a number. Every product PR carries a **Design Handoff References** section naming the EC clauses it implements.

---

## EC-0. The design-only boundary

This text rides at the top of every overhaul wave, verbatim:

> **DESIGN-ONLY BOUNDARY**
> This wave may change UI, UX, visual design, interaction design, responsive behavior, animation, information hierarchy, customer-facing copy, navigation presentation, and brand expression.
> It may not change application truth, authentication, authorization, consent semantics, data models, APIs, readiness calculations, agent policy, source behavior, employer decisions, business logic, or pricing behavior.
> If the proposed experience requires one of those changes, record it as a product dependency and stop. Do not solve it inside the design PR.

**Operating rule:** Product contracts are inherited. Visual decisions are not. No wave inherits a prior visual treatment merely because it exists.

---

## Part I — The feeling

### EC-1. Target feeling

**Calm intelligence doing complicated work for you.** Not healthcare software you have to operate.

The one product idea every surface serves: **"Enter your NPI. VitalCV does the rest."** The emotional target of the first session is *"That's it? VitalCV already knows this and is handling the rest?"* — the product should feel like it already did work for you before you asked.

### EC-2. The ten principles

1. **Easy outside, sophisticated inside.**
2. **Show users what VitalCV did, not all the machinery used to do it.**
3. **One obvious next action.**
4. **Value before commitment.**
5. **Work completed is more important than data displayed.**
6. **Explain consequences, not system states.**
7. **Trust through clarity, not trust vocabulary.**
8. **AI manifests as work, not chat.**
9. **Mobile is designed independently.**
10. **Motion explains transformation.**

Independent convergence on this direction is recorded: the *VCV Sell Strategy* review (2026-03-20, "multiple visual systems fighting… brand does not feel singular"), the *Steve Jobs feedback* session (2026-04-13, the first two minutes; "this already did work for me"), and the *UI/UX Review* (2026-04-13, evidence-first UI, progressive disclosure) all reached it separately.

---

## Part II — Inherited law (carried forward intact from Creative Direction)

### EC-3. The five laws (from CD-2)

1. **Truth outranks beauty.** No visual may imply more certainty than the underlying data supports. A number may only animate to a value the system actually returned.
2. **State is never carried by color alone.** Every state renders as **glyph + word + source + age**. Remove all color and the screen must still be fully readable and fully honest.
3. **Meaning never lives in motion, hover, GPU, or a shader.** Reduced-motion, no-JS, and static fallbacks are first-class compositions, not degradations.
4. **Glass on chrome. Solid on evidence.** Navigation, overlays, ambient scene may be translucent. Anything asserting a fact is opaque with a hairline rule — no blur, no gradient, no glow, no elevation theatre.
5. **One system.** No new scoped island, no new token prefix, no new badge component. Extend what exists or replace it outright.

### EC-4. The mono law (from CD-8)

> **Machine facts are mono. Human prose is sans. Argument is display.**

Applied without exception: NPIs, license numbers, timestamps, snapshot dates, source names, hashes, receipt IDs, state words in stamps, monetary and duration values. `tabular-nums`, `slashed-zero` on all machine facts. When a user sees mono, they are looking at something the system retrieved, not something VitalCV wrote.

### EC-5. The state law (from CD-5)

Every asserted fact renders as **glyph + word + source + age**. The state word is always set in full-contrast ink; the state hue carries only the glyph and a small rule — contrast never depends on the state color, and grayscale never costs legibility. The default state is *not checked*, and it must be as beautifully set as *confirmed*. "Confirmed" is always qualified by *what* confirmed it and *when*.

Two state vocabularies currently exist: CD-5's six public states and the nine coverage states + two review states in `packages/trust-state/sourceCoverage.ts` (wave-1505 doctrine). **UX-02 reconciles them via one mapping table** — the type preserves the canonical state, the chip renders the human word. Until then, neither vocabulary may grow.

### EC-6. Geometry semantics (from CD-10)

Corner radius is a semantic, not a taste: sharp/near-sharp = structure and document; moderate radius = software chrome; **pills (999px) are retired — nothing wears one.** State marks are near-sharp stamps, not badges. Structure comes from hairline rules, not shadows. Exact radii values are locked by the UX-01 verdict (EC-20).

### EC-7. The kill list (CD-13, extended by the reset)

Permanently retired. Presence in a PR is a rejection.

**Visual (from CD-13):** public knowledge graphs / constellations / force simulations / node-link people diagrams; carousels, Rolodexes, chapter cards, product-card grids; giant metric counters, percentage rings as theatre, "days saved" theatre; gradients as surface, glow, neon, shimmer; stock photography of clinicians, smiling-doctor imagery, isometric illustration, 3D blobs; emoji as UI; pill badges; dual page-level navigation rails; blockchain/wallet/crypto/DID/VC iconography anywhere in the acquisition path.

**Visual (reset extensions):** glowing AI gradients; purple/blue AI blobs; endless bento boxes; glassmorphism as a surface treatment; fake browser windows; the film/scene conceptual model; decorative waveform/data noise; generic healthcare-blue SaaS.

**Copy:** the bare word `Verified` as a status; generic section headers ("How it works" as a literal header, "Features", "Why VitalCV"); any freshness word that outruns the lane (`live`, `real-time`, `current`, `always up to date`) unless that lane is genuinely read per request.

**Imagery, positively stated:** the only images VitalCV publishes are **its own artifacts** — a real proof packet, a real source result, a real requirement ledger, rendered honestly. That is the entire art direction.

### EC-8. The accessibility floor (from CD-15)

AA minimum everywhere. Every state legible in grayscale and to a screen reader without color reference. Visible focus on every interactive element — never `outline: none`. Full keyboard path through every flow. 200% text zoom with no clipped control; **44px minimum touch targets**. No horizontal scroll from 360px up. Motion, GPU, JS, and network all optional for meaning. **Reduced-motion is reviewed as a first-class composition**, not an afterthought.

### EC-9. The four competitive asymmetries (from CD-20)

Medallion and Carefam are the named bar; both are employer-first, demo-gated, claim unauditable numbers, and sell speed. We do not out-gloss them:

1. **They gate the product. We give it away in the first viewport** — an NPI field that returns real state, no account.
2. **They claim numbers. We show one artifact** — a real result with source, timestamp, scope, and what it does not decide.
3. **They speak to the back office. We speak to the clinician** — the only door in this market nobody is standing in.
4. **They say "AI-powered." We demonstrate it** — live resolution, honest degradation, work visibly done.

### EC-10. Where the boldness goes (from CD-20)

A quiet system is not a timid one. VitalCV spends its entire visual budget in **one place: the moment an NPI resolves.** That moment should be genuinely arresting — facts arriving, state landing, the next action appearing. Everything around it stays near-silent so it lands. If a proposed treatment does not make that moment sharper, it is decoration, and EC-7 applies.

### EC-11. Truth contract (standing copy law)

Machine-checkable from UX-02 onward (`scripts/copy-rules.json`). Banned anywhere in customer-facing copy or attributes: "automatically verified", "guaranteed verification", "complete credentialing", "instant credentialing", "legally accepted", "risk transferred", "final verification without review", "source confirmed before response", "certified compliant", "HIPAA compliant" (→ HIPAA-aligned), "SOC2 certified", "NPDB" (as a customer-facing noun), "hire instantly", "blockchain-anchored", "zero-knowledge proof", "all 50 states", bare "Verified" as a status. **Never a confirmed mark on gated (Nursys, FSMB) or non-integrated (NPDB, DEA, ABMS, SAM.gov, Doximity) sources.**

### EC-12. Glass on chrome, solid on evidence (from CD-12)

**May be glass:** floating nav chrome, command palette, modal scrim, ambient hero atmosphere. **Must be solid:** every credential, source result, readiness item, requirement, proof artifact, receipt, audit row, and application state. If content does not scroll beneath it, do not use glass.

---

## Part III — Reset-era doctrine (new law)

### EC-13. The Easy Button frame

The homepage's one job is to make the clinician want to try VitalCV. The product must NOT primarily feel like: a credential wallet, an evidence network, a provenance system, a résumé builder, a credentialing vendor, a blockchain product, a data-viz project, a job board, or an AI chatbot. It is **the easy button for clinician hiring** — complexity lives behind the screen.

### EC-14. The four-owner vocabulary

Every piece of work in a hire has exactly one owner, named in exactly these four ways:

**VitalCV handles** · **Needs your approval** · **Needs you** · **Employer decides**

This vocabulary is the product's ownership model made visible. Fit, readiness, and remaining work are explained in owner-vocabulary sentences, never as a mysterious score.

### EC-15. The agent behavior ladder

*observe → explain → recommend → prepare → execute with consent → escalate*

This ladder is the source of all agent-state UI. The seven canonical work-states (UX-07) map 1:1 onto it — **VitalCV did it · VitalCV prepared it · VitalCV needs you · Someone else controls it · Something changed · Something is blocked · Finished** — each rendered as glyph + word + one-line consequence + timestamp, machine facts in mono. Approval moments are the sacred interaction: nothing moves without the clinician, and the UI makes that legible.

### EC-16. The agent is an operator, not a chatbot

No chat bubbles, no fake transcripts, no giant conversational prompt, no "Ask VitalCV anything", no bot mascots. The agent is visible through **work**: next action, work completed, work prepared, approval required, external dependency, activity receipt, status change, blocker removed. Activity renders as a work ledger / receipt stream.

### EC-17. The acquisition-surface vocabulary ban

The system talks about: **VitalCV · your profile · jobs · applying · next actions · work VitalCV handles · hiring · starting.**

Never customer-facing: packets · artifacts · lanes · evidence networks · provenance · holder · readiness score · passport · wallet · graph · receipt · recognition (as UI nouns) · trust tier · dossier · credential object · any technical credential construct. Full machine-checkable list in `scripts/copy-rules.json` (UX-16).

### EC-18. The eyebrow constitution

The site chrome is a **wide, shallow eyebrow** structurally faithful to the Palantir/Zoox treatment (measured 2026-08-07). Not a SaaS navbar.

- Full browser width. ONE continuous horizontal instrument. **56–72px constant height**, content vertically centered, gutters exactly consistent with the page grid (28–32px).
- LEFT: restrained wordmark. MIDDLE: max 3 quiet items **or contextual product state**. RIGHT: quiet Sign in + at most one dominant square-cornered instrument and/or a menu control.
- 1px hairline rules may structure the bar; square or near-square corners on instruments.
- Scroll: the bar stays architecturally stable (same height); it may gain solid ground and a bottom rule, and may invert over dark/light bands **with identical geometry**.
- Menu: a full-takeover canvas, not a sheet.
- Mobile: a deliberate recomposition at the same height discipline.
- **Banned:** floating rounded container, SaaS pills, centered-link-row-as-main-event, backdrop-blur-navbar-with-thin-line, ordinary hamburger sheet.

After UX-03 ships with founder GO, **shared chrome freezes** unless a later usability finding reopens it.

### EC-19. Motion law

Four timing bands, one easing family (values locked by EC-20):

| Band | Duration | For |
|---|---|---|
| Control feedback | **80–150ms** | Toggles, focus, hover, press |
| State transition | **150–250ms** | Element reveal, chip state change |
| Product transformation | **250–450ms** | Work resolving, panel/route transitions |
| Narrative | **450–800ms** | Rare. The NPI-resolution moment, the no-NPI explainer |

Rules: one scroll owner per page (the standing XS-1 law from `VITALCV_EXPERIENCE_SYSTEM_2026.md`); single-shot reveals — nothing loops gratuitously (exceptions, exactly two: skeleton shimmer, /status pulse); numbers animate only between real returned values; all keyframes in `motion.css`; the global `*` transition rule is removed in UX-02 and never returns; `prefers-reduced-motion` yields a reviewed static composition. These bands supersede CD-11's 120/240/400 values.

---

## Part IV — Locked brand decisions

### EC-20. The brand decision table

The **structure** of this table is locked now. The **values** are filled by the UX-01 verdict (`design-lab/homepage-reset/DECISION.md`) the same day it lands, and locked thereafter. A wave that ships before back-fill inherits nothing visually — it waits.

| Decision | Value | Status |
|---|---|---|
| Typography — display face | TBD (A: Instrument Sans · B: Geist · C: Archivo expanded) | AWAITING VERDICT |
| Typography — body face | TBD | AWAITING VERDICT |
| Typography — mono face | TBD (A/C: IBM Plex Mono · B: Geist Mono) | AWAITING VERDICT |
| Type scale | TBD | AWAITING VERDICT |
| Grid + page width | TBD | AWAITING VERDICT |
| Eyebrow geometry (exact height, gutters) | TBD within EC-18's 56–72px band | AWAITING VERDICT |
| Button grammar | TBD (primary/secondary/quiet/destructive; ≥44px — structure locked) | AWAITING VERDICT |
| Border/rule grammar | TBD | AWAITING VERDICT |
| Icon family | TBD | AWAITING VERDICT |
| Corner-radius philosophy | TBD within EC-6 (pills retired — locked) | AWAITING VERDICT |
| Spacing rhythm | TBD | AWAITING VERDICT |
| Neutral palette (grounds, ink ramp, rules) | TBD (A: bone `#F1F0EC` · B: warm graphite `#141517` · C: gallery white `#FBFAF7`) | AWAITING VERDICT |
| Interaction/accent treatment | TBD (A: spruce `#175E4C` · B: work-green · C: vermilion `#D8451D`) — ONE accent; the brand accent never borrows a state hue | AWAITING VERDICT |
| Product-UI treatment (workspace surfaces) | TBD | AWAITING VERDICT |
| Illustration treatment | Only images VitalCV publishes are its own artifacts (EC-7) — LOCKED | LOCKED |
| Motion timings/easing | Bands locked (EC-19); exact curve + per-band values | AWAITING VERDICT |
| Font delivery | Self-hosted variable `woff2` via `next/font/local` in `apps/web/app/fonts/`; never `next/font/google` | LOCKED |

Signal-vs-state separation is law regardless of verdict: the work/confirmed color means exactly one thing, and the brand accent never borrows a state hue.

---

## Part V — Governance

### EC-21. Citable-by-clause

PRs are rejected by citing an EC number. Any reviewer can run the five-minute review (CD-18 carries forward, renumbered against this document): state by color alone → reject (EC-3.2, EC-5); numbers animating beyond returned values → reject (EC-3.1, EC-19); machine facts in sans → reject (EC-4); glass/gradient/glow on evidence → reject (EC-12); new prefix/stylesheet/badge/island → reject (EC-3.5); kill-list item → reject (EC-7); fails reduced-motion, grayscale, or keyboard → reject (EC-8).

### EC-22. Amendment

Palette, type, states, motion bands, the kill list, the eyebrow spec, and the owner vocabulary change only by editing this file with a dated rationale, founder-approved. A PR may not introduce a local exception. Parked eras (see `PARKED_VISUAL_ERAS.md`) return only via amendment.

### EC-23. Enforcement

Lands with UX-02, runs forever (program Part 4): `check-design-lint.ts` ported from the `.worktrees/retire-speed-claim` worktree onto mainline `scripts/`, CI-blocking; wave-1505's ten lint rules extended (raw hex, foreign prefixes, new stylesheet imports, pill radii on state markers, gradients/glass on evidence, banned copy via `copy-rules.json`, checkmark-on-gated-source, infinite keyframes, literal z-index, `next/font/google`); visual regression 10 routes × 3 viewports + reduced-motion; baseline updates require a CHANGES.md link. Proof obligation: a deliberately-violating PR fails CI on all counts before the gate is considered live.

### EC-24. Records

- `VitalCV_Competitive_Mandate_and_Claude_Code_Waves_2026-07-21.md` — **recorded missing.** Searched 2026-08-08 (repo root, `docs/`, `design-handoff/`, depth ≤4): not found. Its homepage-composition authority (the six-scene film) is superseded by the homepage reset regardless; the film/scene model is on the kill list (EC-7). If the file surfaces, its strategic copy is salvage material for UX-16 only.
- The wave-1505 design system (`design-handoff/claude-design-2026-07-12-wave1505/wave1505/`) is the best token/component architecture in the codebase and is UX-02's skeleton, re-skinned to the verdict.
- The UX-01 exploration record lives in `design-lab/homepage-reset/` (master brief, three direction briefs, three pass-1 critiques — all PASS, Playwright evidence at 1440×900 and 390×844 + reduced-motion + motion captures).
- `VITALCV_EXPERIENCE_SYSTEM_2026.md` (XS-1…XS-10, est. 2026-08-02, deriving from `founder-rulings-2026-08.md`) is canonical for *interaction and progression* and was **missed by the program audit** — recorded here 2026-08-08. Carried forward: XS-1 (one scroll owner, cited in EC-19), XS-7 (reduced motion as deliverable), XS-9 (performance floor), XS-10 (the NPI field outranks the journey — fully aligned with EC-13). Its homepage-journey mechanisms (XS-3 media rail, XS-4 chapter menu) are built for the film/journey model the reset retires; **UX-04 must amend XS per its own rules when the homepage is rebuilt** — this is a recorded dependency, not a silent supersession.
- Mainline CD also carries an **Amendment 2026-08-02: "One public Ink chapter"** (one full-bleed warm-graphite chapter permitted per public page, evidence stays paper). A Direction-B verdict (dark-first public) goes far beyond that allowance and must explicitly supersede it in the back-fill.
- Working-tree copies of CD on long-lived branches were found **stale** against `origin/main` (missing the 2026-08-02 amendment) during UX-00 drafting. Doctrine reads come from `origin/main`, never from a branch's working copy.
