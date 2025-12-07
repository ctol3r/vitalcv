/**
 * B242B-ACC-014: Accessible Color Palette Config
 *
 * Defines colour themes that meet minimum contrast ratios.
 * Includes variants for light/dark modes.
 * Integrates with DesignSystem; documented for design teams.
 */

export interface ColorContrast {
  /** Contrast ratio (e.g., 4.5 for normal text, 3.0 for large text) */
  ratio: number;
  /** WCAG level (AA or AAA) */
  level: 'AA' | 'AAA';
  /** Text size category */
  textSize: 'normal' | 'large';
}

export interface ColorPair {
  /** Foreground color (text) */
  foreground: string;
  /** Background color */
  background: string;
  /** Contrast ratio */
  contrast: number;
  /** Whether it meets WCAG AA */
  meetsAA: boolean;
  /** Whether it meets WCAG AAA */
  meetsAAA: boolean;
}

export interface ColorTheme {
  /** Theme name */
  name: string;
  /** Theme description */
  description: string;
  /** Primary colors */
  primary: string[];
  /** Secondary colors */
  secondary: string[];
  /** Background colors */
  background: {
    light: string;
    dark: string;
  };
  /** Text colors */
  text: {
    light: string;
    dark: string;
  };
  /** Accent colors */
  accent: string[];
  /** Error colors */
  error: string[];
  /** Success colors */
  success: string[];
  /** Warning colors */
  warning: string[];
  /** Info colors */
  info: string[];
}

/**
 * Calculate relative luminance of a color
 * Based on WCAG 2.1 formula
 */
