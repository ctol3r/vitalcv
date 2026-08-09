# VitalCV 2026 Design Implementation Waves

**Authority inputs**

- `VITALCV_LIVING_PROFILE_VISUAL_SYSTEM_2026-08-08.md`
- `VITALCV_WORKBENCH_SPATIAL_KNOWLEDGE_PROGRAM_2026-08-08.md`
- `VITALCV_CLAUDE_CODE_ACTION_PLAN_VISUAL_WORKBENCH_2026-08-08.md`
- Attached Dimension token / theme / design files
- [Lovable 2026 design trends](https://lovable.dev/guides/website-design-trends-2026)
- [Linear reference](https://styles.refero.design/style/90ce5883-bb24-4466-93f7-801cd617b0d1)
- [ElevenLabs reference](https://styles.refero.design/style/031056ff-7af1-46db-8daa-115f731c5d26)

## The design decision

VitalCV should not imitate Dimension, Linear, or ElevenLabs. It should combine their strongest disciplines into a distinct system:

> **A calm clinical record meets a precise operating instrument.**

VitalCV is not a dark AI workspace, a generic healthcare site, or a white-label credentialing dashboard. Its visual signature is **the portable clinician profile**: a clear record that gathers known facts, exposes what remains, pauses at clinician consent, and carries forward to the next opportunity.

### What we borrow

| Reference | Borrow | Do not borrow |
| --- | --- | --- |
| Dimension attachment | Dusk-dark atmosphere, frosted surface restraint, soft pill actions, low-weight typography, generous breathing room | Its exact palette, warm-to-cobalt hero, token names, or generic AI-workspace composition |
| Linear | Operational density, hairline precision, low-weight type, decisive status information | Acid-lime branding, overly compact control surfaces, or project-management visual tropes |
| ElevenLabs | Editorial calm, warm paper contrast, product visuals as the only expressive color, quiet cards | Whisper-thin text where accessibility suffers; its visual identity or orange/blue product sparks |
| Lovable’s 2026 guidance | Functional motion, organic restraint, accessibility, deliberate 3D, mobile performance | Trend collecting: no decorative kinetic type, faux personalization, or 3D for its own sake |

## VitalCV’s native visual register

### 1. Dual material world

- **Public / story register:** warm graphite field, bone-white type, paper-like profile artifacts, frosted panels, and a single indigo *atmospheric* glow behind key visual moments.
- **Product / record register:** warm paper surfaces and sharply legible operational panels; dense where proof, source timing, or a decision requires it.
- **Work in motion:** the portable profile object and continuity path are the distinctive visual form. They replace stock clinical photography, AI blobs, and “network graph” wallpaper.

Dark is a deliberate canvas, not a cosmetic dark-mode toggle. Light is a clear record surface, not hospital white.

### 2. Color law

Use the current VitalCV semantic theme as the source of truth. Do not paste third-party raw tokens into `globals.css`.

| Role | VitalCV rule |
| --- | --- |
| Canvas | Warm graphite / existing `--vt-bg` dark register |
| Paper / primary action | Warm paper or snow-white surface with dark text; primary launch CTA is not green |
| Editorial accent | Existing indigo family (`--vt-accent-editorial` / approved equivalent), used in a glow, profile-path highlight, or illustration detail—not as status |
| Source-confirmed | Green only when a named source actually returns a match |
| Pending / needs a person | Amber only for the real pending / needs-you state |
| Blocked / critical | Red only for the real blocked / critical state |
| Borders | Warm, low-contrast semantic border tokens; never literal white hairlines everywhere |

**Critical correction:** the current homepage uses green both as “work complete” and as its primary NPI CTA. Move the primary CTA to the warm-paper inverse action treatment. Green must retain its evidence / completed-work meaning or the interface loses its truth grammar.

### 3. Type, shape, and density

- Retain currently loaded VitalCV fonts until an inventory proves a font change is warranted. Do not globally import DM Sans / Geist merely because the attachment uses them; the current homepage already uses Geist and Geist Mono successfully.
- Display type: low-to-medium weight, tight tracking, maximum clarity. Never use motion or a thin weight to make essential copy legible.
- Button, filter, and tag shape: full pill. Product controls: 8–10px. Marketing cards: 20–24px. Operational tables / proof rows remain crisp rather than becoming clouds of rounded rectangles.
- Prefer one strong editorial composition or a two-column story over card-grid wallpaper.
- Use no more than one atmospheric gradient or glow per viewport, never on a button, text, source status, or input.

### 4. Motion law

- **Narrative:** one 10–14 second replayable profile journey; settle on a composed still.
- **System feedback:** 80–150ms for press/focus/selection, 150–250ms for UI state change, 250–450ms for data-driven profile assembly.
- **No movement means no new state.** Do not animate a submission, source lookup, match, approval, or employer decision before the corresponding operation succeeds.
- `prefers-reduced-motion`, data saving, 320px layouts, and no-JS receive a complete static experience.

### 5. Existing homepage rule

The live homepage already pairs a real NPI flow with a labelled illustrative five-beat `WorkSurface`. Do not replace that conversion architecture. Improve it in place:

- keep the real NPI entry immediately visible;
- preserve the existing no-script completed frame, reduced-motion annotation, replay, and truth boundary;
- evolve the scene from a flat operations diagram into the Profile in Motion object language;
- keep the employer outcome separate and unresolved until the employer actually decides;
- update the homepage composition manifest and composition-gate test in the same change.

## Route translation

| Route / surface | Design expression | Must remain primary |
| --- | --- | --- |
| `/` | Profile in Motion hero, paper inverse NPI CTA, five-step WorkSurface, one quiet indigo horizon | NPI entry and truthful explanation |
| NPI result / claim | Data-driven profile assembly; visible source / unknown / clinician-owned layers | Returned facts and error / unavailable state |
| Clinician profile | Persistent small profile object / continuity ribbon at the edge of work | The actual editable profile and next action |
| Jobs / MATCHA | Restrained opportunity field and real filter changes | Search, filters, real role cards, explanation |
| Apply | Choice Gate with a distinct paper approval tray | Explicit consent and request outcome |
| Workbench | Frosted, resizable sidecar; paper note and preview surfaces; stacked panes | Writing, linked context, privacy, and user action |
| Employer marketing | Employer Desk that ends at review; proof-led editorial layout | Employer’s actual role / candidate workflow |
| Trust / Status | Quiet Source Constellation, source cards, observation time and limitations | Accessible source availability and state text |

## Implementation waves for Claude Code

Each wave follows: **Plan → founder gate when noted → smallest scoped implementation → tests → screenshot / recording → security and privacy check → handoff.** Do not run two waves that modify the same route, token file, or shared component in parallel.

### D-00 — Repository, design, and performance baseline

**Goal:** establish facts before changing a living interface.

- Inspect `EasyHome`, `WorkSurface`, `easy-home.css`, `vitalTokens.css`, theme files, `Eyebrow`, current employer pages, and visual regression / composition tests.
- Record existing LCP, CLS, JS/CSS bytes, contrast results, font loads, and top-level route screenshots at 390px, 768px, 1280px, and 1440px.
- Map every existing green / indigo / primary CTA usage that could violate the new color law.
- Add `docs/design/VITALCV_2026_VISUAL_LANGUAGE.md` with the design decision above, a route map, raw-reference attribution, and explicit “inspiration, not imitation” note.

**Gate:** no visible behavior change; baseline evidence and token collision report attached.

### D-01 — Semantic visual token bridge

**Goal:** make the new language implementable without a global theme demolition.

- Add only semantic VitalCV tokens—e.g. `--vt-action-primary-bg`, `--vt-action-primary-fg`, `--vt-scene-canvas`, `--vt-scene-panel`, `--vt-scene-paper`, `--vt-scene-glow`, `--vt-frost-bg`, `--vt-frost-border`—mapped to existing theme values.
- Add light/dark values and WCAG contrast assertions. Preserve existing source / pending / blocked tokens and semantics.
- Define the small shape scale: pill, control, card, panel; do not alter legacy radius aliases until call sites are audited.
- Add token-contract tests or static validation that forbids raw third-party colors in production components.

**Gate:** no global palette replacement; no status color is repurposed as a decorative accent; all existing visual tests remain green.

### D-02 — Shared surface and action primitives

**Goal:** create the reusable components, not a fresh CSS dialect per page.

- Build / refine scoped primitives: `VitalAction` (paper inverse primary), `VitalGhostAction`, `VitalPill`, `VitalFrostPanel`, `VitalSceneFrame`, and `VitalProofRow` using existing component conventions.
- Make each primitive keyboard-visible, responsive, and resistant to nested interactive elements.
- Use hairline borders and translucency for elevation; no heavy shadows or gradient buttons.
- Add a component harness / Storybook-equivalent with normal, hover, focus, disabled, pending, dark, light, and reduced-motion views.

**Gate:** primary action no longer needs green; primitives have accessible names and contrast tests.

### D-03 — VisualScene foundation and asset governance

**Goal:** provide one truthful, accessible runtime for process visuals.

- Implement `VisualScene` and a typed scene manifest with `scene`, `mode`, `state`, `poster`, `transcript`, `alt`, `priority`, and fallback properties.
- Add deferred loading, explicit replay, static fallback, data-save / reduced-motion behavior, fixed aspect ratios, and error handling.
- Introduce asset origin / license metadata, maximum byte budgets, and CI validation for poster + mobile + static variants.
- Start with SVG/CSS/DOM storyboards and static profile-object assets; no heavy 3D library or final video yet.

**Gate:** zero CLS; meaningful scenes have text equivalent; a missing fallback or unlabelled asset fails validation.

### D-04 — Homepage conversion refresh

**Goal:** make the live NPI promise feel more premium without disturbing the actual NPI funnel.

- Refactor `EasyHome` and `easy-home.css` to consume D-01 primitives and the new scene register.
- Convert the NPI primary action from green to warm-paper inverse; reserve green for actual source-confirmed / completed work.
- Add a quiet indigo scene glow behind the profile object only; do not create a full-screen borrowed gradient.
- Preserve the existing NPI validation, bootstrap behavior, real-result paths, no-script form, tracking, and source-freshness footer.
- Update `docs/design/homepage-composition-manifest.md` and its composition gate in the same PR.

**Gate:** a first-time visitor finds and understands the NPI CTA without watching motion; no analytics, API, consent, or matching behavior changes.

### D-05 — Profile in Motion WorkSurface

**Goal:** turn the existing five-beat explainer into VitalCV’s proprietary visual language.

- Rebuild the WorkSurface around the layered profile object, continuity path, source objects, choice gate, opportunity tile, and employer review boundary.
- Preserve the current completed server frame, 10–14 second single play, replay, and reduced-motion annotations.
- Use only abstract / fictional / labelled illustrative material. No fake clinician identity, source result, match score, employer outcome, or dense graph.
- Add visual tests for each beat and truth-contract tests for language / state order.

**Gate:** five-second comprehension test: “VitalCV gathers known facts, the clinician approves sharing, the employer reviews.”

### D-06 — Data-driven record scenes

**Goal:** give real clinician surfaces the same visual DNA without turning data into decoration.

- Implement NPI Reveal and Profile Layers as DOM-driven state transitions using actual returned data.
- Give unknown, unavailable, access-required, self-attested, and source-confirmed states distinct text + icon + layout—not only color.
- Add compact continuity object on clinician home / profile; it must never displace fields, sources, or required next actions.
- Use CSS / DOM state transitions only; no fake source animation or fabricated counters.

**Gate:** error and unknown states are as intentionally designed as the successful result; source status remains semantically truthful.

### D-07 — Jobs and consent experiences

**Goal:** make relevance and control feel intelligent but never magical.

- Add Opportunity Field to jobs / MATCHA as a low-motion contextual layer that reacts only to actual query/filter state.
- Add Choice Gate to Apply with VitalCV: distinct approval tray, selected record facets, and no send motion until endpoint success.
- Add Continuity Ribbon to application timelines only between actual events.
- Stop background motion while a user searches, filters, types, or reviews consent.

**Gate:** keyboard and screen-reader flow remains complete; no scene claims a job matches, a profile is sent, or an outcome happened before real state confirms it.

### D-08 — Workbench spatial visual language

**Goal:** make the Workbench feel like an intentional private place, not a chat panel.

- Apply frosted sidecar / paper-note material language to the authenticated Workbench shell only.
- Make active note, linked context, preview, history, pane stack, and privacy state visibly distinct.
- Implement short geometry transitions for pane open/pin/stack and an equivalent static / list treatment for reduced motion.
- Do not mount this language on public marketing or employer routes; employer notes, if introduced later, are separately scoped.

**Gate:** clinician private notes are visibly and technically private; focus, Escape, Back, resizing, mobile sheet, and unsaved-change protections pass.

### D-09 — Employer, Trust, and Status translation

**Goal:** let the employer side feel serious and modern without becoming a command-center pastiche.

- Implement Employer Desk on employer marketing using real product language: record received, open questions, review boundary.
- Implement Quiet Source Constellation / source cards on Trust and Status; source age, availability, and limitations remain adjacent accessible text.
- Use editorial proof rows and thin dividers instead of card grids where content is mostly explanatory.
- Keep private Workbench references completely absent from employer and trust outputs.

**Gate:** employer visual story ends at employer review; every source visual state has a non-visual equivalent.

### D-10 — Motion, performance, and accessibility hardening

**Goal:** prove that “premium” did not make VitalCV slower or less usable.

- Enforce poster ≤250 KB, a modern moving hero asset target ≤1.5 MB, lazy loading, no background autoplay in data-save mode, and no visual-caused CLS.
- Audit keyboard navigation, focus contrast, text contrast, 44px touch targets, motion reduction, transcripts, image alt text, and 320px/390px layouts.
- Add route-level Lighthouse / Core Web Vitals budgets and screenshot coverage for dark, light, unavailable, loading, error, and reduced-motion states.
- Run security review on any new asset loading, MDX/HTML rendering, or query-state code.

**Gate:** no regression against D-00 performance baseline without founder approval; all critical routes pass accessibility checks.

### D-11 — Pilot rollout and visual system sweep

**Goal:** scale what users understand, not what merely looks expensive.

- Feature-flag homepage and major scene changes; preserve existing homepage variants as controlled rollback paths.
- Capture only privacy-safe interaction metrics: NPI start, CTA completion, replay, scene exposure; never note content or personal profile content for design analytics.
- Run five-second comprehension sessions with clinicians and employer users; test NPI CTA discoverability, ownership clarity, and privacy comprehension.
- Map every major route to a visual role, remove duplicate / legacy visual metaphors, and update the visual language document.

**Gate:** founder walkthrough confirms one coherent product; user evidence confirms visuals improve comprehension and conversion rather than merely attention.

## Required Claude Code handoff per wave

```text
Wave: <ID + name>
Invariant(s) preserved:
Files changed:
Route / component ownership affected:
Schema or API changes: none | exact migration
Tests run and results:
Visual evidence: screenshots / recording paths
Accessibility and performance evidence:
Privacy / provenance review:
Rollback path:
Risks or founder decisions needed:
Next eligible wave:
```

## First task bundle prompt

```text
Read in full:
- VITALCV_2026_DESIGN_IMPLEMENTATION_WAVES_2026-08-09.md
- VITALCV_LIVING_PROFILE_VISUAL_SYSTEM_2026-08-08.md
- VITALCV_WORKBENCH_SPATIAL_KNOWLEDGE_PROGRAM_2026-08-08.md
- VITALCV_CLAUDE_CODE_ACTION_PLAN_VISUAL_WORKBENCH_2026-08-08.md

Execute D-00 only.

Inspect the live homepage and current repository implementation, especially EasyHome,
WorkSurface, easy-home.css, vitalTokens.css, themes, shared Eyebrow, employer routes,
and visual/composition tests. Produce the baseline and
docs/design/VITALCV_2026_VISUAL_LANGUAGE.md. Identify every current use of green as a
primary CTA versus a factual source/completion state. Do not modify product behavior,
copy, token values, visual assets, APIs, schema, or deployment settings. Run the
existing relevant test suite and provide the required wave handoff.
```

## Completion definition

VitalCV has completed this program when a clinician can see—in five seconds and without deciphering a dashboard—that:

1. their professional record begins with known public information;
2. unknowns and ownership remain visible;
3. nothing leaves their profile without consent;
4. a role can receive the chosen record without another blank application; and
5. the career record remains useful after the immediate application.

The interface should feel expensive because it is exact, calm, and humane—not because it is noisy, trendy, or trying to impersonate someone else’s brand.

## Continuation Block

**CURRENT STATE:** The supplied design system, Linear, ElevenLabs, and 2026 trend guidance have been translated into a VitalCV-native design direction: warm graphite public story, warm paper records, indigo only as an editorial visual accent, and factual state colors protected from decorative use.

**NEXT STEPS:** Run D-00, then D-01 and D-02 before changing any homepage, scene, Workbench, or employer UI.

**OPEN QUESTIONS / GAPS:** Confirm the final public register after D-00 screenshots (dark-led vs balanced dark/paper); confirm who will produce final master 3D/video assets after D-05 storyboard proof.

**STRATEGIC CONTEXT:** This plan sharpens VitalCV’s distinct promise—portable clinician identity with visible control—while preventing a fashionable visual overhaul from damaging performance, accessibility, or trust.

**SUGGESTED PROMPT FOR NEXT SESSION:** “Execute D-00 from VITALCV_2026_DESIGN_IMPLEMENTATION_WAVES_2026-08-09.md. Build the design/performance baseline only; make no product behavior or visual changes.”
