import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Conformance gate for the band-system COMPONENT layer.
 *
 * `apps/web/styles/band-system-components.css` is a synthesis with
 * reference R3 (Zoox) — see
 * docs/design/zoox-r3-component-synthesis-2026-08-10.md.
 *
 * Most of R3's character is authorised on `origin/main` after
 * amendments A-1 and A-2 (2026-08-09): the soft radius scale, frost on
 * chrome and scene overlays, one atmospheric wash per viewport, pill
 * word-labels. This gate is therefore NOT a ban list. It pins the few
 * invariants the synthesis has to hold:
 *
 *   A-2   an ACTION is square in every register
 *   A-1   frost degrades; the one permitted wash is not authored here
 *         as a raw gradient, and never lands on a control
 *   EC-5  44px targets, visible focus, never `outline: none`
 *   EC-4  no-JS is a first-class composition — specifically, the
 *         segmented control's selected state must be drawn without
 *         script, which is the one place the reference's own
 *         implementation fails
 *   LINT-14  no third-party reference tokens
 *
 * IMPORTANT — comments are stripped before scanning. The stylesheet's
 * header quotes R3's own values verbatim (`border-radius: 1.6rem`,
 * `0 3rem 3rem`, `margin-left: -2rem`) so a scan that read comments
 * would fail on its own rationale — the same false-positive class as
 * the golden-namespace sweep. Declarations only.
 *
 * What this does NOT do: prove rendered geometry. The 44px floors and
 * the register rendering are verified by measuring painted controls in
 * a browser. These are tripwires against regression, not proofs.
 */

const CSS_PATH = path.join(__dirname, '..', 'styles', 'band-system-components.css');

/**
 * The band system's keyframes live in the house motion file, not beside the
 * component that drives them: LINT-03 admits `@keyframes` in `motion.css` and
 * nowhere else. The component stylesheet still owns the `animation:` shorthand
 * that references them, so the invariant below has to read across both files.
 */
const MOTION_CSS_PATH = path.join(__dirname, '..', 'styles', 'motion.css');
const PRIMITIVES_CSS_PATH = path.join(__dirname, '..', 'styles', 'band-system.css');

