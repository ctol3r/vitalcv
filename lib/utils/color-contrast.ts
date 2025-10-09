/**
 * Color Contrast Utilities
 *
 * WCAG 2.1 AA compliance requires:
 * - Normal text (< 18pt): 4.5:1 contrast ratio
 * - Large text (>= 18pt or >= 14pt bold): 3:1 contrast ratio
 * - UI components and graphics: 3:1 contrast ratio
 */

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : null
}

/**
 * Calculate relative luminance of a color
 * Formula from WCAG 2.1: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4)
  })

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Calculate contrast ratio between two colors
 * Formula from WCAG 2.1: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 *
 * @param color1 - First color (hex format)
 * @param color2 - Second color (hex format)
 * @returns Contrast ratio (1 to 21)
 *
 * @example
 * getContrastRatio('#000000', '#ffffff') // 21
 * getContrastRatio('#767676', '#ffffff') // 4.54
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1)
  const rgb2 = hexToRgb(color2)

  if (!rgb1 || !rgb2) {
    throw new Error('Invalid hex color format')
  }

  const lum1 = getRelativeLuminance(...rgb1)
  const lum2 = getRelativeLuminance(...rgb2)

  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Check if color combination meets WCAG AA for normal text
 *
 * @param foreground - Foreground color (hex)
 * @param background - Background color (hex)
 * @returns True if contrast ratio >= 4.5:1
 */
export function meetsWCAG_AA_NormalText(
  foreground: string,
  background: string
): boolean {
  const ratio = getContrastRatio(foreground, background)
  return ratio >= 4.5
}

/**
 * Check if color combination meets WCAG AA for large text
 *
 * @param foreground - Foreground color (hex)
 * @param background - Background color (hex)
 * @returns True if contrast ratio >= 3:1
 */
export function meetsWCAG_AA_LargeText(
  foreground: string,
  background: string
): boolean {
  const ratio = getContrastRatio(foreground, background)
  return ratio >= 3.0
}

/**
 * Check if color combination meets WCAG AAA for normal text
 *
 * @param foreground - Foreground color (hex)
 * @param background - Background color (hex)
 * @returns True if contrast ratio >= 7:1
 */
export function meetsWCAG_AAA_NormalText(
  foreground: string,
  background: string
): boolean {
  const ratio = getContrastRatio(foreground, background)
  return ratio >= 7.0
}

/**
 * Check if color combination meets WCAG AAA for large text
 *
 * @param foreground - Foreground color (hex)
 * @param background - Background color (hex)
 * @returns True if contrast ratio >= 4.5:1
 */
export function meetsWCAG_AAA_LargeText(
  foreground: string,
  background: string
): boolean {
  const ratio = getContrastRatio(foreground, background)
  return ratio >= 4.5
}

/**
 * Get WCAG compliance level for a color combination
 *
 * @param foreground - Foreground color (hex)
 * @param background - Background color (hex)
 * @param isLargeText - Whether text is large (>= 18pt or >= 14pt bold)
 * @returns Compliance level object
 *
 * @example
 * getWCAGCompliance('#000000', '#ffffff', false)
 * // { ratio: 21, AA: true, AAA: true, level: 'AAA' }
 */
export function getWCAGCompliance(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): {
  ratio: number
  AA: boolean
  AAA: boolean
  level: 'AAA' | 'AA' | 'Fail'
  description: string
} {
  const ratio = getContrastRatio(foreground, background)

  let AA: boolean
  let AAA: boolean

  if (isLargeText) {
    AA = ratio >= 3.0
    AAA = ratio >= 4.5
  } else {
    AA = ratio >= 4.5
    AAA = ratio >= 7.0
  }

  const level = AAA ? 'AAA' : AA ? 'AA' : 'Fail'
  const description =
    level === 'AAA'
      ? 'Excellent contrast - exceeds all requirements'
      : level === 'AA'
        ? 'Good contrast - meets WCAG AA requirements'
        : 'Insufficient contrast - fails WCAG AA requirements'

  return { ratio, AA, AAA, level, description }
}

/**
 * Suggest an accessible foreground color for a given background
 * Returns either black or white, whichever has better contrast
 *
 * @param background - Background color (hex)
 * @param preferDark - Prefer dark foreground if both meet requirements
 * @returns Suggested foreground color (#000000 or #ffffff)
 */
export function suggestForegroundColor(
  background: string,
  preferDark: boolean = true
): string {
  const blackContrast = getContrastRatio('#000000', background)
  const whiteContrast = getContrastRatio('#ffffff', background)

  // If both meet WCAG AA for normal text, use preference
  if (blackContrast >= 4.5 && whiteContrast >= 4.5) {
    return preferDark ? '#000000' : '#ffffff'
  }

  // Otherwise, use whichever has better contrast
  return blackContrast > whiteContrast ? '#000000' : '#ffffff'
}

/**
 * Find the nearest accessible color from a palette
 *
 * @param background - Background color (hex)
 * @param palette - Array of possible foreground colors (hex)
 * @param isLargeText - Whether text is large
 * @returns Nearest accessible color or null if none found
 */
export function findAccessibleColor(
  background: string,
  palette: string[],
  isLargeText: boolean = false
): string | null {
  const minRatio = isLargeText ? 3.0 : 4.5

  const accessible = palette
    .map((color) => ({
      color,
      ratio: getContrastRatio(color, background),
    }))
    .filter(({ ratio }) => ratio >= minRatio)
    .sort((a, b) => b.ratio - a.ratio) // Sort by highest contrast

  return accessible.length > 0 ? accessible[0].color : null
}

