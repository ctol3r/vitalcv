/**
 * Design Tokens Tests
 *
 * Tests for token integrity and validation
 */

import { describe, it, expect } from '@jest/globals';
import {
  designTokens,
  colors,
  typography,
  spacing,
  borderRadius,
  elevation,
  validateTokens,
  getColorValue,
  getSpacing,
  getBorderRadius,
  getElevation,
  tokensToJSON,
} from '../designTokens';

describe('Design Tokens', () => {
  describe('Color Palette', () => {
    it('should have all required color scales', () => {
      expect(colors.primary).toBeDefined();
      expect(colors.secondary).toBeDefined();
      expect(colors.neutral).toBeDefined();
      expect(colors.semantic).toBeDefined();
    });

    it('should have all required shades for primary colors', () => {
      const requiredShades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
      requiredShades.forEach((shade) => {
        expect(colors.primary[shade as keyof typeof colors.primary]).toBeDefined();
        expect(colors.secondary[shade as keyof typeof colors.secondary]).toBeDefined();
        expect(colors.neutral[shade as keyof typeof colors.neutral]).toBeDefined();
      });
    });

    it('should have all semantic colors', () => {
      expect(colors.semantic.success).toBeDefined();
      expect(colors.semantic.error).toBeDefined();
      expect(colors.semantic.warning).toBeDefined();
      expect(colors.semantic.info).toBeDefined();
    });

    it('should have valid hex color values', () => {
      const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

      Object.values(colors.primary).forEach((color) => {
        expect(color).toMatch(hexRegex);
      });

      Object.values(colors.semantic.success).forEach((color) => {
        expect(color).toMatch(hexRegex);
      });
    });
  });

  describe('Typography', () => {
    it('should have all required font families', () => {
      expect(typography.fontFamily.sans).toBeDefined();
      expect(typography.fontFamily.serif).toBeDefined();
      expect(typography.fontFamily.mono).toBeDefined();
    });

    it('should have all required font sizes', () => {
      const requiredSizes = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl'];
      requiredSizes.forEach((size) => {
        expect(typography.fontSize[size as keyof typeof typography.fontSize]).toBeDefined();
      });
    });

    it('should have valid font size structure', () => {
      const fontSize = typography.fontSize.base;
      expect(Array.isArray(fontSize)).toBe(true);
      expect(fontSize[0]).toMatch(/^\d+\.?\d*rem$/);
      expect(typeof fontSize[1]).toBe('object');
      expect(fontSize[1]).toHaveProperty('lineHeight');
      expect(fontSize[1]).toHaveProperty('letterSpacing');
    });

    it('should have all required font weights', () => {
      const requiredWeights = ['thin', 'extralight', 'light', 'normal', 'medium', 'semibold', 'bold', 'extrabold', 'black'];
      requiredWeights.forEach((weight) => {
        expect(typography.fontWeight[weight as keyof typeof typography.fontWeight]).toBeDefined();
      });
    });
  });

  describe('Spacing Scale', () => {
    it('should have valid spacing values', () => {
      Object.entries(spacing).forEach(([key, value]) => {
        if (key === '0') {
          expect(value).toBe('0');
        } else {
          expect(value).toMatch(/^\d+\.?\d*rem$/);
        }
      });
    });

    it('should have consistent spacing progression', () => {
      expect(spacing[1]).toBe('0.25rem');
      expect(spacing[2]).toBe('0.5rem');
      expect(spacing[4]).toBe('1rem');
      expect(spacing[8]).toBe('2rem');
    });
  });

  describe('Border Radius', () => {
    it('should have valid border radius values', () => {
      Object.entries(borderRadius).forEach(([key, value]) => {
        if (key === 'none') {
          expect(value).toBe('0');
        } else if (key === 'full') {
          expect(value).toBe('9999px');
        } else {
          expect(value).toMatch(/^\d+\.?\d*rem$/);
        }
      });
    });

    it('should have all required border radius sizes', () => {
      const requiredSizes = ['none', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl', 'full'];
      requiredSizes.forEach((size) => {
        expect(borderRadius[size as keyof typeof borderRadius]).toBeDefined();
      });
    });
  });

  describe('Elevation Shadows', () => {
    it('should have all required elevation levels', () => {
      const requiredLevels = ['none', 'xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', 'inner'];
      requiredLevels.forEach((level) => {
        expect(elevation[level as keyof typeof elevation]).toBeDefined();
      });
    });

    it('should have valid shadow values', () => {
      Object.entries(elevation).forEach(([key, value]) => {
        if (key === 'none') {
          expect(value).toBe('none');
        } else {
          expect(typeof value).toBe('string');
          expect(value.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Utility Functions', () => {
    it('getColorValue should return correct color', () => {
      const color = getColorValue(colors.primary, 500);
      expect(color).toBe('#0ea5e9');
    });

    it('getSpacing should return correct spacing', () => {
      expect(getSpacing(4)).toBe('1rem');
      expect(getSpacing(8)).toBe('2rem');
    });

    it('getBorderRadius should return correct radius', () => {
      expect(getBorderRadius('md')).toBe('0.375rem');
      expect(getBorderRadius('lg')).toBe('0.5rem');
    });

    it('getElevation should return correct shadow', () => {
      expect(getElevation('sm')).toBeDefined();
      expect(typeof getElevation('base')).toBe('string');
    });
  });

  describe('Token Validation', () => {
    it('validateTokens should return valid when tokens are correct', () => {
      const result = validateTokens();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should export tokens as JSON', () => {
      const json = tokensToJSON();
      expect(json).toBeDefined();
      expect(json.colors).toBeDefined();
      expect(json.typography).toBeDefined();
      expect(json.spacing).toBeDefined();
      expect(json.borderRadius).toBeDefined();
      expect(json.elevation).toBeDefined();
    });

    it('JSON export should be serializable', () => {
      const json = tokensToJSON();
      expect(() => JSON.stringify(json)).not.toThrow();
    });
  });

  describe('Design Tokens Object', () => {
    it('should export all token categories', () => {
      expect(designTokens.colors).toBeDefined();
      expect(designTokens.typography).toBeDefined();
      expect(designTokens.spacing).toBeDefined();
      expect(designTokens.borderRadius).toBeDefined();
      expect(designTokens.elevation).toBeDefined();
    });
  });
});

