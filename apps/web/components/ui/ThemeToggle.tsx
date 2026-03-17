'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const CYCLE: Record<string, string> = {
  light: 'dark',
  dark: 'light',
};

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

  const resolved = resolvedTheme ?? theme ?? 'dark';
  const next = CYCLE[resolved] ?? 'dark';
  const isDark = resolved === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
      className={`
        flex h-8 w-8 items-center justify-center rounded-lg border transition-colors duration-200 ease-out
        border-[var(--vt-border,#27272A)] bg-[var(--vt-surface,#121214)]
        text-[var(--vt-text-2,#A1A1AA)] hover:text-[var(--vt-text-1,#FFFFFF)]
        hover:bg-[var(--vt-surface-subtle,#18181B)]
        ${className}
      `}
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
  const { theme, setTheme } = useTheme();
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

  const current = THEMES.find((t) => t.id === theme) ?? THEMES[1];
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
                theme === id
                  ? 'text-[var(--vt-text-primary)] font-medium'
                  : 'text-[var(--vt-text-secondary)]'
              }`}
            >
              <ItemIcon className="h-3.5 w-3.5 shrink-0" />
              {label}
              {theme === id && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--vt-accent)]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
