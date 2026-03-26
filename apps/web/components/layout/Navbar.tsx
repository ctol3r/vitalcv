'use client';

/**
 * Navbar — Wave 181: Navigation Rewrite & Information Architecture
 *
 * Public nav: Home · Explore · Employers · Search · Network · Developers
 * Auth CTA: Sign In + Get Started (unauthenticated), My Workspace (authenticated)
 */

import { isPublicSurfacePath, isRouteActive } from '@/components/layout/publicSurfaceRoutes';
import { useUxTelemetry } from '@/hooks/useUxTelemetry';
import { UX_EVENTS } from '@/lib/analytics/ux-events';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

// Public-only nav items. Never add ops/internal routes here.
// See docs/VCV_UI_DOCTRINE.md §3 for the full Navbar ruleset.
// Three primary paths. Features (passport, interview) are reachable from within flows.
// Developers is secondary — present but not the wedge.
const NAV_ITEMS = [
  { href: '/get-ready',   label: 'Get Ready' },
  { href: '/explore',     label: 'Explore Roles' },
  { href: '/employers',   label: 'For Employers' },
  { href: '/developers',  label: 'Developers' },
] as const;

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { track } = useUxTelemetry();

  if (!isPublicSurfacePath(pathname)) {
    return null;
  }

  const closeMenu = () => setMenuOpen(false);
  const handleNavItemClick = (label: string) => {
    track({
      eventType: UX_EVENTS.NAV_ITEM_CLICKED,
      componentId: 'navbar',
      metadata: { label },
    });
    closeMenu();
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-vt-surface-ops-base/90 text-white backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-6">

        {/* Logo */}
        <Link
          href="/"
          className="font-heading text-lg font-semibold tracking-tight shrink-0"
          onClick={closeMenu}
        >
          VitalCV
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex flex-1">
          {NAV_ITEMS.map((item) => {
            const active = isRouteActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => handleNavItemClick(item.label)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? 'bg-white/12 text-white'
                    : 'text-white/70 hover:bg-white/8 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <Link
            href="/sign-in"
            className="rounded-full border border-white/20 px-4 py-1.5 text-sm font-medium text-white/80 hover:border-white/40 hover:text-white transition"
          >
            Sign In
          </Link>
          <Link
            href="/get-ready"
            className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-[oklch(0.22_0.01_60)] hover:bg-white/90 transition"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white transition md:hidden"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav className="border-t border-white/10 bg-[oklch(0.18_0.01_60)] px-6 py-4 md:hidden">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => handleNavItemClick(item.label)}
                  className={`block rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                    isRouteActive(pathname, item.href)
                      ? 'bg-white/12 text-white'
                      : 'text-white/70 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2 border-t border-white/10 pt-4">
            <Link
              href="/sign-in"
              onClick={closeMenu}
              className="flex-1 rounded-xl border border-white/20 py-2.5 text-center text-sm font-medium text-white/80"
            >
              Sign In
            </Link>
            <Link
              href="/get-ready"
              onClick={closeMenu}
              className="flex-1 rounded-xl bg-white py-2.5 text-center text-sm font-semibold text-[oklch(0.22_0.01_60)]"
            >
              Get Started
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
