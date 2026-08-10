# VitalCV — DESIGN.md

> **GENERATED — do not edit by hand.**
> `node --experimental-strip-types scripts/generate-design-md.ts`
> `design-md-freshness.test.ts` fails if this file drifts from the CSS.

This file states **facts about the tokens as they are declared today**. It is written for
coding agents building VitalCV UI, and it is regenerated from the CSS so it cannot
describe an architecture nobody shipped.

## Governance — this file is not the authority

| Domain | Authority | This file |
|---|---|---|
| Brand decisions (type, palette, radius, motion, light/dark) | `docs/design/VITALCV_EXPERIENCE_CONSTITUTION.md` **EC-20** | points, never restates |
| Component + token architecture | `design-handoff/claude-design-2026-07-12-wave1505/wave1505/DESIGN_SYSTEM.md` | points, never restates |
| Truth/copy contract, banned strings | `CLAUDE.md` + **EC-3** | points, never restates |
| Which tokens exist, where, and which wins | **here** | authoritative |

Where wave-1505 and EC-20 disagree, **EC-20 wins**: 1505 is the architecture, its values
are superseded. Reading 1505 for values ships the wrong brand.

## Cascade order (the precedence nobody had written down)

Token files are `@import`ed by `app/globals.css` in this order. **Later wins** at equal
specificity, so this list is the precedence:

| # | File | `--vt-*` declarations |
|---|---|---|
| 1 | `apps/web/styles/themes/index.css` | 147 |
| 2 | `apps/web/styles/tokens.css` | 35 |
| 3 | `apps/web/styles/vitalTokens.css` | 69 |
| 4 | `apps/web/styles/matcha-zen.css` | 16 |

**267 declarations across 4 files, 178 distinct tokens.**

## Collisions — one declaration silently overriding another

Same token, **same selector**, different value, in more than one file. Theme variants
(`[data-theme]`, `.mz`, `.dark`) are not collisions — that is what theming is, and
**59 tokens** legitimately vary by selector.

**15 tokens are silently overridden.** The winning value is the lowest row for
each (latest import). Reported, not resolved — resolving them is a design decision, and
this file only measures.

| Token | Value | Declared in | Selector | Wins? |
|---|---|---|---|---|
| `--vt-badge-critical-bg` | `transparent` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-critical-bg` | `var(--vt-badge-unavailable-bg)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-critical-border` | `var(--vt-severity-critical)` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-critical-border` | `var(--vt-badge-unavailable-bg)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-critical-text` | `var(--vt-severity-critical)` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-critical-text` | `var(--vt-badge-unavailable-text)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-info-bg` | `transparent` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-info-bg` | `var(--vt-badge-preview-bg)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-info-border` | `var(--vt-border)` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-info-border` | `var(--vt-badge-preview-bg)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-info-text` | `var(--vt-text-primary)` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-info-text` | `var(--vt-badge-preview-text)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-neutral-bg` | `transparent` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-neutral-bg` | `var(--vt-badge-access-bg)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-neutral-border` | `var(--vt-border)` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-neutral-border` | `var(--vt-badge-access-bg)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-neutral-text` | `var(--vt-text-secondary)` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-neutral-text` | `var(--vt-badge-access-text)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-success-bg` | `transparent` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-success-bg` | `var(--vt-badge-checked-bg)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-success-border` | `var(--vt-status-resolved)` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-success-border` | `var(--vt-badge-checked-bg)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-success-text` | `var(--vt-status-resolved)` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-success-text` | `var(--vt-badge-checked-text)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-warning-bg` | `transparent` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-warning-bg` | `var(--vt-badge-pending-bg)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-warning-border` | `var(--vt-severity-medium)` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-warning-border` | `var(--vt-badge-pending-bg)` | `styles/tokens.css` | `:root` | **yes** |
| `--vt-badge-warning-text` | `var(--vt-severity-medium)` | `styles/themes/index.css` | `:root` | no |
| `--vt-badge-warning-text` | `var(--vt-badge-pending-text)` | `styles/tokens.css` | `:root` | **yes** |

## Tokens

Role sentences come from `docs/design/design-md-roles.json`. **8 of 178**
tokens have a documented role; the rest say so plainly rather than inventing one.

