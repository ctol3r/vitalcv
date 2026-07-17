'use client';

/**
 * HolderWorkspaceShell — the signed-in clinician workspace shell.
 *
 * VitalCV is light-only (Chris, 2026-07-15). The workspace always renders on
 * light `.mz` paper (`data-holder-theme="light"`), so the dark-authored
 * surfaces stay readable via styles/holder-light-compat.css (which remaps their
 * `text-white` / `bg-white/[…]` utilities to ink under `[data-holder-theme=
 * "light"]`). The `useHolderTheme` context is kept as a no-op shim so existing
 * consumers don't break; `theme` is always `'light'` and toggling does nothing.
 */

import * as React from 'react';

type HolderTheme = 'light';

interface HolderThemeValue {
  theme: HolderTheme;
  setTheme: (t: HolderTheme) => void;
  toggle: () => void;
}

const HolderThemeContext = React.createContext<HolderThemeValue | null>(null);

// Light-only: theme is constant, mutators are no-ops.
const LIGHT_ONLY: HolderThemeValue = { theme: 'light', setTheme: () => {}, toggle: () => {} };

export function useHolderTheme(): HolderThemeValue {
  return React.useContext(HolderThemeContext) ?? LIGHT_ONLY;
}

export function HolderWorkspaceShell({ children }: { children: React.ReactNode }) {
  return (
    <HolderThemeContext.Provider value={LIGHT_ONLY}>
      <div
        data-holder-theme="light"
        className="mz mz-paper mz-persona-holder flex min-h-screen flex-col text-foreground selection:bg-vt-info/30 [--holder-mobile-bottom-nav-height:4rem]"
      >
        {children}
      </div>
    </HolderThemeContext.Provider>
  );
}
