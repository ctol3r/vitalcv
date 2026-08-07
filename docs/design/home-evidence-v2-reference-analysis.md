# Home Evidence Experience v2 — reference analysis

Wave 0 evidence record for the Home Evidence Experience v2 program.

Companion to [`home-evidence-experience-v2.md`](./home-evidence-experience-v2.md)
(the contract) and [`home-evidence-v2-acceptance.md`](./home-evidence-v2-acceptance.md)
(the checklist). That contract's §15 states the provenance ruling in one
paragraph. **This document is the evidence underneath it**: what was actually
measured, where, and what was rejected.

## Method, and how to falsify anything here

Every observation below was taken from the live reference or the repository on
**2026-08-01**, not recalled. Reference CSS was fetched to an ignored scratch
directory outside the repository, never into `apps/` or `packages/`. Page
structure was read from a rendered browser, not from a text fetch — an early
text-only fetch of two reference pages returned navigation and footer chrome
only (the reference client-renders its body), and those results were discarded
rather than written up.

Three of the patterns this program was told to expect **did not survive
measurement**. They are marked **NOT OBSERVED** below and were not implemented
on the strength of the claim. That is the point of the exercise.

Counts below come from the five reference bundles (≈351 KB total).

---

## 1. VitalCV current state

Established by preflight against `origin/main` @ `c5551736f` and production.

| Fact | Evidence |
| --- | --- |
| All 10 production URLs in the plan's §2 respond | `curl` → `200` on all ten |
| PR A (foundation) is **merged** | #994; `home-surfaces.css`, `motion.css` on `main` |
| PR B (evidence input) open | #998 |
| PR C (evidence capsule) open, stacked on PR B's branch | #1002, base `feat/home-evidence-v2-input` |
| Foundation contract test shipped as `home-evidence-foundation.test.ts` | not the placeholder name `home-surface-contract.test.ts` |
| Design-lint rules in force | LINT-01, -02, -03, -04, -05, -06, -08, -09; COMPETE R1–R8 |

`AskHome` remains the factual and actionable owner of the homepage;
`CinematicEvidenceField` is decorative and `aria-hidden`. Wave 2 does not move
real data into the decorative layer.

### A defect this preflight found

PR B's extraction of `EvidenceInput` retyped the primary CTA with an ASCII
apostrophe. `origin/main` ships `Check&rsquo;s ready` (U+2019). The change was
invisible in review and only surfaced because an e2e locator matched the
typographic character literally. Restored, and now pinned by a unit assertion.

This is the [copy-polish
failure mode](./DESIGN_LINT.md) in a new place: the string was not "polished",
it was *retyped*, and retyping is how pinned copy silently dies.

---

## 2. Zoox homepage observations

Source: <https://zoox.com/> (rendered).

| Observation | Detail |
| --- | --- |
| One dominant opening statement | A single two-sentence claim occupies the first screen with nothing competing for attention |
| Eyebrow + one sentence, repeated | Each scene opens with a short all-caps eyebrow label, then exactly one sentence of supporting copy |
| One concept per screen | Seven scenes, each carrying a single idea; no dense feature grid anywhere on the page |
| Split-text reveal, done accessibly | Headline copy is duplicated: one intact visually-hidden copy for assistive tech, one `aria-hidden="true"` copy split into ~24 per-word spans for the animation |

**The split-text finding is the most useful thing on this page**, and it is the
opposite of what it looks like. Word-split animated text usually indicates a
component that has shredded its own accessible name. Here the accessible copy
is intact and separate, and the decorative copy is correctly hidden. Verified
in the DOM, not inferred from appearance.

**VitalCV translation.** The eyebrow + single-sentence rhythm is what lets one
NPI action dominate screen one while the atmosphere still says what the product
is. If VitalCV ever animates a headline per-word, it adopts the two-copy
structure or it does not ship.

---

## 3. Zoox How to Ride observations

Source: <https://zoox.com/how-to-ride> (rendered).

The page is a **process narrated by its own status**:

| Position | Transitional label | Content |
| --- | --- | --- |
| 1 | `REQUESTING…` | how to summon |
| 2 | `ZOOX ARRIVING…` | what arrives, what happens |
| 3 | `YOU'VE ARRIVED!` | the three payoffs |

The transitional labels are **not headings** — they are present-tense status
states of a process the reader has conceptually started. The sequence
`request → arrive → experience → complete` is carried by those labels rather
than by numbering or a progress dashboard.

**VitalCV translation.** The four moments — **NPI → Sources → Permission →
Review** — should read as states of one process the clinician started by typing
their number, not as four marketing sections. VitalCV already owns real status
vocabulary for this (`idle` / `resolving` / `resolved`), and the journey labels
should agree with it rather than invent a parallel one.

**Rejected literal adaptation.** No ride metaphor, no vehicle imagery, no
scroll-driven ride sequence, no scroll hijacking, and no copied transition.

---

## 4. Zoox Know Your Ride observations

Source: <https://zoox.com/know-your-ride> and the detail group on How to Ride.

