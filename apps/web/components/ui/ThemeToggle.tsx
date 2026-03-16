'use client';

import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const CYCLE: Record<string, string> = {
  light: 'dark',
  dark: 'light',
};

/**
 * Compact theme toggle — cycles light ↔ dark.
 * Respects OS preference on first load (next-themes enableSystem).
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — only render icon client-side
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className={`h-8 w-8 rounded-lg ${className}`} aria-hidden />
    );
  }

  const resolved = resolvedTheme ?? theme ?? 'dark';
  const next = CYCLE[resolved] ?? 'dark';
  const isDark = resolved === 'dark' || resolved === 'midnight' || resolved === 'graphite';

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
      className={`
        flex h-8 w-8 items-center justify-center rounded-lg border transition-colors duration-150
        border-[var(--vt-border,#2A2A2A)] bg-[var(--vt-surface,#141414)]
        text-[var(--vt-text-2,#9A9A9A)] hover:text-[var(--vt-text-1,#F4F4F4)]
        hover:bg-[var(--vt-surface-2,#1E1E1F)]
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

/**
 * Extended theme picker — shows all four themes in a dropdown.
 * Usage: place in header, trigger on click.
 */
const THEMES = [
  { id: 'light',    label: 'Light',    icon: Sun },
  { id: 'dark',     label: 'Dark',     icon: Moon },
  { id: 'midnight', label: 'Midnight', icon: Moon },
  { id: 'graphite', label: 'Graphite', icon: Monitor },
] as const;

export function ThemePicker({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
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
        className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--vt-border,#2A2A2A)] bg-[var(--vt-surface,#141414)] px-2.5 text-[11px] font-medium text-[var(--vt-text-2,#9A9A9A)] transition-colors hover:bg-[var(--vt-surface-2)] hover:text-[var(--vt-text-1)]"
        aria-label="Choose theme"
      >
        <Icon className="h-3.5 w-3.5" />
        <span>{current.label}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-36 overflow-hidden rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] shadow-lg">
          {THEMES.map(({ id, label, icon: ItemIcon }) => (
            <button
              key={id}
              type="button"
              onClick={() => { setTheme(id); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-sm transition-colors hover:bg-[var(--vt-surface-2)] ${
                theme === id
                  ? 'text-[var(--vt-text-1)] font-medium'
                  : 'text-[var(--vt-text-2)]'
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
