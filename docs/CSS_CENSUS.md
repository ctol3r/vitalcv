# CSS Census — apps/web

> UX-02 Phase 0 evidence. Measured against `origin/main` @ `efda1a5d8` on 2026-08-07.
> Regenerate: `node design-lab/ux02-phase0/census.mjs <repo-root>`.
> "Dead class candidates" is a heuristic (class literal appears in no source file);
> verify before deleting — dynamically-composed class names can evade it.

## Totals

| Metric | Value |
|---|---|
| Stylesheets (source, excl. build output/coverage) | 35 |
| Top-level selectors | 1468 |
| Unique custom properties | 993 |
| Custom-property definitions | 1099 |
| Properties defined in more than one file | 94 |
| Dead-class candidates | 161 |

## Cross-file custom-property collisions (top 40)

These are the fuel of the specificity war: the same property name defined in
multiple stylesheets, so the winning value depends on import order.

| Property | Defined in |
|---|---|
| `--accent` | `app/globals.css`, `components/evidence-record/record.css`, `styles/clinician-doc.css`, `styles/matcha-zen.css` |
| `--ink` | `components/evidence-record/record.css`, `styles/career-loop-home.css`, `styles/clinician-doc.css`, `styles/reset-home.css` |
| `--paper` | `components/evidence-record/record.css`, `styles/clinician-doc.css`, `styles/matcha-zen.css` |
| `--serif` | `components/evidence-record/record.css`, `styles/career-loop-home.css`, `styles/reset-home.css` |
| `--sans` | `components/evidence-record/record.css`, `styles/career-loop-home.css`, `styles/reset-home.css` |
| `--mono` | `components/evidence-record/record.css`, `styles/career-loop-home.css`, `styles/reset-home.css` |
| `--hairline` | `styles/career-loop-home.css`, `styles/clinician-doc.css`, `styles/reset-home.css` |
| `--vt-accent-editorial` | `styles/matcha-zen.css`, `styles/themes/index.css`, `styles/wave1501-home.css` |
| `--vt-text-secondary` | `styles/matcha-zen.css`, `styles/themes/index.css`, `styles/wave1501-home.css` |
| `--vt-text-muted` | `styles/matcha-zen.css`, `styles/themes/index.css`, `styles/wave1501-home.css` |
| `--card` | `app/globals.css`, `styles/matcha-zen.css` |
| `--font-mono` | `app/globals.css`, `styles/typography.css` |
| `--radius-sm` | `app/globals.css`, `styles/design-tokens.css` |
| `--radius-md` | `app/globals.css`, `styles/design-tokens.css` |
| `--radius-lg` | `app/globals.css`, `styles/design-tokens.css` |
| `--radius-xl` | `app/globals.css`, `styles/design-tokens.css` |
| `--radius-none` | `app/globals.css`, `styles/design-tokens.css` |
| `--radius-2xl` | `app/globals.css`, `styles/design-tokens.css` |
| `--radius-full` | `app/globals.css`, `styles/design-tokens.css` |
| `--rule` | `components/evidence-record/record.css`, `styles/matcha-zen.css` |
| `--ivory` | `styles/career-loop-home.css`, `styles/reset-home.css` |
| `--ivory-deep` | `styles/career-loop-home.css`, `styles/reset-home.css` |
| `--ink-soft` | `styles/career-loop-home.css`, `styles/reset-home.css` |
| `--indigo` | `styles/career-loop-home.css`, `styles/reset-home.css` |
| `--indigo-deep` | `styles/career-loop-home.css`, `styles/reset-home.css` |
| `--paper-on-ink` | `styles/career-loop-home.css`, `styles/reset-home.css` |
| `--stone` | `styles/career-loop-home.css`, `styles/reset-home.css` |
| `--stone-deep` | `styles/career-loop-home.css`, `styles/reset-home.css` |
| `--stone-dim` | `styles/career-loop-home.css`, `styles/reset-home.css` |
| `--stone-dash` | `styles/career-loop-home.css`, `styles/reset-home.css` |
| `--stone-lane` | `styles/career-loop-home.css`, `styles/reset-home.css` |
| `--placeholder` | `styles/career-loop-home.css`, `styles/reset-home.css` |
| `--pure-white` | `styles/career-loop-home.css`, `styles/reset-home.css` |
| `--space-1` | `styles/design-tokens.css`, `styles/wave1501-home.css` |
| `--space-5` | `styles/design-tokens.css`, `styles/wave1501-home.css` |
| `--space-12` | `styles/design-tokens.css`, `styles/wave1501-home.css` |
| `--vt-badge-access-text` | `styles/home.css`, `styles/tokens.css` |
| `--ink-950` | `styles/matcha-zen.css`, `styles/wave1501-home.css` |
| `--ink-900` | `styles/matcha-zen.css`, `styles/wave1501-home.css` |
| `--ink-800` | `styles/matcha-zen.css`, `styles/wave1501-home.css` |

