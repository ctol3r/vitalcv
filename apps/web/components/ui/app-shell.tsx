'use client';

import Link from 'next/link';
import { PortalSwitcher } from './portal-switcher';

/* ------------------------------------------------------------------ */
/*  AppShell — shared wrapper with top nav + portal switcher           */
/* ------------------------------------------------------------------ */

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Global top bar */}
      <div className="border-b border-[var(--glass-border)] bg-background/80 backdrop-blur-sm">
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
