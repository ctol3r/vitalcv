# Component Library Spec

Canonical home: `apps/web/design-system/components/`. New work imports from this directory only.

`apps/web/components/ui/` is the legacy shadcn-style layer; existing callers can stay until the sweep wave, but no new files land there.

## Active canonical components

| Component | Status | Owns axis | Notes |
|---|---|---|---|
| `Badge` | stable | generic neutral/accent/critical/warning/success/outline labels | Use the more specific chips below before reaching for this. |
| `Button` | stable | primary actions, secondary actions | `variant` + `size` props; restrained CTA palette. |
| `Card` / `ActionCard` / `FindingCard` / `IdentityFieldsCard` / `IdentityField` / `StorylineCard` / `ProviderCard` | stable | content containers | `ActionCard` adds a primary CTA; `FindingCard` is for surfaced findings (paired with severity). |
| `LaneStateBadge` + `LaneStateLegend` | stable | ops vocabulary (`checked` / `pending` / `access` / `blocked` / `contradicted` / `unknown` / `info`) | Internal type uses `'verified'` but visible label is `"Checked"`. **Do not change this** — it's the canonical guard against the banned word. |
| **`TruthStateChip` + `TruthStateLegend`** (Wave G) | **NEW — added in PR #425** | system-state vocabulary (`source-backed` / `snapshot-only` / `institution-review-required` / `access-required` / `auth-required` / `temporarily-unavailable` / `connector-not-live` / `demo-only`) | Use for: Passport source rows, Connector Matrix on `/status`, per-field register on `/trust/attribution`. See `apps/web/design-system/docs/truth-state-chip.md` for full guidance. |
| `TrustTierBadge` | stable | T1–T4 source tier | Pair with `TruthStateChip` on a Passport row to show *what kind of source* (T1–T4) and *what state* (source-backed / unavailable / …). |
| `ConfidenceBadge` / `ConfidenceTierBadge` | stable | confidence tier | Independent axis from truth state. |
| `SeverityBadge` | stable | severity 1–5 | Pair with `FindingCard`. |
| `RiskScoreBadge` | stable | risk score | Independent of trust/severity; product-specific. |
| `ExclusionBadge` (`components/psv/`) | stable | OIG/LEIE outcome | Adverse-finding axis. **Do not collapse into `TruthStateChip`.** |
| `SanctionRiskBadge` (`components/trust-state/`) | stable | sanction risk tier | Same axis as ExclusionBadge but quantitative. |
| `DecisionBadge` / `ReceiptVerificationBadge` / `ReplayIntegrityBadge` / `LaneHealthBadge` / `ReuseSignalBadge` | stable | per-domain decision/integrity/lane-health/reuse artefacts | Each owns its own axis; not interchangeable. |
| `EvidenceTable` / `Table` / `Timeline` / `Tabs` / `Panel` / `Modal` / `Toast` / `Dropdown` / `Input` / `Icon` | stable | primitives | Existing API; no Wave-G-era changes needed. |
| `FreshnessIndicator` | stable | timestamp-relative freshness | Pair with `TruthStateChip` in source rows. |
| `GraphLegend` / `GraphToolbar` | stable | trust-graph chrome | Used on `/trust/graph`. |
| `InvestigationPanel` | stable | investigation-ops chrome | Internal ops surfaces. |

## Components to retire or migrate (long-tail sweep, NOT this batch)

- `components/ui/StatusBadge.tsx`
- `components/ui/BadgeStatus.tsx`
- `components/ui/trust-status-badge.tsx`
- `components/ui/claim-badge.tsx`
- `components/ui/badge.tsx` (shadcn primitive — keep for shadcn-derived patterns; migrate one caller at a time)

Hand-rolled `<span>` status pills in:

- `apps/web/components/passport/` (Passport-side source rows)
- `apps/web/components/trust/` (Trust-side coverage tags)
- `apps/web/components/source-health/` (lane health summaries)

Each migrates to `TruthStateChip` as its host route is upgraded (Waves H / K).

## Conventions

- **CSS variables, not Tailwind values.** Every component uses `var(--vt-…)` tokens. No raw hex, no inline rgba, no Tailwind config additions.
- **`cva` for variant matrices.** All chips/badges use `cva` from `class-variance-authority`. New components should follow.
- **`cn` from `@/lib/utils` for class merging.** Standard tailwind-merge-aware helper.
- **`lucide-react` for iconography.** No custom SVG inlining unless the icon is genuinely unique.
- **Tests live in `apps/web/__tests__/`.** Vitest + `react-dom/server` `renderToStaticMarkup`. JSX requires `import React from 'react';` at the top.
- **Banned-string regression tests** are mandatory for any component that renders a status label. See `apps/web/__tests__/truth-state-chip.test.tsx` for the canonical pattern.

## Out of scope for this doc

- Per-route composition — see `screen-composition-spec.md`.
- State treatment matrix — see `state-model-as-design.md`.
- Visual north star (palette, type, motion) — see `vitalcv-visual-system.md`.
