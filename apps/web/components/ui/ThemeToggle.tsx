'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

type SupportedTheme = 'light' | 'dark';

const CYCLE: Record<SupportedTheme, SupportedTheme> = {
  light: 'dark',
  dark: 'light',
};

function resolveTheme(
  theme: string | undefined,
  resolvedTheme?: string,
): SupportedTheme {
  if (theme === 'light' || theme === 'dark') {
    return theme;
  }

  if (resolvedTheme === 'light') {
    return 'light';
  }

  return 'dark';
}

/**
 * Compact theme toggle — cycles light ↔ dark.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — only render icon client-side
  useEffect(() => {
    setMounted(true);
    if (!theme) {
      setTheme('dark');
    }
  }, [theme, setTheme]);

  if (!mounted) {
    return (
      <div className={`h-8 w-8 rounded-lg ${className}`} aria-hidden />
    );
  }

  const currentTheme = resolveTheme(theme, resolvedTheme);
  const next = CYCLE[currentTheme];
  const isDark = currentTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
      className={`rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white ${className}`}
    >
      {isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}

const THEMES = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
] as const;

export function ThemePicker({ className = '' }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!theme) {
      setTheme('dark');
    }
  }, [theme, setTheme]);
  
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-theme-picker]')) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!mounted) return null;

  const currentTheme = resolveTheme(theme, resolvedTheme);
  const current = THEMES.find((t) => t.id === currentTheme) ?? THEMES[1];
  const Icon = current.icon;

  return (
    <div className={`relative ${className}`} data-theme-picker>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--vt-border)] bg-[var(--vt-surface)] px-2.5 text-[11px] font-medium text-[var(--vt-text-secondary)] transition-colors duration-200 ease-out hover:bg-[var(--vt-surface-subtle)] hover:text-[var(--vt-text-primary)]"
        aria-label="Choose theme"
      >
        <Icon className="h-3.5 w-3.5" />
        <span>{current.label}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-[50] w-36 overflow-hidden rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] shadow-lg">
          {THEMES.map(({ id, label, icon: ItemIcon }) => (
            <button
              key={id}
              type="button"
              onClick={() => { setTheme(id); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-sm transition-colors duration-200 ease-out hover:bg-[var(--vt-surface-subtle)] ${
                currentTheme === id
                  ? 'text-[var(--vt-text-primary)] font-medium'
                  : 'text-[var(--vt-text-secondary)]'
              }`}
            >
              <ItemIcon className="h-3.5 w-3.5 shrink-0" />
              {label}
              {currentTheme === id && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--vt-accent)]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
