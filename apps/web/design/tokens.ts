import { motionDurations, motionEasings } from '@/ui/animation/motion';
import { themeTokens } from '@/ui/theme/tokens';

export const colors = {
  background: themeTokens.colors.light.backgroundPrimary,
  foreground: themeTokens.colors.light.textPrimary,
  card: themeTokens.colors.light.backgroundPanel,
  primary: themeTokens.colors.light.accentBlue,
  secondary: themeTokens.colors.light.backgroundHover,
  accent: themeTokens.colors.light.accentCyan,
  destructive: themeTokens.colors.light.danger,
  trustGreen: themeTokens.colors.light.success,
  trustYellow: themeTokens.colors.light.accentYellow,
  trustRed: themeTokens.colors.light.danger,
  sage: themeTokens.colors.light.accentCyan,
  waveBlue: themeTokens.colors.light.accentBlue,
  waveTeal: themeTokens.colors.light.accentCyan,
  wavePurple: themeTokens.colors.light.accentMagenta,
} as const;

export const darkColors = {
  background: themeTokens.colors.dark.backgroundPrimary,
  foreground: themeTokens.colors.dark.textPrimary,
  card: themeTokens.colors.dark.backgroundPanel,
  primary: themeTokens.colors.dark.accentBlue,
  secondary: themeTokens.colors.dark.backgroundHover,
  accent: themeTokens.colors.dark.accentCyan,
  destructive: themeTokens.colors.dark.danger,
  trustGreen: themeTokens.colors.dark.success,
  trustYellow: themeTokens.colors.dark.accentYellow,
  trustRed: themeTokens.colors.dark.danger,
  sage: themeTokens.colors.dark.accentCyan,
} as const;

export const easings = {
  spring: motionEasings.swiftOut,
  easeOut: motionEasings.easeOut,
  decelerate: motionEasings.fadeOut,
} as const;

export const durations = {
  fast: motionDurations.fast,
  normal: motionDurations.highlight,
  slow: motionDurations.panel,
  pulse: 1.5,
} as const;

/** @deprecated — depth tokens removed in design system reset */
export const shadows = { glass: 'none', glow: 'none', elevated: 'none' } as const;
/** @deprecated — depth tokens removed in design system reset */
export const darkShadows = { glass: 'none', glow: 'none', elevated: 'none' } as const;
/** @deprecated — depth tokens removed in design system reset */
export const glassBlur = '0px';

export const fontSize = themeTokens.typography.size;
export const lineHeight = themeTokens.typography.lineHeight;

export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

export const spacing = themeTokens.typography.spacing;

export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  modal: 30,
  overlay: 40,
  toast: 50,
} as const;

/** @deprecated — blur tokens removed in design system reset */
export const blur = { sm: '0px', md: '0px', lg: '0px', xl: '0px' } as const;

export const borderRadius = {
  none: '0',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.5rem',
  full: '9999px',
} as const;
