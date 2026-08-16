/**
 * motion-token-sync.test.ts — UX-02 motion values.
 *
 * `styles/tokens.css` is the ONE source of motion truth. Two mirrors exist for
 * framer-motion consumers (`design-system/tokens/motion.ts`) and for runtime
 * CSS-variable emission (`motionCssVariables` in `design-system/styles/
 * variables.ts`, spread onto <html> by app/layout.tsx). Before UX-02 the
 * mirrors silently disagreed with the canonical file: the CSS side was
 * corrected to the 120ms control-feedback band by ruling R-e while the TS side
 * kept shipping 280ms as "instant". Nothing failed, because nothing compared
 * them. This suite is that comparison.
 *
 * It also pins EC-29 band membership: every duration token must sit inside one
 * of the four Class A bands. Values are UX-02's to set (EC-20 animation row);
 * the BANDS are locked law — widening one requires an EC-22 amendment, so a
 * band edit here must arrive with one.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { motionTokens, motionDurations, motionEasings } from '@/design-system/tokens/motion';
import { motionCssVariables } from '@/design-system/styles/variables';

const WEB = resolve(__dirname, '..');
const tokensCss = readFileSync(resolve(WEB, 'styles/tokens.css'), 'utf-8');

/** EC-29 Class A bands, ms, inclusive. */
const BANDS: Array<[number, number]> = [
  [80, 150], // control feedback
  [150, 250], // state transition
  [250, 450], // product transformation
  [450, 800], // rare narrative
];
const inBand = (ms: number) => BANDS.some(([lo, hi]) => ms >= lo && ms <= hi);

/** Read a custom property's value out of tokens.css. */
function cssToken(name: string): string {
  const match = tokensCss.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  if (!match) throw new Error(`${name} is not declared in styles/tokens.css`);
  return match[1].trim();
}

const cssMs = (name: string) => Number.parseFloat(cssToken(name));

describe('tokens.css is the single source of motion truth', () => {
  it('the TS mirror agrees with the canonical durations', () => {
    expect(motionTokens.duration.control).toBe(cssToken('--duration-instant'));
    expect(motionTokens.duration.fast).toBe(cssToken('--duration-fast'));
    expect(motionTokens.duration.normal).toBe(cssToken('--duration-normal'));
    expect(motionTokens.duration.slow).toBe(cssToken('--duration-slow'));

    // framer-motion durations are seconds; canonical values are ms.
    expect(motionDurations.instant * 1000).toBe(cssMs('--duration-instant'));
    expect(motionDurations.fast * 1000).toBe(cssMs('--duration-fast'));
    expect(motionDurations.normal * 1000).toBe(cssMs('--duration-normal'));
    expect(motionDurations.slow * 1000).toBe(cssMs('--duration-slow'));
  });

  it('the runtime CSS variables derive from the mirror, not their own literals', () => {
    expect(motionCssVariables['--vt-motion-control']).toBe(motionTokens.duration.control);
    expect(motionCssVariables['--vt-motion-fast']).toBe(motionTokens.duration.fast);
    expect(motionCssVariables['--vt-motion-normal']).toBe(motionTokens.duration.normal);
    expect(motionCssVariables['--vt-motion-slow']).toBe(motionTokens.duration.slow);
    // The legacy --ui-motion-* family rides the same values. "instant" is
    // control feedback — the 280ms literal this replaced was the R-e defect
    // surviving in a second definition site.
    expect(motionCssVariables['--ui-motion-duration-instant']).toBe(motionTokens.duration.control);
    expect(motionCssVariables['--ui-motion-duration-fast']).toBe(motionTokens.duration.fast);
  });

  it('the control-feel tokens stay in the control-feedback band together', () => {
    // R-e set these; the mirror's control value must move with them.
    expect(cssToken('--duration-snap')).toBe(motionTokens.duration.control);
    expect(cssToken('--duration-respond')).toBe(motionTokens.duration.control);
  });
});

describe('EC-29 band membership', () => {
  it('every canonical CSS duration sits inside a Class A band', () => {
    const declared = [...tokensCss.matchAll(/--duration-([a-z]+)\s*:\s*(\d+(?:\.\d+)?)ms/g)];
    expect(declared.length).toBeGreaterThanOrEqual(8);
    for (const [, name, value] of declared) {
      if (name === 'stagger') continue; // sibling offset, not a duration
      expect(inBand(Number(value)), `--duration-${name}: ${value}ms is outside every EC-29 band`).toBe(true);
    }
  });

  it('every TS mirror duration sits inside a Class A band', () => {
    for (const [name, seconds] of Object.entries(motionDurations)) {
      expect(inBand(seconds * 1000), `motionDurations.${name} = ${seconds}s is outside every EC-29 band`).toBe(true);
    }
  });
});

describe('one easing family', () => {
  const SYSTEM = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

  it('the canonical curve is declared once and the mirrors quote it exactly', () => {
    expect(cssToken('--vt-ease-system')).toBe(SYSTEM);
    for (const value of Object.values(motionTokens.easing)) {
      expect(value).toBe(SYSTEM);
    }
    for (const ease of Object.values(motionEasings)) {
      expect([...ease]).toEqual([0.2, 0.8, 0.2, 1]);
    }
  });
});
