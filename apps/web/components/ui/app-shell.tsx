'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PortalSwitcher } from './portal-switcher';

/* ------------------------------------------------------------------ */
/*  AppShell — shared wrapper with top nav + portal switcher           */
/* ------------------------------------------------------------------ */

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Global top bar — sticky, backdrop-blur on scroll only */}
      <div
        className={`sticky top-0 z-40 border-b transition-[backdrop-filter,background-color,border-color] duration-200 ${
          scrolled
            ? 'border-[var(--glass-border)] bg-background/80 backdrop-blur-sm'
            : 'border-transparent bg-background'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-12">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-heading font-semibold tracking-tight hover:opacity-80 transition-opacity"
            >
              <span className="text-[var(--accent)]">Vital</span>
              <span>CV</span>
            </Link>

            {/* Portal switcher */}
            <PortalSwitcher />

            {/* Placeholder for user menu / auth */}
            <div className="w-8 h-8 rounded-full bg-muted/40 border border-[var(--glass-border)]" />
          </div>
        </div>
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}
