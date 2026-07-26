# VitalCV — Design Lint Rules (DG-18.4) · Wave 1505

Machine-enforceable. `error` blocks merge; `warn` blocks release. Wiring: stylelint + eslint + three CI grep gates + two component tests. No design interpretation required.

## LINT-01 · No raw color outside theme files — error
- **Forbid:** hex (`#xxx`–`#xxxxxxxx`), `oklch()`, `rgb()`, `hsl()` on any color-bearing property.
- **Detect (stylelint):** `declaration-property-value-disallowed-list` on `/color|background|border|fill|stroke|shadow|outline/` with `[/#[0-9a-fA-F]{3,8}/, /\b(oklch|rgb|rgba|hsl|hsla)\(/]`. JSX inline styles: eslint rule scanning `style={{...}}` string literals with the same regex.
- **Allowed:** `wave1500/01-primitives.css` (repo: `styles/tokens.css`), brand asset exports (`brand/og.css`, SVG files).

## LINT-02 · No raw lucide imports outside `<Icon>` — error
- **Detect (eslint):** `no-restricted-imports: [{ name: 'lucide-react', message: 'Import via components/Icon — the glyph set is closed.' }]` with `overrides` allowlisting `components/Icon.tsx`.
- **Note:** truth-state iconography is `TrustGlyph` ONLY; `<Icon>` is for non-state UI glyphs.

## LINT-03 · No `@keyframes` outside `motion.css` — error
- **Detect:** CI grep `grep -rn "@keyframes" app/ components/ --include='*.css' --include='*.tsx'` must return 0; stylelint custom plugin mirrors it in-editor.
- **Allowed:** `styles/motion.css`. House set: `vt-enter`, `sk-sweep`, `status-pulse`, `al-sweep`. Adding one requires a CHANGES.md entry.

## LINT-04 · No dark/ops tokens on public routes — error
- **Detect:** CI grep for `data-theme="ops"`, `--vt-surface-inverse`, `var(--ink-950)` under `app/(public)/`; Playwright asserts paper body background on all matrix routes (see REGRESSION_MATRIX.md §4).
- **Allowed:** `app/(ops)/`.

## LINT-05 · No literal `z-index` — error
- **Detect (stylelint):** `declaration-property-value-allowed-list: { 'z-index': [/^var\(--vt-z-/, 'auto'] }`.
- **Scale:** base 0 · raised 10 · nav 40 · banner 45 · widget 50 · overlay 60 · skip 100. A new stop = CHANGES.md entry.

## LINT-06 · Shadows and radii discipline — error
- **Forbid:** any `box-shadow` other than `none | var(--vt-lift) | var(--vt-focus-ring)`; any `border-radius` on public routes other than `var(--radius-1|2|3)`.
- **Detect (stylelint):** allowed-list on both properties; grep gate confines `--radius-ops` to `app/(ops)/`.

## LINT-07 · Gated/unavailable never renders a checkmark — error
- **Detect (component test):** snapshot `StateChip` for `gated | unavailable | accessRequired`; assert SVG path data contains the lock/slash/key path and NOT the check path (`M2.5 7.5 L5.5 10.5 L11.5 3.5`). This is do/don't pair #1.

## LINT-08 · Copy prohibitions — error
- **Detect:** CI grep over `app/`, `content/`:
  `/\b(cheapest|guaranteed (roi|results)|as seen in|trusted by \d|100% (secure|verified)|blockchain-verified|bank-level)\b/i`
- **Pricing clause:** in `app/(public)/pricing`, any `/\$\d/` must appear within 3 source lines of `<HonestyLabel`. Script: `scripts/lint-pricing-honesty.mjs`.
- **Error/empty clause:** in error components, forbid `/\b(success|almost there|oops)\b/i`; in empty states, forbid rendering fixture rows (`grep -l "SAMPLE_" app/**/empty*`).
- **Allowed:** legal documents may quote prohibited phrases when prohibiting them (`app/(public)/legal/`).

## LINT-09 · Font-family literals — warn
- **Detect (stylelint):** `font-family` must be `var(--font-display|--font-body|--font-mono)`.
- **Allowed:** `lib/fonts.ts` (next/font emits literals), generated `.next/`.

## LINT-10 · Glyph without label in chip contexts — warn
- **Detect (eslint custom):** `<TrustGlyph>` as the only child of an element with chip/badge role and no sibling text or `aria-label` → warn. Decorative glyphs beside full sentences must be `aria-hidden`.

## CI wiring

```
lint:design =
  stylelint "**/*.css" --config .stylelintrc.design.json
  && eslint . --config .eslintrc.design.json
  && node scripts/lint-grep-gates.mjs      # LINT-03/04/06/08 greps
  && vitest run tests/design-lint          # LINT-07 component tests
```

Runs on every PR beside `test:visual` (REGRESSION_MATRIX.md). A PR that changes tokens, adds keyframes, or updates baselines without a matching CHANGES.md entry fails review by policy.
