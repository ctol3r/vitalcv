# VitalCV Design — God-Mode Master Task List

> **Version:** 2026-07-11 · **Owner:** Founder · **Executor:** Claude (design waves)
> **Scope:** All public + product surfaces of `apps/web` (vitalcv.com), marketing seam, ops surfaces
> **Sources:** Live vitalcv.com audit (2026-07-11), `apps/web/styles/*`, `apps/web/components/*`, `CURRENT_STATE_2026-07.md`, `design-handoff/claude-design-2026-06-26`, zenlike doctrine (matcha-zen.css)
> **Doctrine:** Paper + ink, calm single-shot motion, source honesty, Antigravity contract, no demo theater. Every task below must respect copy prohibitions in CLAUDE.md §16.

---

## 0. Current-State Design Snapshot (ground truth)

**Live look & feel (vitalcv.com):**
- Light "paper + ink" editorial surface. Warm paper (`#E4E3E0` theme bridge / `#f4f2ec` mz layer), near-black ink `#141414`, brutalist rules, no gradients on the new surfaces.
- Editorial serif display with *italic* accent words ("Start faster.", "follows you", "tells you what to do next") — Fraunces by doctrine, indigo `#4f46e5` italic accent in mz layer.
- Deep matcha green `#2C3E2D` is the meta theme-color; MATCHA is the named intelligence layer.
- Hero = NPI-first input (0/10 digits, no account), wallet mock with 72% readiness ring, source rows showing honest states (NPPES source-backed · OIG/LEIE checked · PECOS gated).
- Signature interactive moments: "Try MATCHA" chip-tap demo, career **constellation** (drag-rotate sky + Began/Now/Headed slider), 5-step how-it-works, by-role 4-door section.
- /trust = Trust State Register: T1–T4 proof-tier vocabulary, three state planes (Anonymous Preview / Owned Snapshot / Signed Institutional Artifact), dashed-border degraded semantics, machine-readable endpoints table.
- /pilot = employer page with metric strip, limitation-honesty list, plain form.

**Design system in repo:**
- **Token layers (overlapping, partially conflicting):** `design-tokens.css` (type/spacing/z/blur/radius scales) · `vitalTokens.css` (`--vt-*` oklch, Trust Blue brand, glass + ops-gradient tokens, Waves 174–177) · `styles/themes/index.css` (ACTIVE theme bridge — brutalist ink-on-paper + semantic state palette) · `matcha-zen.css` (`.mz`-scoped paper/ink/truth-state/indigo doctrine) · plus `tokens.css`, `vds.css`, `blueprint-overrides.css`, `visual-qa.css`, `graph-foundry.css`, `trust-register.css`, `intelligence.css`, `antigravity.css`.
- **Accent conflict:** brand primary is simultaneously Trust Blue `oklch(0.55 0.20 255)` (vitalTokens), ink `#141414` (theme bridge), indigo `#4f46e5` (mz accent), teal `#0a7b7f` (matcha-lift fallback), matcha green `#2C3E2D` (meta). No single canonical accent.
- **Typography:** doctrine = Fraunces (serif display) / Geist (body) / Geist Mono (eyebrows, tokens, data). **Reality: `layout.tsx` maps every font variable to system stacks — no web fonts are actually loaded.** The live site renders system-ui, not the intended editorial voice.
- **Icons:** `lucide-react ^0.454`, used unevenly; no custom trust-state glyph set.
- **Motion:** framer-motion v12 imported in ~138 files; 40+ CSS `@keyframes` in `globals.css` (vcv-*, trust-*, crs-*, shimmer, marquee, node-breathe, glow-breathe, critical-pulse…); house curve `cubic-bezier(0.2, 0.8, 0.2, 1)`; **global `*` color transition (280ms) applied to every element** — perf + correctness hazard. Zen doctrine says: 320ms, single-shot, no loops, no gradients — many keyframes violate it.
- **Components:** 60+ component directories; `components/ui/` mixes shadcn primitives (button, card, badge, accordion) with bespoke demo-era pieces (MagneticButton, CursorPhysics, SpotlightCard, AntigravityHero, BackgroundField, bento-grid). Multiple badge/status implementations (BadgeStatus, StatusBadge, claim-badge, badge).
- **Known weak surfaces (CURRENT_STATE 2026-07-08):** `/review/request` sparse + left-heavy; `/get-ready` SSR-flashes "Checking your workspace…"; `apps/marketing` is a separate visual system (seam); `/status`, legal pages, sign-in barely designed.

**Design north star:** one calm, honest, editorial paper-and-ink system — Fraunces × Geist × Geist Mono, ink primary + one deliberate accent, truth-state chips as the atomic visual unit, single-shot 320ms motion, dark "ops" mode reserved for operator surfaces. Recognition → Acceptance → Start must be legible in the visuals, not just the copy.

