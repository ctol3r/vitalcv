/**
 * B246B-DES-012: Light & Dark theme definitions
 *
 * Define default light and dark themes by mapping token values to color roles.
 * Ensures sufficient contrast ratios for accessibility.
 */

import type { Theme } from './themeTypes';

/**
 * Default light theme
 */
export const lightTheme: Theme = {
  name: 'light',
  colors: {
    // Background colors
    background: '#ffffff',
    backgroundSecondary: '#f9fafb',
    backgroundTertiary: '#f3f4f6',

    // Foreground/text colors
    foreground: '#111827',
    foregroundSecondary: '#6b7280',
    foregroundTertiary: '#9ca3af',

    // Border colors
    border: '#e5e7eb',
    borderSecondary: '#d1d5db',
    borderFocus: '#3b82f6',

    // Accent colors
    accent: '#3b82f6',
    accentForeground: '#ffffff',
    accentHover: '#2563eb',

    // Primary colors
    primary: '#111827',
    primaryForeground: '#ffffff',
    primaryHover: '#1f2937',

    // Secondary colors
    secondary: '#f3f4f6',
    secondaryForeground: '#111827',
    secondaryHover: '#e5e7eb',

    // Muted colors
    muted: '#f9fafb',
    mutedForeground: '#6b7280',

    // Semantic colors
    success: '#10b981',
    successForeground: '#ffffff',
    warning: '#f59e0b',
    warningForeground: '#ffffff',
    error: '#ef4444',
    errorForeground: '#ffffff',
    info: '#3b82f6',
    infoForeground: '#ffffff',

    // Interactive states
    hover: '#f9fafb',
    active: '#f3f4f6',
    disabled: '#e5e7eb',
    disabledForeground: '#9ca3af',

    // Card colors
    card: '#ffffff',
    cardForeground: '#111827',
    cardBorder: '#e5e7eb',

    // Input colors
    input: '#ffffff',
    inputBorder: '#d1d5db',
    inputFocus: '#3b82f6',

    // Ring/focus ring
    ring: '#3b82f6',
    ringOffset: '#ffffff',
  },
  typography: {
    fontFamily: {
      sans: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
    },
    fontSize: {
      xs: '0.75rem',      // 12px
      sm: '0.875rem',     // 14px
      base: '1rem',       // 16px
      lg: '1.125rem',     // 18px
      xl: '1.25rem',      // 20px
      '2xl': '1.5rem',    // 24px
      '3xl': '1.875rem',  // 30px
      '4xl': '2.25rem',   // 36px
      '5xl': '3rem',      // 48px
      '6xl': '3.75rem',   // 60px
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75',
      loose: '2',
    },
    letterSpacing: {
      tighter: '-0.05em',
      tight: '-0.025em',
      normal: '0',
      wide: '0.025em',
      wider: '0.05em',
    },
  },
  spacing: {
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    '2xl': '3rem',   // 48px
    '3xl': '4rem',   // 64px
    '4xl': '6rem',   // 96px
  },
  borderRadius: {
    none: '0',
    sm: '0.125rem',  // 2px
    md: '0.375rem',  // 6px
    lg: '0.5rem',    // 8px
    xl: '0.75rem',   // 12px
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
    none: 'none',
  },
  breakpoints: {
    xs: '0px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
  },
};

/**
 * Default dark theme
 */
export const darkTheme: Theme = {
  name: 'dark',
  colors: {
    // Background colors
    background: '#111827',
    backgroundSecondary: '#1f2937',
    backgroundTertiary: '#374151',

    // Foreground/text colors
    foreground: '#f9fafb',
    foregroundSecondary: '#d1d5db',
    foregroundTertiary: '#9ca3af',

    // Border colors
    border: '#374151',
    borderSecondary: '#4b5563',
    borderFocus: '#60a5fa',

    // Accent colors
    accent: '#60a5fa',
    accentForeground: '#111827',
    accentHover: '#3b82f6',

    // Primary colors
    primary: '#f9fafb',
    primaryForeground: '#111827',
    primaryHover: '#e5e7eb',

    // Secondary colors
    secondary: '#374151',
    secondaryForeground: '#f9fafb',
    secondaryHover: '#4b5563',

    // Muted colors
    muted: '#1f2937',
    mutedForeground: '#9ca3af',

    // Semantic colors
    success: '#34d399',
    successForeground: '#111827',
    warning: '#fbbf24',
    warningForeground: '#111827',
    error: '#f87171',
    errorForeground: '#ffffff',
    info: '#60a5fa',
    infoForeground: '#111827',

    // Interactive states
    hover: '#1f2937',
    active: '#374151',
    disabled: '#4b5563',
    disabledForeground: '#6b7280',

    // Card colors
    card: '#1f2937',
    cardForeground: '#f9fafb',
    cardBorder: '#374151',

    // Input colors
    input: '#1f2937',
    inputBorder: '#4b5563',
    inputFocus: '#60a5fa',

    // Ring/focus ring
    ring: '#60a5fa',
    ringOffset: '#111827',
  },
  typography: lightTheme.typography,
  spacing: lightTheme.spacing,
  borderRadius: lightTheme.borderRadius,
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.4)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -4px rgb(0 0 0 / 0.4)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.4), 0 8px 10px -6px rgb(0 0 0 / 0.4)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.5)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.3)',
    none: 'none',
  },
  breakpoints: lightTheme.breakpoints,
};

/**
 * Get theme by name
 */
export function getTheme(name: 'light' | 'dark'): Theme {
  return name === 'light' ? lightTheme : darkTheme;
}

/**
 * Default theme export
 */
export const defaultTheme = lightTheme;

