'use client';

import { useTheme as useNextTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export interface ThemeConfig {
  theme: Theme;
  systemTheme: 'light' | 'dark';
  resolvedTheme: 'light' | 'dark';
  isDark: boolean;
  isLight: boolean;
  isSystem: boolean;
}

export function useTheme() {
  const { theme, setTheme, systemTheme, resolvedTheme } = useNextTheme();
  const [mounted, setMounted] = useState(false);

  // Ensure component is mounted to avoid hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === 'dark';
  const isLight = resolvedTheme === 'light';
  const isSystem = theme === 'system';

  const config: ThemeConfig = {
    theme: (theme as Theme) || 'system',
    systemTheme: systemTheme || 'light',
    resolvedTheme: resolvedTheme || 'light',
    isDark,
    isLight,
    isSystem,
  };

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const setThemeMode = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  return {
    ...config,
    mounted,
    toggleTheme,
    setTheme: setThemeMode,
  };
}

// Hook for theme-aware styling
export function useThemeStyles() {
  const { isDark, isLight, resolvedTheme } = useTheme();

  const getThemeClass = (lightClass: string, darkClass: string) => {
    return isDark ? darkClass : lightClass;
  };

  const getThemeColor = (lightColor: string, darkColor: string) => {
    return isDark ? darkColor : lightColor;
  };

  const getThemeBg = (lightBg: string, darkBg: string) => {
    return isDark ? darkBg : lightBg;
  };

  const getThemeBorder = (lightBorder: string, darkBorder: string) => {
    return isDark ? darkBorder : lightBorder;
  };

  return {
    isDark,
    isLight,
    resolvedTheme,
    getThemeClass,
    getThemeColor,
    getThemeBg,
    getThemeBorder,
  };
}

// Hook for theme transitions
export function useThemeTransition() {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 300); // Match CSS transition duration

    return () => clearTimeout(timer);
  }, [theme]);

  return {
    isTransitioning,
    transitionClass: isTransitioning ? 'transition-all duration-300 ease-in-out' : '',
  };
}

// Hook for theme persistence
export function useThemePersistence() {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    // Load theme from localStorage on mount
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme && savedTheme !== theme) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    // Save theme to localStorage when it changes
    if (theme) {
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

  return {
    theme,
    setTheme,
  };
}

// Hook for theme-aware component variants
export function useThemeVariants() {
  const { isDark } = useTheme();

  const cardVariants = {
    default: isDark
      ? 'bg-gray-800 border-gray-700 text-white'
      : 'bg-white border-gray-200 text-gray-900',
    elevated: isDark
      ? 'bg-gray-800 border-gray-600 shadow-lg text-white'
      : 'bg-white border-gray-200 shadow-lg text-gray-900',
    muted: isDark
      ? 'bg-gray-900 border-gray-700 text-gray-300'
      : 'bg-gray-50 border-gray-200 text-gray-600',
  };

  const buttonVariants = {
    primary: isDark
      ? 'bg-blue-600 hover:bg-blue-700 text-white'
      : 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: isDark
      ? 'bg-gray-700 hover:bg-gray-600 text-white'
      : 'bg-gray-100 hover:bg-gray-200 text-gray-900',
    outline: isDark
      ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
      : 'border-gray-300 text-gray-700 hover:bg-gray-50',
  };

  const inputVariants = {
    default: isDark
      ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500',
    focused: isDark ? 'border-blue-500 ring-blue-500/20' : 'border-blue-500 ring-blue-500/20',
  };

  return {
    cardVariants,
    buttonVariants,
    inputVariants,
  };
}