| Token | Effective value | Declared in | Role |
|---|---|---|---|
| `--vt-accent` | `var(--accent)` | `styles/themes/index.css, styles/matcha-zen.css` | — *(role not documented)* |
| `--vt-accent-editorial` | `var(--accent)` | `styles/themes/index.css, styles/matcha-zen.css` | — *(role not documented)* |
| `--vt-accent-editorial-on-dark` | `#A5B4FC` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-accent-editorial-on-paper` | `#4338CA` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-accent-hover` | `#322BA6` | `styles/tokens.css` | — *(role not documented)* |
| `--vt-accent-press` | `#322BA6` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-accent-strong` | `var(--ink-900)` | `styles/matcha-zen.css` | — *(role not documented)* |
| `--vt-accent-wash` | `#ECEBF8` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-bg` | `var(--vt-scene-paper)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-bg-press` | `#E4E1D8` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-fg` | `var(--vt-scene-paper-text)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-fg-press` | `var(--vt-scene-paper-text)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-inverse-bg` | `#151412` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-inverse-bg-press` | `#32302D` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-inverse-fg` | `#F6F5F1` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-action-primary-inverse-fg-press` | `#F6F5F1` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-badge-access-bg` | `#F0F1F3` | `styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-access-text` | `#6B6F75` | `styles/tokens.css` | Warm grey ink for gated and access-required states. Warm on purpose: CD-4 requires a warm ramp, and the prior blue-leaning value put cool ink on a warm surface. |
| `--vt-badge-checked-bg` | `#E8F5EE` | `styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-checked-text` | `#2E7D45` | `styles/tokens.css` | Ink for the one affirmative state. Only `checked` earns it — a source returned a usable payload. Never decoration, never a default success colour. |
| `--vt-badge-critical-bg` | `var(--vt-badge-unavailable-bg)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-critical-border` | `var(--vt-badge-unavailable-bg)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-critical-text` | `var(--vt-badge-unavailable-text)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-info-bg` | `var(--vt-badge-preview-bg)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-info-border` | `var(--vt-badge-preview-bg)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-info-text` | `var(--vt-badge-preview-text)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-neutral-bg` | `var(--vt-badge-access-bg)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-neutral-border` | `var(--vt-badge-access-bg)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-neutral-text` | `var(--vt-badge-access-text)` | `styles/themes/index.css, styles/tokens.css` | Ink for absence — unavailable, no-active-record, not-decision-grade. Neutral because absence is not severity; red is reserved for revoked alone. |
| `--vt-badge-pending-bg` | `#FEF3E2` | `styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-pending-text` | `#A05C00` | `styles/tokens.css` | Ink for in-flight and aged states (pending, stale, review-required). Amber says 'not settled', never 'wrong'. |
| `--vt-badge-preview-bg` | `#E5F4F5` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-preview-text` | `#0A7B7F` | `styles/themes/index.css, styles/tokens.css` | Ink for synthetic/preview payloads. Must never be mistaken for a real source confirmation. |
| `--vt-badge-success-bg` | `var(--vt-badge-checked-bg)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-success-border` | `var(--vt-badge-checked-bg)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-success-text` | `var(--vt-badge-checked-text)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-unavailable-bg` | `#F5EDED` | `styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-unavailable-text` | `#8C2A2A` | `styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-warning-bg` | `var(--vt-badge-pending-bg)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-warning-border` | `var(--vt-badge-pending-bg)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-badge-warning-text` | `var(--vt-badge-pending-text)` | `styles/themes/index.css, styles/tokens.css` | — *(role not documented)* |
| `--vt-bg` | `var(--paper)` | `styles/themes/index.css, styles/matcha-zen.css` | — *(role not documented)* |
| `--vt-border` | `var(--rule)` | `styles/themes/index.css, styles/matcha-zen.css` | — *(role not documented)* |
| `--vt-border-2` | `var(--vt-border-subtle)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-border-subtle` | `var(--rule-soft)` | `styles/themes/index.css, styles/matcha-zen.css` | — *(role not documented)* |
| `--vt-cloud-dancer` | `#F0EEE9` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-color-brand-primary` | `oklch(0.66 0.18 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-brand-secondary` | `oklch(0.48 0.18 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-danger` | `oklch(0.65 0.20 25)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-info` | `oklch(0.60 0.18 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-neutral-100` | `oklch(0.210 0 0)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-neutral-200` | `oklch(0.274 0 0)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-neutral-300` | `oklch(0.320 0 0)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-neutral-400` | `oklch(0.400 0 0)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-neutral-500` | `oklch(0.550 0 0)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-neutral-600` | `oklch(0.700 0 0)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-neutral-700` | `oklch(0.870 0 0)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-neutral-800` | `oklch(0.922 0 0)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-neutral-900` | `oklch(0.965 0 0)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-success` | `oklch(0.68 0.18 155)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-color-warning` | `oklch(0.75 0.17 80)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-critical` | `var(--vt-severity-critical)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-divider-light` | `oklch(0.90 0.008 80)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-divider-ops` | `oklch(0.274 0 0)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-duration-interact` | `320ms` | `styles/tokens.css` | — *(role not documented)* |
| `--vt-ease-system` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | `styles/tokens.css` | — *(role not documented)* |
| `--vt-edge-co-author` | `#333333` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-edge-co-grant` | `#333333` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-edge-co-investigator` | `#333333` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-edge-industry-payment` | `#f59e0b` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-edge-practice-group` | `#333333` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-focus-ring` | `#E4E3E0` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-focus-ring-scene` | `var(--vt-accent-editorial-on-dark)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-focus-ring-scene-paper` | `var(--vt-accent-editorial-on-paper)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-font-body` | `var(--font-geist-loaded, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif)` | `styles/tokens.css` | — *(role not documented)* |
| `--vt-font-display` | `var(--font-fraunces-loaded, Georgia, 'Times New Roman', serif)` | `styles/tokens.css` | — *(role not documented)* |
| `--vt-frost-bg` | `color-mix(in oklab, var(--vt-scene-panel) 72%, transparent)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-frost-border` | `color-mix(in oklab, var(--vt-scene-text) 12%, transparent)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-glass-bg` | `oklch(1 0 0 / 0.05)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-glass-divider` | `oklch(1 0 0 / 0.05)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-glass-ring` | `oklch(1 0 0 / 0.10)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-glass-ring-faint` | `oklch(1 0 0 / 0.06)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-glass-sheen` | `inset 0 1px 0 0 color-mix(in oklab, white 60%, transparent)` | `styles/tokens.css` | — *(role not documented)* |
| `--vt-glass-subtle-bg` | `oklch(1 0 0 / 0.03)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-glow-passport` | `oklch(0.45 0.01 255 / 0.10)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-info` | `var(--vt-accent)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-node-alert` | `#ef4444` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-node-company` | `#8b5cf6` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-node-institution` | `#E4E3E0CC` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-node-provider` | `#E4E3E0` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-node-publication` | `#E4E3E066` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-node-trial` | `#E4E3E066` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-ops-from` | `oklch(0.05 0.008 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-ops-to` | `oklch(0.05 0.008 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-ops-via` | `oklch(0.08 0.006 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-outline-default` | `1px solid var(--vt-color-neutral-200)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-outline-focus` | `2px solid var(--vt-color-brand-primary)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-outline-strong` | `2px solid var(--vt-color-neutral-900)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-outline-thin` | `1px solid var(--vt-color-neutral-800)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-overlay` | `rgba(20, 20, 20, 0.85)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-passport-from` | `oklch(0.045 0.004 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-passport-to` | `oklch(0.075 0.008 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-passport-via` | `oklch(0.07 0.005 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-radius-full` | `9999px` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-radius-lg` | `0.75rem` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-radius-md` | `0.5rem` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-radius-sm` | `0.25rem` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-risk-high` | `var(--p0)` | `styles/themes/index.css, styles/matcha-zen.css` | — *(role not documented)* |
| `--vt-risk-low` | `#10b981` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-risk-medium` | `var(--watch)` | `styles/themes/index.css, styles/matcha-zen.css` | — *(role not documented)* |
| `--vt-scene-canvas` | `#151412` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-line` | `#32302D` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-line-strong` | `#403D39` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-panel` | `#1D1B19` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-panel-raised` | `#232120` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-paper` | `#F6F5F1` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-paper-line` | `#D9D6CD` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-paper-text` | `#151412` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-paper-text-secondary` | `#5B5C57` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-state-needs-person` | `#E4B45C` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-state-source-confirmed` | `#4ADE97` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-state-source-confirmed-deep` | `#2E9E6B` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-state-waiting` | `#8F8C88` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-text` | `#F2F1ED` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-text-secondary` | `#9C9D99` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-scene-text-tertiary` | `#888A85` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-severity-critical` | `#ef4444` | `styles/themes/index.css` | The reserved fail-closed red. `revoked` only. Any other state painting this is a truth defect, not a style choice. |
| `--vt-severity-high` | `#f59e0b` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-severity-low` | `#71717a` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-severity-medium` | `#3b82f6` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-shadow-card` | `0 14px 32px rgb(26 34 40 / 0.05), 0 2px 10px rgb(26 34 40 / 0.03)` | `styles/tokens.css` | — *(role not documented)* |
| `--vt-shadow-glow` | `0 0 30px oklch(0.55 0.20 255 / 0.3)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-shadow-lg` | `0 16px 32px -8px oklch(0 0 0 / 0.06), 0 8px 16px -4px oklch(0 0 0 / 0.03)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-shadow-md` | `0 8px 16px -4px oklch(0 0 0 / 0.04), 0 4px 8px -2px oklch(0 0 0 / 0.02)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-shadow-pill` | `0 1px 2px rgb(26 34 40 / 0.04)` | `styles/tokens.css` | — *(role not documented)* |
| `--vt-shadow-sm` | `0 2px 8px -2px oklch(0 0 0 / 0.03), 0 1px 3px -1px oklch(0 0 0 / 0.02)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-shadow-soft` | `0 20px 48px rgb(26 34 40 / 0.06), 0 6px 18px rgb(26 34 40 / 0.04)` | `styles/tokens.css` | — *(role not documented)* |
| `--vt-shape-card` | `20px` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-shape-control` | `10px` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-shape-panel` | `24px` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-shape-pill` | `9999px` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-spacing-2xl` | `3rem` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-spacing-lg` | `1.5rem` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-spacing-md` | `1rem` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-spacing-sm` | `0.5rem` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-spacing-xl` | `2rem` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-spacing-xs` | `0.25rem` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-state-access` | `#a5b4fc` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-state-blocked` | `#fb7185` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-state-contradicted` | `#d8b4fe` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-state-pending` | `#fbbf24` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-state-source-confirmed` | `var(--ok)` | `styles/themes/index.css, styles/matcha-zen.css` | — *(role not documented)* |
| `--vt-state-unknown` | `#94a3b8` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-status-acknowledged` | `#a1a1aa` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-status-dismissed` | `#52525b` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-status-investigating` | `#8b5cf6` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-status-new` | `#3b82f6` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-status-resolved` | `var(--ok)` | `styles/themes/index.css, styles/matcha-zen.css` | — *(role not documented)* |
| `--vt-success` | `var(--vt-status-resolved)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-surface` | `var(--card)` | `styles/themes/index.css, styles/matcha-zen.css` | — *(role not documented)* |
| `--vt-surface-2` | `var(--vt-surface-subtle)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-surface-base` | `oklch(0.12 0.008 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-surface-brand` | `oklch(0.97 0.03 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-surface-dim` | `#100F0E` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-surface-hero` | `linear-gradient(180deg, rgb(255 255 255 / 0.96), rgb(249 251 250 / 0.92))` | `styles/tokens.css` | — *(role not documented)* |
| `--vt-surface-ops-base` | `oklch(0.08 0.005 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-surface-ops-raised` | `oklch(0.12 0.008 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-surface-overlay` | `oklch(1 0 0 / 0.8)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-surface-raised` | `oklch(0.18 0.008 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-surface-subtle` | `var(--paper-2)` | `styles/themes/index.css, styles/matcha-zen.css` | — *(role not documented)* |
| `--vt-surface-sunken` | `oklch(0.08 0.005 255)` | `styles/vitalTokens.css` | — *(role not documented)* |
| `--vt-text-1` | `var(--vt-text-primary)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-text-2` | `var(--vt-text-secondary)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-text-3` | `var(--vt-text-muted)` | `styles/themes/index.css` | — *(role not documented)* |
| `--vt-text-muted` | `var(--ink-500)` | `styles/themes/index.css, styles/matcha-zen.css` | Captions and metadata, 12px and up. Never body text. |
| `--vt-text-primary` | `var(--ink-900)` | `styles/themes/index.css, styles/matcha-zen.css` | — *(role not documented)* |
| `--vt-text-secondary` | `var(--ink-600)` | `styles/themes/index.css, styles/matcha-zen.css` | Support copy. The darkest grey allowed for prose at AA on paper. Never body text on a dark ground without rechecking contrast. |
| `--vt-warning` | `var(--vt-severity-medium)` | `styles/themes/index.css` | — *(role not documented)* |

