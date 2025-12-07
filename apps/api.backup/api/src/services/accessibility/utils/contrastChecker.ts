/**
 * B242A-ACC-004: ContrastChecker utility
 *
 * Calculates contrast ratios between two colors and determines WCAG compliance.
 * Based on WCAG 2.1 guidelines for color contrast.
 */

/**
 * Convert hex color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Calculate relative luminance of a color
 * Based on WCAG 2.1 formula: https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((val) => {
    const v = val / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * Returns a value between 1 (no contrast) and 21 (maximum contrast)
 */
export function calculateContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) {
    throw new Error('Invalid hex color format. Expected format: #RRGGBB');
  }

  const l1 = getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * WCAG 2.1 contrast requirements
 */
export const WCAG_REQUIREMENTS = {
  NORMAL_TEXT_AA: 4.5, // Level AA for normal text
  LARGE_TEXT_AA: 3.0, // Level AA for large text (18pt+ or 14pt+ bold)
  UI_COMPONENTS_AA: 3.0, // Level AA for UI components and graphical objects
  NORMAL_TEXT_AAA: 7.0, // Level AAA for normal text
  LARGE_TEXT_AAA: 4.5, // Level AAA for large text
} as const;

export interface ContrastCheckResult {
  contrastRatio: number;
  passesNormalTextAA: boolean;
  passesLargeTextAA: boolean;
  passesUIComponentsAA: boolean;
  passesNormalTextAAA: boolean;
  passesLargeTextAAA: boolean;
}

/**
 * Check contrast between two colors and return detailed results
 */
export function checkContrast(
  foreground: string,
  background: string
): ContrastCheckResult {
  const contrastRatio = calculateContrastRatio(foreground, background);

  return {
    contrastRatio: Math.round(contrastRatio * 100) / 100, // Round to 2 decimal places
    passesNormalTextAA: contrastRatio >= WCAG_REQUIREMENTS.NORMAL_TEXT_AA,
    passesLargeTextAA: contrastRatio >= WCAG_REQUIREMENTS.LARGE_TEXT_AA,
    passesUIComponentsAA: contrastRatio >= WCAG_REQUIREMENTS.UI_COMPONENTS_AA,
    passesNormalTextAAA: contrastRatio >= WCAG_REQUIREMENTS.NORMAL_TEXT_AAA,
    passesLargeTextAAA: contrastRatio >= WCAG_REQUIREMENTS.LARGE_TEXT_AAA,
  };
}

/**
 * Quick check if a color pair meets WCAG AA standards for normal text
 */
export function meetsWCAGAA(foreground: string, background: string): boolean {
  const result = checkContrast(foreground, background);
  return result.passesNormalTextAA;
}

/**
 * Quick check if a color pair meets WCAG AAA standards for normal text
 */
export function meetsWCAGAAA(foreground: string, background: string): boolean {
  const result = checkContrast(foreground, background);
  return result.passesNormalTextAAA;
}

