# VitalCV Design System (VDS) — Agent Reference

> This document is for AI agents (OpenClaw, Codex, Claude) editing VitalCV UI.
> Follow these rules to maintain design consistency.

## Source of Truth

**All shared UI primitives live in:**
```
apps/web/components/vds/primitives.tsx
```

**Old import paths re-export from VDS:**
- `intelligence-ops/primitives.tsx` → aliases to VDS
- `intelligence/shared.tsx` → console-specific wrappers + VDS-compatible tokens

**New code should import from `@/components/vds/primitives`.**

## Theme System

**Tokens file:** `apps/web/styles/themes/index.css`
**4 themes:** light · dark · midnight · graphite

### Core Variables (always use these)

| Variable | Purpose |
|---|---|
| `--vt-bg` | Page background |
| `--vt-surface` | Card / panel surface |
| `--vt-surface-2` | Elevated surface (hover, nested) |
| `--vt-border` | Default border |
| `--vt-border-2` | Subtle border (inner, dividers) |
| `--vt-text-1` | Primary text |
| `--vt-text-2` | Secondary / label text |
| `--vt-text-3` | Muted / placeholder text |
| `--vt-accent` | Interactive accent |
| `--vt-critical` | Danger / error |
| `--vt-warning` | Warning |
| `--vt-success` | Positive / verified |
| `--vt-info` | Informational |

### Badge Variables

Each tone has `--vt-badge-{tone}-bg`, `--vt-badge-{tone}-text`, `--vt-badge-{tone}-border`.
Tones: `neutral` · `critical` · `warning` · `success` · `info`

## Approved Primitives

| Primitive | Use For |
|---|---|
| `VBadge` | Status, severity, priority, category labels |
| `VCard` | Any content container / panel |
| `VCardSkeleton` | Loading state for VCard |
| `VBanner` | Alert banners, system messages |
| `VEmptyState` | No data / no results states |
| `VErrorState` | Error with retry button |
| `VSectionHeader` | Eyebrow + title + optional action |
| `VButton` | Actions (variants: default, ghost, accent) |
| `VFilterChip` | Toggle chip for filter bars |
| `VTimestamp` | Relative time with absolute tooltip |
| `ConfidenceMeter` | Small progress bar with percentage |
| `VBackLink` | Navigation back link |
| `VEntityLink` | Inline entity reference link |
| `VBadgeLink` | Clickable badge that navigates |
| `VPaginationControls` | Page navigation |

### Badge Tone Rules

| Tone | When to Use |
|---|---|
| `critical` | Revoked, outage, critical severity |
| `warning` | High severity, escalated, expired |
| `success` | Verified, completed, resolved, healthy, low severity |
| `info` | Medium, pending, in-progress, new, acknowledged |
| `neutral` | Skipped, dismissed, unknown, category labels |

Use `severityTone(value)` to map any status string to the correct tone.

### Score Color Rules

- `riskScoreColor(score)` → red ≥75, amber ≥50, green ≥25, muted below
- `trustScoreColor(score)` → green ≥75, blue ≥50, amber ≥25, muted below

## Forbidden Patterns

**DO NOT use in product surfaces (`intelligence-ops/`, `intelligence/`, `vds/`):**

```
❌ text-white          → ✅ text-[var(--vt-text-1)]
❌ text-slate-300      → ✅ text-[var(--vt-text-2)]
❌ text-slate-400      → ✅ text-[var(--vt-text-3)]
❌ bg-slate-950        → ✅ bg-[var(--vt-surface)]
❌ border-white/10     → ✅ border-[var(--vt-border)]
❌ bg-white/5          → ✅ bg-[var(--vt-surface-2)]
❌ hover:bg-white/10   → ✅ hover:bg-[var(--vt-surface-2)]
❌ hover:text-white    → ✅ hover:text-[var(--vt-text-1)]
❌ Inline badge styles → ✅ <VBadge tone="..." label="..." />
❌ One-off panel shells → ✅ <VCard>...</VCard>
❌ Duplicate empty state → ✅ <VEmptyState title="..." description="..." />
```

**Exceptions (mark with `// vds-lint-ignore`):**
- Graph canvas rendering (JS-side colors, not CSS)
- Marketing pages (use oklch palette)
- Decorative elements (avatar circles, timeline dots)

## Enforcement

Run before commits:
```bash
bash apps/web/scripts/vds-lint.sh        # warn mode
bash apps/web/scripts/vds-lint.sh --strict  # fail on violations
```

## Adding a New Theme

1. Add `[data-theme="your-theme"]` block in `/styles/themes/index.css`
2. Define all 14 `--vt-*` variables + badge variables + shadows
3. Add to `ThemePicker` in `components/ui/ThemeToggle.tsx`
