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

/* ── Typography scale ──────────────────────────────────── */
export const fontSize = {
  xs: '0.75rem',     // 12px
  sm: '0.875rem',    // 14px
  base: '1rem',      // 16px
  lg: '1.125rem',    // 18px
  xl: '1.25rem',     // 20px
  '2xl': '1.5rem',   // 24px
  '3xl': '1.875rem', // 30px
  '4xl': '2.25rem',  // 36px
  '5xl': '3rem',     // 48px
  '6xl': '3.75rem',  // 60px
  '7xl': '4.5rem',   // 72px
  '8xl': '6rem',     // 96px
} as const;

export const lineHeight = {
  none: '1',
  tight: '1.1',
  snug: '1.25',
  normal: '1.5',
  relaxed: '1.625',
  loose: '2',
} as const;

export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

/* ── Spacing scale (4px base) ──────────────────────────── */
export const spacing = {
  px: '1px',
  0: '0',
  0.5: '0.125rem',   // 2px
  1: '0.25rem',       // 4px
  1.5: '0.375rem',    // 6px
  2: '0.5rem',        // 8px
  3: '0.75rem',       // 12px
  4: '1rem',          // 16px
  5: '1.25rem',       // 20px
  6: '1.5rem',        // 24px
  8: '2rem',          // 32px
  10: '2.5rem',       // 40px
  12: '3rem',         // 48px
  16: '4rem',         // 64px
  20: '5rem',         // 80px
  24: '6rem',         // 96px
  32: '8rem',         // 128px
} as const;

/* ── Z-index layers ────────────────────────────────────── */
export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  modal: 30,
  overlay: 40,
  toast: 50,
} as const;

/* ── Blur levels ───────────────────────────────────────── */
export const blur = {
  sm: '4px',
  md: '8px',
  lg: '16px',
  xl: '24px',
} as const;

/* ── Border radius scale ───────────────────────────────── */
export const borderRadius = {
  none: '0',
  sm: '0.25rem',     // 4px
  md: '0.5rem',      // 8px
  lg: '0.75rem',     // 12px — matches --radius
  xl: '1rem',        // 16px
  '2xl': '1.5rem',   // 24px — glass cards
  full: '9999px',    // pills / circles
} as const;