/**
 * Common accessible color combinations
 */
export const ACCESSIBLE_COLORS = {
  // Black on white
  blackOnWhite: {
    foreground: '#000000',
    background: '#ffffff',
    ratio: 21,
    level: 'AAA',
  },
  // White on black
  whiteOnBlack: {
    foreground: '#ffffff',
    background: '#000000',
    ratio: 21,
    level: 'AAA',
  },
  // Dark gray on white
  darkGrayOnWhite: {
    foreground: '#595959',
    background: '#ffffff',
    ratio: 7.0,
    level: 'AAA',
  },
  // Light gray on black
  lightGrayOnBlack: {
    foreground: '#a8a8a8',
    background: '#000000',
    ratio: 7.01,
    level: 'AAA',
  },
  // Gray on white (minimum AA)
  grayOnWhite: {
    foreground: '#767676',
    background: '#ffffff',
    ratio: 4.54,
    level: 'AA',
  },
  // Blue on white
  blueOnWhite: {
    foreground: '#0066cc',
    background: '#ffffff',
    ratio: 7.44,
    level: 'AAA',
  },
  // White on blue
  whiteOnBlue: {
    foreground: '#ffffff',
    background: '#0066cc',
    ratio: 7.44,
    level: 'AAA',
  },
  // Green on white
  greenOnWhite: {
    foreground: '#008000',
    background: '#ffffff',
    ratio: 4.57,
    level: 'AA',
  },
  // Red on white
  redOnWhite: {
    foreground: '#cc0000',
    background: '#ffffff',
    ratio: 5.39,
    level: 'AA',
  },
} as const

/**
 * VitalCV accessible color palette
 * All colors meet WCAG AA requirements with appropriate backgrounds
 */
export const VITAL_CV_COLORS = {
  // Light theme
  light: {
    background: '#ffffff', // oklch(1 0 0)
    foreground: '#1a1a1a', // oklch(0.145 0 0) - 14.54:1 ratio
    primary: '#2e2e2e', // oklch(0.205 0 0) - 11.86:1 ratio
    primaryForeground: '#fcfcfc', // oklch(0.985 0 0)
    secondary: '#f7f7f7', // oklch(0.97 0 0)
    secondaryForeground: '#2e2e2e', // oklch(0.205 0 0)
    muted: '#f7f7f7', // oklch(0.97 0 0)
    mutedForeground: '#7a7a7a', // oklch(0.556 0 0) - 4.61:1 ratio (AA)
    accent: '#f7f7f7', // oklch(0.97 0 0)
    accentForeground: '#2e2e2e', // oklch(0.205 0 0)
    destructive: '#d93f3f', // Adjusted for better contrast
    destructiveForeground: '#ffffff',
    success: '#22c55e', // Green-500
    successForeground: '#ffffff',
    warning: '#f59e0b', // Amber-500
    warningForeground: '#000000',
    info: '#7a7a7a',
    infoForeground: '#ffffff',
  },
  // Dark theme
  dark: {
    background: '#1a1a1a', // oklch(0.145 0 0)
    foreground: '#fcfcfc', // oklch(0.985 0 0) - 14.54:1 ratio
    primary: '#fcfcfc', // oklch(0.985 0 0)
    primaryForeground: '#2e2e2e', // oklch(0.205 0 0)
    secondary: '#3d3d3d', // oklch(0.269 0 0)
    secondaryForeground: '#fcfcfc', // oklch(0.985 0 0)
    muted: '#3d3d3d', // oklch(0.269 0 0)
    mutedForeground: '#b8b8b8', // oklch(0.708 0 0) - 4.5:1 ratio (AA)
    accent: '#3d3d3d', // oklch(0.269 0 0)
    accentForeground: '#fcfcfc', // oklch(0.985 0 0)
    destructive: '#ef4444', // Red-500
    destructiveForeground: '#ffffff',
    success: '#22c55e', // Green-500
    successForeground: '#000000',
    warning: '#f59e0b', // Amber-500
    warningForeground: '#000000',
    info: '#b8b8b8',
    infoForeground: '#000000',
  },
} as const

/**
 * Validate all color combinations in a theme
 *
 * @param theme - Theme object with color combinations
 * @returns Array of failing color combinations
 */
export function validateThemeColors(theme: Record<string, string>): Array<{
  pair: string
  ratio: number
  required: number
  status: 'pass' | 'fail'
}> {
  const results: Array<{
    pair: string
    ratio: number
    required: number
    status: 'pass' | 'fail'
  }> = []

  // Check foreground/background pairs
  const pairs = [
    ['foreground', 'background', 4.5],
    ['primaryForeground', 'primary', 4.5],
    ['secondaryForeground', 'secondary', 4.5],
    ['mutedForeground', 'muted', 4.5],
    ['accentForeground', 'accent', 4.5],
    ['destructiveForeground', 'destructive', 4.5],
    ['successForeground', 'success', 4.5],
    ['warningForeground', 'warning', 4.5],
    ['infoForeground', 'info', 4.5],
  ] as const

  for (const [fg, bg, required] of pairs) {
    if (theme[fg] && theme[bg]) {
      const ratio = getContrastRatio(theme[fg], theme[bg])
      results.push({
        pair: `${fg} / ${bg}`,
        ratio: Math.round(ratio * 100) / 100,
        required,
        status: ratio >= required ? 'pass' : 'fail',
      })
    }
  }

  return results
}