## Per-file census

| File | Bytes | Selectors | Props | Importers | Dead-class candidates |
|---|---|---|---|---|---|
| `app/globals.css` | 35133 | 29 | 202 | 1 | 3 |
| `components/evidence-record/record.css` | 14067 | 55 | 13 | 3 | 0 |
| `components/home/SourceCoverageRibbon.module.css` | 1210 | 3 | 0 | 1 | 0 |
| `components/motion/ScrollMotion.module.css` | 1443 | 7 | 0 | 1 | 0 |
| `components/page-stack/PageStack.module.css` | 2846 | 18 | 0 | 4 | 0 |
| `styles/antigravity.css` | 19598 | 62 | 128 | 1 | 47 |
| `styles/artifact-motion.css` | 12774 | 35 | 5 | 9 | 2 |
| `styles/blueprint-overrides.css` | 9482 | 39 | 0 | 1 | 2 |
| `styles/career-loop-home.css` | 21689 | 109 | 18 | 1 | 3 |
| `styles/clinician-doc.css` | 5518 | 21 | 32 | 1 | 0 |
| `styles/design-tokens.css` | 2727 | 1 | 57 | 2 | 0 |
| `styles/glass-cursor.css` | 2295 | 3 | 0 | 1 | 0 |
| `styles/graph.css` | 7883 | 39 | 0 | 1 | 13 |
| `styles/header.css` | 9570 | 46 | 5 | 1 | 0 |
| `styles/holder-light-compat.css` | 1997 | 5 | 0 | 2 | 0 |
| `styles/home.css` | 32085 | 120 | 16 | 13 | 3 |
| `styles/homepage-motion.css` | 22298 | 80 | 1 | 3 | 6 |
| `styles/intelligence.css` | 16966 | 87 | 27 | 1 | 24 |
| `styles/kinetic.css` | 1279 | 3 | 0 | 1 | 3 |
| `styles/matcha-deck.css` | 25256 | 149 | 24 | 1 | 2 |
| `styles/matcha-zen.css` | 27378 | 66 | 41 | 4 | 3 |
| `styles/matcha.css` | 1636 | 4 | 0 | 1 | 1 |
| `styles/motion.css` | 8284 | 0 | 0 | 15 | 0 |
| `styles/page-density.css` | 1932 | 7 | 5 | 2 | 0 |
| `styles/reset-home.css` | 19198 | 92 | 18 | 1 | 1 |
| `styles/scene.css` | 2178 | 5 | 0 | 2 | 2 |
| `styles/story-rail.css` | 4005 | 15 | 0 | 1 | 0 |
| `styles/themes/index.css` | 9965 | 6 | 86 | 2 | 2 |
| `styles/tokens.css` | 16555 | 12 | 195 | 2 | 7 |
| `styles/typography.css` | 10416 | 27 | 54 | 2 | 10 |
| `styles/utilities.css` | 6642 | 14 | 0 | 1 | 6 |
| `styles/vds.css` | 958 | 4 | 0 | 1 | 3 |
| `styles/vitalTokens.css` | 6741 | 2 | 79 | 2 | 0 |
| `styles/wave1501-home.css` | 25362 | 120 | 91 | 4 | 11 |
| `styles/z1-home.css` | 33280 | 183 | 2 | 1 | 7 |

## Importers and dead-class detail

### `app/globals.css`

Imported by: `app/layout.tsx`

Dead-class candidates: `.animate-node-breathe`, `.glow-on-hover`, `.memory-cluster`

### `components/evidence-record/record.css`

Imported by: `app/design/reset/page.tsx`, `components/evidence-record/Z1Home.tsx`, `components/evidence-record/faces.mjs`

### `components/home/SourceCoverageRibbon.module.css`

Imported by: `components/home/SourceCoverageRibbon.tsx`

### `components/motion/ScrollMotion.module.css`

Imported by: `components/motion/ScrollMotion.tsx`

### `components/page-stack/PageStack.module.css`

Imported by: `components/page-stack/EntityLink.tsx`, `components/page-stack/EntityPreviewCard.tsx`, `components/page-stack/PageStack.tsx`, `components/page-stack/Pane.tsx`

### `styles/antigravity.css`

Imported by: `app/layout.tsx`

