/**
 * B246B-DES-011: ThemeProvider & context
 *
 * Provides React context for theme values.
 * Supports dynamic switching between themes.
 * Uses design tokens.
 * Exposes hook useTheme() to access current theme and toggle theme.
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Theme, ThemeMode, ThemeContextValue } from './themeTypes';
import { lightTheme, darkTheme, getTheme } from './themes';

/**
 * Theme context
 */
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Storage key for persisting theme preference
 */
const THEME_STORAGE_KEY = 'chai-vc-theme';

/**
 * ThemeProvider props
 */
export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeMode;
  defaultCustomTheme?: Theme;
  storageKey?: string;
}

/**
 * ThemeProvider component
 */
export function ThemeProvider({
  children,
  defaultTheme = 'system',
  defaultCustomTheme,
  storageKey = THEME_STORAGE_KEY,
}: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') {
      return defaultTheme;
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored as ThemeMode;
      }
    } catch {
      // Ignore localStorage errors
    }

    return defaultTheme;
  });

  const [customTheme, setCustomTheme] = useState<Theme | undefined>(defaultCustomTheme);

  /**
   * Get effective theme based on mode
   */
  const getEffectiveTheme = useCallback((): Theme => {
    if (customTheme) {
      return customTheme;
    }

    if (mode === 'system') {
      if (typeof window !== 'undefined') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        return prefersDark ? darkTheme : lightTheme;
      }
      return lightTheme;
    }

    return getTheme(mode);
  }, [mode, customTheme]);

  const [theme, setThemeState] = useState<Theme>(getEffectiveTheme);

  /**
   * Update theme when mode or custom theme changes
   */
  useEffect(() => {
    const effectiveTheme = getEffectiveTheme();
    setThemeState(effectiveTheme);

    // Apply theme to document root
    if (typeof document !== 'undefined') {
      const root = document.documentElement;

      // Apply color tokens as CSS variables
      Object.entries(effectiveTheme.colors).forEach(([key, value]) => {
        const cssVar = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        root.style.setProperty(cssVar, value);
      });

      // Apply typography tokens
      Object.entries(effectiveTheme.typography.fontSize).forEach(([key, value]) => {
        root.style.setProperty(`--font-size-${key}`, value);
      });

      // Apply spacing tokens
      Object.entries(effectiveTheme.spacing).forEach(([key, value]) => {
        root.style.setProperty(`--spacing-${key}`, value);
      });

      // Apply border radius tokens
      Object.entries(effectiveTheme.borderRadius).forEach(([key, value]) => {
        root.style.setProperty(`--radius-${key}`, value);
      });

      // Set theme class for dark mode
      if (mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [mode, customTheme, getEffectiveTheme]);

  /**
   * Listen to system theme changes
   */
  useEffect(() => {
    if (mode !== 'system' || typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      setThemeState(getEffectiveTheme());
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [mode, getEffectiveTheme]);

  /**
   * Set theme mode
   */
  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, newMode);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [storageKey]);

  /**
   * Toggle between light and dark
   */
  const toggleTheme = useCallback(() => {
    setMode((current) => {
      if (current === 'system') {
        // If system, toggle to opposite of current effective theme
        const effective = getEffectiveTheme();
        return effective.name === 'dark' ? 'light' : 'dark';
      }
      return current === 'light' ? 'dark' : 'light';
    });
  }, [setMode, getEffectiveTheme]);

  /**
   * Set custom theme
   */
  const setTheme = useCallback((newTheme: Theme) => {
    setCustomTheme(newTheme);
    setThemeState(newTheme);
  }, []);

  /**
   * Context value
   */
  const contextValue = useMemo<ThemeContextValue>(() => ({
    theme,
    mode,
    setMode,
    toggleTheme,
    setTheme,
  }), [theme, mode, setMode, toggleTheme, setTheme]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * useTheme hook
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}