Five detail items are grouped by **what the rider controls** — sound,
temperature, comfort, connectivity, confidence — not by subsystem. Each is a
short imperative title plus two or three sentences of plain benefit. There is
no specification table anywhere.

**VitalCV translation.** Sources must not render as a database list. The
grouping is by what the reader needs to understand:

1. identity returned;
2. source response;
3. access limitation;
4. next action;
5. human decision.

This is already the taxonomy PR C implements (`SOURCE_RETURNED`,
`ATTENTION_REQUIRED`, `ACCESS_REQUIRED`, `SYSTEM_UNAVAILABLE`). The reference
supports the grouping; it does not supply the categories, which come from
VitalCV source truth.

---

## 5. Zoox form observations

Source: <https://zoox.com/community> — computed styles read from live elements.

| Property | Measured | VitalCV position |
| --- | --- | --- |
| Label | real `<label>`, `position: absolute` | **Adopt.** Real label, never placeholder-only |
| Placeholder | supplementary only, on the textarea | **Adopt.** Placeholder never carries the accessible name |
| Field height | 56 px | **Adopt the floor.** Exceeds the 44 px primary-action target |
| Error wiring | `aria-describedby` → a per-field error id | **Adopt.** Already how `EvidenceInput` wires `#ask-hint` |
| Input font-size | **14 px** | **REJECT — VitalCV exceeds this** |

### NOT OBSERVED — the 16 px iOS guard

This program was told to expect an iOS input rule raising font-size to ≥16 px.
**The measured inputs are 14 px.** The single `font-size:16px` in the bundles
belongs to an unrelated monospace rule.

The ≥16 px requirement is real — it is a WebKit behavior (iOS zooms the
viewport on focus of a sub-16 px input) — but it is a **platform** requirement,
not something inherited from this reference. VitalCV keeps it, sourced to the
platform, and is *more* correct than the reference here.

---

## 6. Zoox CSS system observations

Measured across the five bundles.

| # | Concept | Measured | VitalCV equivalent |
| --- | --- | --- | --- |
| A | Semantic tones | Component-scoped variant classes named for tone (light / dark / black); each sets `--bg-color` (126 definitions) and `--text-color` (86) and descendants consume them | `data-home-tone="paper\|mist\|trust\|ink"` in `home-surfaces.css` |
| B | Product easing | `cubic-bezier(.2,0,0,1)` — **53 raw literal occurrences**, plus 2 long-form | **One** easing token in `motion.css` |
| F | Clip-path reveal | `clip-path: inset(…)` driven by custom properties | Decorative capsule entrance only |
| G | Spacing | Paired per-section `--hz-padding-{top,bottom}-{mobile,desktop}` (85 each), `--side-padding` (76), `--max-width` (75) | Existing VitalCV spacing tokens |
| H | Media ratios | `1/1` (8), `3/2` (4), `16/9` (4), plus bespoke ratios | Only when VitalCV has real media |

**The 53 raw literals are the lesson, not the curve.** A value repeated 53 times
is a value no one can change. VitalCV tokenises it once. The curve itself is a
four-number easing definition that carries no authorship; the *discipline* of
having exactly one is what transfers.

### NOT OBSERVED — `prefers-reduced-motion`

**Zero occurrences across all five bundles.** The only media features present
are `min-width` (437), `max-width` (24) and `orientation` (6). There is no
`prefers-reduced-motion` and no `prefers-color-scheme`.

A single component ships a no-motion variant class, but that is an
**authoring-time** opt-out chosen by whoever built the section — not a response
to a user's declared preference.

This is the clearest possible confirmation of the source hierarchy: the
reference is an authority for composition and pacing and is **not** an authority
for VitalCV accessibility. VitalCV's reduced-motion behavior is governed by
`motion.css` and WCAG 2.2, and the reference contributes nothing to it.

### NOT OBSERVED — a tiered spacing scale and a column-formula grid

The bundles expose paired per-section padding variables and a single
`--grid-gap`, not a `none/xs/sm/md/lg` tier scale and not 8/12-column
calculations. VitalCV keeps its own spacing tokens; nothing here justifies
importing a new scale.

---

## 7. Accessibility requirements

Binding, and they outrank every reference observation above.