Dead-class candidates: `.ag-arrow-link`, `.ag-body`, `.ag-btn`, `.ag-btn-accent`, `.ag-btn-compact`, `.ag-btn-nav`, `.ag-btn-primary`, `.ag-btn-secondary`, `.ag-btn-text`, `.ag-caption`, `.ag-card`, `.ag-card-elevated`, `.ag-code`, `.ag-col-1`, `.ag-col-10`, `.ag-col-11`, `.ag-col-12`, `.ag-col-2`, `.ag-col-3`, `.ag-col-4`, `.ag-col-5`, `.ag-col-6`, `.ag-col-7`, `.ag-col-8`, `.ag-col-9`, `.ag-container`, `.ag-cta`, `.ag-cta-nav`, `.ag-divider`, `.ag-grid-col`, `.ag-grid-row`, `.ag-heading-0`, `.ag-heading-00`, `.ag-heading-1`, `.ag-heading-2`, `.ag-heading-3`, `.ag-heading-4`, `.ag-heading-5`, `.ag-heading-6`, `.ag-heading-7`, `.ag-heading-8`, `.ag-heading-9`, `.ag-input`, `.ag-label`, `.ag-landing-main`, `.ag-pill`, `.ag-small`

### `styles/artifact-motion.css`

Imported by: `__tests__/scene-artifacts.test.tsx`, `app/employers/how-it-works/page.tsx`, `app/employers/page.tsx`, `app/pilot/page.tsx`, `app/trust/page.tsx`, `components/artifacts/PageArtifacts.tsx`, `components/artifacts/SceneArtifacts.tsx`, `components/matcha/MatchaExperienceShowcase.tsx`, `components/motion/ArtifactStage.tsx`

Dead-class candidates: `.ask-art-glyph-accent`, `.ask-art-overlap`

### `styles/blueprint-overrides.css`

Imported by: `app/globals.css (@import)`

Dead-class candidates: `.vital-blueprint`, `.vital-topnav__divider`

### `styles/career-loop-home.css`

Imported by: `app/page.tsx`

Dead-class candidates: `.clh-plate-sub`, `.clh-proof`, `.clh-room--ivory`

### `styles/clinician-doc.css`

Imported by: `app/globals.css (@import)`

### `styles/design-tokens.css`

Imported by: `components/layout/Grid.tsx`, `app/globals.css (@import)`

### `styles/glass-cursor.css`

Imported by: `app/layout.tsx`

### `styles/graph.css`

Imported by: `app/globals.css (@import)`

Dead-class candidates: `.tippy-arrow`, `.tippy-box`, `.tippy-content`, `.vital-graph-badge`, `.vital-graph-badge--accent`, `.vital-graph-drawer`, `.vital-graph-loading`, `.vital-graph-stage`, `.vital-graph-statusbar`, `.vital-graph-statusbar__group`, `.vital-graph-tabs`, `.vital-swatch`, `.vital-swatch--line`

### `styles/header.css`

Imported by: `app/globals.css (@import)`

### `styles/holder-light-compat.css`

Imported by: `components/holder/HolderWorkspaceShell.tsx`, `app/globals.css (@import)`

### `styles/home.css`

Imported by: `__tests__/design-wave1501.test.tsx`, `__tests__/evidence-capsule.test.tsx`, `__tests__/film-journey-unification.test.tsx`, `app/design/reset/page.tsx`, `app/dev/compete-film/page.tsx`, `app/page.tsx`, `components/evidence-record/Z1Home.tsx`, `components/home/evidence/EvidenceCapsule.tsx`, `components/home/film/HorizontalCareerFilm.tsx`, `components/home/w1501/Sky.tsx`, `components/home/w1501/Wave1501Client.tsx`, `components/home/w1501/primitives.tsx`, `scripts/evidence-record-acceptance-matrix.mjs`

Dead-class candidates: `.film-narration`, `.film-narration-line`, `.film-narration-mark`

### `styles/homepage-motion.css`

Imported by: `__tests__/chapter-anchor-contract.test.ts`, `components/home/StoryIcon.tsx`, `app/globals.css (@import)`

Dead-class candidates: `.hero-compact`, `.mz-scale-lg`, `.mz-scroll-cue`, `.proofcycle`, `.proofcycle-word`, `.proofcycle-words`

### `styles/intelligence.css`

Imported by: `app/globals.css (@import)`

Dead-class candidates: `.vital-card-grid`, `.vital-feed-card--ranked`, `.vital-feed-card__signal--investigator`, `.vital-graph-stage--context`, `.vital-metric-card`, `.vital-metric-card--accent`, `.vital-metric-card--danger`, `.vital-metric-card--success`, `.vital-metric-grid`, `.vital-profile-spotlight`, `.vital-profile-spotlight__actions`, `.vital-profile-spotlight__copy`, `.vital-profile-spotlight__summary`, `.vital-profile-spotlight__title`, `.vital-results-table`, `.vital-results-table__head`, `.vital-results-table__row`, `.vital-status-pill--blocked`, `.vital-status-pill--elevated`, `.vital-status-pill--ready`, `.vital-verification-banner`, `.vital-verification-banner--no_match`, `.vital-verification-banner--ready`, `.vital-verification-banner--watch`

