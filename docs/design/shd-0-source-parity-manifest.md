# SHD-0.2 — Shaders Landing Page source-parity manifest (100% accounted)

**Date:** 2026-07-18
**Source of truth:** actual template source, inspected from a public v0 export (`SELO77/v0-shaders-landing-page`, verified byte-consistent with the live template demo at `v0.app/templates/shaders-landing-page-R3n0gnvYFbO`; hero verified against the rendered demo in a real browser). The template is ~1,180 lines: `app/page.tsx` (318), 4 section components, 3 interaction primitives, 1 hook, `globals.css`.

**Statuses:** `port` (behavioral parity, re-skinned), `adapt` (role preserved, VitalCV semantics), `substitute` (source behavior conflicts with accessibility/truth/perf — replaced by an equivalent that preserves the role), `n/a` (source-brand content only).

## 1. Master architecture (what the template actually is)

- **One fixed full-viewport shader background** for the whole page: `<Shader>` with two stacked layers — `Swirl` (colorA `#1275d8` blue, colorB `#e19136` amber, speed 0.8) + pointer-reactive `ChromaFlow` (momentum 25, alpha mask — the cursor leaves flowing color wakes). A `bg-black/20` scrim guarantees text contrast. Package: **`shaders` (shaders.com) v3 — npm metadata declares NO license; treat as non-importable.**
- **A native horizontal rail**: `flex h-screen overflow-x-auto` with five `w-screen shrink-0 snap-start` sections. Vertical wheel is translated to horizontal `scrollBy({left: e.deltaY, behavior:'instant'})`; touch uses ±50 px vertical-swipe section stepping; programmatic jumps use smooth `scrollTo`. Chapter index = `round(scrollLeft/width)` on a rAF-throttled scroll listener.
- **Load gate**: poll the shader canvas every 100 ms until it has size, 1.5 s hard fallback → everything fades in over 700 ms. Content is never blocked on the shader succeeding.
- **Three global primitives**: dual-ring lerp custom cursor (`mix-blend-difference`, global `cursor: none`), SVG-turbulence grain overlay (8% opacity, blend overlay), magnetic buttons (rAF translate toward pointer ×0.15, 3 variants).
- **Reveal grammar**: per-section one-shot IntersectionObserver (`useReveal`, threshold 0.3) driving direction-varied slide+fade (left/right/top/bottom, 700 ms, 150 ms stagger); hero uses tailwind `animate-in` with 0/200/300/500 ms delays.

## 2. Element-by-element parity manifest (source order)

