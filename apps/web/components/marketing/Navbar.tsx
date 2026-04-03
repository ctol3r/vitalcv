'use client';

import { useState, useEffect } from 'react';
import { Menu, X, Sun, Moon } from 'lucide-react';
import Link from 'next/link';

export default function Navbar() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
      setTheme(saved);
      if (saved === 'dark') {
        document.documentElement.classList.add('dark');
      }
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <nav className="border-b border-line p-6 flex justify-between items-center sticky top-0 z-50 bg-[var(--vt-bg)]">
      <Link
        href="/"
        className="flex items-center gap-2"
      >
        <div className="w-8 h-8 bg-ink rounded-sm flex items-center justify-center text-bg font-bold">V</div>
        <h1 className="text-xl font-bold tracking-tighter uppercase">VitalCV</h1>
      </Link>

      {/* Desktop links */}
      <div className="hidden md:flex items-center gap-8 text-xs font-medium uppercase tracking-widest opacity-60">
        <Link href="/explore" className="hover:opacity-100 transition-opacity">
          Explore
        </Link>
        <Link href="/employers" className="hover:opacity-100 transition-opacity">
          For Employers
        </Link>
        <Link href="/developers" className="hover:opacity-100 transition-opacity">
          Developers
        </Link>
      </div>

      {/* Desktop CTAs */}
      <div className="hidden md:flex items-center gap-4">
        <button
          onClick={toggleTheme}
          className="p-2 hover:bg-ink/5 rounded-full transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
        <Link
          href="/sign-in"
          className="text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
        >
          Sign In
        </Link>
        <Link
          href="/onboarding"
          className="text-xs font-bold uppercase tracking-widest bg-ink text-bg px-6 py-2 hover:opacity-90 transition-colors"
        >
          Get Started
        </Link>
      </div>

      {/* Mobile hamburger */}
      <button
        type="button"
        className="md:hidden p-2 -mr-2 text-ink"
        onClick={() => setMobileOpen((prev) => !prev)}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
    </nav>
  );
}
