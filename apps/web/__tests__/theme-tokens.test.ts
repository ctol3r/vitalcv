import { describe, expect, it } from 'vitest';
import { motionCssVariables, motionDurations } from '@/ui/animation/motion';
import { themeTokens, themeCssVariables } from '@/ui/theme/tokens';

describe('theme token system', () => {
  it('defines the required semantic color tokens for both theme modes', () => {
    expect(themeTokens.colors.light.backgroundPrimary).toBeTruthy();
    expect(themeTokens.colors.light.backgroundPanel).toBeTruthy();
    expect(themeTokens.colors.light.backgroundHover).toBeTruthy();
    expect(themeTokens.colors.light.borderPrimary).toBeTruthy();
    expect(themeTokens.colors.light.textPrimary).toBeTruthy();
    expect(themeTokens.colors.light.textSecondary).toBeTruthy();
    expect(themeTokens.colors.light.textMuted).toBeTruthy();
    expect(themeTokens.colors.light.accentBlue).toBeTruthy();
    expect(themeTokens.colors.light.accentCyan).toBeTruthy();
    expect(themeTokens.colors.light.accentYellow).toBeTruthy();
    expect(themeTokens.colors.light.accentMagenta).toBeTruthy();
    expect(themeTokens.colors.light.danger).toBeTruthy();
    expect(themeTokens.colors.light.success).toBeTruthy();
    expect(themeTokens.colors.dark.backgroundPrimary).toBeTruthy();
    expect(themeTokens.colors.dark.backgroundPanel).toBeTruthy();
  });

  it('publishes CSS variables for the graph shell and motion system', () => {
    const cssVariables = themeCssVariables as Record<string, string>;

    expect(cssVariables['--ui-light-background-primary']).toBe(themeTokens.colors.light.backgroundPrimary);
    expect(cssVariables['--ui-dark-background-panel']).toBe(themeTokens.colors.dark.backgroundPanel);
    expect(cssVariables['--vital-ops-background']).toBe('var(--ui-dark-background-primary)');
    expect(motionCssVariables['--ui-motion-duration-panel']).toBe('320ms');
    expect(motionDurations.panel).toBeLessThanOrEqual(0.32);
  });

  // CD-7. This assertion used to read `toContain('Nunito Sans')` — it pinned the
  // PRE-CD-W1 value and passed only because `app/layout.tsx` re-declares the same
  // keys after spreading `vdsCssVariables`. The suite was defending the wrong
  // answer: anyone correcting the token source broke the test, and anyone
  // reordering that spread reverted the product's fonts without breaking
  // anything. Assert the shipped faces, and assert the retired ones are gone.
  it('publishes the three CD-7 faces, not the retired ones', () => {
    const cssVariables = themeCssVariables as Record<string, string>;

    for (const key of ['--font-sans', '--font-body', '--font-heading', '--vt-font-sans', '--ui-font-sans']) {
      expect(cssVariables[key], `${key} must resolve to the loaded Geist Sans`).toContain('--font-geist-loaded');
    }
    for (const key of ['--font-mono', '--vt-font-mono', '--ui-font-mono']) {
      expect(cssVariables[key], `${key} must resolve to the loaded Geist Mono`).toContain('--font-geist-mono-loaded');
    }

    // The two faces this product does not load. Their reappearance is the
    // regression, and it is silent — nothing else in the repo would catch it.
    const allFontValues = Object.entries(cssVariables)
      .filter(([key]) => key.includes('font'))
      .map(([, value]) => value)
      .join(' ');
    expect(allFontValues).not.toContain('Nunito Sans');
    expect(allFontValues).not.toContain('JetBrains Mono');
  });
});
