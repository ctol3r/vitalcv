'use client';

import { useState } from 'react';
import { ArrowRight, Search, Moon, Sun, Shield, Terminal } from 'lucide-react';
import Link from 'next/link';

/* ── Hero — Sandbox Brutalist Design ───────────────────────── */

export function Hero() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <section className="min-h-[60vh] flex items-center justify-center px-6 relative">
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-2 hover:bg-ink/5 rounded-full transition-colors"
        aria-label="Toggle theme"
      >
        {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
      </button>

      <div className="max-w-5xl w-full text-center space-y-12">
        {/* Header */}
        <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6 uppercase">
          Check your <span className="italic font-serif font-medium text-ink/80">readiness</span> snapshot.
        </h1>

        <p className="text-lg opacity-60 max-w-xl mx-auto">
          Primary sources check public records. Enter your NPI to start.
        </p>

        {/* NPI Input Form */}
        <form className="max-w-md mx-auto relative">
          <input
            type="text"
            placeholder="ENTER 10-DIGIT NPI"
            className="w-full bg-transparent border-b-2 border-line py-4 px-2 text-2xl font-mono focus:outline-none focus:border-ink transition-colors placeholder:opacity-20 uppercase"
          />
          <button
            type="submit"
            className="absolute right-0 bottom-4 p-2 hover:scale-110 transition-transform"
          >
            <ArrowRight className="w-6 h-6" />
          </button>
        </form>

        {/* Source Icons */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 opacity-40 grayscale">
          <div className="flex flex-col items-center gap-2">
            <Shield className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-widest">NPPES</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Shield className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-widest">OIG/LEIE</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Terminal className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-widest">PECOS</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Search className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-widest">FSMB</span>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-8">
          <Link
            href="/demo"
            className="border border-[var(--vt-border)] px-6 py-3 text-sm font-bold uppercase tracking-widest hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            Request a Demo <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/developers"
            className="border border-[var(--vt-border)] px-6 py-3 text-sm font-bold uppercase tracking-widest hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            API Docs <Terminal className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
