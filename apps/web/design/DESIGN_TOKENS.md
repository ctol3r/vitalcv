# Antigravity Design Tokens

This document outlines the core tokens for the Antigravity (Liquid Glass) design system used in VitalCV.
These tokens align with Tailwind CSS variables and export to `tokens.ts` for Framer Motion usage.

## Color Palette (Liquid Glass & Warm Minimalism)

- `background`: Cloud Dancer (`oklch(0.957 0.008 90)`)
- `foreground`: Warm Charcoal (`oklch(0.22 0.01 60)`)
- `card`: Warm Paper (`oklch(0.971 0.006 85)`)
- `primary`: Deep Warm Charcoal (`oklch(0.30 0.015 60)`)
- `secondary`: Lighter Warm Tone (`oklch(0.935 0.008 85)`)
- `accent`: Mist Blue (`oklch(0.855 0.032 230)`)
- `destructive`: Muted Terracotta (`oklch(0.55 0.14 35)`)
- `trust-green`: Reassuring Sage-green (`oklch(0.72 0.15 155)`)
- `trust-yellow`: Warm Amber (`oklch(0.82 0.13 85)`)
- `trust-red`: Muted Terracotta (`oklch(0.55 0.14 35)`)
- `sage`: Soft Sage Accent (`oklch(0.82 0.06 155)`)

## Motion & Easing

- **Spring (Bouncy)**: `[0.175, 0.885, 0.32, 1.275]` (For badges, pops)
- **Ease Out (Smooth)**: `[0.2, 0.8, 0.2, 1]` (For liquid glass cards, dialogs)
- **Decelerate**: `[0.0, 0.0, 0.2, 1]` (For page transitions)

## Durations

- `fast`: `0.2s` (Color changes, simple hovers)
- `normal`: `0.34s` (Structural shifts, card elevates)
- `slow`: `0.6s` (Page transitions, heroic reveals)
- `pulse`: `1.5s` (Infinite pulsing badges)

## Spacing & Radius

- `radius-sm`: `0.5rem`
- `radius-md`: `0.625rem`
- `radius-lg`: `0.75rem`
- `radius-xl`: `1rem`
- `glass-blur`: `20px`
