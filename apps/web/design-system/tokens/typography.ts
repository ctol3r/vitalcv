export const typographyTokens = {
  fontSans: "var(--font-geist), 'Geist', 'Nunito Sans', ui-sans-serif, system-ui, sans-serif",
  fontMono: "var(--font-geist-mono), 'Geist Mono', 'SFMono-Regular', ui-monospace, monospace",
  size: {
    display: '3rem',
    h1: '2.25rem',
    h2: '1.75rem',
    h3: '1.25rem',
    body: '1rem',
    meta: '0.875rem',
    caption: '0.75rem',
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.15',
    normal: '1.5',
    loose: '1.7',
  },
  // Prototype letter-spacing token; available on demand via .tracking-tightish utility.
  letterSpacing: {
    tightish: '-0.01em',
  },
} as const;

export type TypographySizeToken = keyof typeof typographyTokens.size;
export type TypographyWeightToken = keyof typeof typographyTokens.weight;
export type TypographyLineHeightToken = keyof typeof typographyTokens.lineHeight;
