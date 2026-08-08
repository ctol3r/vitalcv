# VitalCV Living Profile Visual System

**Purpose:** Make VitalCV feel like an intelligent, living product that is visibly moving a clinician toward their next role—without inventing results, obscuring decisions, or relying on generic healthcare imagery.

**This is a new visual-and-motion track attached to the Billion-Dollar Wave Program.** It does not replace UX-00 through UX-16 or Wave 1077. It supplies the illustration system those waves need.

## The central visual idea: “Profile in Motion”

VitalCV should have one proprietary visual story:

> **A clinician’s profile moves forward. VitalCV completes work around it. The clinician approves what leaves them. The employer decides what happens next.**

The protagonist is never a dashboard, a hospital room, a network graph, an AI blob, or a generic doctor. It is the **VitalCV profile**: a luminous, tactile, vertical professional record with clearly distinct layers of information. It crosses a physical, flowing career path.

The reference image concept created for this track is a useful direction: the profile begins as a simple identity object, becomes richer as sourced information gathers, pauses at a deliberate approval gate, passes through a job opportunity field, and arrives at an employer review space. It uses depth, material, and movement to make the system understandable before any interface copy is read.

## The creative decision

Yes to:

- Original 3D editorial “worlds” and small animated scenes.
- A continuous path that tells the career story from profile creation through reuse.
- Tactile, physically believable materials: frosted resin for what is visible, paper/ceramic for information, machined metal for actions and boundaries, soft light for work completed.
- Slow, confident transformations: information arrives, the profile gains a layer, an approval gate opens only after the clinician acts, a role aligns, an employer receives exactly the selected record.
- A few expressive, friendly forms—almost toy-like in clarity, never childish in tone.
- Scenes that visibly label ownership through object behavior: VitalCV moves and assembles; the clinician pulls/releases/approves; the employer receives/reviews/decides.

No to:

- Stock operating rooms, exam rooms, white-coat teams, or staged clinician photos as product proof.
- A dense “everything is connected” galaxy or data-web as the acquisition metaphor. It reads as technical complexity rather than an easy next move.
- Fake doctor names, fake source responses, fake job matches, fake counters, or fake employer decisions inside the animation.
- Explainer motion that implies VitalCV verifies, clears, hires, privileges, or starts someone automatically.
- One huge autoplay animation pasted on every page. The system must breathe.

## The visual grammar

### 1. The profile object

The profile is the only persistent hero object across the product. It should be recognizable even in silhouette:

- A tall rounded-rectangle pane, but with near-sharp corners and an archival “record” quality rather than a floating SaaS card.
- It is semi-translucent only when representing the clinician’s controlled view. Evidence itself remains solid and legible.
- It has 3–5 visible layers, never a fake wall of text. Layers stand for identity, source-backed facts, clinician-provided information, permissions, and applied-to/employer context.
- Information states use the approved `StateChip` grammar in the real UI; the illustration represents states symbolically, never through unlabelled colors alone.

### 2. The career path

A single continuous path, line, ribbon, or shallow sculptural rail connects scenes. It is not a blockchain, neural network, or subway map. It represents **continuity**: the profile remains with the clinician as their career moves.

The five permanent story beats are:

1. **Identify** — enter NPI; VitalCV begins with public professional information.
2. **Build** — known facts arrive; unknowns remain visibly open.
3. **Choose** — the clinician controls what can be shared.
4. **Apply** — a role receives a selected profile, not another blank form.
5. **Carry forward** — the profile stays useful for the next opportunity.

The employer-review scene is a bridge between 4 and 5, not a sixth “success” beat. It must stop at employer review unless a real, later state authorizes more.

### 3. Four ownership cues

Every scene must communicate these without forcing a user to learn system vocabulary:

| Owner | Motion behavior | Real UI copy style |
| --- | --- | --- |
| VitalCV handles | Small source objects arrive, organize, and settle into the profile | “VitalCV found these professional details.” |
| Needs your approval | A clear gate/handle/selection tray waits without pulsing or nagging | “Choose what to share.” |
| Needs you | One open slot or tool points to the human action still required | “Add your preferred location.” |
| Employer decides | A separated review desk receives the profile but does not light green or resolve itself | “The employer reviews your application.” |

### 4. Motion behavior

The animation must feel like a carefully designed product film, not a looping ad:

