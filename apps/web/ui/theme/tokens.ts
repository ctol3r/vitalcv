import { themeColors, type ThemeColorScale } from './colors';
import { themeTypography } from './typography';

function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
}

function mapColorScaleVariables(
  mode: keyof ThemeColorScale,
  palette: ThemeColorScale[keyof ThemeColorScale],
): Record<`--${string}`, string> {
  return Object.fromEntries(
    Object.entries(palette).map(([token, value]) => [
      `--ui-${mode}-${toKebabCase(token)}`,
      value,
    ]),
  ) as Record<`--${string}`, string>;
}

function mapScaleVariables(
  prefix: string,
  values: Record<string, string>,
): Record<`--${string}`, string> {
  return Object.fromEntries(
    Object.entries(values).map(([token, value]) => [
      `--${prefix}-${token.replace(/\./g, '-')}`,
      value,
    ]),
  ) as Record<`--${string}`, string>;
}

export const themeTokens = {
  colors: themeColors,
  typography: themeTypography,
  radius: {
    panel: '1rem',
    badge: '9999px',
  },
  shadow: {
    panel: '0 18px 48px rgb(2 6 23 / 0.26)',
    stage: '0 32px 80px rgb(2 6 23 / 0.3)',
  },
  layout: {
    topbarHeight: '3.9rem',
    sidebarWidth: '20rem',
    contextWidth: '23rem',
  },
} as const;

export const themeCssVariables = {
  ...mapColorScaleVariables('light', themeTokens.colors.light),
  ...mapColorScaleVariables('dark', themeTokens.colors.dark),
  ...mapScaleVariables('font-size', themeTokens.typography.size),
  ...mapScaleVariables('leading', themeTokens.typography.lineHeight),
  ...mapScaleVariables('space', themeTokens.typography.spacing),
  '--ui-font-sans': themeTokens.typography.family.sans,
  '--ui-font-body': themeTokens.typography.family.body,
  '--ui-font-heading': themeTokens.typography.family.heading,
  '--ui-font-mono': themeTokens.typography.family.mono,
  '--font-body': themeTokens.typography.family.body,
  '--font-heading': themeTokens.typography.family.heading,
  '--font-sans': themeTokens.typography.family.sans,
  '--font-mono': themeTokens.typography.family.mono,
  '--vital-ops-background': 'var(--ui-dark-background-primary)',
  '--vital-ops-panel': 'var(--ui-dark-background-panel)',
  '--vital-ops-panel-alt': 'var(--ui-dark-background-hover)',
  '--vital-ops-hover': 'var(--ui-dark-background-hover)',
  '--vital-ops-border': 'var(--ui-dark-border-primary)',
  '--vital-ops-border-subtle': 'var(--ui-dark-border-primary)',
  '--vital-ops-text-primary': 'var(--ui-dark-text-primary)',
  '--vital-ops-text-secondary': 'var(--ui-dark-text-secondary)',
  '--vital-ops-text-muted': 'var(--ui-dark-text-muted)',
  '--vital-ops-accent-blue': 'var(--ui-dark-accent-blue)',
  '--vital-ops-accent-cyan': 'var(--ui-dark-accent-cyan)',
  '--vital-ops-accent-yellow': 'var(--ui-dark-accent-yellow)',
  '--vital-ops-accent-magenta': 'var(--ui-dark-accent-magenta)',
  '--vital-ops-danger': 'var(--ui-dark-danger)',
  '--vital-ops-success': 'var(--ui-dark-success)',
  '--vital-ops-topbar-height': themeTokens.layout.topbarHeight,
  '--vital-ops-sidebar-width': themeTokens.layout.sidebarWidth,
  '--vital-ops-context-width': themeTokens.layout.contextWidth,
} as const satisfies Record<`--${string}`, string>;
