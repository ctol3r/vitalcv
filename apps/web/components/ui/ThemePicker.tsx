'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const palettes = [
  { key: 'default', label: 'Default', css: '' },
  { key: 'ocean', label: 'Ocean', css: '--brand: 33 150 243; --accent: 56 189 248;' },
  { key: 'violet', label: 'Violet', css: '--brand: 139 92 246; --accent: 168 85 247;' },
];

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const [palette, setPalette] = useState('default');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('vitalcv_palette');
    if (saved) applyPalette(saved);
  }, []);

  function applyPalette(key: string) {
    setPalette(key);
    localStorage.setItem('vitalcv_palette', key);
    const root = document.documentElement;
    const found = palettes.find((p) => p.key === key);
    root.style.removeProperty('--brand');
    root.style.removeProperty('--accent');
    if (found?.css) {
      found.css.split(';').forEach((kv) => {
        const [k, v] = kv.split(':').map((s) => s?.trim());
        if (k && v) root.style.setProperty(k, v);
      });
    }
  }

  if (!mounted) return null;

  return (
    <div className="flex items-center gap-2">
      <select
        className="rounded border px-2 py-1 text-sm bg-white dark:bg-neutral-900"
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
      <select
        className="rounded border px-2 py-1 text-sm bg-white dark:bg-neutral-900"
        value={palette}
        onChange={(e) => applyPalette(e.target.value)}
      >
        {palettes.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}