- **Hero narrative:** one 10–14 second single-play journey, then settle on a finished still. Offer Replay. Never force users to wait for it.
- **Product transformation:** 250–450ms. Profile assembles, record passes into a selected state, a role becomes relevant after a real input.
- **Control feedback:** 80–150ms. Hover, press, focus, selection.
- **State transition:** 150–250ms. Facts refresh, a request arrives, an application is shared.
- **Rare narrative:** 450–800ms only for an intentional scene change.
- **No perpetual motion** except a loading skeleton, a small system-status pulse, or a clearly running source check. The hero never loops once it has finished.
- **Reduced motion:** show the fully composed scene plus step controls; nothing necessary lives only in movement.

## A family of visual assets, not one repeated animation

The design system needs eight composable assets. They share profile object, materials, lighting, camera angle, and color meaning—but not the same composition.

| Asset | What it shows | Where it belongs | Motion treatment |
| --- | --- | --- | --- |
| **A. The Journey Film** | All five beats as a flowing 3D world | Homepage, top-level “How it works” | 10–14s single-play; static final state and Replay |
| **B. NPI Reveal** | One quiet profile assembling from named, real source results | NPI entry/resolution, profile preview | Real-data-driven 250–450ms assembly; no fabricated item count |
| **C. Profile Layers** | What came from a source, what clinician added, and what remains open | Claim, profile completion, Trust explanation | Progressive layers; user-triggered expansion only |
| **D. Choice Gate** | Profile enters a selection tray and pauses for the clinician | Apply, sharing permissions | No autonomous travel beyond the approval point |
| **E. Opportunity Field** | A selected role comes into focus from a restrained field of role tiles | Jobs, match explanations, saved jobs | Only actual role cards appear; ranking updates are driven by real inputs |
| **F. Employer Desk** | A receiving desk with a review tray, open questions, and a decision boundary | Employers, candidate inbox, pilot sales | Cards arrive only after a real share; no celebratory “hired” ending |
| **G. Continuity Ribbon** | A profile traveling from one opportunity node to another without restarting | Reuse, referrals, lifecycle messaging | A short 2–3s transition, used sparingly |
| **H. Quiet Source Constellation** | A sparse, orderly set of source objects—not a galaxy—each linked to a fact | Trust Center, Status, empty/unknown states | Static by default; small source-read pulse only during actual checks |

## Page-by-page integration plan

“Every page gets a visual” means every important page participates in the language. It does **not** mean every page opens with the same 3D animation or wastes the clinician’s attention.

| Surface | Visual role | Exact component | Guardrail |
| --- | --- | --- | --- |
| `/` Homepage | Make the whole promise obvious in five seconds | Asset A, the Journey Film, beside the NPI action | The real NPI input is always visible and immediately usable; the scene cannot be mistaken for live results. |
| NPI input / preview | Make “VitalCV already did work” emotionally clear | Asset B, NPI Reveal, composed from returned data | On error/unavailable, show a dignified static unknown state—not a broken/empty 3D scene. |
| Claim | Explain why a claim is required | Asset C, Profile Layers, tightly cropped | Never imply identity proof is finished before it is. |
| Profile / clinician home | Make next action and profile continuity feel alive | Small persistent profile object + a compact continuity ribbon | No large hero animation above actionable work. |
| Preferences / MATCHA | Show answers affecting the role field | Asset E, Opportunity Field | Only animate the criterion that actually changes matching; label non-engine-backed preferences. |
| Jobs | Make relevance readable, not magical | Compact role-field background or 2D/3D hybrid empty state | Job cards remain primary; motion stops while filter/search is in use. |
| Apply with VitalCV | Make clinician control unmistakable | Asset D, Choice Gate + selected profile tray | There is no “send” motion until the share endpoint succeeds. |
| Application timeline | Humanize waiting without hiding status | Asset G, Continuity Ribbon between real events | No motion equals no new state; notifications only on material change. |
| Employers landing | Show a hire moving from interest to review—not a credentialing factory | Asset F, Employer Desk | Lead with outcome, then show the boundary: employer decides. |
| Employer roles/candidates/starts | Make work progression spatially intelligible | Smaller table-edge/side-panel visual cues, not a hero film | Operational data remains denser than decorative art. |
| Trust / source register | Make source limits legible and reassuring | Asset H, Quiet Source Constellation | Each source has real current availability, source, and age in accessible text. |
| Status | Explain service state gently | Miniaturized Asset H | No animation when the service has no live state to report. |
| Empty/error/success | Give dignity to non-happy paths | 2D cropped objects from the relevant scene | No confetti, green glow, or faux certainty. |

