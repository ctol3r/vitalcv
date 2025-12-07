/**
 * B246B-DES-020: TypeScript theme typings
 *
 * Defines strict TypeScript types for theme structure and tokens.
 * Ensures compile-time validation of theme usage.
 */

/**
 * Color token values - supports various color formats
 */
export type ColorToken = string;

/**
 * Typography scale tokens
 */
export interface TypographyTokens {
  fontFamily: {
    sans: string;
    mono: string;
    serif?: string;
  };
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    '4xl': string;
    '5xl': string;
    '6xl': string;
  };
  fontWeight: {
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };
  lineHeight: {
    tight: string;
    normal: string;
    relaxed: string;
    loose: string;
  };
  letterSpacing: {
    tighter: string;
    tight: string;
    normal: string;
    wide: string;
    wider: string;
  };
}

/**
 * Spacing scale tokens
 */
export interface SpacingTokens {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
  '4xl': string;
}

/**
 * Border radius tokens
 */
export interface BorderRadiusTokens {
  none: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  full: string;
}

/**
 * Shadow tokens
 */
export interface ShadowTokens {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  inner: string;
  none: string;
}

/**
 * Color role mappings - semantic color usage
 */
export interface ThemeColors {
  // Background colors
  background: ColorToken;
  backgroundSecondary: ColorToken;
  backgroundTertiary: ColorToken;

  // Foreground/text colors
  foreground: ColorToken;
  foregroundSecondary: ColorToken;
  foregroundTertiary: ColorToken;

  // Border colors
  border: ColorToken;
  borderSecondary: ColorToken;
  borderFocus: ColorToken;

  // Accent colors
  accent: ColorToken;
  accentForeground: ColorToken;
  accentHover: ColorToken;

  // Primary colors
  primary: ColorToken;
  primaryForeground: ColorToken;
  primaryHover: ColorToken;

  // Secondary colors
  secondary: ColorToken;
  secondaryForeground: ColorToken;
  secondaryHover: ColorToken;

  // Muted colors
  muted: ColorToken;
  mutedForeground: ColorToken;

  // Semantic colors
  success: ColorToken;
  successForeground: ColorToken;
  warning: ColorToken;
  warningForeground: ColorToken;
  error: ColorToken;
  errorForeground: ColorToken;
  info: ColorToken;
  infoForeground: ColorToken;

  // Interactive states
  hover: ColorToken;
  active: ColorToken;
  disabled: ColorToken;
  disabledForeground: ColorToken;

  // Card colors
  card: ColorToken;
  cardForeground: ColorToken;
  cardBorder: ColorToken;

  // Input colors
  input: ColorToken;
  inputBorder: ColorToken;
  inputFocus: ColorToken;

  // Ring/focus ring
  ring: ColorToken;
  ringOffset: ColorToken;
}

/**
 * Complete theme structure
 */
export interface Theme {
  name: string;
  colors: ThemeColors;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  borderRadius: BorderRadiusTokens;
  shadows: ShadowTokens;
  breakpoints?: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
}

/**
 * Partial theme for custom theme creation (allows overriding specific tokens)
 */
export type PartialTheme = Partial<Omit<Theme, 'name'>> & {
  name: string;
};

/**
 * Theme mode
 */
export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Theme validation result
 */
export interface ThemeValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Theme context value
 */
export interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

