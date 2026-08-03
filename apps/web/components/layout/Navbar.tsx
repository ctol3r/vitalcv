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

/**
 * The expanding navigation.
 *
 * Every destination below is a route that exists and returns 200. The file's
 * standing rule is "never a dead link", and `holder-route-contract` extracts
 * hrefs from source and asserts each one resolves — so an aspirational entry
 * fails CI rather than shipping a 404. A **Company** group was requested and is
 * deliberately absent for exactly that reason: there is no /about, /careers or
 * /contact in `app/` today. It goes in the moment those pages exist.
 */
const NAV_GROUPS = [
  {
    id: 'clinicians',
    label: 'Clinicians',
    blurb: 'Start with your NPI and see what employers can confirm today.',
    links: [
      { href: '/onboarding', label: 'Check your readiness', detail: 'Begin with your NPI' },
      { href: '/passport', label: 'Your evidence record', detail: 'What travels, and what you hold' },
    ],
  },
  {
    id: 'employers',
    label: 'Employers',
    blurb: 'Begin review from attributed evidence instead of from intake.',
    links: [
      { href: '/employers', label: 'For employers', detail: 'What arrives, and what it does not decide' },
    ],
  },
  {
    id: 'evidence',
    label: 'Evidence',
    blurb: 'Every claim names the source that answered and its refresh window.',
    links: [
      { href: '/evidence-network', label: 'Evidence network', detail: 'How records move between parties' },
      { href: '/trust/attribution', label: 'Source attribution', detail: 'Which source answered for what' },
    ],
  },
  {
    id: 'trust',
    label: 'Trust',
    blurb: 'The boundary is published, not implied.',
    links: [
      { href: '/trust', label: 'Trust', detail: 'What VitalCV does and does not decide' },
      { href: '/status', label: 'Status', detail: 'Live source and system state' },
    ],
  },
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
  /**
   * Which group is expanded, or null.
   *
   * One value, not one boolean per group: two panels can never be open at once,
   * and moving between triggers swaps the panel rather than stacking it.
   */
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
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

  // Escape closes the panel wherever focus is, and a click outside dismisses it.
  // Both are required for a disclosure that opens on hover: a pointer user who
  // moves away and a keyboard user who tabs out must each be able to get rid of
  // it without hunting for the trigger again.
  useEffect(() => {
    if (!openGroup) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenGroup(null);
    };
    const onPointer = (e: MouseEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpenGroup(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [openGroup]);

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
    <header className="sticky top-0 z-50" data-nav-lifted={lifted ? '' : undefined}>
      {/* An edge-to-edge bar, transparent at rest, that materialises on scroll.

         It was a floating rounded rail with side margins. Palantir and Zoox
         both run a thin bar that spans the full viewport and expands straight
         down; a floating pill cannot do that — a "full-width panel" hanging off
         a max-width pill is the generic dropdown the brief rules out. So the
         pill is gone: the surface is full-bleed and only the CONTENT is held to
         a max width, which is what makes the expanded panel read as the bar
         unfolding across the page rather than a menu appearing beneath it.

         The float shadow went with it. A bar that spans the viewport is not
         floating above the page, so a drop shadow would be describing a
         relationship that no longer exists; a bottom hairline is the honest
         edge.

         It used to be tinted 60% `--background` at rest — 60% of the page's own
         cream, sitting on that same cream. Blur cannot refract a colour into
         itself, so the rail read as a solid pill no matter how much backdrop
         filtering it carried. It was translucent by construction and opaque to
         the eye, which is the complaint that kept coming back.

         At rest there is now no plate at all: no background, no border, no
         shadow. The wordmark and links sit directly on the page, which is what
         "transparent" has to mean on a flat paper surface — you cannot see
         *through* to cream, so the only honest transparency is nothing there.

         Once the page scrolls, content starts passing beneath the bar and a
         plate becomes necessary for legibility rather than decorative: the
         tint, hairline, blur and float shadow fade in together. That is the
         dynamic half — the bar earns its surface exactly when it needs one. */}
      <div
        className={`w-full border-b backdrop-blur-2xl backdrop-saturate-150 transition-[background-color,border-color] duration-300 ${
          // An expanded panel needs a surface for the same reason a scrolled
          // bar does: there is now content that must not print through it.
          lifted || openGroup
            ? 'border-[color-mix(in_oklab,var(--foreground)_12%,transparent)] bg-[color-mix(in_oklab,var(--background)_92%,transparent)]'
            : 'border-transparent bg-transparent backdrop-blur-none backdrop-saturate-100'
        }`}
      >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">

        {/* Logo */}
        <Link
          href="/"
          className="font-heading text-lg font-semibold tracking-tight shrink-0 text-foreground"
          onClick={closeMenu}
        >
          VitalCV
        </Link>

        {/* Desktop nav — group triggers, not plain links. */}
        <nav className="hidden items-center gap-1 md:flex flex-1" aria-label="Primary">
          {NAV_GROUPS.map((group) => {
            const expanded = openGroup === group.id;
            const active = group.links.some((l) => isRouteActive(pathname, l.href));
            return (
              <button
                key={group.id}
                type="button"
                id={`nav-trigger-${group.id}`}
                aria-expanded={expanded}
                aria-controls={`nav-panel-${group.id}`}
                // Hover opens it, focus opens it, click toggles it. A pointer
                // user should not have to click to see a menu, and a keyboard
                // user must not have to guess that hovering is the way in.
                onMouseEnter={() => setOpenGroup(group.id)}
                onFocus={() => setOpenGroup(group.id)}
                onClick={() => setOpenGroup((c) => (c === group.id ? null : group.id))}
                // CD-10 chrome is 10px, never a pill. CD-15 sets a 44px floor:
                // `py-1.5` computed to 32px, so every nav control failed it.
                className={`inline-flex items-center gap-1.5 rounded-[10px] px-3 min-h-11 text-sm font-medium transition ${
                  expanded || active
                    ? 'bg-foreground/10 text-foreground'
                    : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                }`}
              >
                {group.label}
                {/* The arrow states the direction the panel will travel, and
                    turns to point back the way it came once it is open. */}
                <span
                  aria-hidden="true"
                  className={`text-[0.7em] transition-transform duration-200 motion-reduce:transition-none ${
                    expanded ? 'rotate-180' : ''
                  }`}
                >
                  ▾
                </span>
              </button>
            );
          })}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <Link
            href="/sign-in"
            className="inline-flex items-center rounded-[10px] border border-border px-4 min-h-11 text-sm font-medium text-muted-foreground hover:border-foreground/30 hover:text-foreground transition"
          >
            Sign In
          </Link>
          <Link
            href="/passport"
            style={{ backgroundColor: 'var(--vt-accent)' }}
            className="inline-flex items-center rounded-[10px] px-4 min-h-11 text-sm font-semibold text-white hover:opacity-90 transition"
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

      {/* The panel.

          It lives INSIDE the plate, so what expands is the bar itself rather
          than a menu appearing beneath one. The plate is already
          `overflow-hidden rounded-2xl`, so the panel is clipped by the bar's
          own corners on the way down and reads as one object changing height.

          The height animation is a `grid-rows` 0fr→1fr transition rather than
          max-height: it animates to the panel's real height, so the content
          never has to be measured and a longer group cannot be clipped by a
          guessed maximum. Under reduced motion the row simply snaps. */}
      <div
        onMouseLeave={() => setOpenGroup(null)}
        className={`hidden md:grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none ${
          openGroup ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          {NAV_GROUPS.map((group) => (
            <div
              key={group.id}
              id={`nav-panel-${group.id}`}
              role="group"
              aria-labelledby={`nav-trigger-${group.id}`}
              hidden={openGroup !== group.id}
              className="mx-auto max-w-7xl border-t border-[color-mix(in_oklab,var(--foreground)_10%,transparent)] px-5 pb-8 pt-6 sm:px-8"
            >
              <p className="max-w-[52ch] text-sm text-muted-foreground">{group.blurb}</p>
              <ul className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => {
                        handleNavItemClick(link.label);
                        setOpenGroup(null);
                      }}
                      className="group/navlink flex min-h-11 flex-col justify-center rounded-[10px] px-3 py-2 transition hover:bg-foreground/5"
                    >
                      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        {link.label}
                        {/* Finite, never looping: the arrow steps out on hover
                            and stops. CD-11 forbids idle motion. */}
                        <span
                          aria-hidden="true"
                          className="translate-x-0 text-[0.75em] transition-transform duration-150 group-hover/navlink:translate-x-1 motion-reduce:transition-none motion-reduce:transform-none"
                        >
                          →
                        </span>
                      </span>
                      <span className="text-[0.8125rem] text-muted-foreground">{link.detail}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
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
