# Homepage recovery — current-state inventory

Program: docs/ops/HOMEPAGE_RECOVERY_2026-08-02.md · Issue #1060 · Governance PR #1061 (merged `9aade909f`).

This is the single R1 evidence document. Screenshots live under
`artifacts/home-recovery/baseline/`; motion recordings are local-only (not
committed) at `artifacts/home-recovery/baseline/video/` per repo policy.

## R0 — Production convergence (2026-08-02T23:43Z)

| Fact | Value |
| --- | --- |
| CURRENT ORIGIN/MAIN SHA | `9aade909f2fc287e94104c698c99b347f38bf6f6` |
| WEB PRODUCTION SHA | `f7e8002aee615579217435d6c5eb5e5d33353f2f` |
| API PRODUCTION SHA | `f7e8002aee615579217435d6c5eb5e5d33353f2f` |
| HOMEPAGE HTTP STATUS | 200 |
| WEB HEALTH | ok (`/api/health`: backend ok, clerk production mode, apiBase true) |
| API HEALTH | ok (`api.vitalcv.com/health`: status ok, 0 error requests) |
| AUTH HEALTH | Clerk enabled, production mode |
| DATABASE HEALTH | implied ok via backend health; not directly probed in R0 |
| CANONICAL DOMAIN | https://vitalcv.com (canonical metadata on `/`) |
| CACHE STATE | `revalidate = 300` on `/`; external caches bounded to 5 min |
| CONVERGED | **YES for visual-audit purposes** — the only delta between prod (`f7e8002`) and origin/main (`9aade909f`) is the #1061 squash merge, which touched `AGENTS.md`, `CLAUDE.md`, `docs/ops/FOUNDER_VISUAL_GATE.md`, `docs/ops/HOMEPAGE_RECOVERY_2026-08-02.md` only (394 insertions, zero app code). Production's homepage is source-identical to main's. |

Local baseline captures were taken against a production build of `9aade909f`
(`next start`, private port); production-parity screenshots
(`PROD-initial-*.png`) were taken against https://vitalcv.com directly.

## R1.1 — Render ownership map

Route entry: `app/page.tsx` (server, hardcoded metadata/JSON-LD, `revalidate
300`) renders `HorizontalCareerFilm` only. Layout chrome around it: sticky
`Navbar` (the element the film measures into `--film-chrome`), `Footer`,
`FeedbackButton`, `CommandPalette` (hidden), `GlassCursor`;
`AnnouncementRail` hard-suppresses itself on `/`; all workspace/pilot chrome is
Clerk-gated off for guests.

Film tree — every element of `/` with its owner:

