/**
 * Design Tokens
 * Centralized color, spacing, typography, and theme tokens
 * Task: 1104-frontend-0018
 */

export const tokens = {
  // Color Tokens
  colors: {
    // Brand Colors
    primary: {
      50: 'hsl(212, 100%, 97%)',
      100: 'hsl(212, 100%, 93%)',
      200: 'hsl(212, 100%, 87%)',
      300: 'hsl(212, 100%, 78%)',
      400: 'hsl(212, 100%, 67%)',
      500: 'hsl(212, 100%, 56%)', // Primary blue
      600: 'hsl(212, 100%, 47%)',
      700: 'hsl(212, 100%, 39%)',
      800: 'hsl(212, 100%, 32%)',
      900: 'hsl(212, 100%, 26%)',
      950: 'hsl(212, 100%, 16%)',
    },

    // Semantic Colors - Success
    success: {
      50: 'hsl(142, 76%, 96%)',
      100: 'hsl(142, 77%, 91%)',
      200: 'hsl(141, 75%, 83%)',
      300: 'hsl(142, 73%, 70%)',
      400: 'hsl(142, 67%, 56%)',
      500: 'hsl(142, 69%, 44%)',
      600: 'hsl(142, 72%, 36%)',
      700: 'hsl(142, 70%, 29%)',
      800: 'hsl(142, 65%, 24%)',
      900: 'hsl(143, 64%, 20%)',
      950: 'hsl(144, 72%, 11%)',
    },

    // Semantic Colors - Warning
    warning: {
      50: 'hsl(48, 100%, 96%)',
      100: 'hsl(48, 100%, 88%)',
      200: 'hsl(48, 96%, 76%)',
      300: 'hsl(48, 96%, 64%)',
      400: 'hsl(44, 94%, 57%)',
      500: 'hsl(38, 92%, 50%)',
      600: 'hsl(32, 95%, 44%)',
      700: 'hsl(26, 90%, 37%)',
      800: 'hsl(23, 83%, 31%)',
      900: 'hsl(22, 79%, 26%)',
      950: 'hsl(22, 89%, 15%)',
    },

    // Semantic Colors - Error/Danger
    error: {
      50: 'hsl(0, 86%, 97%)',
      100: 'hsl(0, 93%, 94%)',
      200: 'hsl(0, 96%, 89%)',
      300: 'hsl(0, 94%, 82%)',
      400: 'hsl(0, 91%, 71%)',
      500: 'hsl(0, 84%, 60%)',
      600: 'hsl(0, 72%, 51%)',
      700: 'hsl(0, 74%, 42%)',
      800: 'hsl(0, 70%, 35%)',
      900: 'hsl(0, 63%, 31%)',
      950: 'hsl(0, 75%, 17%)',
    },

    // Neutral/Gray Scale
    neutral: {
      50: 'hsl(210, 40%, 98%)',
      100: 'hsl(210, 40%, 96%)',
      200: 'hsl(214, 32%, 91%)',
      300: 'hsl(213, 27%, 84%)',
      400: 'hsl(215, 20%, 65%)',
      500: 'hsl(215, 16%, 47%)',
      600: 'hsl(215, 19%, 35%)',
      700: 'hsl(215, 25%, 27%)',
      800: 'hsl(217, 33%, 17%)',
      900: 'hsl(222, 47%, 11%)',
      950: 'hsl(229, 84%, 5%)',
    },
  },

  // Spacing Tokens (in px, but can be converted to rem)
  spacing: {
    0: '0px',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
    20: '80px',
    24: '96px',
    32: '128px',
    40: '160px',
    48: '192px',
    56: '224px',
    64: '256px',
  },

  // Typography Tokens
  typography: {
    fontFamily: {
      sans: 'var(--font-geist-sans, ui-sans-serif, system-ui, sans-serif)',
      mono: 'var(--font-geist-mono, ui-monospace, monospace)',
    },
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem', // 36px
      '5xl': '3rem',    // 48px
      '6xl': '3.75rem', // 60px
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    lineHeight: {
      none: '1',
      tight: '1.25',
      snug: '1.375',
      normal: '1.5',
      relaxed: '1.625',
      loose: '2',
    },
  },

  // Border Radius
  borderRadius: {
    none: '0px',
    sm: '4px',
    base: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    '2xl': '32px',
    full: '9999px',
  },

  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  },

  // Animation Durations
  animation: {
    duration: {
      fast: '150ms',
      base: '200ms',
      slow: '300ms',
      slower: '500ms',
    },
    easing: {
      linear: 'linear',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },

  // Z-Index Scale
  zIndex: {
    base: '0',
    dropdown: '1000',
    sticky: '1100',
    fixed: '1200',
    modalBackdrop: '1300',
    modal: '1400',
    popover: '1500',
    tooltip: '1600',
  },
} as const;

// CSS Variable Names for Theme Toggle
export const cssVarNames = {
  // Colors
  background: '--background',
  foreground: '--foreground',
  card: '--card',
  cardForeground: '--card-foreground',
  popover: '--popover',
  popoverForeground: '--popover-foreground',
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  secondary: '--secondary',
  secondaryForeground: '--secondary-foreground',
  muted: '--muted',
  mutedForeground: '--muted-foreground',
  accent: '--accent',
  accentForeground: '--accent-foreground',
  destructive: '--destructive',
  destructiveForeground: '--destructive-foreground',
  border: '--border',
  input: '--input',
  ring: '--ring',
  radius: '--radius',
} as const;

// Helper function to get token value
export function getToken(path: string): string {
  const keys = path.split('.');
  let value: any = tokens;

  for (const key of keys) {
    value = value[key];
    if (value === undefined) {
      console.warn(`Token not found: ${path}`);
      return '';
    }
  }

  return value as string;
}

// Helper to apply design tokens as CSS variables
export function applyDesignTokens(element: HTMLElement = document.documentElement): void {
  // Apply spacing
  Object.entries(tokens.spacing).forEach(([key, value]) => {
    element.style.setProperty(`--spacing-${key}`, value);
  });

  // Apply colors
  Object.entries(tokens.colors.primary).forEach(([shade, value]) => {
    element.style.setProperty(`--color-primary-${shade}`, value);
  });

  // Apply other tokens as needed
  element.style.setProperty('--font-sans', tokens.typography.fontFamily.sans);
  element.style.setProperty('--font-mono', tokens.typography.fontFamily.mono);
}

export default tokens;
