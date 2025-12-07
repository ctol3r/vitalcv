/**
 * Tests for custom theme API
 */

import { createCustomTheme, validateTheme, exampleThemes } from '../theme/customTheme';
import { lightTheme } from '../theme/themes';
import type { PartialTheme } from '../theme/themeTypes';

describe('CustomTheme API', () => {
  describe('validateTheme', () => {
    it('should validate a complete theme', () => {
      const result = validateTheme(lightTheme);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject theme without name', () => {
      const invalidTheme = { ...lightTheme, name: undefined as any };
      const result = validateTheme(invalidTheme);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Theme must have a name');
    });

    it('should reject theme with missing required colors', () => {
      const invalidTheme: PartialTheme = {
        name: 'test',
        colors: {
          background: '#ffffff',
          // Missing other required colors
        },
      };
      const result = validateTheme(invalidTheme);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn about missing spacing tokens', () => {
      const partialTheme: PartialTheme = {
        name: 'test',
        colors: lightTheme.colors,
        spacing: {
          xs: '4px',
          // Missing other spacing tokens
        },
      };
      const result = validateTheme(partialTheme);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('createCustomTheme', () => {
    it('should create a custom theme from partial theme', () => {
      const partialTheme: PartialTheme = {
        name: 'custom',
        colors: {
          accent: '#ff0000',
          accentForeground: '#ffffff',
        },
      };

      const customTheme = createCustomTheme(partialTheme);
      expect(customTheme.name).toBe('custom');
      expect(customTheme.colors.accent).toBe('#ff0000');
      expect(customTheme.colors.background).toBe(lightTheme.colors.background);
    });

    it('should throw error for invalid theme', () => {
      const invalidTheme: PartialTheme = {
        name: 'invalid',
        colors: {
          // Missing required colors
        },
      };

      expect(() => createCustomTheme(invalidTheme)).toThrow();
    });

    it('should merge with base theme correctly', () => {
      const partialTheme: PartialTheme = {
        name: 'merged',
        typography: {
          fontSize: {
            base: '18px',
          },
        },
      };

      const customTheme = createCustomTheme(partialTheme);
      expect(customTheme.typography.fontSize.base).toBe('18px');
      expect(customTheme.typography.fontSize.xs).toBe(lightTheme.typography.fontSize.xs);
    });
  });

  describe('exampleThemes', () => {
    it('should have ocean theme', () => {
      expect(exampleThemes.ocean).toBeDefined();
      expect(exampleThemes.ocean.name).toBe('ocean');
      expect(exampleThemes.ocean.colors.accent).toBe('#0ea5e9');
    });

    it('should have violet theme', () => {
      expect(exampleThemes.violet).toBeDefined();
      expect(exampleThemes.violet.name).toBe('violet');
      expect(exampleThemes.violet.colors.accent).toBe('#8b5cf6');
    });

    it('should have forest theme', () => {
      expect(exampleThemes.forest).toBeDefined();
      expect(exampleThemes.forest.name).toBe('forest');
      expect(exampleThemes.forest.colors.accent).toBe('#22c55e');
    });
  });
});

