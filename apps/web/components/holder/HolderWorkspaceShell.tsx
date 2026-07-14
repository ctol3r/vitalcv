'use client';

/**
 * HolderWorkspaceShell — gives the signed-in clinician workspace its OWN
 * light/dark theme, independent of the public site's next-themes.
 *
 * Why holder-scoped: the workspace surfaces are authored in the theme-aware
 * `.mz` (Calm Wave) system, but they default to a dark "instrument" look. We
 * keep DARK as the workspace default (so nothing regresses for signed-in
 * clinicians) while making the nav toggle actually flip the workspace to light
 * — which previously did nothing because the shell hard-pinned `dark`.
 *
 * Applying `dark` here (vs. relying on the global <html> class) means the
 * workspace theme is decoupled: a clinician can run the workspace in light
 * without changing the public marketing theme, and vice-versa. Preference
 * persists in localStorage.
 *
 * NOTE (migration in progress): ClinicianHomeSurface is fully `.mz` and renders
 * correctly in light today. Other full-page surfaces are still being converted
 * to `.mz`; until then they look best in dark. Default dark keeps them right.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

type HolderTheme = 'dark' | 'light';
const STORAGE_KEY = 'vcv-holder-theme';

interface HolderThemeValue {
  theme: HolderTheme;
  setTheme: (t: HolderTheme) => void;
  toggle: () => void;
}

const HolderThemeContext = React.createContext<HolderThemeValue | null>(null);

export function useHolderTheme(): HolderThemeValue {
  const ctx = React.useContext(HolderThemeContext);
  if (!ctx) {
    // Safe fallback so a stray consumer never crashes the workspace.
    return { theme: 'dark', setTheme: () => {}, toggle: () => {} };
  }
  return ctx;
}

export function HolderWorkspaceShell({ children }: { children: React.ReactNode }) {
  // Default dark (matches the current, verified workspace look). Read the saved
  // preference on mount — a one-frame dark→light settle is acceptable and never
  // leaves text invisible (dark is the safe default).
  const [theme, setThemeState] = React.useState<HolderTheme>('dark');

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') setThemeState(saved);
    } catch {
      /* localStorage unavailable — stay dark */
    }
  }, []);

  const setTheme = React.useCallback((t: HolderTheme) => {
    setThemeState(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = React.useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const value = React.useMemo<HolderThemeValue>(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);

  return (
    <HolderThemeContext.Provider value={value}>
      <div
        data-holder-theme={theme}
        className={cn(
          'mz mz-persona-holder flex min-h-screen flex-col selection:bg-vt-info/30 text-foreground',
          theme === 'dark' ? 'dark bg-ops-gradient' : 'mz-paper',
        )}
      >
        {children}
      </div>
    </HolderThemeContext.Provider>
  );
}
