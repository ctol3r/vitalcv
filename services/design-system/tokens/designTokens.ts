/**
 * Design Tokens
 *
 * Comprehensive design system tokens including colors, typography, spacing,
 * border radius, and elevation shadows. Exported as both TypeScript and JSON.
 */

// ============================================================================
// Color Palette
// ============================================================================

export const colors = {
  // Primary Colors
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
    950: '#082f49',
  },

  // Secondary Colors
  secondary: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7e22ce',
    800: '#6b21a8',
    900: '#581c87',
    950: '#3b0764',
  },

  // Neutral Colors
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0a0a0a',
  },

  // Semantic Colors
  semantic: {
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
      950: '#052e16',
    },
    error: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
      950: '#450a0a',
    },
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
      950: '#451a03',
    },
    info: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
      950: '#172554',
    },
  },
} as const;

// ============================================================================
// Typography
// ============================================================================

export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
    serif: ['Georgia', 'Times New Roman', 'serif'],
    mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'monospace'],
  },

  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.05em' }],
    sm: ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.025em' }],
    base: ['1rem', { lineHeight: '1.5rem', letterSpacing: '0' }],
    lg: ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.025em' }],
    xl: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.025em' }],
    '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.05em' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.05em' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.05em' }],
    '5xl': ['3rem', { lineHeight: '1', letterSpacing: '-0.05em' }],
    '6xl': ['3.75rem', { lineHeight: '1', letterSpacing: '-0.05em' }],
    '7xl': ['4.5rem', { lineHeight: '1', letterSpacing: '-0.05em' }],
    '8xl': ['6rem', { lineHeight: '1', letterSpacing: '-0.05em' }],
    '9xl': ['8rem', { lineHeight: '1', letterSpacing: '-0.05em' }],
  },

  fontWeight: {
    thin: '100',
    extralight: '200',
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
  },

  lineHeight: {
    none: '1',
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
    loose: '2',
  },

  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
} as const;

// ============================================================================
// Spacing Scale
// ============================================================================

export const spacing = {
  0: '0',
  1: '0.25rem',    // 4px
  2: '0.5rem',     // 8px
  3: '0.75rem',    // 12px
  4: '1rem',       // 16px
  5: '1.25rem',    // 20px
  6: '1.5rem',     // 24px
  7: '1.75rem',    // 28px
  8: '2rem',       // 32px
  9: '2.25rem',    // 36px
  10: '2.5rem',    // 40px
  11: '2.75rem',   // 44px
  12: '3rem',      // 48px
  14: '3.5rem',    // 56px
  16: '4rem',      // 64px
  20: '5rem',      // 80px
  24: '6rem',      // 96px
  28: '7rem',      // 112px
  32: '8rem',      // 128px
  36: '9rem',      // 144px
  40: '10rem',     // 160px
  44: '11rem',     // 176px
  48: '12rem',     // 192px
  52: '13rem',     // 208px
  56: '14rem',     // 224px
  60: '15rem',     // 240px
  64: '16rem',     // 256px
  72: '18rem',     // 288px
  80: '20rem',     // 320px
  96: '24rem',     // 384px
} as const;

// ============================================================================
// Border Radius
// ============================================================================

export const borderRadius = {
  none: '0',
  sm: '0.125rem',   // 2px
  base: '0.25rem',  // 4px
  md: '0.375rem',   // 6px
  lg: '0.5rem',     // 8px
  xl: '0.75rem',    // 12px
  '2xl': '1rem',    // 16px
  '3xl': '1.5rem',  // 24px
  full: '9999px',
} as const;

// ============================================================================
// Elevation Shadows
// ============================================================================

export const elevation = {
  none: 'none',
  xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  base: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  md: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  lg: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  xl: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  '2xl': '0 30px 60px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
} as const;

// ============================================================================
// Design Tokens Object
// ============================================================================

export const designTokens = {
  colors,
  typography,
  spacing,
  borderRadius,
  elevation,
} as const;

// ============================================================================
// Type Exports
// ============================================================================

export type ColorScale = typeof colors.primary;
export type SemanticColor = typeof colors.semantic.success;
export type FontSize = keyof typeof typography.fontSize;
export type FontWeight = keyof typeof typography.fontWeight;
export type Spacing = keyof typeof spacing;
export type BorderRadius = keyof typeof borderRadius;
export type Elevation = keyof typeof elevation;

// ============================================================================
// JSON Export
// ============================================================================

/**
 * Convert design tokens to JSON-safe format
 */
export function tokensToJSON(): Record<string, unknown> {
  return {
    colors: {
      primary: colors.primary,
      secondary: colors.secondary,
      neutral: colors.neutral,
      semantic: colors.semantic,
    },
    typography: {
      fontFamily: typography.fontFamily,
      fontSize: Object.fromEntries(
        Object.entries(typography.fontSize).map(([key, value]) => [
          key,
          Array.isArray(value) ? { size: value[0], ...value[1] } : value,
        ])
      ),
      fontWeight: typography.fontWeight,
      lineHeight: typography.lineHeight,
      letterSpacing: typography.letterSpacing,
    },
    spacing,
    borderRadius,
    elevation,
  };
}

// Export JSON as default for JSON import
export const designTokensJSON = tokensToJSON();

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get color value from a color scale
 */
export function getColorValue(scale: ColorScale, shade: keyof ColorScale): string {
  return scale[shade];
}

/**
 * Get spacing value
 */
export function getSpacing(size: Spacing): string {
  return spacing[size];
}

/**
 * Get border radius value
 */
export function getBorderRadius(size: BorderRadius): string {
  return borderRadius[size];
}

/**
 * Get elevation shadow value
 */
export function getElevation(level: Elevation): string {
  return elevation[level];
}

/**
 * Validate token integrity
 */
export function validateTokens(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate color scales have required shades
  const requiredShades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
  const colorScales = [colors.primary, colors.secondary, colors.neutral] as const;

  colorScales.forEach((scale, index) => {
    const scaleName = ['primary', 'secondary', 'neutral'][index];
    requiredShades.forEach((shade) => {
      if (!(shade in scale)) {
        errors.push(`Missing shade ${shade} in ${scaleName} color scale`);
      }
    });
  });

  // Validate spacing scale is numeric
  Object.entries(spacing).forEach(([key, value]) => {
    if (isNaN(Number(key)) && key !== '0') {
      errors.push(`Invalid spacing key: ${key}`);
    }
    if (!value.match(/^\d+\.?\d*rem$/)) {
      errors.push(`Invalid spacing value format: ${value}`);
    }
  });

  // Validate border radius values
  Object.entries(borderRadius).forEach(([key, value]) => {
    if (key !== 'none' && key !== 'full' && !value.match(/^\d+\.?\d*rem$/)) {
      errors.push(`Invalid border radius value format: ${value} for key ${key}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

