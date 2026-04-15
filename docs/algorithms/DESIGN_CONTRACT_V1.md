# VitalCV Design Contract v1

## Source of Truth
The canonical source of truth for the VitalCV design system is derived from the `vitalcv-ai-sandbox` architecture, formally encoded in `apps/web/design-system/tokens/colors.ts` and `apps/web/styles/themes/index.css`.

## Core Philosophy: Palantir-Tier Trust Interface
We are building a clinical trust console, not a consumer SaaS application. The interface must prioritize deterministic execution, data density, and mathematical truth over decorative embellishments.

### 1. Color Tokens (One Mapping)
The system uses a strictly controlled, brutalist ink-on-paper palette. Raw Tailwind color scales (e.g., `text-blue-500`) are explicitly prohibited outside of approved semantic primitives.
- **Base**: Deep monochrome (`--vt-bg`, `--vt-surface`, `--vt-surface-subtle`).
- **Text**: Explicitly bound to background contrast (`--vt-text-primary`, `--vt-text-secondary`, `--vt-text-muted`).
- **Borders**: Sharp 1px bounds (`--vt-border`, `--vt-border-subtle`).
- **Accents**: Semantic meaning only, never for decoration (`--vt-status-resolved`, `--vt-severity-critical`, `--vt-severity-high`).

### 2. Light / Dark Mode Execution
No component may define inverted color logic. All components must map strictly to the semantic CSS variables, ensuring 100% readability across themes.
- **Light Mode**: Bright surfaces, ink text.
- **Dark Mode**: Deep surfaces (#141414), bright text (#E4E3E0).

### 3. Typography Scale
- **Headers**: Bold, high-contrast, conveying structural hierarchy.
- **Primary Data**: Monospaced (JetBrains Mono equivalent) for NPIs, timestamps, and cryptographic hashes to emphasize deterministic, machine-readable truth.

### 4. Layout & Interaction
- **Liquid Glass (Passport Only)**: Restricted strictly to the Clinician Passport. Employs `backdrop-blur-xl`, `bg-white/5`, and `shadow-[inset]` to frame the credential as a secure, verifiable cryptographic object.
- **Flat & Dense (Employer/Console)**: Employer dashboards are entirely devoid of glassmorphism. They rely on dense, bordered panels (`rounded-sm` or `rounded-none`) to maximize scannability.
- **Gravity Engine**: No staged fetching or loading animations for computed data. Truth is revealed atomically.

*Any pull request that introduces new custom colors, raw hex codes, floating un-bordered cards, or unauthorized glassmorphism in the employer console will be structurally rejected.*
