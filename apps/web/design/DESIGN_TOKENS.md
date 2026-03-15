# Antigravity Design Tokens: "Operations Platform"

This document outlines the core tokens for the new VitalCV design system (replacing the previous "Liquid Glass" iteration).
These tokens are optimized for an infrastructure-grade, data-dense, dark-theme operational environment inspired by Palantir Foundry and BlueprintJS.

## Color Palette (Dark, Disciplined)

- `workspace-bg`: Near Black Graphite (`hsl(220, 10%, 8%)` / `#121418`)
- `panel-bg`: Dark Graphite (`hsl(220, 10%, 12%)` / `#1A1C22`)
- `component-base`: Slate Muted (`hsl(220, 10%, 16%)` / `#24272E`)
- `border-divider`: Sharp Gray (`hsl(220, 10%, 25%)` / `#393E46`)
- `text-primary`: Crisp White/Light Gray (`hsl(220, 10%, 95%)` / `#F0F2F5`)
- `text-muted`: Neutral Gray (`hsl(220, 10%, 60%)` / `#8A95A5`)

## Semantic Accents (Used sparingly)

- `focus`: Bright Yellow (`hsl(45, 90%, 55%)`) - For selected nodes and active states.
- `structure`: Cyan/Blue (`hsl(190, 80%, 50%)`) - For standard graph nodes and path edges.
- `cluster`: Magenta/Violet (`hsl(290, 70%, 55%)`) - For groups and dense logical clusters.
- `trust-valid`: Secure Green (`hsl(150, 60%, 45%)`) - For verified receipts and high confidence.
- `trust-invalid`: Warning Red (`hsl(10, 80%, 50%)`) - For revoked claims and errors.

## Typography (Data-Dense & Serious)

- **Primary Font:** Nunito Sans
- **Monospace Font:** JetBrains Mono (or similar, for cryptographic keys, IDs, SHAs)
- **Hierarchy:**
  - Headers: Semi-Bold (600), tight tracking.
  - UI Labels: Regular (400), 12px, Uppercase with `0.05em` tracking.
  - Body: Regular Size (14px).

## Spacing & Radius (BlueprintJS Mental Model)

- `grid-base`: `4px`
- `padding-tight`: `8px`
- `padding-comfortable`: `12px` or `16px`
- `radius-sm`: `2px`
- `radius-md`: `4px`
- `radius-lg`: `4px` (Do not exceed 4px for operational UI, keeping edges sharp)
- `glass-blur`: NONE (Removed glassmorphism completely)

## Motion & Easing (Mechanical & Deliberate)

- **Instant / Tooltip:** `< 100ms` (Zero-delay feel for data inspection)
- **UI Panel Slide:** `200ms ease-out` (For Right Inspector drawers)
- **Graph Re-layout:** Physics-based spring simulation (via graph rendering engine)

## Component Rules

- No heavy drop shadows. Rely on 1px borders (`border-divider`) to delineate elevation and panels.
- No gradients. Flat solid colors.
- Dense information layout. Tables should not have excessive whitespace.
