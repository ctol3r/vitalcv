export const themeColors = {
  light: {
    backgroundPrimary: 'oklch(0.985 0.004 248)',
    backgroundPanel: 'oklch(0.995 0.005 248 / 0.92)',
    backgroundHover: 'oklch(0.958 0.011 248 / 0.92)',
    borderPrimary: 'oklch(0.84 0.015 248 / 0.38)',
    textPrimary: 'oklch(0.23 0.014 252 / 0.96)',
    textSecondary: 'oklch(0.38 0.016 252 / 0.86)',
    textMuted: 'oklch(0.5 0.014 252 / 0.76)',
    accentBlue: 'oklch(0.67 0.16 252)',
    accentCyan: 'oklch(0.77 0.12 205)',
    accentYellow: 'oklch(0.84 0.14 94)',
    accentMagenta: 'oklch(0.72 0.16 336)',
    danger: 'oklch(0.65 0.19 25)',
    success: 'oklch(0.73 0.16 156)',
  },
  dark: {
    backgroundPrimary: 'oklch(0.15 0.018 252)',
    backgroundPanel: 'oklch(0.2 0.02 252 / 0.94)',
    backgroundHover: 'oklch(0.25 0.022 252 / 0.92)',
    borderPrimary: 'oklch(0.47 0.03 252 / 0.34)',
    textPrimary: 'oklch(0.93 0.012 252 / 0.96)',
    textSecondary: 'oklch(0.84 0.012 252 / 0.82)',
    textMuted: 'oklch(0.69 0.02 252 / 0.78)',
    accentBlue: 'oklch(0.73 0.14 252)',
    accentCyan: 'oklch(0.82 0.11 205)',
    accentYellow: 'oklch(0.86 0.14 94)',
    accentMagenta: 'oklch(0.76 0.16 336)',
    danger: 'oklch(0.73 0.16 28)',
    success: 'oklch(0.79 0.15 156)',
  },
} as const;

export type ThemeColorScale = typeof themeColors;
export type ThemeColorMode = keyof ThemeColorScale;
export type ThemeColorToken = keyof ThemeColorScale['light'];
