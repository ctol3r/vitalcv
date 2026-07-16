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
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

// Public-only nav items, clinician-led (Sprint 1). Never add ops/internal routes
// here, and never a dead link — /explore + /developers are intentionally omitted
// until those pages exist (a later sprint).
const NAV_ITEMS = [
  { href: '/onboarding', label: 'For Clinicians' },
  { href: '/employers', label: 'For Employers' },
  { href: '/trust',     label: 'Trust' },
] as const;

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { track } = useUxTelemetry();

  // Calm Wave: a single, consistent paper bar on every public surface. The
  // homepage's dark drama now lives in inset "instrument" panels below the
  // nav, so the bar no longer flips dark over a full-bleed hero.
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
    <header className="sticky top-0 z-50 px-3 pt-3">
      {/* Vital Glass — a floating frosted rail. Detached from the top edge and
         translucent enough (60%) that page content frosts through it under a
         high blur + saturate, with a bright inset top-sheen and a soft float
         shadow. A flush frosted bar over flat paper read as nothing; a floating
         translucent rail reads unmistakably as glass. Theme-safe. */}
      <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl border border-[color-mix(in_oklab,var(--foreground)_10%,transparent)] bg-[color-mix(in_oklab,var(--background)_60%,transparent)] backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_14px_40px_-18px_rgba(2,6,23,0.42)]">
      <div className="flex h-16 items-center justify-between gap-6 px-5 sm:px-6">

        {/* Logo */}
        <Link
          href="/"
          className="font-heading text-lg font-semibold tracking-tight shrink-0 text-foreground"
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
                    ? 'bg-foreground/10 text-foreground'
                    : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <Link
            href="/sign-in"
            className="rounded-full border border-border px-4 py-1.5 text-sm font-medium text-muted-foreground hover:border-foreground/30 hover:text-foreground transition"
          >
            Sign In
          </Link>
          <Link
            href="/passport"
            style={{ backgroundColor: 'oklch(18% 0.012 265)' }}
            className="rounded-full px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 transition"
          >
            Check Readiness
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav-menu"
          className="rounded-lg p-2 text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition md:hidden"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu — inside the glass rail, on a near-opaque panel for legibility */}
      {menuOpen && (
        <nav id="mobile-nav-menu" className="border-t border-border/60 bg-[color-mix(in_oklab,var(--background)_88%,transparent)] px-5 py-4 md:hidden">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => handleNavItemClick(item.label)}
                  className={`block rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                    isRouteActive(pathname, item.href)
                      ? 'bg-foreground/10 text-foreground'
                      : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2 border-t border-border pt-4">
            <Link
              href="/sign-in"
              onClick={closeMenu}
              className="flex-1 rounded-xl border border-border py-2.5 text-center text-sm font-medium text-muted-foreground"
            >
              Sign In
            </Link>
            <Link
              href="/passport"
              onClick={closeMenu}
              style={{ backgroundColor: 'oklch(18% 0.012 265)' }}
              className="flex-1 rounded-xl py-2.5 text-center text-sm font-semibold text-white"
            >
              Check Readiness
            </Link>
          </div>
        </nav>
      )}
      </div>
    </header>
  );
}
