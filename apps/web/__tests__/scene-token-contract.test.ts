/**
 * D-01A — the scene register's token contract.
 *
 * The public scene tokens in styles/themes/index.css carry three founder
 * decisions (2026-08-08) and two accessibility corrections (D-00 A-1/A-2).
 * This test recomputes the WCAG ratios from the FILE, not from a copy of the
 * values, so quietly darkening a token is a red test, not a design-review
 * archaeology project.
 *
 * It also pins the bridge: the two public islands (easy-home.css, eyebrow.css)
 * may not re-introduce literal colours — every colour they use must resolve
 * through a var(). LINT-01 enforces this repo-wide as a ratchet; here it is an
 * absolute for the two files D-01A cleaned, so the debt cannot creep back into
 * exactly the files that were paid off.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesDir = join(__dirname, '..', 'styles');
const themes = readFileSync(join(stylesDir, 'themes', 'index.css'), 'utf8');

function token(name: string): string {
  const m = themes.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\b`));
  if (!m) throw new Error(`token ${name} not found as a hex literal in themes/index.css`);
  return m[1];
}

function luminance(hexColor: string): number {
  const channel = (i: number) => {
    const c = parseInt(hexColor.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('scene register token contract (D-01A)', () => {
  it('A-1 — tertiary scene text clears AA on every scene surface', () => {
    const text3 = token('--vt-scene-text-tertiary');
    for (const surface of ['--vt-scene-canvas', '--vt-scene-panel', '--vt-scene-panel-raised']) {
      expect(
        contrast(text3, token(surface)),
        `tertiary text on ${surface} — this colour carries the truth boundary and source attributions`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('A-2 — every primary-action state clears AA', () => {
    const pairs: Array<[string, string, string]> = [
      ['--vt-action-primary-fg', '--vt-action-primary-bg', 'rest'],
      ['--vt-action-primary-fg-press', '--vt-action-primary-bg-press', 'hover/focus'],
      ['--vt-action-primary-inverse-fg', '--vt-action-primary-inverse-bg', 'inverse rest'],
      ['--vt-action-primary-inverse-fg-press', '--vt-action-primary-inverse-bg-press', 'inverse press'],
    ];
    for (const [fg, bg, state] of pairs) {
      // -press tokens may alias non-press ones via var(); resolve one level.
      const resolve = (name: string): string => {
        const alias = themes.match(new RegExp(`${name}:\\s*var\\((--[a-z0-9-]+)\\)`));
        return alias ? token(alias[1]) : token(name);
      };
      expect(
        contrast(resolve(fg), resolve(bg)),
        `primary action at ${state} — the old green treatment was 2.99:1 here`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('decision 3 — the focus ring is indigo and visible on its registers', () => {
    expect(contrast(token('--vt-accent-editorial-on-dark'), token('--vt-scene-canvas'))).toBeGreaterThanOrEqual(3);
    expect(contrast(token('--vt-accent-editorial-on-paper'), token('--vt-scene-paper'))).toBeGreaterThanOrEqual(3);
  });

  it('decision 2 — the action tokens are not the state hues', () => {
    const green = token('--vt-scene-state-source-confirmed').toLowerCase();
    const greenDeep = token('--vt-scene-state-source-confirmed-deep').toLowerCase();
    const actionValues = themes.match(/--vt-action-primary[a-z-]*:\s*(#[0-9a-fA-F]{6})/g) ?? [];
    for (const decl of actionValues) {
      const value = decl.split(':')[1].trim().toLowerCase();
      expect([green, greenDeep], `an action token resolved to a state green: ${decl}`).not.toContain(value);
    }
  });

  describe('E register — amendment E (2026-08-15)', () => {
    it('every E action state clears AA with its label', () => {
      const label = token('--vt-home-e-action-label');
      for (const bg of ['--vt-home-e-action', '--vt-home-e-action-hover', '--vt-home-e-action-press']) {
        expect(
          contrast(label, token(bg)),
          `E action label on ${bg} — the paper-coloured label was rejected at 4.73:1; the floor is 4.5`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('E text tokens clear AA on ground and panel', () => {
      for (const fg of ['--vt-home-e-ink', '--vt-home-e-dim']) {
        for (const bg of ['--vt-home-e-ground', '--vt-home-e-panel']) {
          expect(contrast(token(fg), token(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(
        contrast(token('--vt-home-e-band-text'), token('--vt-home-e-ink')),
        'band text on the dark band ground',
      ).toBeGreaterThanOrEqual(4.5);
    });

    it('the E action is an instrument, never a state — distinct from every state hue and the reserved severity red', () => {
      const action = token('--vt-home-e-action').toLowerCase();
      const reserved = [
        token('--vt-scene-state-source-confirmed'),
        token('--vt-scene-state-source-confirmed-deep'),
        token('--vt-scene-state-needs-person'),
        token('--vt-scene-state-waiting'),
      ].map((v) => v.toLowerCase());
      expect(reserved, 'the E action resolved to a state hue').not.toContain(action);
      // The reserved revoked-red. The E row says severity red never renders on
      // the `/` scene register; the palette-level guard is that the two values
      // never converge, because the rule cannot survive them becoming equal.
      const severityMatch = themes.match(/--vt-severity-critical:\s*(#[0-9a-fA-F]{6})/);
      if (severityMatch) {
        expect(action, 'the E action equals --vt-severity-critical').not.toBe(severityMatch[1].toLowerCase());
      }
    });
  });

  describe('F register — the founder Homepage v4 (amendment F, 2026-08-16)', () => {
    it('every F ink tier clears AA on ground, raised, and inset paper', () => {
      for (const fg of ['--vt-home-f-ink-strong', '--vt-home-f-ink', '--vt-home-f-ink-muted', '--vt-home-f-ink-subtle']) {
        for (const bg of ['--vt-home-f-ground', '--vt-home-f-raised', '--vt-home-f-inset']) {
          expect(contrast(token(fg), token(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it('the F action label clears AA at rest and press', () => {
      const label = token('--vt-home-f-action-label');
      for (const bg of ['--vt-home-f-action', '--vt-home-f-action-press']) {
        expect(contrast(label, token(bg)), `F action label on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('the F signal and the minted snapshot hue clear the graphics floor on paper', () => {
      for (const hue of ['--vt-home-f-signal', '--vt-home-f-snapshot']) {
        for (const bg of ['--vt-home-f-ground', '--vt-home-f-raised']) {
          expect(contrast(token(hue), token(bg)), `${hue} on ${bg}`).toBeGreaterThanOrEqual(3);
        }
      }
    });

    it('the F action and signal are not state hues, and severity red stays reserved', () => {
      const action = token('--vt-home-f-action').toLowerCase();
      const signal = token('--vt-home-f-signal').toLowerCase();
      const states = [
        token('--vt-state-source-confirmed'),
        token('--vt-state-pending'),
        token('--vt-home-f-snapshot'),
        token('--vt-severity-critical'),
      ].map((v) => v.toLowerCase());
      expect(states, 'the F action resolved to a state hue').not.toContain(action);
      // The signal deliberately shares the CD-4 indigo with --vt-state-access
      // (access is indigo BY the A-1 focus/atmosphere decision); it may never
      // equal a green/amber/red state or the reserved severity red.
      expect(states, 'the F signal resolved to a non-indigo state hue').not.toContain(signal);
    });
  });

  it('the bridged islands declare no literal colours', () => {
    const colourish =
      /(?:color|background|border|fill|stroke|shadow|outline)[a-z-]*\s*:[^;]*(?:#[0-9a-fA-F]{3,8}\b|\b(?:oklch|rgba?|hsla?)\()|(?:^|[{;])\s*--(?!vt-)[a-z0-9-]+\s*:\s*[^;]*(?:#[0-9a-fA-F]{3,8}\b|\b(?:oklch|rgba?|hsla?)\()/;
    for (const island of ['easy-home.css', 'eyebrow.css']) {
      const lines = readFileSync(join(stylesDir, island), 'utf8')
        .split('\n')
        .filter((line) => colourish.test(line));
      expect(lines, `${island} re-introduced literal colour(s):\n${lines.join('\n')}`).toEqual([]);
    }
  });
});
