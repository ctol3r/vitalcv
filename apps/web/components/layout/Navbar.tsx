'use client';

/**
 * Navbar — Wave 181: Navigation Rewrite & Information Architecture
 *
 * Public nav: Home · Explore · Employers · Search · Network · Developers
 * Auth CTA: Sign In + Get Started (unauthenticated), My Workspace (authenticated)
 */

import { isPublicSurfacePath, isRouteActive } from '@/components/layout/publicSurfaceRoutes';
import { LiquidMenu } from '@/components/layout/LiquidMenu';
import { useUxTelemetry } from '@/hooks/useUxTelemetry';
import { UX_EVENTS } from '@/lib/analytics/ux-events';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

// Public-only nav items, clinician-led (Sprint 1). Never add ops/internal routes
// here, and never a dead link — /explore + /developers are intentionally omitted
// until those pages exist (a later sprint).
const NAV_ITEMS = [
  { href: '/onboarding', label: 'For Clinicians' },
  { href: '/employers', label: 'For Employers' },
  { href: '/trust',     label: 'Trust' },
] as const;

// Mobile menu destinations (VHS-2.5 required set): Home + the public nav.
// Check Readiness + Sign In render as the overlay's CTA pair.
const MOBILE_MENU_ITEMS = [
  { href: '/', label: 'Home' },
  ...NAV_ITEMS,
] as const;

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const { track } = useUxTelemetry();

  // Glass is right over paper and wrong over content. At 60% translucency a
  // large serif heading scrolling underneath reads THROUGH the bar, which
  // looks like a rendering fault rather than a material. So the rail keeps its
  // full translucency at rest and firms up once there is content behind it.
  //
  // A sentinel + IntersectionObserver, deliberately not a scroll listener:
  // this is site chrome on every public surface, and the homepage's rule is
  // that ChapterProgress owns the only scroll model.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [lifted, setLifted] = useState(false);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setLifted(!(entry?.isIntersecting ?? true)),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

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
    <>
    {/* Top-of-document sentinel: while it is in view the rail is at rest. */}
    <div ref={sentinelRef} aria-hidden="true" className="absolute top-0 h-px w-full" />
    <header className="sticky top-0 z-50 px-3 pt-3" data-nav-lifted={lifted ? '' : undefined}>
      {/* Vital Glass — a floating frosted rail. Detached from the top edge and
         translucent enough (60%) that page content frosts through it under a
         high blur + saturate, with a bright inset top-sheen and a soft float
         shadow. A flush frosted bar over flat paper read as nothing; a floating
         translucent rail reads unmistakably as glass. Theme-safe.

         Lifted state: once the page has scrolled, the same rail moves to 92%
         and takes a firmer edge — still glass, but content passing underneath
         no longer prints through the words on top of it. */}
      <div
        className={`mx-auto max-w-7xl overflow-hidden rounded-2xl border backdrop-blur-2xl backdrop-saturate-150 transition-[background-color,border-color,box-shadow] duration-300 ${
          lifted
            ? 'border-[color-mix(in_oklab,var(--foreground)_16%,transparent)] bg-[color-mix(in_oklab,var(--background)_92%,transparent)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_18px_44px_-20px_rgba(2,6,23,0.5)]'
            : 'border-[color-mix(in_oklab,var(--foreground)_10%,transparent)] bg-[color-mix(in_oklab,var(--background)_60%,transparent)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_14px_40px_-18px_rgba(2,6,23,0.42)]'
        }`}
      >
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
          ref={toggleRef}
          type="button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          className="rounded-lg p-2 text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition md:hidden"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      </div>

      {/* Liquid mobile menu (VHS-2.5) — accessible modal overlay with an organic
         circular bloom. Desktop nav stays conventional above. */}
      <LiquidMenu
        open={menuOpen}
        onClose={closeMenu}
        returnFocusRef={toggleRef}
        onNavigate={handleNavItemClick}
        items={MOBILE_MENU_ITEMS.map((item) => ({
          ...item,
          active: isRouteActive(pathname, item.href),
        }))}
      />
    </header>
    </>
  );
}
