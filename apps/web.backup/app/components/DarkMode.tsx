"use client";
import { useEffect, useState } from 'react';

export default function DarkMode() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // Check localStorage on mount
    const saved = localStorage.getItem('vitalcv_dark_mode');
    if (saved === 'true') {
      setDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('vitalcv_dark_mode', String(dark));
  }, [dark]);

  return (
    <button
      className="px-2 py-1 border rounded text-xs hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      onClick={() => setDark(v => !v)}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}