---

## Legend

- **P0** ship-blocking / trust-damaging · **P1** this wave · **P2** next wave · **P3** polish backlog
- **Effort:** S (<1h) · M (1–4h) · L (day+)
- Every task = checkbox + acceptance criteria (AC). IDs are stable — reference them in commits (`design(DG-2.1): …`).
- Rules for the executor: never violate copy prohibitions (§16 CLAUDE.md); never invent source claims; `pnpm check:claims` + `pnpm lint` + `pnpm tsc --noEmit` must pass after every wave; screenshot before/after for each page-level task.

---

# PHASE 1 — FOUNDATION: ONE DESIGN SYSTEM

## 1. Token Unification (kill the five-way palette conflict)

- [ ] **DG-1.1 (P0/M)** Declare the canonical palette in one file: `styles/themes/index.css` becomes the single source of truth. Paper `#E4E3E0→#f4f2ec` scale, ink `#141414` + full mz ink-50…950 scale, ONE accent (decide: matcha deep green `#2C3E2D` family for brand moments + indigo `#4f46e5` reserved for italic editorial accents only), semantic truth states (ok/watch/unknown/p0 from mz + `--vt-state-*` lane palette). AC: a written token spec table at top of file; every color has a name, role, and usage rule.
- [ ] **DG-1.2 (P0/M)** Re-point `--vt-color-brand-primary` (currently Trust Blue oklch) at the canonical accent; grep all consumers and verify nothing visually regresses to blue on paper surfaces. AC: zero remaining Trust Blue renders on public pages.
- [ ] **DG-1.3 (P0/M)** Merge `tokens.css`, `design-tokens.css`, `vitalTokens.css` into a layered structure: `01-primitives.css` (raw scales) → `02-semantic.css` (`--vt-*` roles) → `03-themes.css` (light/dark/ops). Delete duplicates. AC: import order in `globals.css` shrinks; no token defined twice.
- [ ] **DG-1.4 (P1/M)** Promote the `.mz` (matcha-zen) tokens from scoped-class to global semantic tokens so the zen doctrine can govern ALL public surfaces, not just MATCHA. Keep `.mz` as a thin alias layer for backward compat. AC: home, pilot, trust can consume `--paper/--ink-*/--ok/--watch` without `.mz` wrapper.
- [ ] **DG-1.5 (P1/S)** Deprecate `blueprint-overrides.css` and `visual-qa.css` — fold what's still needed into the semantic layer, delete the rest. AC: files removed from `globals.css` imports.
- [ ] **DG-1.6 (P1/S)** Audit `vds.css`, `graph.css`, `graph-foundry.css`, `intelligence.css`, `trust-register.css` for hardcoded hex values; replace with tokens. AC: `grep -E '#[0-9a-fA-F]{3,8}' styles/*.css` returns only the theme files.
- [ ] **DG-1.7 (P2/S)** Document dark/ops token mapping: `--vt-surface-ops-*`, ops gradient stops, glass tokens — mark them OPS-ONLY. AC: comment header + lint note; no ops token used on a public marketing surface.
- [ ] **DG-1.8 (P2/S)** Add a `pnpm check:tokens` script (simple grep-based) that fails CI on new hardcoded hex/oklch outside theme files. AC: script exists, runs in CI, passes.
- [ ] **DG-1.9 (P2/S)** Radius doctrine: near-sharp on zen/public surfaces (2–6px), `--radius-2xl` glass cards restricted to ops. Normalize `--radius-*` vs `--vt-radius-*` (currently duplicated). AC: one radius scale.
- [ ] **DG-1.10 (P3/S)** Shadow doctrine: paper surfaces use rules/borders not shadows; allow one hover-lift shadow (matcha-lift). Remove ambient glows (`--vt-glow-*`) from public surfaces. AC: documented, enforced by grep.

## 2. Typography (make the doctrine real — the site currently renders system fonts)

