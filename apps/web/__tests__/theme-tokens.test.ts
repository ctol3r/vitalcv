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
    expect(cssVariables['--font-sans']).toContain('Nunito Sans');
    expect(motionCssVariables['--ui-motion-duration-panel']).toBe('320ms');
    expect(motionDurations.panel).toBeLessThanOrEqual(0.32);
  });
});
