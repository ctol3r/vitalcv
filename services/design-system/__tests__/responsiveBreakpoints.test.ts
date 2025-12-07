/**
 * Tests for responsive breakpoints utility
 */

import {
  defaultBreakpoints,
  getBreakpoint,
  mediaQueries,
  breakpoints,
} from '../utils/responsiveBreakpoints';
import { lightTheme } from '../theme/themes';

describe('ResponsiveBreakpoints', () => {
  describe('defaultBreakpoints', () => {
    it('should have all required breakpoints', () => {
      expect(defaultBreakpoints).toHaveProperty('xs');
      expect(defaultBreakpoints).toHaveProperty('sm');
      expect(defaultBreakpoints).toHaveProperty('md');
      expect(defaultBreakpoints).toHaveProperty('lg');
      expect(defaultBreakpoints).toHaveProperty('xl');
    });

    it('should have correct breakpoint values', () => {
      expect(defaultBreakpoints.xs).toBe('0px');
      expect(defaultBreakpoints.sm).toBe('640px');
      expect(defaultBreakpoints.md).toBe('768px');
      expect(defaultBreakpoints.lg).toBe('1024px');
      expect(defaultBreakpoints.xl).toBe('1280px');
    });
  });

  describe('getBreakpoint', () => {
    it('should return default breakpoint value', () => {
      expect(getBreakpoint('sm')).toBe('640px');
      expect(getBreakpoint('md')).toBe('768px');
    });

    it('should return theme breakpoint value if provided', () => {
      const customTheme = {
        ...lightTheme,
        breakpoints: {
          ...lightTheme.breakpoints!,
          sm: '800px',
        },
      };
      expect(getBreakpoint('sm', customTheme)).toBe('800px');
    });
  });

  describe('mediaQueries', () => {
    it('should generate min-width media query', () => {
      const query = mediaQueries.min('md');
      expect(query).toBe('@media (min-width: 768px)');
    });

    it('should generate max-width media query', () => {
      const query = mediaQueries.max('md');
      expect(query).toBe('@media (max-width: 767px)');
    });

    it('should generate between media query', () => {
      const query = mediaQueries.between('sm', 'lg');
      expect(query).toBe('@media (min-width: 640px) and (max-width: 1023px)');
    });

    it('should generate only breakpoint media query', () => {
      const query = mediaQueries.only('md');
      expect(query).toContain('@media');
      expect(query).toContain('min-width');
      expect(query).toContain('max-width');
    });
  });

  describe('breakpoints export', () => {
    it('should export breakpoints', () => {
      expect(breakpoints).toBe(defaultBreakpoints);
    });
  });
});