| Component | File | Data | Live/Illustrative | Verdict |
| --- | --- | --- | --- | --- |
| `HorizontalCareerFilm` | `components/home/film/HorizontalCareerFilm.tsx` (client) | scenes hardcoded; cadence sentence **derived** from `lib/trust/sourceLanes.ts`; NPI submit → live | mixed | KEEP (route owner) — recompose per approved concept |
| `KineticPhrase` (inline) | same file | props | — | KEEP/MIGRATE |
| `EvidenceAtmosphere` + `atmosphere.ts` | `film/` | pure model; ink hardcoded (canvas can't read CSS vars) | decorative | REWRITE-OR-DELETE per concept — currently carries more visual area than the product |
| `useFilmProgress` | `film/useFilmProgress.ts` | scroll; eligibility ≥1024×560, fine pointer | — | KEEP (the ONE scroll owner; contract is sound) |
| `ExpandingEyebrow` (A) | `components/home/ExpandingEyebrow.tsx` | props | — | MERGE INTO CANONICAL (see R1.3) |
| `FilmRecord` | `film/FilmRecord.tsx` (server-safe) | **derived** from `SOURCE_LANE_OPS` | live-derived | KEEP semantics; rescale visually |
| `FilmFit` | `film/FilmFit.tsx` | hardcoded 4 rows | illustrative | KEEP semantics; needs ILLUSTRATIVE labeling review |
| `FilmSignature` | `film/FilmSignature.tsx` | hardcoded ES256/JWKS facts | live facts, static render | KEEP |
| `ProofPacketInspector` | `components/proof/` (client) | `PROOF_ITEMS` const, labeled "Not a live clinician result" | illustrative ✓ labeled | KEEP |
| `TruthBoundary` | `components/home/TruthBoundary.tsx` (server) | hardcoded boundary copy | doctrine | KEEP |
| `LiveNpiResult` | `components/home/LiveNpiResult.tsx` (client) | **live**: `/api/identity/bootstrap/{npi}` + `/api/trust-state/{npi}`, no-store | live | KEEP — but see the P0 styling finding below |
| `EvidenceCapsule{Resolved,Resolving,Error}` | `components/home/evidence/` | model from `SOURCE_LANE_OPS` | live | KEEP — **currently ships unstyled (P0)** |

**P0 finding — the primary CTA's result renders unstyled.** `EvidenceCapsule`
emits 23 `evidence-capsule*` BEM classes. The only two stylesheets defining
those selectors — `styles/evidence-capsule.css` and `styles/cinematic-home.css`
— are **orphaned** (zero imports since `bdbfbca1e`). No rule for any
`.evidence-capsule*` class is reachable from `/`. Confirmed visually in
`npi-settled-1440x900.png`: the returned state is bare unstyled text lines.
The tests that "cover" the capsule read the CSS off disk with `readFileSync`,
so CI stays green. This is exactly the failure mode the program names: the
lookup works, the answer arrives, and the product's proudest moment ships with
no design at all.

Copy/data inconsistencies: `CHOICE_FACTS` says "Three federal source lanes"
while `FilmRecord` renders **six** rows ("The same six every time") from the
same registry; film comments still say "six scenes"/reference a retired
`recognition` scene while `FILM_SCENES` has five. Secondary: the dev harness
`app/dev/compete-film/page.tsx` imports only `compete-film.css` — no
`motion.css`, no `glass-eyebrow.css` — so it is not a faithful preview of `/`.

## R1.2 — Stylesheet ownership map

27 CSS files reach `/`: **303,478 bytes, ~1,444 rules, 891 custom properties.**
The film itself uses 7% of that (`compete-film.css` 18KB + the live half of
`glass-eyebrow.css`).

| Class | Files | Verdict |
| --- | --- | --- |
| Actually styling `/` | `compete-film.css` (homepage-scoped under `.film` ✓), `glass-eyebrow.css` (`.ask-eyebrow*` half), `motion.css` (1 of 8 keyframes used), plus global tokens/typography/utilities | KEEP |
| Dead homepage CSS still shipped via `globals.css` | `home-vitals.css` (31KB, styles dead `HomePageClient`), `homepage-motion.css` (22.7KB, retired rail/story), `story-rail.css` (4.1KB), `scene.css` (2.4KB) | **DELETE — 60.4KB / 373 rules served to every visitor for components that no longer render** |
| Orphaned (not imported anywhere) | `ask-home.css` (20.9KB), `cinematic-home.css` (14.2KB), `evidence-input.css` (9.8KB), `evidence-capsule.css` (7.5KB — see P0), `home-surfaces.css` (11.2KB), `spine-tabs.css` (5.9KB) | **DELETE or REMOUNT — 69.5KB kept "green" only by readFileSync tests** |
| Double-imported | `typography.css` via `layout.tsx` AND `globals.css` (10.7KB emitted twice) | FIX |
| Duplicate tokens | `--vt-bg`/`--vt-surface`/ink tokens declared 3× (`themes/index.css`, `matcha-zen.css`, dead `home-vitals.css` — which **wins by import order**); all `--vt-badge-*` and `--vital-ops-*` declared 2× | CONSOLIDATE — a dead file currently wins the token cascade |

Not-`/` but noted: `motion.css`'s other 7 keyframes serve only orphaned sheets;
`wave1501-home.css` (25.4KB) serves only orphan components.

## R1.3 — Component-intent collisions

### Eyebrow (the headline collision)

Two implementations, **zero shared code**:

| | A — `components/home/ExpandingEyebrow.tsx` (55 ln) | B — `design-system/components/ExpandingEyebrow.tsx` (130 ln) |
| --- | --- | --- |
| Status | **MOUNTED** — ships on `/` via `HorizontalCareerFilm.tsx:364` | **test-only** — sole importer is `experience-components-doctrine.test.tsx` |
| Styling | BEM → `styles/glass-eyebrow.css`; frosted glass pill (blur 14px), horizontal `max-width` reveal, `white-space: nowrap` | Tailwind tokens; anti-glass left-rule label, vertical disclosure block |
| Strengths | Escape-to-close; `data-hydrated` SSR guard | 44px target (`min-h-11`); sticky support; detail is a block (no truncation); `motion-reduce` keeps detail legible |
| Failures | Trigger is ~20px tall — **fails the CD-15 44px floor by 24px**; detail truncates past ~30 chars | No Escape handler; no hydration guard |

**Canonical candidate: B**, with A's Escape handler and hydration guard ported
in. Migration cost ≈ 7 files. The visual delta (glass pill vs bare rule) is a
founder-level call under the visual gate — carried into the concepts.

### Buttons / primary action

- What actually ships on `/`: `.film-npi-submit` (44px ✓) and
  `.film-route`/`.film-route-primary` (**no min-height — misses the 44px floor**),
  both in `compete-film.css`.
- De-facto app-wide canonical: shadcn `components/ui/button.tsx` (57 importers).
- `design-system/ProductAction.tsx` (test-only) is the only implementation that
  *enforces* 44px as a height and carries the `consequence` prop; its pending
  state changes the label instead of spinning.
- ~13 further route-scoped CTA classes exist across old stylesheets, including
  `.vh-cta-ready` with **infinite idle animation** (banned by the program).
- Three separate `MagneticButton` implementations; two are simultaneously
  imported by different live components.

**Canonical candidate: `ProductAction` for homepage CTAs** (first slice: the two
film call sites), shadcn button untouched elsewhere in this program.

### Evidence artifact

- `components/home/evidence/EvidenceCapsule.tsx` — real, ships on `/` via
  `LiveNpiResult`. The design-system entry is a compliant **re-export**, not a
  duplicate. No collision.
- `design-system/EvidenceInspector.tsx` (test-only) is the only artifact that
  makes `source` + `asOf` a compile-time obligation. The shipping
  `ProofPacketInspector` should eventually compose it (1-file change).
- ~35 other `*Evidence*`/`*Inspector*` components exist across the app; out of
  scope for `/` except as deletion candidates when orphaned.

### Other program intents

`ConsentSeal`, `PacketHandoff`, `HumanReviewCheckpoint`,
`ApplicationEvidenceTimeline`, `SourceWorkflowTabs`, `InteractiveIcon`: each has
exactly one implementation in `design-system/` and **zero production
importers** (test-only or fully orphaned). They are the natural building
blocks for the approved direction rather than duplicates to resolve — the
duplication risk is that the film reinvents them inline (it currently does for
tabs-like and timeline-like surfaces).

### Design-system mount status

`apps/web/design-system/` = 79 files, ~5,900 lines; **only 11 of 50 components
reach a production route** (mostly chips/badges + theme tokens, which are
genuinely load-bearing). The entire 9-component "experience set" from #1024 is
imported solely by one doctrine test. `design-system/layouts/` and `patterns/`
have zero live consumers. Barrel hazard: `components/index.ts` star-exports the
client-side EvidenceCapsule re-export, dragging the homepage evidence tree into
every barrel importer's module graph (including `/verify/[npi]`).

### Orphaned homepage compositions still in tree

- `app/HomePageClient.tsx` (~600 lines, Era-1 homepage) — zero importers.
- `components/home/ask/` tree (AskHome, EvidenceInput, SpineTabs …) — zero
  route importers since `bdbfbca1e`; transitively orphans `ask-home.css`,
  `evidence-input.css` and the #1039 eyebrow's only other consumer.
- `components/home/WorkflowStoryTabs.tsx` — zero importers anywhere.
- `components/home/cinematic/CinematicEvidenceField.tsx` — unmounted since
  Era 4.

## R1.4 — Homepage chronology

| Era | Window | Composition | How it changed | Founder visual approval |
| --- | --- | --- | --- | --- |
| 1 | ~2026-04-04 → 07-25 | `HomePageClient` (brutalist activation page) | grown in place | n/a (pre-dates gate) |
| 2 | 07-25 → 07-26 | `HorizontalCareerFilm` v1 (#835, #859, #865) | replaced Era 1, left it in tree | no record |
| 3 | 07-26 → 08-02 | `AskHome` (#910) + Home Evidence v2 stack (#988–#1013) + #1039 eyebrow | replaced Era 2, left film in tree; **`9a7044070` (07-30) was a direct push, no PR** | no record |
| 4 | 08-02 13:18 PT → now | `HorizontalCareerFilm` v2 | **`bdbfbca1e` — direct push to main, no PR**, ~4h after #1039 merged into the composition it unmounted | no record |
| 5 | 08-02 | (governance only, #1061) | — | gate now exists |

The two flips that created the recovery condition were both direct pushes with
no PR. #1039's eyebrow was merged into a composition that was unmounted four
hours later — merged work, live-invisible. Useful discarded work: the Home
Evidence v2 evidence-capsule states and the four-step spine's progressive
enhancement pattern.

## R1.5 — Open-PR triage

| PR | State | Classification | Reason |
| --- | --- | --- | --- |
| #985 transparent eyebrow | OPEN, conflicting (gates skipped) | **CLOSE AS SUPERSEDED** | Restyles `.ask-eyebrow` on the unmounted AskHome surface; both target files rewritten on main since. |
| #1024 experience components | MERGED 08-02 | — | Landed; source of the duplicate eyebrow B. |
| #1039 hero eyebrow | MERGED 08-02 | — | Live-invisible (its host was unmounted 4h later); one half of the eyebrow decision. |
| #1044 employers evidence | OPEN, CLEAN | **MERGE AFTER RECOVERY** | Unique residual work on `/employers`, not `/`; hold for the founder visual gate, not for this audit. |
| #1052 next.config runtime | MERGED | UNRELATED | Deploy fix. |
| #1058 security headers | MERGED | UNRELATED | Deploy fix. |

No-PR remote branches: `codex/home-expandable-eyebrow` and
`codex/home-story-rail` fully landed (stale, deletable);
`codex/homepage-{motion-convergence,palantir-typography-scene,premium-transitions}`
target compositions replaced twice since (dead); `codex/restore-vertical-home`
is a one-commit counter-flip back to AskHome — **blocked by #1060's
one-composition rule; founder decision territory; merging it as-is would also
delete the #1061 governance docs.**

## R2 — Current visual baseline

Captured 2026-08-02 against a production build of `9aade909f` (54 screenshots,
8 viewports, all required states) plus production-parity captures of
https://vitalcv.com. Film mode engages at ≥1024×560 with a fine pointer;
320/390/430/768 widths and reduced-motion get the vertical composition, as
designed. JS-disabled renders the complete vertical document. No horizontal
overflow at any captured viewport. After an NPI submit the film releases to
vertical and renders the honest system state in place ("This is a system
state, not a finding about NPI …") — the truth contract is intact.

### R2.1 Quantitative composition measurements (1440×900, film mode)

| Measure | Value | Flag |
| --- | --- | --- |
| Header height | 78px | — |
| Hero phrase width | 544px; copy column 674px | — |
| NPI input top / submit bottom | 612px / 651px | Primary action above the fold ✓ |
| Arrival artifact (FilmRecord) | **480 × 446px at x=830** | **Exactly the banned pattern: a 30rem artifact floating in a 1440px stage.** Artifact ≈ 16.5% of stage area. |
| Runway | 4500px (5 × 100vh) | One viewport per transition ✓ |
| Horizontal overflow | 0 | ✓ |
| Scene composition grammar | identical in 4 of 5 scenes | **Serif phrase left + one beige table-card right, repeated. Scenes do not deliver distinct visual events.** |
| Scene 5 (choice) | CTAs + 4 facts occupy ~28% of frame | **>35% of the viewport is empty paper/atmosphere; weak closing.** |
| Atmosphere vs product | decorative line-field spans full stage in every scene | **Decoration carries more visual area than the product object in scenes 2–5.** |
| Mobile 390×844 | vertical stack; NPI above fold ✓; product object begins at ~661px | Mobile is the desktop column order compressed — no mobile-specific recomposition. |

### R2.2 First-impression test (one sentence each)

- **What does VitalCV do?** Partially clear — "Get hired on evidence." plus the
  six-source table implies evidence assembly, but what VitalCV *is* (network?
  tool? service?) is only in the table's footnote.
- **Who is it for?** Clear — clinicians (eyebrow, NPI ask); employers only
  surface in scene 3 and the nav.
- **What should I do first?** Clear — enter your NPI.
- **What is the product object?** **Design failure** — a quiet beige table card
  at 480px; legible but it commands no attention and never changes scale,
  angle, or grammar across the film.
- **Why should I trust it?** Deferred to scene 4 (signed receipt); the first
  screen offers only "Free · No account required".
- **What do I remember after ten seconds?** The serif headline and beige calm —
  not the record, not the mechanism. **The page is truthful but not desirable;
  understanding without desire.**