## Technical implementation stance

Do not ship literal GIFs as the foundation. They are heavy, inaccessible, difficult to pause, and cannot respond truthfully to live state. Use the right format for the job.

| Need | Recommended implementation | Why |
| --- | --- | --- |
| Hero art direction / cinematic movement | First build as deterministic 3D master scenes; serve an optimized muted MP4/WebM/AV1 or image sequence with poster image | Highest visual fidelity without making the homepage depend on a GPU or live canvas. |
| Interactive small scenes | Rive for stateful vector/object animation, or a lightweight Canvas/React renderer only where Rive cannot express the needed state | Supports real UI-state inputs, pause/replay, and reduced motion. |
| Data-driven profile assembly | DOM/CSS/Framer-style transitions using actual app records | Screen-reader-friendly, inspectable, source-aware, and cannot accidentally display fake data. |
| Simple icons/empty states | SVG or CSS illustration primitives | Sharp, fast, themable, accessible. |
| 3D-in-product only when essential | Progressive enhancement behind a capability check and static fallback | No clinician should need a modern GPU to apply for a job. |

### Asset pipeline

1. **Storyboards first:** five-second thumbnails and a beat sheet before expensive 3D work.
2. **Master scenes:** create original 3D scenes in one source format (Blender/Cinema 4D/Spline is a creative decision; do not mix three tools per asset).
3. **Export tiers:** poster AVIF/WebP; desktop motion WebM/MP4; mobile cropped render; reduced-motion static composition; alt text/transcript.
4. **Integration:** a single `VisualScene` component accepts `scene`, `mode`, `state`, and `reducedMotion`. It owns intersection playback, Replay, fallback, pause, and asset preloading.
5. **Verification:** performance budgets, no layout shift, no source/claim semantic leakage into artwork, and screenshots/videos captured in the existing visual regression harness.

### Performance and accessibility budget

- Homepage hero poster ≤250 KB when motion is off or deferred; desktop hero moving asset target ≤1.5 MB per modern format after compression. Measure, do not assume.
- Never auto-play motion over cellular data-saving mode; use poster + explicit play/replay.
- Respect `prefers-reduced-motion`; use static storyboard state plus visible step controls.
- All scenes have short alt text and an adjacent textual equivalent of the process. Decorative crops have empty alt text; meaningful process scenes do not.
- Maintain AA contrast independent of the image; no body copy printed inside images.
- No visual is required to complete an action, interpret a legal/consent state, understand source limitation, or know an employer decision.

## Reference takeaways

Use the competitors for principles, never imitation:

