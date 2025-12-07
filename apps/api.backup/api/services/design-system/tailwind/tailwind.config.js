/**
 * B246B-DES-019: TailwindConfigIntegration
 *
 * Sets up Tailwind CSS config to consume design tokens and themes.
 * Maps color tokens and spacing scale.
 * Includes plugin to generate CSS variables for themes.
 * Ensures consistency between Tailwind and design system.
 */

const { lightTheme, darkTheme } = require('../theme/themes');

/**
 * Generate Tailwind color config from theme colors
 */
function generateColorConfig(theme) {
  const colors = {};

  // Map theme colors to Tailwind format
  Object.entries(theme.colors).forEach(([key, value]) => {
    // Convert camelCase to kebab-case for CSS variables
    const cssVar = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    colors[key] = `var(${cssVar}, ${value})`;
  });

  return colors;
}

/**
 * Generate spacing config from theme
 */
function generateSpacingConfig(theme) {
  const spacing = {};

  Object.entries(theme.spacing).forEach(([key, value]) => {
    spacing[key] = value;
  });

  return spacing;
}

/**
 * Generate typography config from theme
 */
function generateTypographyConfig(theme) {
  return {
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.fontSize,
    fontWeight: theme.typography.fontWeight,
    lineHeight: theme.typography.lineHeight,
    letterSpacing: theme.typography.letterSpacing,
  };
}

/**
 * Generate border radius config from theme
 */
function generateBorderRadiusConfig(theme) {
  const borderRadius = {};

  Object.entries(theme.borderRadius).forEach(([key, value]) => {
    borderRadius[key] = value;
  });

  return borderRadius;
}

/**
 * Generate shadow config from theme
 */
function generateShadowConfig(theme) {
  const boxShadow = {};

  Object.entries(theme.shadows).forEach(([key, value]) => {
    boxShadow[key] = value;
  });

  return boxShadow;
}

/**
 * Tailwind CSS plugin to inject theme CSS variables
 */
function themePlugin({ addBase, theme }) {
  addBase({
    ':root': {
      // Inject color variables
      ...Object.entries(lightTheme.colors).reduce((acc, [key, value]) => {
        const cssVar = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        acc[cssVar] = value;
        return acc;
      }, {}),

      // Inject typography variables
      ...Object.entries(lightTheme.typography.fontSize).reduce((acc, [key, value]) => {
        acc[`--font-size-${key}`] = value;
        return acc;
      }, {}),

      // Inject spacing variables
      ...Object.entries(lightTheme.spacing).reduce((acc, [key, value]) => {
        acc[`--spacing-${key}`] = value;
        return acc;
      }, {}),

      // Inject border radius variables
      ...Object.entries(lightTheme.borderRadius).reduce((acc, [key, value]) => {
        acc[`--radius-${key}`] = value;
        return acc;
      }, {}),
    },

    '.dark': {
      // Inject dark theme color variables
      ...Object.entries(darkTheme.colors).reduce((acc, [key, value]) => {
        const cssVar = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        acc[cssVar] = value;
        return acc;
      }, {}),
    },
  });
}

/**
 * Tailwind configuration
 */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../apps/web/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: generateColorConfig(lightTheme),
      spacing: generateSpacingConfig(lightTheme),
      ...generateTypographyConfig(lightTheme),
      borderRadius: generateBorderRadiusConfig(lightTheme),
      boxShadow: generateShadowConfig(lightTheme),
      breakpoints: lightTheme.breakpoints,
    },
  },
  plugins: [
    themePlugin,
    require('tailwindcss-animate'),
  ],
};

