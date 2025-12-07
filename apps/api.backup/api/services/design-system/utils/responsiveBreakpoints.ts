/**
 * B246B-DES-017: ResponsiveBreakpoints utility
 *
 * Defines breakpoints (xs, sm, md, lg, xl) and helper functions/mixins for media queries.
 * Integrates with theme context.
 */

import type { Theme } from '../theme/themeTypes';

/**
 * Default breakpoints
 */
export const defaultBreakpoints = {
  xs: '0px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
} as const;

/**
 * Breakpoint type
 */
export type Breakpoint = keyof typeof defaultBreakpoints;

/**
 * Get breakpoint value from theme or use defaults
 */
export function getBreakpoint(breakpoint: Breakpoint, theme?: Theme): string {
  if (theme?.breakpoints?.[breakpoint]) {
    return theme.breakpoints[breakpoint];
  }
  return defaultBreakpoints[breakpoint];
}

/**
 * Media query helpers
 */
export const mediaQueries = {
  /**
   * Generate min-width media query
   */
  min: (breakpoint: Breakpoint, theme?: Theme): string => {
    const value = getBreakpoint(breakpoint, theme);
    return `@media (min-width: ${value})`;
  },

  /**
   * Generate max-width media query
   */
  max: (breakpoint: Breakpoint, theme?: Theme): string => {
    const value = getBreakpoint(breakpoint, theme);
    return `@media (max-width: ${parseInt(value) - 1}px)`;
  },

  /**
   * Generate range media query
   */
  between: (min: Breakpoint, max: Breakpoint, theme?: Theme): string => {
    const minValue = getBreakpoint(min, theme);
    const maxValue = getBreakpoint(max, theme);
    return `@media (min-width: ${minValue}) and (max-width: ${parseInt(maxValue) - 1}px)`;
  },

  /**
   * Generate only breakpoint media query
   */
  only: (breakpoint: Breakpoint, theme?: Theme): string => {
    const breakpoints = Object.keys(defaultBreakpoints) as Breakpoint[];
    const currentIndex = breakpoints.indexOf(breakpoint);
    const nextBreakpoint = breakpoints[currentIndex + 1];

    if (!nextBreakpoint) {
      return mediaQueries.min(breakpoint, theme);
    }

    return mediaQueries.between(breakpoint, nextBreakpoint, theme);
  },
};

/**
 * CSS-in-JS helper for responsive styles
 */
export function responsive<T>(
  values: Partial<Record<Breakpoint, T>>,
  theme?: Theme
): string {
  const breakpoints = Object.keys(defaultBreakpoints) as Breakpoint[];
  const styles: string[] = [];

  // Base style (xs)
  if (values.xs !== undefined) {
    styles.push(`  ${values.xs}`);
  }

  // Responsive styles
  for (const bp of breakpoints.slice(1)) {
    if (values[bp] !== undefined) {
      styles.push(`${mediaQueries.min(bp, theme)} {`);
      styles.push(`  ${values[bp]}`);
      styles.push(`}`);
    }
  }

  return styles.join('\n');
}

/**
 * React hook for responsive breakpoints
 */
export function useBreakpoint(theme?: Theme): {
  isXs: boolean;
  isSm: boolean;
  isMd: boolean;
  isLg: boolean;
  isXl: boolean;
  current: Breakpoint;
} {
  if (typeof window === 'undefined') {
    return {
      isXs: true,
      isSm: false,
      isMd: false,
      isLg: false,
      isXl: false,
      current: 'xs',
    };
  }

  const width = window.innerWidth;
  const breakpoints = theme?.breakpoints || defaultBreakpoints;

  const isXs = width >= parseInt(breakpoints.xs) && width < parseInt(breakpoints.sm);
  const isSm = width >= parseInt(breakpoints.sm) && width < parseInt(breakpoints.md);
  const isMd = width >= parseInt(breakpoints.md) && width < parseInt(breakpoints.lg);
  const isLg = width >= parseInt(breakpoints.lg) && width < parseInt(breakpoints.xl);
  const isXl = width >= parseInt(breakpoints.xl);

  let current: Breakpoint = 'xs';
  if (isXl) current = 'xl';
  else if (isLg) current = 'lg';
  else if (isMd) current = 'md';
  else if (isSm) current = 'sm';

  return {
    isXs,
    isSm,
    isMd,
    isLg,
    isXl,
    current,
  };
}

/**
 * Export breakpoints for direct use
 */
export const breakpoints = defaultBreakpoints;

