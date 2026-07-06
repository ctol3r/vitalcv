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
import { useEffect, useState } from 'react';

// Public-only nav items. Never add ops/internal routes here.
const NAV_ITEMS = [
  { href: '/pilot',   label: 'For Employers' },
] as const;

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { track } = useUxTelemetry();

  // Homepage renders a dark clinical-monitor hero at the top. While the nav is
  // over that hero it goes transparent-dark (light text) so it reads as one
  // continuous device surface; once scrolled into the light body it returns to
  // the normal solid bar. Only the homepage has the dark hero.
  const isHome = pathname === '/';
  useEffect(() => {
    if (!isHome) {
      setScrolled(false);
      return;
    }
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isHome]);
  const overHero = isHome && !scrolled && !menuOpen;

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
    <header
      data-nav-over={overHero ? '' : undefined}
      className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-colors duration-300 ${
        overHero
          ? 'vh-nav-over border-transparent bg-transparent'
          : 'border-border bg-background/90'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-6">

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
          <ThemeToggle />
          <Link
            href="/sign-in"
            className="rounded-full border border-border px-4 py-1.5 text-sm font-medium text-muted-foreground hover:border-foreground/30 hover:text-foreground transition"
          >
            Sign In
          </Link>
          <Link
            href="/passport"
            className="rounded-full bg-foreground px-4 py-1.5 text-sm font-semibold text-background hover:bg-foreground/90 transition"
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

      {/* Mobile menu */}
      {menuOpen && (
        <nav id="mobile-nav-menu" className="border-t border-border bg-background px-6 py-4 md:hidden">
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
              className="flex-1 rounded-xl bg-foreground py-2.5 text-center text-sm font-semibold text-background"
            >
              Check Readiness
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