- [ ] **DG-2.1 (P0/M)** Actually load the fonts. Add `next/font` (self-hosted) for **Fraunces** (display serif, opsz axis, italic), **Geist** (body), **Geist Mono** (eyebrows/tokens/data) in `apps/web/app/layout.tsx`; wire the existing CSS variables (`--font-fraunces`, `--font-geist`, `--font-geist-mono`, `--vt-font-body`, `--vt-font-display`) to the real font objects instead of system stacks. AC: computed font-family on h1 = Fraunces; body = Geist; zero layout-shift regression (use `adjustFontFallback`).
- [ ] **DG-2.2 (P0/S)** Remove the `eslint-disable no-page-custom-font` workaround and any `<link>` font loads; everything through next/font. AC: no external font requests in network tab.
- [ ] **DG-2.3 (P1/S)** Verify `typography.css` scale (`heading-xl/lg/md/sm`, `body-lg/base/sm`, `label`, `tag`, `metric-xl/lg`, `code`) resolves correctly post-font-load; fix any weight/optical-size mismatches (Fraunces needs explicit `font-optical-sizing`). AC: visual pass on all type classes in a test page.
- [ ] **DG-2.4 (P1/S)** Codify the **italic accent rule**: italic Fraunces + indigo accent for at most ONE phrase per section headline. Document in `docs/design/typography.md`. AC: doc exists; home page conforms.
- [ ] **DG-2.5 (P1/S)** Codify the **mono eyebrow rule**: section eyebrows ("The intelligence layer", "Who buys in", "RUN_ID", timestamps, NPI digits, hashes) always Geist Mono, uppercase, tracked. AC: audit of home/pilot/trust — all eyebrows mono.
- [ ] **DG-2.6 (P2/S)** Tabular numerals for all metrics (readiness %, counts, timestamps): `font-variant-numeric: tabular-nums` utility applied to metric classes. AC: no digit-width jitter in animated counters.
- [ ] **DG-2.7 (P2/S)** Type ramp responsive audit: hero display size on mobile (currently likely too large with serif), line-length clamp (65–75ch prose). AC: no wrapped orphan single words in hero at 375px.
- [ ] **DG-2.8 (P3/S)** Kill remaining references to Plus Jakarta / Inter / JetBrains / DM Sans in variables and comments. AC: three-font system only.

## 3. Color, Contrast & Theming

- [ ] **DG-3.1 (P0/S)** Contrast audit of ink-on-paper: `--vt-text-muted: #14141466` (40% ink) on `#E4E3E0` likely fails WCAG AA for body text. Fix muted/secondary alpha values to pass 4.5:1 (or restrict to large text). AC: axe/contrast tooling passes on home, pilot, trust.
- [ ] **DG-3.2 (P1/S)** Truth-state chip colors: unify `--vt-state-*` (theme bridge) with mz `--ok/--watch/--unknown/--p0` into ONE semantic set covering all 9 coverage states (`checked, stale, pending, gated, unavailable, accessRequired, reviewRequired, notDecisionGrade, previewOnly`). Each state gets text + bg + rule color. AC: single table in tokens; chips render identically on every surface.
- [ ] **DG-3.3 (P1/S)** Decide + document dark mode policy: public site = light-only (paper is the brand); dark reserved for ops/operator + passport night surfaces. Remove half-implemented public dark toggles if they conflict. AC: written policy; `ThemeToggle.tsx` usage audited.
- [ ] **DG-3.4 (P2/S)** Meta theme-color audit: `#2C3E2D` vs paper background — pick per-page theme-color (paper for public pages, ops-dark for operator). AC: iOS Safari chrome matches page background.
- [ ] **DG-3.5 (P2/S)** Focus states: single `--vt-focus-ring` treatment (2px ink ring + 2px paper offset) applied everywhere; kill mixed focus styles. AC: keyboard-tab pass across home + forms shows uniform ring.
- [ ] **DG-3.6 (P3/S)** Print stylesheet for proof packet / share pages (`/p/[slug]`, packet export views): ink-on-white, no chrome, QR/verify link footer. AC: print preview is clean.

## 4. Iconography & Brand Assets

- [ ] **DG-4.1 (P1/M)** Standardize on lucide-react with a wrapped `<Icon>` component: fixed stroke width (1.5), sizes (14/16/20/24), `currentColor` only. Migrate ad-hoc SVGs. AC: one import path; grep shows no raw `<svg>` icons in components except brand marks.
- [ ] **DG-4.2 (P1/M)** Design the **truth-state glyph set** (9 coverage states + T1–T4 proof tiers): consistent, monochrome, readable at 14px. Checked=✓ solid, gated=lock, stale=clock, pending=dashed-circle, unavailable=slash, accessRequired=key, reviewRequired=eye, notDecisionGrade=asterisk, previewOnly=ghost outline. AC: `TrustGlyph` component with story/demo page; used by all chips.
- [ ] **DG-4.3 (P1/S)** Wordmark discipline: "VitalCV" set in Fraunces (or a fixed lockup) consistently in nav, footer, OG images. AC: one `<Logo>` component; no plain-text logo instances.
- [ ] **DG-4.4 (P2/M)** Regenerate OG/Twitter images (currently generic) to the paper/ink editorial style with per-page variants (home, pilot, trust, passport share). AC: `opengraph-image.tsx` renders new design; validated in social debuggers.
- [ ] **DG-4.5 (P2/S)** Favicon/app-icon suite from the new mark (SVG source, 16→512, maskable), matching `manifest.ts`. AC: icons consistent across browsers/devices.
- [ ] **DG-4.6 (P3/S)** Source-name typographic treatment (NPPES, OIG LEIE, CMS PECOS): mono small-caps chips — never third-party logos (no implied endorsement). AC: policy documented; applied.