| Requirement | Standard |
| --- | --- |
| Real, persistent, associated label | [W3C — form labels](https://www.w3.org/WAI/tutorials/forms/labels/) |
| Format guidance via `aria-describedby` | [W3C — form instructions](https://www.w3.org/WAI/tutorials/forms/instructions/) |
| Status without stealing focus | [WCAG 2.2 — status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) |
| Visible keyboard focus | [WCAG 2.2 — focus visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible) |
| Focus never fully covered by chrome | [WCAG 2.2 — focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) |
| ≥24 px targets; ≥44 px for primary actions | [WCAG 2.2 — target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) |
| Full tab semantics or none | [W3C APG — tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) |
| Reduced motion removes movement, never content | [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion) · [WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions) |

### Open item carried into Wave 3

`EvidenceInput` renders one real, always-present, always-associated `<label>`,
which satisfies the merged acceptance contract. But its **text** swaps —
`Enter your 10-digit NPI` at rest, `NPI number` once focused or holding digits —
so the field's *accessible name changes on focus*.

Consequences, stated plainly:

- It is why three e2e specs had to loosen to `/npi/i` rather than assert an
  exact name. A locator that cannot name the thing it locates is a smell.
- A voice-control user who speaks the name they can see is targeting a name
  that stops existing the moment the field takes focus.

The plan's §4.2.D and §7.2 describe the alternative: a **stable** `NPI number`
label, with `Enter your 10-digit National Provider Identifier` living in a
separate instructions node referenced by `aria-describedby`. That is a
strictly better shape — stable accessible name, guidance still adjacent, float
becomes purely visual.

**Not changed inside PR B**, which was already blocked and 950 lines. Tracked
as a Wave 3 decision rather than silently absorbed.

---

## 8. React ownership decision

Per [React — sharing state](https://react.dev/learn/sharing-state-between-components).

| Concern | Owner |
| --- | --- |
| Raw value, storage, analytics, submission | `AskHome` |
| Presentation, focus, derived visual state | `EvidenceInput` |
| Validation | `lib/vital/npi.ts` — **the only** validator, shared with `NpiInput` |
| Derived field state | `evidenceInputState.ts` (pure) |
| Fetch lifecycle and real source state | `LiveNpiResult` / evidence capsule |
| Decorative phase only | `CinematicEvidenceField` |

The field never learns that NPPES exists. A field that knows about a registry
is a field that will eventually fetch from one.

## 9. Next.js boundary decision

`app/page.tsx` stays a server component. Animation never justifies promoting the
route to a client boundary; `'use client'` goes on the leaves that own
interaction. No second scroll owner is introduced.

## 10. Performance constraints

Targets are [Core Web Vitals](https://web.dev/articles/vitals) field thresholds
at p75 — LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1.

Lab runs are **diagnostic evidence, not field proof**. No release note in this
program may claim a production Web Vitals result from a local Lighthouse run.
No new runtime dependency: no GSAP, Lenis, Locomotive, Three, R3F, Swiper, or a
second icon library.

---

## 11. Explicitly rejected patterns

**From the reference:**

- its CSS, class names, custom-property names, fonts, font URLs, assets,
  colours and copy — none imported, none transcribed, none minified-and-renamed;
- the "it's not a car" headline structure and the robotaxi metaphor;
- its scene order and its type scale;
- its 14 px input size (VitalCV requires ≥16 px on mobile);
- **its motion posture** — no `prefers-reduced-motion` anywhere is not a model
  to follow.

**From the program's own brief, on evidence:**

- the 16 px iOS guard as a *reference-derived* pattern — it is platform-derived;
- a `none/xs/sm/md/lg` spacing tier scale — not present in the bundles;
- 8/12-column grid formulas — not present in the bundles.

**Structural, from VitalCV doctrine:**

- scroll hijacking, scroll snapping, carousels, a second scroll owner;
- `animation: … infinite` on any homepage surface;
- any page-level `opacity: 0` that hides required content before JS;
- any live-result vocabulary, clinician identity, NPI digits, percentage, score
  or source result inside the decorative layer;
- raising `scripts/design-lint-baseline.json` to admit any of this.

---

## Worksheet

Plan §4.1 row format, one row per adopted pattern.

| Source | Concept | Principle | VitalCV equivalent | Implemented in | Must not copy | Wave |
| --- | --- | --- | --- | --- | --- | --- |
| CSS bundles | tone variants set `--bg-color` / `--text-color`; descendants consume | context is declared once, descendants respond | `data-home-tone` | `styles/home-surfaces.css` | class names, custom-property names, colour values | A ✅ |
| CSS bundles | one easing repeated 53× as a literal | one product easing, tokenised once | one easing token | `styles/motion.css` | the literal, repeated | A ✅ |
| Homepage | eyebrow + one sentence per scene | one concept per screen | scene rhythm | PR D | copy, type scale, scene order | D |
| Homepage | intact hidden copy + `aria-hidden` split copy | animated text keeps one intact accessible copy | any split-text reveal | PR D | the implementation | D |
| How to Ride | present-tense status labels carry the sequence | a journey is a process narrated by its status | NPI → Sources → Permission → Review | PR D | ride metaphor, imagery, transitions | D |
| Know Your Ride | detail grouped by what the user controls | group by what the reader must understand | source taxonomy | PR C | grouping labels, copy | C |
| Community form | real absolute-positioned label; 56 px field; `aria-describedby` error | label is never a placeholder | `EvidenceInput` | `styles/evidence-input.css` | layout, radii, colours, copy, **14 px size** | B ✅ |

---

## Provenance assertion

No reference CSS, class name, custom-property name, font file, font URL, asset,
colour value or copy string entered this repository. Reference bundles were
fetched to an ignored scratch directory for measurement and were never
committed. All colour resolves to pre-existing `--vt-*` tokens; all type
resolves to `--vt-font-body` / `--vt-font-display` / `--font-mono`.