function getLuminance(hex: string): number {
  // Convert hex to RGB
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  // Apply gamma correction
  const [rLinear, gLinear, bLinear] = [r, g, b].map((val) => {
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });

  // Calculate relative luminance
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Calculate contrast ratio between two colors
 */
export function calculateContrastRatio(
  color1: string,
  color2: string
): number {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a color pair meets WCAG contrast requirements
 */
export function meetsContrastRequirement(
  foreground: string,
  background: string,
  requirement: ColorContrast
): boolean {
  const ratio = calculateContrastRatio(foreground, background);
  return ratio >= requirement.ratio;
}

/**
 * WCAG contrast requirements
 */
export const WCAG_REQUIREMENTS = {
  normalTextAA: { ratio: 4.5, level: 'AA', textSize: 'normal' as const },
  largeTextAA: { ratio: 3.0, level: 'AA', textSize: 'large' as const },
  normalTextAAA: { ratio: 7.0, level: 'AAA', textSize: 'normal' as const },
  largeTextAAA: { ratio: 4.5, level: 'AAA', textSize: 'large' as const },
} as const;

/**
 * Accessible color themes
 */
export const ACCESSIBLE_THEMES: Record<string, ColorTheme> = {
  default: {
    name: 'Default Accessible Theme',
    description: 'High contrast theme meeting WCAG AA standards',
    primary: ['#005fcc', '#004499', '#003366'],
    secondary: ['#6c757d', '#5a6268', '#484f54'],
    background: {
      light: '#ffffff',
      dark: '#1a1a1a',
    },
    text: {
      light: '#212529',
      dark: '#f8f9fa',
    },
    accent: ['#007bff', '#0056b3'],
    error: ['#dc3545', '#c82333'],
    success: ['#28a745', '#218838'],
    warning: ['#ffc107', '#e0a800'],
    info: ['#17a2b8', '#138496'],
  },
  highContrast: {
    name: 'High Contrast Theme',
    description: 'Maximum contrast theme meeting WCAG AAA standards',
    primary: ['#000000', '#ffffff'],
    secondary: ['#333333', '#cccccc'],
    background: {
      light: '#ffffff',
      dark: '#000000',
    },
    text: {
      light: '#000000',
      dark: '#ffffff',
    },
    accent: ['#0000ff', '#ffff00'],
    error: ['#ff0000', '#ffffff'],
    success: ['#00ff00', '#000000'],
    warning: ['#ffff00', '#000000'],
    info: ['#0000ff', '#ffffff'],
  },
  colorBlind: {
    name: 'Color Blind Friendly Theme',
    description: 'Theme optimized for color vision deficiencies',
    primary: ['#1f77b4', '#ff7f0e', '#2ca02c'],
    secondary: ['#d62728', '#9467bd', '#8c564b'],
    background: {
      light: '#ffffff',
      dark: '#2d2d2d',
    },
    text: {
      light: '#000000',
      dark: '#ffffff',
    },
    accent: ['#1f77b4', '#ff7f0e'],
    error: ['#d62728', '#8b0000'],
    success: ['#2ca02c', '#006400'],
    warning: ['#ff7f0e', '#ff8c00'],
    info: ['#1f77b4', '#0000cd'],
  },
};

/**
 * Validate color pair for accessibility
 */
export function validateColorPair(
  foreground: string,
  background: string
): ColorPair {
  const contrast = calculateContrastRatio(foreground, background);
  const meetsAA = contrast >= WCAG_REQUIREMENTS.normalTextAA.ratio;
  const meetsAAA = contrast >= WCAG_REQUIREMENTS.normalTextAAA.ratio;

  return {
    foreground,
    background,
    contrast,
    meetsAA,
    meetsAAA,
  };
}

/**
 * Get accessible text color for a background
 */
export function getAccessibleTextColor(
  background: string,
  theme: 'light' | 'dark' = 'light'
): string {
  const themes = ACCESSIBLE_THEMES.default;
  const lightText = themes.text.light;
  const darkText = themes.text.dark;

  // Check contrast with both light and dark text
  const lightContrast = calculateContrastRatio(lightText, background);
  const darkContrast = calculateContrastRatio(darkText, background);

  // Return the one with better contrast
  if (lightContrast > darkContrast && lightContrast >= 4.5) {
    return lightText;
  }
  if (darkContrast >= 4.5) {
    return darkText;
  }

  // Fallback based on theme
  return theme === 'light' ? lightText : darkText;
}

/**
 * Generate accessible color variants
 */
export function generateAccessibleVariants(
  baseColor: string,
  count: number = 5
): string[] {
  // This is a simplified version
  // In production, you'd use a proper color manipulation library
  const variants: string[] = [baseColor];

  // Generate lighter and darker variants
  for (let i = 1; i < count; i++) {
    // This is a placeholder - real implementation would adjust HSL values
    variants.push(baseColor); // Simplified
  }

  return variants;
}

/**
 * Get theme colors for light mode
 */
export function getLightModeColors(themeName: string = 'default'): ColorTheme {
  const theme = ACCESSIBLE_THEMES[themeName] || ACCESSIBLE_THEMES.default;
  return theme;
}

/**
 * Get theme colors for dark mode
 */
export function getDarkModeColors(themeName: string = 'default'): ColorTheme {
  const theme = ACCESSIBLE_THEMES[themeName] || ACCESSIBLE_THEMES.default;
  // In a real implementation, you'd have separate dark mode themes
  return theme;
}

/**
 * Check if a color is light or dark
 */
export function isLightColor(color: string): boolean {
  const luminance = getLuminance(color);
  return luminance > 0.5;
}

/**
 * Design system integration helper
 */
export const AccessibleColorPalette = {
  themes: ACCESSIBLE_THEMES,
  calculateContrast: calculateContrastRatio,
  validatePair: validateColorPair,
  getTextColor: getAccessibleTextColor,
  meetsRequirement: meetsContrastRequirement,
  requirements: WCAG_REQUIREMENTS,
  isLight: isLightColor,
  getLightMode: getLightModeColors,
  getDarkMode: getDarkModeColors,
} as const;

/**
 * CSS custom properties generator for design systems
 */
export function generateCSSVariables(
  themeName: string = 'default',
  mode: 'light' | 'dark' = 'light'
): string {
  const theme = ACCESSIBLE_THEMES[themeName] || ACCESSIBLE_THEMES.default;
  const bg = mode === 'light' ? theme.background.light : theme.background.dark;
  const text = mode === 'light' ? theme.text.light : theme.text.dark;

  return `
    :root {
      --color-primary: ${theme.primary[0]};
      --color-primary-dark: ${theme.primary[1]};
      --color-secondary: ${theme.secondary[0]};
      --color-background: ${bg};
      --color-text: ${text};
      --color-accent: ${theme.accent[0]};
      --color-error: ${theme.error[0]};
      --color-success: ${theme.success[0]};
      --color-warning: ${theme.warning[0]};
      --color-info: ${theme.info[0]};
    }
  `;
}

/**
 * Default export
 */
export default AccessibleColorPalette;