### `styles/kinetic.css`

Imported by: `app/globals.css (@import)`

Dead-class candidates: `.kinetic-phrase-in`, `.kinetic-phrase-slot`, `.workflow-fade-in`

### `styles/matcha-deck.css`

Imported by: `app/globals.css (@import)`

Dead-class candidates: `.mdk-chip--possible`, `.mdk-chip--promising`

### `styles/matcha-zen.css`

Imported by: `app/explore/page.tsx`, `components/clinician-record/ClinicianRecordDetail.tsx`, `components/motion/Reveal.tsx`, `app/globals.css (@import)`

Dead-class candidates: `.mz-display-hero`, `.mz-dotgrid`, `.mz-meter-ok`

### `styles/matcha.css`

Imported by: `app/globals.css (@import)`

Dead-class candidates: `.matcha-skeleton`

### `styles/motion.css`

Imported by: `__tests__/chapter-anchor-contract.test.ts`, `__tests__/scene-artifacts.test.tsx`, `app/employers/how-it-works/page.tsx`, `app/employers/page.tsx`, `app/ops/engine/page.tsx`, `app/pilot/page.tsx`, `app/trust/page.tsx`, `components/artifacts/PageArtifacts.tsx`, `components/artifacts/SceneArtifacts.tsx`, `components/design-wave1505/views-governance.tsx`, `components/evidence-record/Z1Home.tsx`, `components/home/StoryIcon.tsx`, `components/matcha/MatchaExperienceShowcase.tsx`, `components/motion/ArtifactStage.tsx`, `app/globals.css (@import)`

### `styles/page-density.css`

Imported by: `__tests__/page-density-system.test.tsx`, `app/layout.tsx`

### `styles/reset-home.css`

Imported by: `app/design/reset/page.tsx`

Dead-class candidates: `.rst-room--ivory`

### `styles/scene.css`

Imported by: `components/home/scene/AmbientField.tsx`, `app/globals.css (@import)`

Dead-class candidates: `.scene-scrim`, `.scene-scrim-strong`

### `styles/story-rail.css`

Imported by: `app/globals.css (@import)`

### `styles/themes/index.css`

Imported by: `components/vds/primitives.tsx`, `app/globals.css (@import)`

Dead-class candidates: `.vt-animate-grow-x`, `.vt-animate-rise`

### `styles/tokens.css`

Imported by: `components/layout/Grid.tsx`, `app/globals.css (@import)`

Dead-class candidates: `.ops-muted`, `.ops-subtle`, `.ops-surface-alt`, `.trust-l0`, `.trust-l1`, `.trust-l2`, `.trust-l3`

### `styles/typography.css`

Imported by: `app/layout.tsx`, `app/globals.css (@import)`

Dead-class candidates: `.metric-lg`, `.metric-sm`, `.metric-xl`, `.type-body-lg`, `.type-body-sm`, `.type-heading-lg`, `.type-heading-md`, `.type-heading-sm`, `.type-heading-xl`, `.type-label`

### `styles/utilities.css`

Imported by: `app/globals.css (@import)`

Dead-class candidates: `.animate-alive-slide`, `.animate-critical-pulse`, `.badge-animate-pop`, `.command-pulse`, `.command-ripple`, `.staggered-scroll-reveal`

### `styles/vds.css`

Imported by: `app/globals.css (@import)`

Dead-class candidates: `.vds-graph-cluster-label`, `.vds-graph-dimmed`, `.vds-graph-focused`

### `styles/vitalTokens.css`

Imported by: `components/design-wave1505/styles.ts`, `app/globals.css (@import)`

### `styles/wave1501-home.css`

Imported by: `__tests__/design-wave1501.test.tsx`, `components/home/w1501/Sky.tsx`, `components/home/w1501/Wave1501Client.tsx`, `components/home/w1501/primitives.tsx`

Dead-class candidates: `.vt-btn-primary`, `.vt-btn-secondary`, `.vt-chip`, `.vt-chip-dot`, `.vt-freshness`, `.vt-honesty`, `.vt-paper-card`, `.vt-srcrow`, `.vt-srcrow-label`, `.vt-srcrow-source`, `.vt-srcrow-spacer`

### `styles/z1-home.css`

Imported by: `components/evidence-record/Z1Home.tsx`

Dead-class candidates: `.z1-loop-inner`, `.z1-loop-title`, `.z1-loop-track`, `.z1-stage-desc`, `.z1-stage-glyph`, `.z1-stage-item`, `.z1-stage-name`
