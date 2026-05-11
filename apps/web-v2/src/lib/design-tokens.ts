/**
 * VitalCV institutional design tokens — minimal monochrome.
 *
 * Doctrine: Stripe + Palantir + Linear. NOT crypto wallet, NOT AI
 * wrapper, NOT consumer social. Tokens are intentionally small —
 * adding a token requires a real use case, not a hypothetical.
 *
 * Truth contract:
 *   - Color palette is black/white/grays. No accent hues — trust
 *     states are encoded via WEIGHT and DENSITY, not color signal.
 *   - The `state` palette names ("ok" / "ambiguous" / "failed" /
 *     "unknown") map to grayscale + glyph treatment, not red/green.
 *     Color-blind users see the same hierarchy as everyone else.
 *   - Typography uses system stack + monospace for IDs/digests.
 *   - Motion budget: 150ms ease for state transitions only. No
 *     decorative animation.
 *
 * If you find yourself adding a vibrant color, an icon font, or a
 * gradient, you are off-doctrine. Re-read the brief.
 */

export const colors = Object.freeze({
  // Surface ladder — light-mode only for now. Dark-mode is a future
  // PR; the lockdown test pins these literal values until then.
  bg:           '#fafaf9',  // page background, near-white
  surface:      '#ffffff',  // card/panel background
  surfaceSub:   '#f4f4f3',  // nested panel / hover
  border:       '#dcdcdb',  // hairline borders
  borderStrong: '#a4a4a3',  // emphasis borders

  // Ink ladder — text + glyphs
  ink:          '#0a0a0a',  // primary text
  inkSub:       '#404040',  // secondary text
  inkMuted:     '#787877',  // mono labels, metadata
  inkFaint:     '#a4a4a3',  // disabled / inactive

  // Trust-state palette — explicitly grayscale + glyph-coded.
  // "ok" is NOT green. "failed" is NOT red. We rely on WEIGHT, not
  // hue, so trust legibility doesn't depend on color perception.
  stateOk:        '#0a0a0a',  // strong ink — "evidence present"
  stateAmbiguous: '#787877',  // mid ink — "evidence partial"
  stateFailed:   '#a4a4a3',   // faint ink — "evidence absent"
  stateUnknown: '#a4a4a3',    // faint ink — same weight as failed
});

export const space = Object.freeze({
  px:   '1px',
  '0':  '0',
  '1':  '0.25rem',
  '2':  '0.5rem',
  '3':  '0.75rem',
  '4':  '1rem',
  '5':  '1.5rem',
  '6':  '2rem',
  '7':  '3rem',
  '8':  '4rem',
});

export const type = Object.freeze({
  // System fonts only. No webfonts in v0 — webfonts add load time and
  // motion (FOUT). Add a real font (Inter, Geist, etc.) later as its
  // own PR with explicit performance + a11y review.
  fontSans:
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  fontMono:
    'ui-monospace, "SF Mono", "JetBrains Mono", "Roboto Mono", "Menlo", monospace',

  // Type scale — small, tight, infrastructure-grade. NO display-large
  // sizes. The biggest thing on screen should be ~28px, not 72px.
  sizeXxs:  '10px',  // mono labels (uppercase tracking)
  sizeXs:   '11px',  // metadata, micro
  sizeSm:   '13px',  // body small
  sizeBase: '14px',  // body
  sizeLg:   '16px',  // section heads
  sizeXl:   '20px',  // panel heads
  size2xl:  '28px',  // page heads — max

  // Weights — sans bottom + ink-density encoding for trust states.
  weightRegular:   '400',
  weightMedium:    '500',
  weightSemibold:  '600',
  weightBold:      '700',

  // Tracking — tight on display, generous on uppercase mono labels.
  trackingTight:   '-0.01em',
  trackingNormal:  '0',
  trackingMono:    '0.06em',  // uppercase tracking for mono labels

  // Line-heights — operational density, NOT magazine.
  leadingTight:  '1.2',
  leadingBody:   '1.45',
});

export const radius = Object.freeze({
  none:    '0',
  sharp:   '2px',    // default — near-brutalist
  md:      '4px',
  // No `full` / pill radii. We don't ship pills.
});

export const motion = Object.freeze({
  // Motion budget: 150ms ease for state transitions only.
  durationFast:   '150ms',
  easeStandard:   'cubic-bezier(0.4, 0, 0.2, 1)',
});

export type TrustGlyphState = 'ok' | 'ambiguous' | 'failed' | 'unknown';

/**
 * Glyph + label pairs for each trust state. The glyph encodes the
 * state visually for color-blind users; the label is the screen-
 * reader text. NEVER use the bare word "Verified" — use compound
 * forms only (per CLAUDE.md truth contract).
 */
export const trustGlyph: Readonly<Record<TrustGlyphState, { glyph: string; label: string; color: string }>> =
  Object.freeze({
    ok:        { glyph: '■',  label: 'Source-backed',         color: colors.stateOk },
    ambiguous: { glyph: '◐',  label: 'Ambiguity-visible',     color: colors.stateAmbiguous },
    failed:    { glyph: '✕',  label: 'Evidence absent',       color: colors.stateFailed },
    unknown:   { glyph: '?',  label: 'Unknown — not checked', color: colors.stateUnknown },
  });
