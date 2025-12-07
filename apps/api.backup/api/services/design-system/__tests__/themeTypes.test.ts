/**
 * Tests for theme types
 */

import type { Theme, PartialTheme } from '../theme/themeTypes';
import { lightTheme } from '../theme/themes';

describe('Theme Types', () => {
  it('should have correct structure for light theme', () => {
    expect(lightTheme).toHaveProperty('name');
    expect(lightTheme).toHaveProperty('colors');
    expect(lightTheme).toHaveProperty('typography');
    expect(lightTheme).toHaveProperty('spacing');
    expect(lightTheme).toHaveProperty('borderRadius');
    expect(lightTheme).toHaveProperty('shadows');
  });

  it('should have all required color tokens', () => {
    const requiredColors = [
      'background',
      'foreground',
      'border',
      'accent',
      'accentForeground',
      'primary',
      'primaryForeground',
      'secondary',
      'secondaryForeground',
    ];

    requiredColors.forEach((color) => {
      expect(lightTheme.colors).toHaveProperty(color);
      expect(typeof lightTheme.colors[color as keyof typeof lightTheme.colors]).toBe('string');
    });
  });

  it('should have typography tokens', () => {
    expect(lightTheme.typography).toHaveProperty('fontFamily');
    expect(lightTheme.typography).toHaveProperty('fontSize');
    expect(lightTheme.typography).toHaveProperty('fontWeight');
    expect(lightTheme.typography).toHaveProperty('lineHeight');
  });

  it('should have spacing tokens', () => {
    expect(lightTheme.spacing).toHaveProperty('xs');
    expect(lightTheme.spacing).toHaveProperty('sm');
    expect(lightTheme.spacing).toHaveProperty('md');
    expect(lightTheme.spacing).toHaveProperty('lg');
    expect(lightTheme.spacing).toHaveProperty('xl');
  });

  it('should have border radius tokens', () => {
    expect(lightTheme.borderRadius).toHaveProperty('none');
    expect(lightTheme.borderRadius).toHaveProperty('sm');
    expect(lightTheme.borderRadius).toHaveProperty('md');
    expect(lightTheme.borderRadius).toHaveProperty('lg');
    expect(lightTheme.borderRadius).toHaveProperty('full');
  });

  it('should have shadow tokens', () => {
    expect(lightTheme.shadows).toHaveProperty('sm');
    expect(lightTheme.shadows).toHaveProperty('md');
    expect(lightTheme.shadows).toHaveProperty('lg');
    expect(lightTheme.shadows).toHaveProperty('none');
  });
});

