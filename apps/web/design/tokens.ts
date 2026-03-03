/**
 * Design Tokens for Antigravity (Liquid Glass) UI System
 * Shared constants for Framer Motion and standard React elements.
 */

export const colors = {
  background: 'oklch(0.957 0.008 90)',
  foreground: 'oklch(0.22 0.01 60)',
  card: 'oklch(0.971 0.006 85)',
  primary: 'oklch(0.30 0.015 60)',
  secondary: 'oklch(0.935 0.008 85)',
  accent: 'oklch(0.855 0.032 230)',
  destructive: 'oklch(0.55 0.14 35)',
  trustGreen: 'oklch(0.72 0.15 155)',
  trustYellow: 'oklch(0.82 0.13 85)',
  trustRed: 'oklch(0.55 0.14 35)',
  sage: 'oklch(0.82 0.06 155)',
};

export const darkColors = {
  background: 'oklch(0.18 0.012 60)',
  foreground: 'oklch(0.94 0.006 85)',
  card: 'oklch(0.20 0.012 60)',
  primary: 'oklch(0.94 0.006 85)',
  secondary: 'oklch(0.26 0.012 60)',
  accent: 'oklch(0.50 0.06 230)',
  destructive: 'oklch(0.50 0.14 30)',
  trustGreen: 'oklch(0.65 0.14 155)',
  trustYellow: 'oklch(0.75 0.12 85)',
  trustRed: 'oklch(0.55 0.14 30)',
  sage: 'oklch(0.60 0.06 155)',
};

export const easings = {
  spring: [0.175, 0.885, 0.32, 1.275] as const, // bouncy, playful
  easeOut: [0.2, 0.8, 0.2, 1] as const, // buttery smooth (e.g. for card hovers/globals.css matches)
  decelerate: [0.0, 0.0, 0.2, 1] as const, // snappy reveals
};

export const durations = {
  fast: 0.2, // normal UI interactions
  normal: 0.34, // matched to our CSS transitions
  slow: 0.6, // large hero transitions/page load wraps
  pulse: 1.5, // infinite pulsing indicators
};

export const shadows = {
  glass: '0 4px 24px oklch(0.30 0.01 60 / 0.06)',
  glow: '0 0 40px oklch(0.72 0.15 155 / 0.12)',
  elevated: '0 8px 32px oklch(0.30 0.01 60 / 0.10)',
};

export const darkShadows = {
  glass: '0 4px 24px oklch(0 0 0 / 0.2)',
  glow: '0 0 40px oklch(0.65 0.14 155 / 0.18)',
  elevated: '0 8px 32px oklch(0 0 0 / 0.20)',
};

export const glassBlur = '20px';