- **Abridge:** its strongest pattern is an end-to-end workflow narrative—before, during, and after a clinical encounter—rather than a feature dump. VitalCV should use the same narrative discipline for career movement. [Abridge clinician platform](https://www.abridge.com/platform/clinicians)
- **Medallion:** it makes operational complexity legible as provider workflows and business outcomes. VitalCV should match that seriousness while retaining the clinician—not the institution—as its protagonist. [Medallion provider operations](https://www.medallion.co/who-we-serve/provider-groups)
- **Palantir:** borrow the conviction that an operational system should make state, ownership, and action clear; do not borrow command-center visual density for a clinician acquisition flow. [Palantir for hospitals](https://www.palantir.com/offerings/palantir-for-hospitals/)
- **World/cheqd/Truvera-style identity references:** borrow the feeling that identity is portable and user-controlled; do not lead with blockchain, cryptography, or network-map symbolism.

## New dedicated visual track: VIS-01 through VIS-12

These waves run after the Train 1 production convergence gate and after UX-01 locks the brand direction. They may run alongside non-overlapping clinician/employer waves, but never alter the same page in parallel.

| Wave | Goal | Deliverable and founder gate |
| --- | --- | --- |
| **VIS-01 — Visual Narrative Constitution** | Add “Profile in Motion” to the Experience Constitution: profile object, path, ownership cues, asset rules, exclusions, color semantics, motion policy. | Founder approves one page of rules and references; no scene production before this. |
| **VIS-02 — Five-Beat Storyboard Lab** | Produce 3 storyboards of the Journey Film: dark/operational, light/editorial, and hybrid—using the already approved UX-01 direction as the palette/type authority. | Founder selects one shot list; every beat passes the truth test. |
| **VIS-03 — Profile Object Design Kit** | Create a reusable static 3D/2D profile object and 10 crop rules, with source/self-provided/permission/review variants. | Design system review proves it can appear on every important surface without repetition. |
| **VIS-04 — Hero Journey Film Prototype** | Build one 10–14s real, original hero film with poster, replay, mobile crop, reduced-motion composition, and text transcript. | Five-second comprehension test; Lighthouse/performance budget and founder GO. |
| **VIS-05 — `VisualScene` Runtime** | Implement the shared component, asset manifest, capability detection, intersections, pause/replay, fallback, and test harness. | No CLS; no auto-playing in reduced/data-saving conditions; unit and visual tests pass. |
| **VIS-06 — Homepage Integration** | Deploy the hero only after the profile-first message and real NPI action remain unmistakably primary. | Cold user can recount the five-step flow and finds NPI CTA without watching the film. |
| **VIS-07 — NPI Reveal + Claim Scenes** | Build data-driven profile assembly and the cropped claim/layer object. | Uses returned facts only; errors/unknowns are as deliberate as success. |
| **VIS-08 — Jobs + Apply Scenes** | Build Opportunity Field and Choice Gate with real role/apply states. | No fabricated role/match/submit result; application consent flow remains keyboard and screen-reader complete. |
| **VIS-09 — Employer + Trust Scenes** | Build Employer Desk and Quiet Source Constellation for employer acquisition, candidate review, Trust, and Status. | Every status in the visual has textual source/age/limitation adjacent to it. |
| **VIS-10 — Mobile Story Composition** | Design the visual system as a vertical sequence for 390px, not a cropped desktop diorama. | Phone test: scenes clarify, never obstruct tasks; network budget met. |
| **VIS-11 — Asset Governance + Visual QA** | Add CI manifest checks, responsive screenshots, motion/reduced-motion captures, license/origin metadata, and performance budgets. | A deliberately oversized, unlabeled, or no-fallback asset fails CI. |
| **VIS-12 — Whole-Product Art Direction Sweep** | Map every important route to one role in the visual system and remove unapproved stock/legacy visual metaphors. | Founder walkthrough confirms the product feels singular across public, clinician, employer, and trust surfaces. |

## First Claude Code prompt

```md
Implement VIS-01 — Visual Narrative Constitution from
VITALCV_LIVING_PROFILE_VISUAL_SYSTEM_2026-08-08.md.

This is a design-only documentation and design-lab wave. Do not change application
logic, source behavior, consent, authorization, matching, or employer decisions.
Read the Experience Constitution, UX-01 decision material, and the Profile in Motion
visual system. Add the binding rules for the profile object, five-beat path, four
ownership cues, asset formats, no-go list, accessibility, and performance budgets.
Then create a reviewable VIS-02 storyboard brief—not production motion assets.
Capture existing evidence and end with a founder decision packet.
```

## Completion Board baseline

| Area | Current completion | Completion condition |
| --- | ---: | --- |
| Visual narrative definition | 35% | One founder-approved story and strict truth/motion rules |
| Original illustration system | 10% | Reusable asset family, not one hero image |
| Homepage process explainer | 15% | Original film + real CTA + accessible fallback |
| In-product motion | 20% | State-driven, restrained, data/truth-aware interactions |
| Page-by-page visual coherence | 12% | Every core surface has an intentional visual role |
| Performance/accessibility motion safety | 30% | Budgets, fallbacks, tests, and reduced-motion composition enforced |

## Continuation Block

**CURRENT STATE:** VitalCV has the intellectual parts of an exceptional experience but lacks a proprietary visual language. “Profile in Motion” is now the recommended system: a clinician-controlled profile travels through known information, consent, jobs, employer review, and reuse.

**NEXT STEPS:** Finish W1078 deploy truth; complete UX-01’s visual-direction verdict; then run VIS-01 and VIS-02 before building the hero film.

**OPEN QUESTIONS / GAPS:** Which UX-01 direction is final? Does the founder want the generated 3D concept to become the dark/hybrid reference, or should the board explore a light editorial counterpart first? Who will produce master 3D scenes after the prototype is approved?

**STRATEGIC CONTEXT:** The visual system turns VitalCV’s invisible advantage—continuity, control, and work completed—into an instantly understood product story. It should increase first-session comprehension and help clinicians remember the asset they carry forward.

**SUGGESTED PROMPT FOR NEXT SESSION:** “Run VIS-01 for VitalCV. Add the Profile in Motion rules to the Experience Constitution, then create three five-beat storyboard options that honor the approved UX-01 direction and never show fake clinician data or implied employer outcomes.”
