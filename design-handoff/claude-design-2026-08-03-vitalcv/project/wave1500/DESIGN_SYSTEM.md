# VitalCV DESIGN_SYSTEM.md — Wave 1500

> Canonical spec. Supersedes scattered doctrine in `design-tokens.css`, `vitalTokens.css`, `matcha-zen.css`, `blueprint-overrides.css`, `visual-qa.css`. Token source of truth: `01-primitives.css` → `02-semantic.css` → `03-themes.css` (import in that order; delete the old five-way stack).

## 1. Palette (DG-1.1 — decided)

| Token | Value | Role | Rule |
|---|---|---|---|
| `--vt-surface-page` | `#f4f2ec` | Page paper | Every public page. Meta theme-color = paper on public pages. |
| `--vt-surface-card` | `#ffffff` | Raised card | Rule borders, never shadows (one hover-lift exception). |
| `--vt-text` | `#141414` | Ink | Body, primary buttons, borders, focus. The workhorse. |
| `--vt-text-secondary` | `#474540` | Support copy | Passes 4.5:1 on paper (fixes DG-3.1 alpha-ink). |
| `--vt-text-muted` | `#6b6860` | Captions | ≥12px only. Never body text. |
| `--vt-brand` | `#2c3e2d` (matcha 800) | THE brand accent | Recognition moments, brand chips, primary-button hover, MATCHA surfaces. |
| `--vt-accent-editorial` | `#4f46e5` (indigo) | Editorial accent | Italic Fraunces display phrases ONLY, ≤1 per section headline. |

**Killed:** Trust Blue `oklch(0.55 0.20 255)`, teal `#0a7b7f`, `--vt-glow-*`, glass tokens on public surfaces. `--vt-color-brand-primary` now aliases matcha (DG-1.2).

## 2. Truth states (DG-3.2 — one semantic set, 9 coverage states)

Each state = text + bg + rule token (`--vt-state-{name}[-bg|-rule]`) + glyph (DG-4.2). Glyph + label always paired — grayscale legible.

| State | Hue family | Glyph |
|---|---|---|
| checked | green `#1c5c38` | solid check |
| stale | amber `#7d5a1e` | clock |
| pending | neutral, dashed border | dashed circle |
| gated | amber | lock |
| unavailable | neutral | slash |
| accessRequired | amber | key |
| reviewRequired | amber on white | eye |
| notDecisionGrade | neutral on white | asterisk |
| previewOnly | blue-gray, dashed border | ghost outline |
| p0 (review) | red `#7a1414` | triangle |
| contradicted (review) | purple `#5b2a86` | diverging arrows |

Dashed border = degraded/preview semantics everywhere (`--vt-degraded-border`).

## 3. Typography (DG-2.1)

- **Fraunces** — display (h1–h3), optical sizing on, weight ~560. Italic + indigo = the accent rule.
- **Geist** — body 14/1.6. **Geist Mono** — eyebrows (10px caps +0.2em), NPI digits, RUN_ID, hashes, timestamps; `tabular-nums` on all metrics.
- Kill Plus Jakarta / Inter / JetBrains / DM Sans references. Load via `next/font` self-hosted (repo task).

## 4. Motion (DG-5.2)

House curve `cubic-bezier(0.2, 0.8, 0.2, 1)` · 240–420ms (base 320ms) · single-shot entrances (`.vt-enter`) · hover lift ≤2px · **no infinite loops on public surfaces** (exceptions: loading skeleton shimmer, /status live pulse) · no global `*` transition · full `prefers-reduced-motion` static fallback.

## 5. Radius / shadow / focus

Radius 2–6px public; 12px ops-only. Shadows: none on paper except `--vt-lift` on hover. Focus everywhere: 2px ink ring + 2px paper offset (`--vt-focus-ring`).

## 6. Components (this wave)

`StateChip` (sm/md, tooltip = source + freshness + definition) · `TrustGlyph` (9 states + T1–T4) · `ProofTierBadge` · `SourceRow` (label / mono source / chip / freshness / action) · `ReadinessRing` (role="meter", band by threshold, sweeps once) · `FreshnessStamp` (relative, ISO on hover, stale coloring) · `HonestyLabel` (designed, never fine print) · buttons (primary ink-fill w/ matcha hover, secondary rule-outline, quiet underline, destructive) · `PaperCard` (rule border, optional lift) · `NpiInput` (10-digit, live 0/10 counter, no account required).

## 7. Do / Don't

- **Do** show gated/unavailable sources honestly — never a bare checkmark.
- **Do** use matcha solid only for Recognition moments; ink for everything else.
- **Don't** put indigo anywhere but italic display phrases.
- **Don't** use dark surfaces on public routes — dark is ops-only (`[data-theme="ops"]`). Passport = light paper (decided).
- **Don't** add gradients, glows, glass, marquees, breathing nodes to public surfaces.

## 8. Adopted vs dropped

- **Adopted:** matcha-zen paper/ink scales, D56 truth-state hues + dashed-degraded semantics, Trust Register table austerity.
- **Dropped:** claude-design-2026-06-26 glass cards, ops gradients on public, Trust Blue, spring per-card motion, MagneticButton/CursorPhysics/SpotlightCard.