## 5. Motion System (calm doctrine vs. 40-keyframe reality)

- [ ] **DG-5.1 (P0/S)** Remove the **global `* { transition: color… }` rule** in `globals.css` (280ms on every element) — replace with a `.theme-transition` class applied only to `<html>` during theme switches. AC: no universal transitions; interaction latency improves.
- [ ] **DG-5.2 (P1/M)** Write `docs/design/motion-doctrine.md`: house curve `cubic-bezier(0.2,0.8,0.2,1)`, 240–420ms range, single-shot entrances only, hover-lift ≤2px, NO infinite loops on public surfaces (exceptions: skeleton shimmer while loading, live-status pulse on /status). AC: doc merged.
- [ ] **DG-5.3 (P1/M)** Keyframe audit: inventory all 40+ `@keyframes` in `globals.css`; delete unused (grep usage), migrate survivors into `styles/motion.css` with doctrine comments. Kill `marquee`, `node-breathe`, `glow-breathe`, `critical-pulse` from public surfaces. AC: keyframe count halved; each survivor has a documented consumer.
- [ ] **DG-5.4 (P1/M)** framer-motion audit (138 files): public pages should use CSS entrances (`matcha-enter`) where possible; reserve framer-motion for the constellation, MATCHA demo, and drag interactions. Remove per-card spring animations that violate calm doctrine. AC: motion bundle size reduced; scroll jank eliminated on home.
- [ ] **DG-5.5 (P1/S)** `prefers-reduced-motion` coverage: every animation (CSS + framer) has a static equivalent. Currently only matcha layers handle it. AC: OS-level reduced-motion renders a fully static site minus opacity fades.
- [ ] **DG-5.6 (P2/M)** Standardize scroll-reveal: one `<Reveal>` primitive (IntersectionObserver, single-shot, stagger ≤3 children, 60ms step) replacing ScrollReveal/vcv-stagger-in/fadeInUp variants. AC: one implementation; all sections migrated.
- [ ] **DG-5.7 (P2/S)** Readiness ring animation (`crs-ring-fill`, `vcv-score-count`): count-up + ring sweep once on first view, tabular nums, no re-trigger on scroll. AC: consistent on hero mock, passport, review.
- [ ] **DG-5.8 (P3/S)** Retire novelty physics components from public surfaces: `MagneticButton`, `CursorPhysics`, `SpotlightCard` (demo-era). Keep in `_archive` or ops playground. AC: no usage on public routes.

## 6. Component Library Consolidation

- [ ] **DG-6.1 (P0/M)** ONE status chip: merge `BadgeStatus.tsx`, `StatusBadge.tsx`, `claim-badge.tsx`, ad-hoc badges into a single `<StateChip>` consuming DG-3.2 semantic states + DG-4.2 glyphs, with size variants (sm/md) and `title` tooltips naming source + freshness. AC: all surfaces render chips from one component; old files deleted.
- [ ] **DG-6.2 (P1/M)** ONE card system: paper card (rule border, sharp radius, optional matcha-lift hover) replacing card.tsx variants + SpotlightCard + bento-grid on public pages. AC: home/pilot/trust use it exclusively.
- [ ] **DG-6.3 (P1/M)** ONE button system: primary (ink fill/paper text), secondary (rule outline), quiet (text + underline on hover), destructive; sizes sm/md/lg; loading + disabled states. Merge `ButtonPrimary.tsx` into `button.tsx` variants. AC: single import; visual parity across pages.
- [ ] **DG-6.4 (P1/M)** `<SourceRow>` component: the atomic "Identity · NPPES · Source-backed" row (label, source mono, StateChip, freshness timestamp, optional action). Used by hero mock, passport, packet, review, trust register. AC: one component, five consumers.
- [ ] **DG-6.5 (P1/M)** `<ReadinessRing>`: the 72% ring as a reusable primitive (size, band coloring by threshold, animated once, a11y label). AC: hero + passport + review use it.
- [ ] **DG-6.6 (P1/S)** `<ProofTierBadge>` (T1–T4): mono label + tier glyph, tooltip with tier definition, matching /trust vocabulary exactly. AC: used on trust register + packet views.
- [ ] **DG-6.7 (P2/M)** Form kit: input, NPI segmented input (10-digit with digit counter), textarea, select, checkbox — paper/ink styling, uniform focus, inline validation (watch/p0 colors), helper text. AC: /pilot and /review/request forms rebuilt on kit.
- [ ] **DG-6.8 (P2/M)** `<FreshnessStamp>`: relative time + absolute ISO on hover (Wave 16 W16-2 requirement), stale threshold coloring. AC: every CHECKED_AT on /trust and review surfaces uses it.
- [ ] **DG-6.9 (P2/S)** `<LimitationNote>`: the verbatim limitation-honesty list item (bullet · ink, never collapsible on first render). AC: pilot + packet use it.
- [ ] **DG-6.10 (P2/M)** Empty/loading/error triad for every data surface: paper skeleton (matcha-skeleton), honest empty state ("No sources checked yet — enter an NPI"), fail-closed error state (never fake success). AC: EmptyState.tsx redesigned; used across passport/review/inbox.
- [ ] **DG-6.11 (P2/M)** Navigation: unify header (VitalCV wordmark, For Employers, Sign In, Check Readiness CTA) + footer (trust links, legal, © 2026) as shared components with active states, mobile drawer. AC: identical nav on every public route (today /trust has no nav).
- [ ] **DG-6.12 (P3/M)** Component inventory page at `/dev/design` (auth-gated): renders every primitive with all states — the living style guide. Update `docs/design/current-ui-inventory.md` from it. AC: page exists; inventory doc regenerated.
- [ ] **DG-6.13 (P3/S)** Delete or archive dead components: `MvpTestChecklist`, `AntigravityHero`, `BackgroundField`, bento-grid, and anything with zero imports. AC: `knip` clean for components/ui.

