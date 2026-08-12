# VitalCV Experience Constitution

**Status:** CANONICAL — founder GO on the R2 layering, 2026-08-08. Phase 0 approved; EC-20 back-filled from the final UX-01 verdict (Direction B with amendments) per the ruling's execution step 3.
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

**The freeze.** LIFTED 2026-08-09 (founder ruling) — UX-03 shipped as UX-V1 (#1190) plus #1232. The exemptions below are historical; the founder visual gate and the design-only boundary are what bind visual work now. **Exempt** (each still design-review gated): accessibility regressions; production-breaking UI defects; security/truth corrections; founder-authorized urgent fixes. No unrelated visual feature work rides an exemption.

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

Every priority flow is composed for a 390px device deliberately — never stacked desktop. No horizontal scroll from 360px up. The chrome recomposes deliberately: identity stays at the top gutter and the control cluster pins above the viewport bottom, with the page reserving clearance so no control is ever covered (EC-10, A-2).

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

The machine-checkable subset is planned as `scripts/copy-rules.json` (UX-16) — **it does not exist yet**; today's enforcement is `scripts/check-public-claims.ts`, which already covers every EC-3 banned string (verified W1080, 2026-08-08; its matcher normalizes hyphens and case, so "zero-knowledge proof" and "zero knowledge proof" both fail). Until UX-16 lands, cite the script, not the JSON. Voice: calm, declarative; facts with lineage, never enthusiasm; errors never apologize twice, never "oops."

### EC-10. The eyebrow — structural form is invariant

**Amended 2026-08-09 (A-2), superseding the continuous-bar clause on the founder's direct
directive ("exact to palantir.com", and "the top bar in a wide rectangle shape").** The site
chrome is a **wide rounded rectangle floating over the page**: a zero-height sticky layer, no
full-bleed bar and no bottom rule, carrying one inset rounded rectangle — the chrome's single
surface — with the instruments floating inside it. LEFT: restrained identity (wordmark at the
gutter). MIDDLE: nothing — the chrome carries no center content. RIGHT: quiet sign-in + at most
one dominant rectangular action and a fused pair of square instruments (real lookup, menu). The
rectangle is frosted, decorative, and inert: it never carries text, never intercepts a click, and
its geometry is architecturally stable on scroll (register/colour may change, position never).
Menu opens as a full-takeover canvas that paints BELOW the still-live chrome and over the
rectangle. Mobile recomposes deliberately: the rectangle goes full-bleed and square, identity
stays inside it up top, and the control cluster pins to the viewport bottom.

**Banned forms (unchanged):** floating rounded container, SaaS pills, centered-link-row-as-main-event, backdrop-blur-navbar-with-thin-line, ordinary hamburger sheet.

Exact geometry inside this form — offset values, gutter value, instrument sizes, corner language, inversion behavior — is Class B and locks in EC-20. Shared chrome remains founder-gated: this amendment implements the founder's 2026-08-09 directive and itself lands only through the founder visual gate.

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

The **structure** is locked now. The **values** are filled from the UX-01 verdict (`design-lab/homepage-reset/DECISION.md`) and locked thereafter. A wave that ships before back-fill inherits nothing visually — it waits.

**Verdict status: FINAL 2026-08-08 — Direction B GO, with amendments** (see EC-24 and DECISION.md). **Back-filled 2026-08-08 on founder GO** (R2 layering accepted). The amendments govern every value below: B's thesis is the brand (the product demonstration), the prototype is reference not implementation canon; dark-first warm-graphite is a **public register, not a mandate**; evidence artifacts stay **printable/light by default**; no 14–18s blocking hero — motion communicates the Easy Button quickly; the eyebrow gets its own UX-03 implementation and founder visual gate.

| Decision | Value | Status |
|---|---|---|
| Typography — display / body / mono faces | **Geist** (400/500/600) for display and body; **Geist Mono** (400/500) for machine facts and micro-labels | LOCKED |
| Type scale | Anchors from the verdict reference: hero h1 44–52px desktop / 30–34px mobile; micro-labels 11px mono uppercase `+0.08em`. Full ramp finalized in UX-02 within these anchors | LOCKED ANCHORS · ramp in UX-02 |
| Grid + page width | Full-width hairline-ruled band composition; content max ~1400px. Precise grid in UX-02 | LOCKED · grid in UX-02 |
| Eyebrow exact geometry (within EC-10's form) | **Amended 2026-08-09 (A-2, then A-3)**, superseding "64px desktop / 56px mobile, contextual product-state middle zone". Zero-height floating group. **The rectangle:** inset 10px left and right **but capped at 1480px wide and centred above that cap (A-3)**, held 16px from the top, 70px tall, 10px radius (`--vt-shape-control`), frosted (`backdrop-filter: blur(10px)` over a ~10% neutral scene mix), `pointer-events: none`. **Inside it:** instruments centred (painted boxes at y 31), and **every instrument measures from the RECTANGLE's edge, not the viewport's — 20px inside it on both sides (A-3)**, which still reads as the familiar 30px gutter at any width below the cap. Dominant action 40px tall × 205px minimum with a 16px/400 label, square instruments 40 × 40px with fused 1px borders, 30px between the action and the cluster; radius 0 on every instrument; no bottom rule, no centre content. **The takeover's columns ride the same band (A-3).** **Mobile:** rectangle full-bleed, square, 65px tall at the top — the band collapses there, so identity sits at the 20px gutter from the viewport edge; control cluster fixed 20px above the viewport bottom with the page reserving clearance. **All dimensions here are the PAINTED box**; interactive elements carry a 2px transparent ring so the target measures 44px (EC-5) while the painted box measures the reference value | LOCKED (amended A-3) |
| Button grammar (primary/secondary/quiet/destructive; ≥44px targets locked via EC-5) | Primary = solid work-green square-cornered instrument with AA-corrected near-black ink (reference `#4ADE97`; solid `#2E9E6B` + off-white recorded as the alternative); secondary = hairline outline; quiet = text. Exact styles in UX-02 | LOCKED STRUCTURE · styles in UX-02 |
| Rule/border treatment | 1px hairlines structure panels and bands (`#2E2F33` on the graphite register) | LOCKED |
| Icon family | **Consolidate to one family in UX-02.** Two are installed today: `lucide-react` (imported by 330 `apps/web` files) and `@blueprintjs/icons`; 47 components also carry inline `<svg>`. Whichever wins must satisfy the locked grammar — 1px hairline weight, near-sharp 0–3px, no glass, no gradient, no glow — and the loser is removed, not left resident. Design review picks; this row records the constraint and the count | DEFERRED · UX-02 owns · constraint locked |
| Corner-radius philosophy + pill policy | **Amended 2026-08-09 (A-1, then A-2).** A-1 superseded "near-sharp 0–3px on panels and instruments; pills retired" and gave the public **scene register** a four-step shape scale — `--vt-shape-pill` 9999px, `--vt-shape-control` 10px, `--vt-shape-card` 20px, `--vt-shape-panel` 24px. **A-2 resolves what the scale left ambiguous: an ACTION is square, a WORD-LABEL may be a pill.** Every action on a public surface takes radius 0 — chrome instruments and page actions alike — and so does any illustration that DEPICTS an action. The pill survives for names and labels (source names, owner chips, disclosure tags, step indices), which makes the silhouette carry meaning: square means you can act on it. A-1's limits are untouched: evidence and operational surfaces stay near-sharp, and **a pill is never a state marker** (EC-4). Islands outside the scene register keep their own radii until migrated | LOCKED (amended A-2) |
| Spacing rhythm | **No spacing scale exists yet** — measured 2026-08-08 (W1080): zero `--*-space*` custom properties across `apps/web/styles` and `globals.css`, so every value is currently ad hoc. UX-02A's "one semantic token layer" owns it; until that lands no wave may assert a spacing rule as law. Bounded by the locked band composition (full-width hairline-ruled, content max ~1400px) and the chrome gutter (30px desktop / 20px mobile, A-2) | DEFERRED · UX-02A owns · nothing to supersede |
| Neutral palette (grounds, ink ramp, rules) | **Public register (dark, permitted not mandated):** ground `#141517`, panel `#1C1D20`, raised `#222326`, hairline `#2E2F33`, ink `#F2F1ED`, secondary `#9C9D99`. **Light register (required for evidence/printable/dense-legibility surfaces):** off-white family with graphite ink; exact artifact palette is a named UX-02 design task | LOCKED · light values in UX-02 |
| Interaction/accent treatment | **Amended 2026-08-09 (A-1): the accent-work merge is reversed.** Work-green (`#4ADE97`, `--vt-scene-state-source-confirmed`) is the single **work** colour — source-confirmed facts and completed work — and is **retired as the primary action**. The primary action is the warm-paper inverse instrument (`--vt-action-primary-bg` = scene paper, `--vt-action-primary-fg` = paper ink). Needs-you amber `#E4B45C`; waiting neutral `#8F8C88`. VitalCV indigo (`--vt-accent-editorial`, register-resolved via `-on-dark` / `-on-paper`) carries the focus ring and the editorial atmosphere, and is **never a status colour**. State words always in ink (EC-4). Full state-hue family reconciled in UX-02 with the EC-3 vocabulary mapping | LOCKED (amended A-1) |
| Mono presentation policy | Machine facts — NPIs, timestamps, state words, source names, micro-labels — in Geist Mono, `tabular-nums` | LOCKED |
| Card grammar | Solid hairline-ruled panels, radius 0–3px, no shadows | LOCKED |
| Glass treatment | **Amended 2026-08-09 (A-1), superseding "None."** Frost is permitted on **chrome and scene overlays only** — `--vt-frost-bg` / `--vt-frost-border`, both `color-mix` over scene surfaces, so the effect degrades to a solid panel wherever `backdrop-filter` is unsupported. **Evidence surfaces stay solid:** no frost on a proof row, artifact, receipt, or any surface a decision is read from. This restores CD's "glass on chrome, solid on evidence" as the operative line rather than a blanket ban | LOCKED (amended A-1) |
| Gradient treatment | **Amended 2026-08-09 (A-1), superseding "None."** Exactly one atmospheric gradient is permitted — `--vt-scene-glow`, the editorial indigo wash, **at most once per viewport**, behind a scene composition. It may never appear on a control, text, status marker, input, evidence surface, or card fill, and it carries no meaning: removing it must cost nothing but atmosphere (EC-4). No other gradient is authorised | LOCKED (amended A-1) |
| Light/dark doctrine | Dark-first warm-graphite is the permitted **public register**; the light register is **required** for evidence artifacts (printable by default, amendment 6), dense workflow surfaces, and legibility-critical contexts; **not** permanent dark everywhere (amendment 5). Explicitly supersedes CD-3 "light is the only public mode", CD's 2026-08-02 one-Ink-chapter amendment, and wave-1505 LINT-04's scope (rescoped in the EC-23 port) | LOCKED |
| Product-UI visual density | Designed in UX-02+ under **design review** — an EC-14 Class C judgement, never a CI rule. Bounded by what is already locked: cards earn their box, structure comes from rules and space rather than container sprawl, density serves comprehension, and working surfaces operate where acquisition surfaces argue | DEFERRED · UX-02+ owns · Class C, review-enforced |
| Illustration treatment | VitalCV's own artifacts plus abstracted, **self-labeling** product illustrations ("Illustration — not a live result"); no stock imagery | LOCKED |
| Animation character/easing + band values | Motion communicates the Easy Button **quickly**; no blocking or gating sequences (amendment 5); single-shot; the four-band structure holds; exact durations/easing set in UX-02 motion work | LOCKED CONSTRAINTS · values in UX-02 |
| Font delivery | Self-hosted variable `woff2` via `next/font/local` in `apps/web/app/fonts/`; never `next/font/google` | LOCKED |

State hues may never be spent as decoration (EC-3). The accent-work merge above is the recorded verdict decision. Rows marked "in UX-02" or **DEFERRED** are bounded design tasks inside locked constraints — not open questions.

#### Direction D homepage register — amendment D (2026-08-11)

The founder selected **D · Watch it build** for `/` on 2026-08-11. This is a
route-scoped implementation register for the production `easy` homepage; it
supersedes the conflicting Direction-B presentation on that route only. It does
not reopen the product, source, consent, authorization, or scene-truth
contracts above.

| Decision | Value | Status |
|---|---|---|
| Ground | Warm light paper `#f7f6f3` | LOCKED for `/` |
| Ink / dim / rule | `#131211` / `#5c5852` / `#e0ddd6` | LOCKED for `/` |
| Panel | Solid white `#ffffff` | LOCKED for `/` |
| Accent | Deep green `#0f6d4e`, reserved for source-confirmation and focus | LOCKED for `/` |
| Primary action | Ink `#131211`, white label, 8px radius | LOCKED for `/` |
| Hero H1 | `clamp(31px, 4.3cqw, 47px)`, 500 weight, `-0.035em` tracking, 1.04 line-height | LOCKED for `/` |
| Monospace | None on this surface | LOCKED for `/` |

The organizing idea is the product demonstration: a self-labelled career
record assembles row by row, naming the source or limitation on every row. The
complete record is server-rendered and visible before JavaScript; the assembly
effect may begin only after JavaScript marks the record animated. This preserves
the no-script and blocked-compositor failure mode.

**Deliberately not changed:** EC-10's shared public chrome geometry, its
instruments, and its route-declared theme mechanism. This amendment changes the
homepage composition beneath that chrome, not the chrome itself.

**On the difference (W1080 closure, 2026-08-08).** Three rows previously read
"PENDING UX-02", which is indistinguishable from an unresolved brand decision and
made the table read as incomplete when it is not. A deferral is legitimate only
when it names **the wave that owns it** and **the constraint it decides within**;
all three now do, and each records what was measured rather than a value nobody
has chosen. No row in this table is an open question, and no wave may fill a
DEFERRED row by inventing a value — EC-22 applies unchanged.

---

## Part V — Profile in Motion: the visual narrative system

Added by CC-01 / VIS-01 (2026-08-08) from `docs/design/VITALCV_LIVING_PROFILE_VISUAL_SYSTEM_2026-08-08.md` (the founder brief, committed with this amendment), amended in place per EC-22. These clauses govern illustration, scene, and motion work. They do not touch application truth, authorization, consent, data models, source behavior, or employer decisions (EC-0).

### EC-25. Scene truth review — Class A

Every scene, still or moving, passes this review before it ships. This is EC-3 applied to artwork, and it is rejection law.

A scene may never contain or imply:

1. A clinician who could be mistaken for a real person — no real or well-formed NPI, no realistic external identifier, no plausible name paired with credentials.
2. A source response that did not occur, a source that is not integrated, or a confirmation mark on a gated source.
3. A count, score, match, or metric presented as a measurement. Illustrative numbers are labeled illustrative or removed.
4. A submission, share, or send shown as complete before the real endpoint has succeeded.
5. An employer decision, hire, clearance, privilege, or start. **Employer scenes stop at review** — the review desk receives, it never resolves green.
6. Verification, clearance, or credentialing performed by VitalCV.

A scene must be impossible to mistake for live results. Where a scene sits next to real product state, the self-labeling illustration rule in EC-20 applies: it says what it is.

### EC-26. The `VisualScene` contract — Class A

There is one rendering path for public visual scenes, and it distinguishes **decorative art** from **data-driven app state** at the type level. A component may not blur the two.

```
VisualScene {
  scene      SceneId              // from the EC-28 inventory
  kind       'decorative'         // art; alt="" ; carries no state
           | 'process'            // explains a process; requires transcript
           | 'stateful'           // reflects real returned app state
  mode       'motion' | 'static' | 'auto'
  state?     <scene-specific>     // required when kind='stateful', else forbidden
  priority   'hero' | 'inline' | 'background'
  poster     <asset>              // required for every motion scene
  transcript <text>               // required for kind='process' and 'stateful'
}
```

Binding properties:

- **`kind='stateful'` renders only from real returned records.** It has no fixture path and no optimistic path. Unknown, unavailable, and error states are composed deliberately, never rendered as an empty or broken scene.
- **A scene is never the sole carrier of meaning** (EC-4). No state, consent choice, source limitation, ownership label, or employer decision may exist only inside artwork. Removing every scene from a surface must leave it fully usable and fully legible.
- **Reduced motion is a composition, not a fallback.** The static state tells the same story, with step controls where a sequence carries the meaning.
- **No autoplay** under `prefers-reduced-motion` or data-saving conditions; serve poster plus an explicit play or replay control.
- **No layout shift.** Scenes reserve their space.

### EC-27. The protagonist object and the five beats — Class C

**One protagonist across the product.** It is the clinician's own record — not a dashboard, hospital, network graph, AI motif, or a person.

This clause **reconciles with, and does not replace, `docs/design/vitalcv-cinematic-storyboard.md`** (issue #1069, Phase Z0), which already defines the object's anatomy — SILHOUETTE, PROPORTIONS, and the "cover the copy and the object still reads" test. That anatomy is the object's definition of record. The Living Profile brief's "profile object" and Z0's "living evidence record" are **the same protagonist under two names**; shipping them as two objects would recreate exactly the multiple-competing-systems problem this constitution exists to end. Waves cite Z0 for anatomy and this clause for narrative.

**The five permanent beats:** Identify → Build → Choose → Apply → Carry forward. The employer-review scene is a **bridge between Apply and Carry forward, never a sixth success beat** (EC-25.5).

The four ownership cues are already law in EC-7 and are the vocabulary every scene expresses through object behavior: VitalCV assembles; the clinician pulls, releases, and approves; the employer receives and reviews; open items stay visibly open.

Materials, palette, lighting, and camera are **Class B** — they resolve through EC-13 and the locked EC-20 rows, not here. This clause supplies narrative structure only.

### EC-28. The approved scene inventory and placement authority — Class C, with Class A gates

Only these scenes are approved for the first release. A new scene requires an EC-22 amendment.

| Scene | Kind | Home surface |
|---|---|---|
| Journey Film | process | See placement note below |
| NPI Reveal | stateful | NPI entry / resolution |
| Profile Layers | stateful | Claim, profile completion |
| Choice Gate | stateful | Apply, sharing permissions |
| Opportunity Field | stateful | `/holder/opportunities*` (see note) |
| Employer Desk | process | Employer acquisition |
| Continuity Ribbon | decorative | Application timeline, reuse |
| Quiet Source Constellation | stateful | Trust Center, Status |
| Workbench Window | process | Clinician product page |
| Decision Trail | stateful | Opportunity detail |

**Placement note — the Journey Film is not authorized on `/` by this clause.** Homepage composition authority rests with the homepage reset and UX-04 (EC-24), and the retired film/scene model may not re-enter through an illustration wave. A Journey Film on the homepage requires an explicit EC-22 amendment and a founder visual gate. Independent of that, UX-01 amendment 5 forbids a blocking hero: no scene may make a visitor wait for the message, and the real NPI action outranks the journey (XS-10, EC-1).

**Route note (founder decision, 2026-08-08).** The source briefs target a `/jobs` surface. No such route exists. Opportunity and apply scenes target the surfaces that do: `/holder/opportunities{,/discover,/interested,/passed}`, `/holder/matcha/opportunities`, and `/opportunities/discover`. Renaming the customer-facing noun is UX-16 copy work; creating a `/jobs` route is a product dependency, not an illustration wave.

### EC-29. Media budgets and motion safety — Class A

Objective, measurable, and CI-enforceable (EC-23):

- Hero poster ≤ 250 KB. Desktop hero moving asset ≤ 1.5 MB per modern format after compression. Measure; do not assume.
- Every motion asset ships: poster, static reduced-motion composition, and — for `kind='process'` and `'stateful'` — a transcript or adjacent textual equivalent. Decorative crops carry empty alt text; meaningful process scenes never do.
- Every asset carries source, license, and origin metadata. An unlabeled, oversized, or fallback-less asset fails the gate.
- Motion timing follows the four bands already locked in EC-20: 80–150ms control feedback · 150–250ms state transition · 250–450ms product transformation · 450–800ms rare narrative.
- **Nothing loops** except a loading skeleton, a system-status pulse, or a source check that is genuinely running. A hero does not loop once it has finished.
- Numbers animate only between real returned values (EC-3).
- No body copy is printed inside an image; contrast floors hold independent of artwork (EC-5).

---

## Part VI — Governance

### EC-21. Citability

- **Rejection law:** Class A clauses (EC-0…EC-12, EC-25, EC-26, EC-29) and **locked** EC-20 rows. Cite the number.
- **Class B (EC-13):** not citable as law until its EC-20 row locks. Neither prior eras nor new inventions may be asserted as authority in these domains before the verdict.
- **Class C (EC-14, EC-27, EC-28):** rejections happen in design review, citing the clause **plus a named rationale**. Never automated. EC-28's placement and route notes record founder decisions and bind like locked EC-20 rows.

### EC-22. Amendment

Class A clauses and locked EC-20 rows change only by editing this file with a dated rationale, founder-approved. A PR may not introduce a local exception. Class C guidance evolves through recorded amendments as review precedent accumulates. Parked eras (`PARKED_VISUAL_ERAS.md`) return only via amendment.

### EC-23. Enforcement — CI enforces contracts, review enforces taste

**CI-blocking (objective, lands with UX-02):**

- Truth/copy safety: the EC-3 banned strings and false-claim patterns (`scripts/check-public-claims.ts`, run as the `check-public-claims` required check); checkmark-on-gated-or-non-integrated-source
- Accessibility contracts: focus ring presence, target sizes, contrast floors
- Reduced-motion presence: every animated surface ships a reduced-motion composition
- State never by color alone: glyph + word pairing at the component level
- Token architecture: no raw values outside token files, no foreign prefixes, no new stylesheet imports, no literal z-index, `next/font/local` only
- Duplicate design-system infrastructure **after UX-02** (second badge systems, parallel component libraries, new scoped islands)

**Design/founder review (taste — never CI):** typography, palette, gradients, cards, radius, imagery, composition, visual density, animation character.

Subjective July-era taste is not encoded as CI law before the reset direction is chosen. The `check-design-lint.ts` port from `.worktrees/retire-speed-claim` is scoped to the objective list above; taste rules from wave-1505's set (pill radii, shadow discipline, dark-on-public) join CI only if and when the verdict locks the matching EC-20 row. Proof obligation stands: a deliberately-violating PR must fail CI on every objective count before the gate is considered live.

### EC-24. Records

- **A-3 — the rectangle stops growing, on founder directive (2026-08-09).** EC-20's
  eyebrow-geometry row moves from `amended A-2` to `amended A-3`. The founder, on the chrome A-2
  shipped: *"can we make the top bar eyebrow less wide and more exact to the palantir.com size"*.

  **The defect was a measurement taken at one width.** A-2 probed the reference at 1440 and 390 and
  recorded "inset 10px left and right" — true at 1440, and false as a rule. Re-probed at
  1280/1440/1512/1728/1920/2560, the reference paints **1260 / 1420 / 1480 / 1480 / 1480 / 1480**,
  centred once capped: it holds a 10px inset only until the rectangle reaches **1480px**, then
  stops growing and centres. VitalCV's implementation had no cap, so on a 1920 display the chrome
  measured 1900 wide against the reference's 1480, and on a 2560 display 2540 against 1480. Every
  desktop assertion in the eyebrow suite ran at 1440 — *below the cap* — so nothing could see it.
  **The lesson generalises past this row: a geometry rule read off a single viewport is an
  anecdote. Probe a reference at the extremes of the range you intend to ship, or the constant you
  write down is really a coordinate.**

  The instruments turned out to be band-relative too, which the single-width probe also hid: the
  wordmark sits at reference `x` 30 / 36 / 144 / 240 / 560 as the viewport grows — always
  **20px inside the rectangle**, never at a fixed viewport gutter. Below the cap that is 10 + 20 =
  the 30px gutter A-2 recorded, which is why the two readings agreed at 1440 and only at 1440. The
  takeover was measured open at 1920: columns start at 240 and the last closes at 240 — **the same
  band**, so it moves with the chrome rather than staying full-bleed under it.

  Implementation note kept deliberately: the band is `max(10px, (100% - 1480px) / 2)` against
  `.vcv-eb`, **not `100vw`** — a classic (non-overlay) scrollbar makes `100vw` wider than the
  layout box and would push the centred band off-centre by half the scrollbar on exactly the
  platforms least likely to be checked.

  **Not touched, and recorded rather than taken silently:** the reference's dominant action is
  *fluid* — measured 178 / 205 / 217 / 253 / 285 / 392 across the same six widths, ≈`16.7vw − 36px`
  — while EC-20 locks ours at a 205px minimum, a value A-2 read at 1440 for the same reason it
  misread the inset. VitalCV's action stays 205 here: matching the reference would make the action
  *wider* on large displays, which is the opposite of the directive this amendment serves, and the
  action's shape was separately founder-ruled under A-2. **Flagged for a founder decision, not
  folded into a width-reduction PR.**

- **A-2 — the floating chrome, on founder directive (2026-08-09).** EC-10's structural form and
  EC-20's eyebrow-geometry row carry an `amended A-2` marker. This entry records the directive and
  what the amendment deliberately does not touch.

  The founder's standing request — restated 2026-08-09, "since the beginning, I've been asking for
  the top eyebrow to be exact to palantir.com" — is a **Class B geometry directive inside EC-10's
  form**, and EC-10's form itself had to move: the reference is not a bar. Measured from
  palantir.com on 2026-08-09 (probe and computed styles archived with the wave evidence): the
  chrome is a sticky group of zero height, the brand floats at a 30px gutter, the right cluster
  holds one 40 × 205px rectangular action plus two fused 40px squares, every corner is square, and
  the takeover paints beneath a chrome that stays live. VitalCV's implementation matches that
  geometry and maps the reference's search slot to the one real lookup it has (the public NPI
  check) rather than adding a decorative control.

  **The rectangle was missed on the first pass and the founder had to ask twice** ("did I mention
  I want the top bar to be in a wide rectangle shape — again just like palantir.com"). The reason
  is worth recording: the reference's defining surface is a single `div` whose only distinguishing
  property is `backdrop-filter`, it holds no text, and a DOM sweep for large rounded boxes near the
  top of the page returns nothing — its radius is 10px and it was filtered out as noise. It was
  visible in the very first screenshots as a soft rounded edge and was read as hero artwork. The
  lesson generalises: **when copying a reference, sweep for what PAINTS (backdrop-filter, blend
  modes, pseudo-elements), not only for what CONTAINS.** Measured values now in the EC-20 row.

  **What A-2 does not change.** The register mechanism is untouched: sections still declare
  `data-header-theme` and the chrome still inverts by declaration, never by pixel sampling or
  blend-mode trickery — the reference uses `mix-blend-mode: difference`, which VitalCV rejects
  because it makes contrast a function of whatever pixel is underneath, and EC-5's contrast floor
  has to be provable. Colour still routes through `--vt-scene-*`. A-1 is untouched and not
  contradicted: it *permits* the pill, it does not mandate it, and chrome instruments fall under
  A-1's own surviving limit that operational surfaces stay near-sharp. Work-green remains barred
  from the action (LINT-15). The page's primary NPI action keeps its A-1 pill; only the chrome is
  square. **That divergence is deliberate and visible on `/` — two "Start with your NPI" controls
  in different silhouettes — and is flagged for the founder at the visual gate.**

  **The page action followed the chrome, on founder ruling.** Squaring the chrome left `/` showing
  two "Start with your NPI" controls in different silhouettes — chrome square, page pill — which
  was flagged at the gate rather than resolved unilaterally. The founder ruled: *"square the page
  action to match."* So the EC-20 shape row above now states the rule that ruling implies, and it
  is a rule rather than a special case: **an action is square, a word-label may be a pill.**

  Measured before changing anything, `/` was the only public surface with pill-shaped actions —
  `/pricing`, `/employers`, `/trust`, `/explore` and `/verify` already carry none — so the change
  is one island (`easy-home.css`) and six real actions. Two DEPICTIONS of buttons inside the
  illustrative work surface went square with them, because an illustration that draws a product we
  no longer ship is simply a wrong picture. Four word-labels keep the pill: the disclosure tag,
  source names, the owner chip, and the reduced-motion step index. Nothing here weakens A-1: a
  pill is still never a state marker, and the state markers were already radius 0.

  **Two reference behaviours were adjusted on accessibility grounds; both deviations are recorded
  here rather than silently taken.**

  *Mobile clearance.* Mobile pins the control cluster to the viewport bottom, as the reference
  does. Measured at 390 × 844 before clearance was added, the cluster covered the footer's last
  two links and the feedback control at the document bottom. The footer now reserves 84px and the
  feedback chip rides above the cluster. The reference reserves equivalent clearance; copying the
  pinning without it would have shipped untappable links.

  *Target size.* The reference's instruments are 40px; EC-5's floor is 44px. **The two are
  reconciled rather than traded off:** every instrument paints its box in an inner span, so the
  interactive element measures 44px while the painted box measures the reference's 40px, and the
  row offsets absorb the 2px ring so the *visible* edges still land on the gutter. This is why the
  EC-20 row above states painted dimensions — a future wave measuring the outer element will read
  44 and must not "correct" the row. The required a11y baseline ratchet is what caught the
  regression (`/`: sub-44px targets 13 → 15) after a full local e2e run had gone green, because
  that spec landed on `main` while this work was in flight; the same pass also lifted the wordmark
  and sign-in link, which the baseline had grandfathered, taking `/` to 12.

- **A-1 — the 2026 scene register, ratified after the fact (2026-08-09).** Four locked EC-20 rows
  above carry an `amended A-1` marker. This entry records why, and the process failure that made
  the amendment necessary rather than optional.

  The work landed first. `#1229` (squash `4a023b269`) shipped the public scene register —
  `--vt-shape-*` (pill 9999px, control 10px, card 20px, panel 24px), `--vt-scene-glow`,
  `--vt-frost-*`, and the paper-inverse `--vt-action-primary-*` — into
  `apps/web/styles/themes/index.css`, and it is live. It did not touch this file. For roughly a
  day, four rows of citable law said the opposite of the running product: pills retired, glass
  none, gradient none, near-sharp 0–3px, work-green as the primary action.

  **A contradiction like that does not sit still — it converts into rejected correct work.**
  EC-21 makes locked rows rejection law, so the next wave to read EC-20 would have cited a number
  against the shipped design and been *right by the document and wrong by the product*. This is
  the failure `check-design-lint.ts` documents twice in its own comments (the R2 `HorizontalStoryRail`
  ban and the CD-3/4 accent arc), where a gate defends retired doctrine and the correct fix looks
  like a broken build. The remedy is not to relax the rule that caught it; it is to make the
  document tell the truth, on the record, with the limits restated.

  What the amendment **preserves** is the load-bearing part. Frost is confined to chrome and scene
  overlays and may never touch an evidence surface — CD's "glass on chrome, solid on evidence"
  becomes the operative line instead of a blanket ban. The single indigo wash is atmosphere with
  no meaning attached, capped at one per viewport, banned from every control and status marker.
  A pill is a control silhouette and **never** a state marker. EC-4 is untouched: nothing in this
  amendment lets colour, motion, or hover carry meaning alone.

  The one row that got *stricter* is the accent. The 2026-08-08 accent-work merge made work-green
  both the completed-work colour and the primary action; on the shipped homepage that produced a
  single hex doing two contradictory jobs — reporting "this is confirmed" and soliciting "click
  me" — across the NPI submit, the eyebrow action, and roughly fourteen completed-state selectors
  in one viewport. Two independent lanes reached the same correction on the same day
  (`#1229` and `#1230`'s ruling board, `design-lab/2026-register/`). A truth colour that also
  asks for clicks stops being a truth colour, so green is now work only and the primary action is
  paper.

  **Process note, recorded because the next amendment should not repeat it.** Two lanes executed
  the same founder brief in parallel roughly ten minutes apart, reaching mostly-identical
  conclusions through duplicated effort and one head-on collision (a duplicate `LINT-14` ID; the
  loser closed as `#1231`). A wave that changes a locked row must amend this file **in the same
  PR** — the EC-22 requirement is not satisfied by shipping the values and intending to write it
  down later.

- **W1080 decision closure (2026-08-08).** The UX-01 verdict was already FINAL and EC-20 already
  back-filled, so closure was not a matter of making decisions — it was making them *citable*.
  EC-21 declares this document law and every locked EC-20 row derives from the verdict, but the
  verdict itself, `design-lab/homepage-reset/DECISION.md`, was **never committed**. The rest of
  the exploration record around it *was* — master brief, all three direction briefs and
  prototypes, the three pass-1 critiques, the evidence harness, 17 files in all. The one file that
  never landed was the decision. It existed on one machine; nobody else could read the authority
  this document rests on, and one lost working tree would have taken the founder's ruling with it.
  It is now tracked. Three further citations were wrong:
  `scripts/copy-rules.json` was named in EC-23 as the live CI mechanism but **has never existed**
  (the real guard is `scripts/check-public-claims.ts`, which does cover every EC-3 string); the
  competitive mandate was **recorded missing when it is in the repo**, renamed to
  `docs/strategy/competitive-mandate.md`; and `PARKED_VISUAL_ERAS` cited three chrome specs by
  filename that were **deleted**, not parked, so it now names the retiring commit. The lesson is
  narrow and worth keeping: **a governance document that cites a file nobody can open is a claim
  about law, not law.** `apps/web/__tests__/governance-citability.test.ts` now makes citability a
  property this repo has rather than one it asserts.
- **CC-01 / VIS-01 amendment (2026-08-08):** Part V (EC-25…EC-29, Profile in Motion) added per the founder's Visual System + Workbench program (CC-01 wave; source brief `docs/design/VITALCV_LIVING_PROFILE_VISUAL_SYSTEM_2026-08-08.md`, committed with this amendment per the W1080 lesson); Governance renumbered to Part VI, clause numbers unchanged. Founder decisions recorded same day: customer-facing name **VitalCV Workbench** (collision with the ops-facing investigation workbench noted in `docs/architecture/workbench-baseline.md` §4-M5 — copy-only rename, no route/table changes); opportunity/apply waves **retarget to `/holder/opportunities*`** (no `/jobs` route exists; EC-28 route note). CC-00 baseline: `docs/architecture/workbench-baseline.md`.
- **R2 restructure (2026-08-08):** founder ruling — Phase 0 approved; UX-00 revised into the three-class layering; PR #1160 held draft at reviewed head `9568a4db1e`; merge blocked pending FOUNDER UX-00 REVISION REVIEW.
- **UX-01 verdict state — FINAL.** Lineage, all 2026-08-08: a parallel lane recorded "B as presented, no hybrid" (selection made in-session 2026-08-07) → the founder's UX-00 ruling reopened the verdict pending hybrid consideration (no back-fill occurred during the reopening) → the founder's amended ruling resolved it: **DIRECTION B GO, WITH AMENDMENTS** (memorialized in `DECISION.md`): product-forward brand; dark-first as public *register* with intentionally light evidence/dense surfaces; the Start Agent's visible work is brand; the eyebrow is binding with its own UX-03 gate; NOT authorized — blocking 14–18s hero, permanent dark everywhere, prototype-as-implementation. EC-20 back-fill follows only after this R2 layering is accepted (execution step 3). The verdict's register scoping supplies the explicit supersession EC-13.11 requires.
- **Companion ruling on #1165 (census):** accepted as evidence; merge held until governance rebase — "UX-02 adopts…" language renamed to "candidate substrate / measured recommendation" (the census establishes facts, it does not legislate); rebase after #1160 settles (main had advanced to `ab25931b6` at ruling time). Its Direction-B scoping assumption is now consistent with the final verdict.
- `VITALCV_EXPERIENCE_SYSTEM_2026.md` (XS-1…XS-10, est. 2026-08-02, deriving from `founder-rulings-2026-08.md`) is canonical for *interaction and progression* and was missed by the program audit. Carried forward: XS-1 (one scroll owner, cited in EC-4), XS-7 (reduced motion as deliverable), XS-9 (performance floor), XS-10 (the NPI field outranks the journey — aligned with EC-1). Its homepage-journey mechanisms (XS-3 media rail, XS-4 chapter menu) serve the retired journey model; **UX-04 must amend XS per its own rules** — a recorded dependency, not a silent supersession.
- Mainline CD carries the **2026-08-02 "One public Ink chapter" amendment**; any dark-public verdict must supersede it explicitly (EC-13.11).
- **Competitive mandate — found 2026-08-08 (W1080), correcting a "recorded missing" entry.** It is `docs/strategy/competitive-mandate.md`, tracked on `origin/main`. The earlier search looked for the original filename (`VitalCV_Competitive_Mandate_and_Claude_Code_Waves_2026-07-21.md`) across repo root / docs / design-handoff at depth ≤4 and missed it because the document had been **renamed**, not lost. Searching for a path rather than for the document is how a live file gets recorded as missing. Its authority is unchanged: homepage-composition authority rests with the homepage reset, the film/scene model is retired, and it carries a superseded-where-conflicting notice; its strategic copy is UX-16 salvage only.
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
