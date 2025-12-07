/**
 * B246B-DES-013: CustomTheme API
 *
 * Allows creation of custom themes by overriding token values.
 * Validates theme structure and merges with base theme.
 */

import type { Theme, PartialTheme, ThemeValidationResult } from './themeTypes';
import { lightTheme } from './themes';

/**
 * Deep merge utility for theme objects
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const output = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      output[key] = deepMerge(target[key] || {} as T[Extract<keyof T, string>], source[key]);
    } else if (source[key] !== undefined) {
      output[key] = source[key] as T[Extract<keyof T, string>];
    }
  }

  return output;
}

/**
 * Validates a theme structure
 */
export function validateTheme(theme: Partial<Theme>): ThemeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required top-level properties
  if (!theme.name) {
    errors.push('Theme must have a name');
  }

  // Validate colors if provided
  if (theme.colors) {
    const requiredColorKeys: (keyof Theme['colors'])[] = [
      'background',
      'foreground',
      'border',
      'accent',
      'accentForeground',
      'primary',
      'primaryForeground',
      'secondary',
      'secondaryForeground',
      'muted',
      'mutedForeground',
    ];

    for (const key of requiredColorKeys) {
      if (!theme.colors[key]) {
        errors.push(`Missing required color token: ${key}`);
      }
    }

    // Check contrast ratios (basic validation)
    if (theme.colors.background && theme.colors.foreground) {
      // This is a simplified check - in production, use a proper contrast ratio calculator
      warnings.push('Contrast ratio validation recommended - ensure WCAG AA compliance');
    }
  }

  // Validate typography if provided
  if (theme.typography) {
    if (!theme.typography.fontFamily?.sans) {
      errors.push('Typography must include fontFamily.sans');
    }
    if (!theme.typography.fontSize?.base) {
      errors.push('Typography must include fontSize.base');
    }
  }

  // Validate spacing if provided
  if (theme.spacing) {
    const requiredSpacingKeys: (keyof Theme['spacing'])[] = ['xs', 'sm', 'md', 'lg', 'xl'];
    for (const key of requiredSpacingKeys) {
      if (!theme.spacing[key]) {
        warnings.push(`Recommended spacing token missing: ${key}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Creates a custom theme by merging with base theme
 */
export function createCustomTheme(partialTheme: PartialTheme, baseTheme: Theme = lightTheme): Theme {
  // Validate the partial theme
  const validation = validateTheme(partialTheme);

  if (!validation.valid) {
    throw new Error(`Invalid theme: ${validation.errors.join(', ')}`);
  }

  // Merge with base theme
  const mergedTheme = deepMerge(baseTheme, partialTheme);

  // Ensure name is set
  if (partialTheme.name) {
    mergedTheme.name = partialTheme.name;
  }

  return mergedTheme as Theme;
}

/**
 * Example custom themes
 */
export const exampleThemes = {
  /**
   * Ocean theme - blue accent
   */
  ocean: createCustomTheme({
    name: 'ocean',
    colors: {
      accent: '#0ea5e9',
      accentForeground: '#ffffff',
      accentHover: '#0284c7',
      primary: '#0ea5e9',
      primaryForeground: '#ffffff',
      ring: '#0ea5e9',
    },
  }),

  /**
   * Violet theme - purple accent
   */
  violet: createCustomTheme({
    name: 'violet',
    colors: {
      accent: '#8b5cf6',
      accentForeground: '#ffffff',
      accentHover: '#7c3aed',
      primary: '#8b5cf6',
      primaryForeground: '#ffffff',
      ring: '#8b5cf6',
    },
  }),

  /**
   * Forest theme - green accent
   */
  forest: createCustomTheme({
    name: 'forest',
    colors: {
      accent: '#22c55e',
      accentForeground: '#ffffff',
      accentHover: '#16a34a',
      primary: '#22c55e',
      primaryForeground: '#ffffff',
      ring: '#22c55e',
    },
  }),
};

/**
 * Export validation function for external use
 */
export { validateTheme };