/** Strip comments so documented counter-examples aren't scanned. */
function declarationsOnly(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('band-system-components.css — synthesis invariants', () => {
  const raw = fs.readFileSync(CSS_PATH, 'utf8');
  const css = declarationsOnly(raw);
  const motionCss = declarationsOnly(fs.readFileSync(MOTION_CSS_PATH, 'utf8'));

  /**
   * Structural sanity, and it earned its place the hard way.
   *
   * An edit once left a comment block closed early, so ~18 lines of
   * prose sat as bare CSS followed by an unmatched close-comment
   * delimiter. Every rule after that point stopped parsing and
   * `.bs-surface` rendered nothing — while ALL 45 assertions across
   * five gate files passed, because the comment-stripping regex
   * happily consumed the mess.
   *
   * (Writing that delimiter literally in this docblock reproduced the
   * same bug in this file. Hence the wording.)
   *
   * A content gate that scans a stylesheet cannot tell you the
   * stylesheet still parses. This one can.
   */
  it('is structurally intact — balanced comments and braces', () => {
    const opens = (raw.match(/\/\*/g) ?? []).length;
    const closes = (raw.match(/\*\//g) ?? []).length;
    expect(opens, 'unbalanced comment delimiters').toBe(closes);

    // After stripping, no stray delimiter may survive.
    expect(css).not.toContain('*/');
    expect(css).not.toContain('/*');

    // Braces must balance, and never go negative.
    let depth = 0;
    for (const ch of css) {
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        expect(depth, 'a closing brace with no opener').toBeGreaterThanOrEqual(0);
      }
    }
    expect(depth, 'unclosed block').toBe(0);
  });

  it('strips comments before scanning (guards the guard)', () => {
    // The header quotes R3's rejected action radius; it must exist in
    // the raw file and be absent from what we scan.
    expect(raw).toMatch(/16px/);
    expect(css).not.toMatch(/border-radius:\s*16px/);
  });

  /**
   * A-2 is the single point where this synthesis and the reference
   * genuinely diverge, so it is the assertion most worth pinning.
   * Silhouette is load-bearing: square means you can act on it.
   */
  it('keeps every action square in EVERY register (A-2)', () => {
    const declared = [...css.matchAll(/--vt-bs-shape-action:\s*([^;]+)/g)].map((m) => m[1].trim());

    // Declared in the base island and re-declared in the scene register,
    // so a future register cannot inherit a rounded action by accident.
    expect(declared.length).toBeGreaterThanOrEqual(2);
    for (const value of declared) {
      expect(value).toMatch(/^0(px)?$/);
    }
  });

  it('routes action, icon and segment radii through the action token', () => {
    // Each interactive component must read the token rather than
    // hardcode a radius, or A-2 becomes unenforceable at the token.
    for (const selector of ['bs-action', 'bs-iconbtn', 'bs-segment__option']) {
      const block = css.match(new RegExp(`\\.${selector}\\s*\\{[^}]*\\}`))?.[0] ?? '';
      expect(block, `.${selector} must declare a radius`).toMatch(/border-radius:/);
      expect(block, `.${selector} must read --vt-bs-shape-action`).toMatch(
        /border-radius:\s*var\(--vt-bs-shape-action\)/,
      );
    }
  });

  /**
   * The correction at the heart of this synthesis.
   *
   * R3's `.pill.active` sets only a text colour; the ground beneath it
   * comes from a JS-positioned blob. Before that script runs the
   * selected option is white text on a white ground — unreadable, not
   * merely unanimated. EC-4 requires no-JS to be first-class.
   *
   * So the selected state must be drawn by a rule that does NOT depend
   * on the `--armed` class the script adds.
   */
  it('draws the selected segment option without script (EC-4)', () => {
    const staticRule = css.match(
      /(^|\})\s*([^{}]*\.bs-segment__option\[aria-current='true'\][^{}]*)\{([^}]*)\}/m,
    );

    expect(staticRule, 'a static aria-current rule must exist').not.toBeNull();

    const selector = staticRule![2];
    const body = staticRule![3];

    // The static rule must not be gated behind the armed class.
    expect(selector).not.toContain('--armed');

    // And it must actually paint an indicator, not just recolour text —
    // colour alone would still fail EC-4 in grayscale.
    expect(body).toMatch(/border-block-end-color:\s*var\(--vt-bs-ink\)/);
    expect(body).toMatch(/font-weight:/);
  });

  it('hands the indicator over exactly once, so both never paint', () => {
    // The armed variant retires the static rule.
    expect(css).toMatch(
      /\.bs-segment--armed\s+\.bs-segment__option\[aria-current='true'\]\s*\{[^}]*border-block-end-color:\s*transparent/,
    );
    // And the travelling bar is invisible until armed.
    const indicator = css.match(/\.bs-segment__indicator\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(indicator).toMatch(/opacity:\s*0/);
  });

  /**
   * A-1 permits frost on a scene surface, so this file COULD carry a
   * blur. It deliberately does not.
   *
   * `docs/design/glass-retirement-scope-2026-08-10.md` is an active
   * workstream holding ~147 remaining glass occurrences flat behind
   * `glass-ratchet.test.ts`. Adding one here would fight that
   * retirement and force someone else's baseline wider to land work
   * that does not need it.
   *
   * Nothing is lost: A-1 builds frost from `color-mix` so it degrades
   * to a solid translucent panel, and `--vt-bs-surface` binds to
   * `--vt-frost-bg`, which IS that degraded form. This assertion is
   * what stops the blur being added back absent-mindedly while the
   * retirement is still in flight.
   */
  it('authors no blur while the glass retirement is in flight', () => {
    expect(css).not.toMatch(/backdrop-filter\s*:/i);
    expect(css).not.toMatch(/filter\s*:\s*[^;}]*blur\s*\(/i);
  });

  it('still binds the frost token, so the treatment is one line away (A-1)', () => {
    // The architecture stays wired even though the blur is withheld.
    expect(css).toMatch(/--vt-bs-surface:\s*var\(--vt-frost-bg/);
    expect(css).toMatch(/--vt-bs-surface-border:\s*var\(--vt-frost-border/);
  });

  it('authors no raw gradient — the one permitted wash arrives by token (A-1)', () => {
    // `--vt-scene-glow` is the ratified atmospheric wash; referencing it
    // is allowed, authoring a second gradient here is not.
    expect(css).not.toMatch(/(linear|radial|conic)-gradient\s*\(/i);
  });

  it('ships no shadows (EC-20 card grammar)', () => {
    const shadows = [...css.matchAll(/box-shadow\s*:\s*([^;}]+)/gi)]
      .map((m) => m[1].trim())
      .filter((v) => v !== 'none');
    expect(shadows).toEqual([]);
  });

  it('never removes the focus indicator, and styles focus-visible (EC-5)', () => {
    expect(css).not.toMatch(/outline\s*:\s*(none|0)\b/i);
    expect(css.match(/:focus-visible/g)?.length ?? 0).toBeGreaterThan(4);
  });

  it('declares a 44px floor on every interactive component (EC-5)', () => {
    // R3 ships 23 of 42 controls under the floor, including the 24px
    // icon buttons this file deliberately keeps the MARK size of.
    for (const selector of ['bs-action', 'bs-segment__option', 'bs-row']) {
      const block = css.match(new RegExp(`\\.${selector}\\s*\\{[^}]*\\}`))?.[0] ?? '';
      expect(block, `.${selector} needs the 44px floor`).toMatch(/min-block-size:\s*44px/);
    }

    // The icon instrument is the interesting case: the mark keeps R3's
    // 24px scale while the target is expanded around it.
    const iconbtn = css.match(/\.bs-iconbtn\s*\{[^}]*\}/)?.[0] ?? '';
    expect(iconbtn).toMatch(/min-inline-size:\s*44px/);
    expect(iconbtn).toMatch(/min-block-size:\s*44px/);
  });

  it('keeps motion optional (EC-4 / EC-5)', () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);

    // The scroll-driven reveal must be opt-in on motion preference, not
    // merely undone afterwards — R3 ships zero reduced-motion blocks
    // across its whole stylesheet set while running clip transitions
    // on nearly every section.
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*no-preference\)/);
    expect(css).toMatch(/@supports\s*\(animation-timeline:/);
  });

  /**
   * `clip-path` clips descendants' outlines, and the reveal uses
   * `animation-fill-mode: both`, so its END state persists. Ending on
   * `inset(0)` would leave every revealed band permanently cropping the
   * focus ring of any control near its edge — invisible until someone
   * places a control flush to the edge, which is the worst kind of
   * latent a11y defect.
   *
   * The end state must therefore sit OUTSIDE the border box.
   */
  it('ends the reveal outside the border box so focus rings survive (EC-5)', () => {
    // The component stylesheet must still be the thing that DRIVES it —
    // otherwise this assertion would keep passing over an orphaned animation
    // that nothing references.
    expect(css, '.bs-*-reveal must reference the wipe').toMatch(
      /animation:\s*bs-reveal-wipe\b/,
    );

    const kf = motionCss.match(/@keyframes\s+bs-reveal-wipe\s*\{([\s\S]*?)\n\}/)?.[1];
    expect(kf, 'the reveal keyframes must exist in motion.css').toBeTruthy();

    const to = kf!.match(/\bto\s*\{([^}]*)\}/)?.[1] ?? '';
    const inset = to.match(/clip-path:\s*inset\(([^)]*)\)/)?.[1] ?? '';
    expect(inset, 'the `to` frame must set an inset clip').not.toBe('');

    const components = inset.trim().split(/\s+/);
    for (const value of components) {
      expect(
        value.startsWith('-'),
        `reveal end state must clear the border box; got "${value}"`,
      ).toBe(true);
    }
  });

  /**
   * LINT-14 bans third-party reference tokens — distinctive hexes as
   * well as names. Synthesising from a captured stylesheet is exactly
   * the situation where one gets pasted in by accident.
   */
  it('reproduces no colour from the reference (LINT-14)', () => {
    const referenceHexes = [
      '#64d5b3',
      '#34484a',
      '#0d1212',
      '#d3e4df',
      '#5b8279',
      '#fdb1be',
      '#8cdff8',
      '#34ffc5',
      '#c7c6ff',
      '#a7cfff',
      '#b20c0c',
    ];

    const lower = css.toLowerCase();
    const found = referenceHexes.filter((hex) => lower.includes(hex));
    expect(found).toEqual([]);
  });

  /**
   * SURFACE vs PANEL is A-1's evidence/chrome boundary, and it was
   * accidental before it was a contract: the two components' code was
   * near-identical and only the token wiring differed, so nothing
   * stopped an author frosting a surface a decision is read from.
   *
   * `.bs-panel` must therefore stay hardcoded solid and near-sharp —
   * if it ever reads the surface or scene-shape tokens it inherits the
   * frost with them.
   */
  it('keeps .bs-panel solid and near-sharp, so evidence cannot frost (A-1)', () => {
    const primitives = declarationsOnly(fs.readFileSync(PRIMITIVES_CSS_PATH, 'utf8'));
    const panel = primitives.match(/\.bs-panel\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(panel, '.bs-panel must exist in the primitives').not.toBe('');
    expect(panel).not.toMatch(/--vt-bs-surface/);
    expect(panel).not.toMatch(/--vt-bs-shape-/);
    expect(panel).not.toMatch(/--vt-frost/);

    // And its radius stays near-sharp rather than tracking a token.
    const radius = panel.match(/border-radius:\s*([^;]+)/)?.[1]?.trim() ?? '';
    expect(radius).toMatch(/^[0-3](\.\d+)?px$/);
  });

  /**
   * R2's arrow CTA and R3's action were one control with two names. The
   * duplicate is retired rather than aliased — an alias keeps both
   * reachable and the duplication merely becomes invisible.
   */
  it('retires .bs-cta rather than aliasing it', () => {
    const primitives = declarationsOnly(fs.readFileSync(PRIMITIVES_CSS_PATH, 'utf8'));
    expect(primitives).not.toMatch(/\.bs-cta/);

    // The replacement carries the external travel the retired one had.
    expect(css).toMatch(/\.bs-action--external/);
  });
});