| # | Source element | Exact source behavior | VitalCV counterpart | Fallback | Status |
|---|---|---|---|---|---|
| 1 | `Shader`+`Swirl` background | Full-viewport animated color field, blue↔amber | Career-evidence atmosphere in VitalCV palette (paper/ink base, provenance emerald, evidence indigo, bounded amber) behind the rail | Static gradient poster; reduced-motion = no loop | **substitute** (license: re-implement — own GLSL/canvas or licensed lib; never text-on-unstable region without scrim) |
| 2 | `ChromaFlow` pointer wake | Cursor movement paints directional color flow (momentum 25) | Pointer-reactive evidence shimmer, bounded amplitude | Disabled on coarse pointer/reduced motion | **substitute** (same role, own implementation) |
| 3 | `bg-black/20` scrim | Constant contrast layer over shader | Same — scrim token guaranteeing AA over every scene state | Always present | **port** |
| 4 | Load gate (canvas poll + 1.5 s fallback + 700 ms fade) | Content never blocked on GPU | `SceneProvider` capability layer (SHD-1.1) with identical never-block guarantee | SSR content visible pre-hydration (improves on source: source hides content until gate) | **adapt** |
| 5 | Fixed nav: logo → section 0 | Logo click returns to hero | VitalCV wordmark → chapter 0 | Plain anchor | **port** |
| 6 | Nav items Home/Work/Services/About/Contact with animated underline + current state | `scrollToSection(i)`, underline grows on hover/current | Global header stays site-level (per AUD-1.2 one-navigator rule); **chapter** nav lives in the right-edge dot rail with the same current-state/hover-label affordance | Hash links `#wallet #evidence #matcha #apply #employers` in DOM order | **adapt** (nav split: site nav ≠ chapter nav; underline treatment ports to rail labels) |
| 7 | `MagneticButton` Get Started → contact | Magnetic pull ×0.15, spring back, glass/solid variants | Same primitive for `Check Readiness` and chapter CTAs | Plain button on coarse pointer/reduced motion | **port** |
| 8 | Horizontal rail wheel translation | `preventDefault` + horizontal scrollBy; instant behavior | Same driver, plus: PageUp/Down + arrow keys + Home/End, never trap Tab, bounded entry/exit so page scroll resumes at rail ends | Vertical DOM order on mobile/reduced-motion/no-JS (same content) | **adapt** (source has NO keyboard path — accessibility gap fixed in port) |
| 9 | Touch swipe stepping (±50 px) | Vertical swipe steps sections; `touchmove` preventDefault | Not used: mobile renders vertical document flow (VHS-2 contract) | — | **substitute** (mobile = vertical; horizontal-on-touch conflicts with the bundles' mobile contract) |
| 10 | Scroll-snap `snap-start` + smooth programmatic jumps | Sections settle cleanly | Same snap grammar in the rail | Native vertical scroll | **port** |
| 11 | Chapter index model (rAF-throttled) | `round(scrollLeft/width)` drives nav state | Chapter progress `0→1` model (SHD-1.3.3) driving rail dots, scene state, and hash | — | **adapt** (extends index → continuous progress) |
| 12 | Hero: badge pill "WebGL Powered Design" | Frosted mono-font pill | "Source-backed career evidence" eyebrow pill (truthful; no tech-brag claim) | Static | **adapt** |
| 13 | Hero: 3-line display H1 6xl→8xl font-light | "Creative experiences in fluid motion" | Existing H1 "Find the opportunity. Prove your career once. Start faster." at source scale | Static | **adapt** (copy is VitalCV's; scale/weight grammar ports) |
| 14 | Hero: subhead + dual CTAs (primary/secondary magnetic) | — | NPI form is PRIMARY (form-first, never displaced); secondary quiet employer entry "For employers: start review from evidence" | Form works pre-hydration | **adapt** (conversion contract overrides source CTA pair) |
| 15 | Hero: "Scroll to explore" + pulse pill | Bottom-center indicator | Same affordance labeled for the chapter rail; also keyboard hint | Hidden in vertical fallback | **port** |
| 16 | Hero entry stagger (0/200/300/500 ms animate-in) | Fade+slide-from-bottom cascade | Same stagger grammar on chapter 0 | Reduced motion: content final, no animation | **port** |
| 17 | Work section: "Featured / Recent explorations" header + slide-in from left | H2 5xl→7xl + mono slash-caption | Evidence chapter: "Evidence / What the sources say" grammar | Static | **adapt** |
| 18 | Work: 3 alternating project rows (number/title/category/year), alternating margins 85%/90%, hover title translate-x, staggered direction reveals | Editorial list, not cards | Evidence rows: named lanes (NPPES / OIG-LEIE / PECOS / state-license access-gated) with REAL lane states in place of year; same alternation + hover grammar; state copy contract preserved | Static list | **adapt** |
| 19 | Services: "Capabilities / What we bring" 2×2 grid, per-card direction reveals (top/right/left/bottom), line-grow hover, numbered 01–04 | 4 capability cards | Opportunity/MATCHA chapter: 4 real capability cards (Wallet, Readiness, MATCHA reasoning, Proof packet) in the same grid+reveal grammar | Static grid | **adapt** |
| 20 | About: split story + big-numeral stats (150+/8/12) alternating border-left rows + 2 CTAs | Fabricated agency stats | Recognition chapter: employer head-start story; NO fabricated numbers — real source-coverage counts or illustrative-labeled figures only (truth contract) | Static | **substitute** (stat values; layout grammar ports) |
| 21 | Contact: "Let's talk" split — email/location/socials left, minimal underline-input form right (name/email/message), staggered slide-ins, magnetic submit, fake 1.5 s submit + success line | Conversion culmination | Start/Reuse chapter: dual conversion — clinician NPI action (real, existing state machine) + employer review/pilot route (real destinations). NO fake form submit; existing contact/pilot routes | Form-first, works without JS | **substitute** (fake submit → real actions; composition grammar ports) |
| 22 | `CustomCursor` dual-ring lerp (0.15), scale 1.5/0.5 over interactive, `mix-blend-difference`, global `cursor:none` | Cursor replaced everywhere | Port ONLY as fine-pointer progressive enhancement; never `cursor:none` globally (a11y/`prefers-reduced-motion`/coarse-pointer exempt); native cursor in form fields | Native cursor | **adapt** |
| 23 | `GrainOverlay` SVG feTurbulence 8% overlay | Full-page grain | Port at VitalCV opacity over scene chapters only | None (decorative) | **port** |
| 24 | `useReveal` one-shot IO (0.3) | Per-section reveal state | Replaced by chapter-progress-driven reveals (single owner; no stray IO listeners) | Content visible by default | **adapt** |
| 25 | Dark theme (oklch 0.12 bg / 0.98 fg), Geist + Geist Mono, radius 0.75rem | Template tokens | VitalCV Calm Wave tokens (paper/ink, Fraunces/Geist, `.mz` layer) — no new font package | — | **substitute** (tokens; type-scale grammar ports) |
| 26 | `contain: strict/layout style paint`, `translateZ(0)`, rAF throttling | Perf hygiene | Port same hygiene into scene runtime | — | **port** |
| 27 | Acme brand, template copy, social links, `hello@studio.com`, v0 badge/CTA, Vercel Analytics | Source-brand content | VitalCV content; PostHog (existing) | — | **n/a** (explicitly excluded) |
| 28 | Hidden scrollbar (`scrollbar-width:none`) | Rail chrome | Same on rail; document scrollbar untouched | — | **port** |

**Unowned features: none.** Rows 1–28 cover every file in the template source (`page.tsx`, 4 sections, 3 primitives, 1 hook, layout, globals).

### Source accessibility gaps the port must fix (not inherit)
1. No keyboard path through chapters (wheel-only). 2. Global `cursor:none` unconditionally. 3. No `prefers-reduced-motion` branch anywhere. 4. Fake form submit. 5. Content hidden until load-gate flips (SSR shows nothing). 6. No deep links/hashes. Each is marked `adapt`/`substitute` above with the correcting behavior.

## 3. Companion templates (roles fixed by the master tasklist)

| Template | Role | Inventory basis | VitalCV destination |
|---|---|---|---|
| WebGPU Graphene 3D Model | Hero replacement | Render inspection pending (v0 preview requires interactive session; the VHS-1 bundle already records it failing WebGL init in automated environments — reinforces fallback-first architecture) | `CareerEvidenceField` v2: WebGPU material/depth language bound to identity/source/opportunity/acceptance semantics; current 2D canvas field demoted to fallback tier (SHD-2.1) |
| Optimus AI platform | Product-system composition | Prior bundle inventory (VHS-1 §2) + template page | Chapter card grammar: claim / state / source / what-it-does-not-decide / next action; bold hierarchy; CTA architecture (SHD-4.1) |
| Liquid Menu | Mobile navigation | Prior bundle inventory (VHS-1 §5) | Mobile header menu with fluid expansion; reduced-motion = standard disclosure (SHD-5.1) |

## 4. Dependency & license decisions

| Dependency | Verdict |
|---|---|
| `shaders` (shaders.com) v3 | **Do not adopt.** npm metadata declares no license; commercial platform. Re-implement the two needed effects (ambient flow field + pointer wake) as original GLSL/Canvas in `components/home/evidence-field/` per VHS-1 runtime ladder. |
| `tw-animate-css` | Not needed — repo already has equivalent motion CSS. |
| GSAP + ScrollTrigger (tasklist recommendation) | **Not required for parity.** The source achieves the rail with native scroll + snap + wheel translation (~120 lines, zero deps). Recommendation: keep the native driver; add GSAP only if the Rolodex (SHD-3.2) needs it. |
| Geist fonts | Already in repo. |

## 5. Build plan — Waves 1–3

1. **SHD-1.1 SceneProvider** (capability detect: WebGPU/WebGL/reduced-motion/coarse/visibility; debug hook for tests) + shader-scene boundary with poster fallback. The template's load-gate pattern, made SSR-honest.
2. **SHD-1.2 visual primitives**: scrim, grain, magnetic button, fine-pointer cursor, scene registry; VitalCV palette.
3. **SHD-1.3 chapter-progress model**: one `0→1` driver (native rail scroll) feeding dot rail, scene params, reveals, hash; forward/reverse parity tests.
4. **SHD-2.x hero**: Graphene-language evidence field over `SceneProvider`; NPI form-first contract preserved; employer secondary entry.
5. **SHD-3.x rail + Rolodex**: port the source rail driver with keyboard + skip-story + vertical fallback; rebuild `StickyProductStory` as `CareerRolodex` inside chapter flow.
Existing test contracts that must stay green throughout: `homepage-motion.spec.ts` (22), `home-npi-role-doors`, `homepage-truth-pass`, `check-public-claims`, route-inventory count.