---

# PHASE 2 — SURFACE-BY-SURFACE EXECUTION

## 7. Homepage (`/`) — polish the flagship

- [ ] **DG-7.1 (P1/S)** Hero: after DG-2.1, re-tune Fraunces display sizing/leading; italic accent only on "Start faster." AC: hero matches editorial doctrine at 375/768/1440px.
- [ ] **DG-7.2 (P1/S)** NPI input: segmented digit counter (0/10) with mono digits, calm focus pulse (`vcv-input-pulse` once), inline "No account required" microcopy; error state for invalid checksum. AC: keyboard + paste + mobile numeric pad all work.
- [ ] **DG-7.3 (P1/M)** Wallet mock card: rebuild on `<SourceRow>` + `<ReadinessRing>` + `<StateChip>` so the marketing mock and the real passport are pixel-identical (truth in advertising). AC: components shared with /passport.
- [ ] **DG-7.4 (P1/S)** "Reads primary sources" list: mono source chips (DG-4.6), each with its coverage state — never a bare checkmark for gated sources. AC: PECOS/state boards show gated/adapter states honestly.
- [ ] **DG-7.5 (P2/S)** How-it-works 1–5: number them in Fraunces, connect with a hairline rule, single-shot stagger reveal. AC: reads as one path Recognition → Acceptance → Start.
- [ ] **DG-7.6 (P2/M)** "Why this compounds" trio: paper cards with rule dividers; the RECOGNITION → ACCEPTANCE → START strip becomes a designed diagram (mono labels, arrow glyphs), not plain text. AC: strip is a reusable `<CanonicalPath>` component.
- [ ] **DG-7.7 (P2/M)** Try-MATCHA demo: chip taps reflect back in ≤200ms, reduced-motion safe, mobile tap targets ≥44px; visually quieter than the hero (it's a demo, not the product claim). AC: interaction audit passed.
- [ ] **DG-7.8 (P2/L)** Constellation section: perf audit (drag-rotate at 60fps on mid-range mobile, canvas/DPR handling), "illustrative" label kept visible, slider styled to form kit, reduced-motion static fallback image. AC: no jank; Lighthouse perf unaffected.
- [ ] **DG-7.9 (P2/S)** By-role 4-door section: equal-height paper cards, role glyphs, hover lift; fix Verifier door href (currently links to `/`). AC: four working destinations.
- [ ] **DG-7.10 (P2/S)** "Who buys in" five-audience block: turn into scannable two-column definition list with mono role eyebrows. AC: readable at mobile widths.
- [ ] **DG-7.11 (P3/S)** Footer: add nav parity (product links), tighten legal row, feedback affordance styling. AC: footer identical across routes.
- [ ] **DG-7.12 (P3/S)** Section rhythm pass: consistent vertical spacing scale (`--space-24/32` between sections), hairline section dividers, eyebrow+headline+body pattern everywhere. AC: spacing tokens only — no arbitrary margins.

## 8. Employer Pilot (`/pilot`) + `/review/request`

- [ ] **DG-8.1 (P1/M)** Rebuild pilot metric strip as designed stat cards (mono metric, Fraunces number, caption with honesty label "Internal simulation · not a customer pilot result" styled as a visible sub-rule, never hidden). AC: four stats, equal heights, honest labels prominent.
- [ ] **DG-8.2 (P1/M)** Pilot form on form kit (DG-6.7): org, contact, work-email validation, baseline textarea with prompt placeholder; success + failure states designed; audit note ("reviewed within two business days") as designed callout. AC: form submits with visible confirmation state.
- [ ] **DG-8.3 (P1/M)** `/review/request` redesign (flagged sparse/left-heavy in CURRENT_STATE): two-column layout — form left, "what happens next" timeline right; NPI input reuses DG-7.2; D56 zen styling. AC: no longer left-heavy; screenshot parity with pilot page quality.
- [ ] **DG-8.4 (P2/S)** "What is live now / what remains partial" two-list block: designed as paired ok/watch panels with StateChips — the honesty layout becomes a signature visual. AC: reusable `<HonestyPanel>`.
- [ ] **DG-8.5 (P2/S)** Trust container + limitation honesty sections: mono-labeled definition rows, bullet honesty list via `<LimitationNote>`. AC: consistent with packet views.
- [ ] **DG-8.6 (P3/S)** Proof-pack visual: small designed diagram of packet → sha256 hash → ARTIFACT_EXPORTED audit event (mono, schematic, no fake UI screenshot). AC: diagram present, doctrine-safe.

## 9. Trust Surfaces (`/trust`, `/trust/attribution`, `/trust/graph`, `/status`)

- [ ] **DG-9.1 (P1/M)** Trust State Register: add global nav/footer (currently chrome-less); keep the register's austere table character. AC: nav parity.
- [ ] **DG-9.2 (P1/M)** T1–T4 tier vocabulary cards + state-plane sections rebuilt on `<ProofTierBadge>` + `<SourceRow>`; dashed-border degraded semantics tokenized (`--vt-degraded-border`). AC: three planes visually distinct; dashed = degraded documented.
- [ ] **DG-9.3 (P2/S)** Machine-readable endpoints table: mono, row hover, copy-to-clipboard on endpoint paths, external-link glyphs. AC: table usable on mobile (stacked rows).
- [ ] **DG-9.4 (P2/S)** Issuer continuity block: key fingerprint + DID as copyable mono tokens with verify links; "EC P-256 · ES256 · Active" as StateChip. AC: copy affordances work.
- [ ] **DG-9.5 (P2/M)** `/status` page design pass: uptime/lane health with 4-level spine (HEALTHY/DEGRADED/STALE/CRITICAL) colors from semantic tokens; the ONE allowed looping pulse for live indicator. AC: matches ops color doctrine.
- [ ] **DG-9.6 (P3/M)** `/trust/graph` explorer: apply graph tokens (`--vt-node-*`), ink nodes on paper, legend, zoom controls styled. AC: legible, not demo-theater.

## 10. Clinician Funnel (`/get-ready`, `/onboarding`, `/passport`, `/p/[slug]`)

- [ ] **DG-10.1 (P0/M)** Fix `/get-ready` SSR flash: "Checking your workspace…" renders as bare text with the marketing shell. Design a proper gate state (paper skeleton + wordmark + progress) OR server-render the signed-out pitch. AC: no unstyled flash; signed-out users see the designed pitch immediately.
- [ ] **DG-10.2 (P1/M)** Onboarding NPI flow: staged reveal (`vcv-stage-in`) of source checks as they complete — each check appears as a `<SourceRow>` with live state transitions (pending → checked/gated). The "loading is the product demo" moment. AC: flow completes <60s with honest states.
- [ ] **DG-10.3 (P1/L)** Passport surface: unify on paper/ink (currently gray-950 gradient dark passport tokens exist — decide: passport = light paper like the rest, OR intentional dark "document" mode; pick ONE and document). Rebuild sections on SourceRow/ReadinessRing/StateChip/FreshnessStamp. AC: passport and homepage mock are the same design language.
- [ ] **DG-10.4 (P1/M)** Public share page `/p/[slug]`: this is the viral surface — designed like a clean credential document: wordmark header, clinician identity block, readiness ring, source rows, "what this is / is not" honesty footer, verify link + print styles (DG-3.6). AC: screenshot-worthy; recruiter-readable in <1 min.
- [ ] **DG-10.5 (P2/S)** Recognition moment: when an employer accepts, design the Recognition record row (mono timestamp, employer name, "accepted as head start" — never "final credentialing decision"). AC: appears on passport + share page.
- [ ] **DG-10.6 (P2/M)** Wallet dashboard (`/holder` / clinician home): card grid of evidence items with StateChips, "next best action" callout fed by MATCHA copy. AC: one clear primary action per screen (Antigravity: appear only at blocked moments).
- [ ] **DG-10.7 (P3/S)** `/apply` + opportunity views: application card with readiness-match indicator, reuse packet visuals. AC: consistent with wallet.

## 11. Employer Review (`/review/[entityId]`, packet export)

- [ ] **DG-11.1 (P1/L)** Review surface: reviewer-first layout — identity header, ReadinessRing, blockers list (p0/watch chips first), FreshnessPanel with 4-layer freshness, accept/refresh/route actions as designed button group with confirmation states (`action-confirm-pulse` once). AC: reviewer can act in <2 min; every action shows its audit consequence ("An audit event will be recorded").
- [ ] **DG-11.2 (P2/M)** Packet/proof-pack HTML view: printable, mono metadata block (sha256, RUN_ID, exported-at), limitation notes verbatim, T-tier badges per lane. AC: matches PDF/ZIP export content.
- [ ] **DG-11.3 (P2/S)** Divergence/contradiction display: `--vt-state-contradicted` purple treatment with side-by-side source values — design the disagreement, don't hide it. AC: contradiction demo state renders clearly.
- [ ] **DG-11.4 (P3/M)** Operator surfaces (SourceHealthPanel, PilotDiagnosticsPanel): apply ops-dark tokens consistently, add remediation-hint slots (W16-1), absolute timestamps on hover (W16-2 → `<FreshnessStamp>`). AC: Wave 16 items closed with design parity.

## 12. Auth, Legal, System Pages

- [ ] **DG-12.1 (P1/S)** Sign-in/sign-up (Clerk): theme Clerk appearance API to paper/ink (fonts, buttons, borders). AC: no default Clerk purple; matches site.
- [ ] **DG-12.2 (P2/S)** 404 / error / global-error pages: designed paper pages with wordmark, honest copy, one CTA home. AC: all three routes styled.
- [ ] **DG-12.3 (P2/S)** Legal pages (privacy, terms, DPA, cookies): prose typography class (65ch, Geist, Fraunces headings), TOC sidebar on desktop. AC: readable, consistent.
- [ ] **DG-12.4 (P3/S)** `/contact`: form on kit + expectation copy. AC: parity with pilot form.
- [ ] **DG-12.5 (P3/S)** Feedback widget: restyle the floating "Feedback" affordance to token system, ensure it never overlaps CTAs on mobile. AC: z-index tokened, mobile-safe.

## 13. Marketing ↔ Web Seam

- [ ] **DG-13.1 (P1/M)** Audit `apps/marketing`: inventory which routes still serve from it; any live route gets the unified token/typography system or redirects into `apps/web`. AC: no user path crosses two visual systems.
- [ ] **DG-13.2 (P2/S)** Kill dead links: verify no surface links `/clinician` (404) or other dead routes; add redirect map. AC: crawl of public pages returns zero 404 links.
- [ ] **DG-13.3 (P2/S)** Pricing page (`/pricing`): paper/ink pricing table per pricing doctrine, honesty labels on any illustrative numbers. AC: doctrine-safe.

---

# PHASE 3 — SYSTEM-WIDE QUALITY GATES

## 14. Responsive & Mobile

- [ ] **DG-14.1 (P1/M)** Full mobile pass at 360/375/414px on: home, pilot, trust, get-ready, passport, share, review/request. Fix overflow, tap targets ≥44px, sticky-header behavior, constellation touch handling. AC: no horizontal scroll anywhere.
- [ ] **DG-14.2 (P2/S)** Tablet pass (768/1024): two-column layouts collapse gracefully; trust register table stacks. AC: screenshots archived.
- [ ] **DG-14.3 (P2/S)** Large-screen pass (1920+): max-width container discipline (`--container-*` token), no full-bleed text. AC: content column ≤1200px.
- [ ] **DG-14.4 (P3/S)** Landscape-mobile + iPad-split edge cases on interactive demos. AC: no broken drag surfaces.

## 15. Accessibility (WCAG 2.2 AA)

- [ ] **DG-15.1 (P1/M)** Automated axe pass on all public routes; fix all critical/serious. AC: zero serious violations.
- [ ] **DG-15.2 (P1/S)** Keyboard: full tab-through of home + both forms + review actions; visible focus (DG-3.5); skip-link works (exists — verify target). AC: recorded keyboard walkthrough.
- [ ] **DG-15.3 (P1/S)** State never by color alone: every StateChip pairs glyph + label (DG-4.2 enforces). AC: grayscale screenshot still fully legible.
- [ ] **DG-15.4 (P2/S)** Screen-reader semantics: readiness ring gets `role="meter"` + label; source rows are described lists; constellation gets an accessible text alternative. AC: VoiceOver pass on hero + passport.
- [ ] **DG-15.5 (P2/S)** Reduced-motion end-to-end verification (extends DG-5.5). AC: OS toggle test on all interactive sections.
- [ ] **DG-15.6 (P3/S)** Form error announcements (`aria-live`), NPI input digit-count announced. AC: SR announces validation.

## 16. Performance (design-adjacent)

- [ ] **DG-16.1 (P1/S)** Font loading: self-hosted, subset (latin), `display: swap` with metric-compatible fallbacks; verify CLS <0.02 after DG-2.1. AC: Lighthouse CLS green.
- [ ] **DG-16.2 (P1/S)** Remove global `*` transition (DG-5.1) and measure INP improvement. AC: INP <200ms on home.
- [ ] **DG-16.3 (P2/M)** Animation perf: constellation + framer sections profiled; `will-change` discipline; no layout-triggering animations (only transform/opacity). AC: no red frames in performance trace on scroll.
- [ ] **DG-16.4 (P2/S)** Image/OG asset optimization: next/image everywhere, priority on hero only. AC: LCP <2.5s on 4G.
- [ ] **DG-16.5 (P3/S)** CSS weight: after token merge, measure globals.css chain; purge unused keyframes/classes. AC: CSS bundle reduced ≥25%.

## 17. Copy–Design Integration (doctrine enforcement in the UI)

- [ ] **DG-17.1 (P0/S)** Run `pnpm check:claims` as part of every design wave; add any new marketing strings introduced by design work to the scan. AC: passes; no banned phrases (no "verified" absolutes, no NPDB/DEA/ABMS, no SOC2/NCQA badges, no "all 50 states", no "instantly").
- [ ] **DG-17.2 (P1/S)** Design the honesty labels as first-class UI (not fine print): "Internal simulation", "illustrative", "Past and future are illustrative", "not a final credentialing decision" get a consistent designed treatment (mono sub-rule caption). AC: `<HonestyLabel>` component used everywhere applicable.
- [ ] **DG-17.3 (P1/S)** Holder vs employer copy surfaces audited against §6 copy discipline ("Present VitalCV Recognition" / "Accept as Head Start"). AC: CTA copy conforms on all surfaces.
- [ ] **DG-17.4 (P2/S)** Microcopy pass with ux-writing standards: empty states, errors, tooltips, form helpers — calm, specific, source-honest. AC: microcopy inventory doc.

## 18. Governance, QA & Handoff

- [ ] **DG-18.1 (P1/M)** Visual regression harness: Playwright screenshot suite for the 10 key routes × 3 viewports, run in CI. AC: baseline committed; diffs gate merges.
- [ ] **DG-18.2 (P1/S)** `docs/design/DESIGN_SYSTEM.md`: single doc — palette, type, spacing, motion, chip states, component index, do/don't gallery. Supersedes scattered doctrine files; links zenlike doctrine. AC: doc merged; referenced from CLAUDE.md.
- [ ] **DG-18.3 (P2/S)** Design lint: ESLint rule/grep script forbidding hardcoded colors, raw lucide imports outside `<Icon>`, and new `@keyframes` outside motion.css. AC: CI check active.
- [ ] **DG-18.4 (P2/S)** Refresh `docs/design/current-ui-inventory.md` after Phase 2; archive `design-handoff/claude-design-2026-06-26` prototypes with a README stating what was adopted vs dropped. AC: inventory current.
- [ ] **DG-18.5 (P3/S)** Before/after screenshot gallery per wave in `docs/design/waves/` for founder review + YC material. AC: gallery exists per completed wave.

---

## Execution Order (recommended waves)

| Wave | Tasks | Theme | Est. |
|---|---|---|---|
| **D-W1 (P0 sweep)** | DG-1.1–1.3, 2.1–2.2, 3.1, 5.1, 6.1, 10.1, 17.1 | Real fonts, one palette, chip unification, kill perf hazards, fix get-ready flash | 1–2 days |
| **D-W2 (primitives)** | DG-4.1–4.3, 5.2–5.5, 6.2–6.6, 3.2, 3.5 | Icon/motion doctrine + core components | 2 days |
| **D-W3 (flagship)** | DG-7.1–7.12, 16.1–16.2 | Homepage to doctrine quality | 2 days |
| **D-W4 (buyer)** | DG-8.1–8.6, 11.1–11.3, 13.1 | Pilot + review surfaces (revenue path) | 2 days |
| **D-W5 (clinician)** | DG-10.2–10.7, 12.1 | Funnel + passport + share page | 2–3 days |
| **D-W6 (trust)** | DG-9.1–9.6, 4.4–4.6 | Trust surfaces + brand assets | 1–2 days |
| **D-W7 (gates)** | DG-14.*, 15.*, 16.3–16.5, 17.2–17.4 | Responsive, a11y, perf, copy | 2 days |
| **D-W8 (governance)** | DG-18.*, 6.12–6.13, 12.2–12.5, 13.2–13.3 | Regression harness, docs, cleanup | 1–2 days |

**Definition of done for the whole program:** one design language (paper/ink/Fraunces/Geist/mono) across every public route; truth-state chips identical everywhere; real fonts loaded; zero doctrine copy violations; axe + CLS + INP green; visual-regression suite guarding it all.

---

*Generated 2026-07-11 from live vitalcv.com audit + repo design-system extraction. Refresh after each completed wave.*
