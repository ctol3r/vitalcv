// CD-7 — the three faces. These MUST agree with `sansStack`/`monoStack` in
// `apps/web/app/layout.tsx`, because both reach `<html>` and only source order
// decided which won.
//
// Until now these read `var(--font-nunito-sans), 'Nunito Sans', …` and
// `var(--font-jetbrains), 'JetBrains Mono', …` — neither of which is a face
// this product loads. They flowed into eight variables (`--font-sans`,
// `--font-mono`, `--font-body`, `--font-heading`, `--vt-font-sans`,
// `--vt-font-mono`, `--ui-font-*`) via `styles/variables.ts`, and were saved
// only by `layout.tsx` spreading `...vdsCssVariables` FIRST and re-declaring
// the same keys after. Reorder that object literal — or apply
// `vdsCssVariables` to any subtree layout.tsx does not own — and the whole
// product silently reverts to Nunito Sans / JetBrains Mono.
//
// That is regression #3 waiting to happen: CD-W1's faces have already been
// lost twice, once to a `next/font/google` build fetch and once to an
// `@theme inline` literal family name. Making the default correct removes the
// ordering dependency instead of documenting it.
export const typographyTokens = {
  fontSans:
    "var(--font-geist-loaded, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif)",
  fontMono:
    "var(--font-geist-mono-loaded, ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace)",
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
