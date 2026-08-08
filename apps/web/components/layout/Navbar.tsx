'use client';

/**
 * Navbar — the shared public header as a full-width EYEBROW (2026-08-07
 * founder directive), evolving the scene-aware journey navigation of the
 * 2026-08-06 shared-header wave (FR-6).
 *
 * The eyebrow form: one shallow full-bleed strip — wordmark and network
 * descriptor pushed to the left edge, controls to the right edge, no
 * centered content column. The journey rail holds the optical center as an
 * itinerary (mono small-caps stages joined by a hairline track), not a row
 * of category links. The full destination set stays behind the trigger in
 * the editorial canvas (HeaderMenu).
 *
 * Scene awareness: sections declare `data-header-theme` / `data-header-stage`
 * and the header reflects them (useHeaderScene). Declaration, not detection —
 * no pixel sampling, no scroll listener; the sentinel IntersectionObserver
 * from #1068 still decides when the bar earns its plate, and ChapterProgress
 * remains the homepage's only scroll owner.
 *
 * Structural contract: this stays a sticky `<header>` with a constant-height
 * bar row. The film rollback measures `document.querySelector('header')` for
 * `position: sticky`, and a constant outer height is what makes the compact
 * scrolled state free of layout shift — the interior tightens, the box does
 * not.
 */

import { isPublicSurfacePath } from '@/components/layout/publicSurfaceRoutes';
import { LiquidMenu } from '@/components/layout/LiquidMenu';
import { HeaderMenu } from '@/components/layout/HeaderMenu';
import { JourneyRail } from '@/components/layout/JourneyRail';
import { getHeaderRouteContext } from '@/components/layout/headerRouteContext';
import { JOURNEY_STAGES } from '@/components/layout/journeyStages';
import { useHeaderScene } from '@/components/layout/useHeaderScene';
import { useUxTelemetry } from '@/hooks/useUxTelemetry';
import { UX_EVENTS } from '@/lib/analytics/ux-events';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function Navbar() {
  const pathname = usePathname();
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const canvasTriggerRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const { track } = useUxTelemetry();

  const route = getHeaderRouteContext(pathname ?? '/');
  const scene = useHeaderScene({ theme: route.defaultTheme, stage: route.defaultStage });
  const activeStage = JOURNEY_STAGES.find((s) => s.id === scene.stage);

  // Glass is right over paper and wrong over content. So the rail keeps full
  // transparency at rest and firms up once there is content behind it.
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

  // Escape closes the canvas wherever focus is (returning focus to the
  // trigger), and a click outside dismisses it.
  useEffect(() => {
    if (!canvasOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCanvasOpen(false);
        canvasTriggerRef.current?.focus();
      }
    };
    const onPointer = (e: MouseEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setCanvasOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [canvasOpen]);

  // Route changes end any open navigation state.
  useEffect(() => {
    setCanvasOpen(false);
    setOverlayOpen(false);
  }, [pathname]);

  if (!isPublicSurfacePath(pathname)) {
    return null;
  }

  const handleNavItemClick = (label: string) => {
    track({
      eventType: UX_EVENTS.NAV_ITEM_CLICKED,
      componentId: 'navbar',
      metadata: { label },
    });
    setCanvasOpen(false);
    setOverlayOpen(false);
  };

  return (
    <>
    {/* Top-of-document sentinel: while it is in view the rail is at rest. */}
    <div ref={sentinelRef} aria-hidden="true" className="absolute top-0 h-px w-full" />
    <header
      ref={navRef}
      className="vcv-header sticky top-0 z-50"
      data-nav-lifted={lifted ? '' : undefined}
      data-menu-open={canvasOpen ? '' : undefined}
      data-header-theme={scene.theme}
      data-header-stage={scene.stage}
    >
      {/* The plate: nothing at rest, a surface earned on scroll or expansion
          (#1068). What is new is that the surface answers the scene beneath
          it — over a declared dark room it resolves to warm ink built from
          the public token family, never an ops token (LINT-04, FR-6). */}
      <div className="vcv-header__plate w-full border-b">
        <div className="vcv-header__row flex w-full items-center justify-between gap-4">

          {/* Left edge: the serif lockup plus the network descriptor — the
              wordmark-and-division grammar of an operational eyebrow, not a
              logo floating in a nav. The descriptor is a span, so the pinned
              tab order (wordmark → rail anchors → Sign In) is untouched. */}
          <div className="flex shrink-0 items-baseline gap-3">
            <Link
              href="/"
              className="vcv-header__wordmark"
              onClick={() => handleNavItemClick('Home')}
            >
              VitalCV
            </Link>
            <span className="vcv-header__descriptor hidden xl:inline">
              Provider Career Evidence Network
            </span>
          </div>

          {/* The journey rail — the page narrative in the chrome. */}
          <nav
            className="hidden min-w-0 flex-1 justify-center md:flex"
            aria-label="Primary"
          >
            <JourneyRail
              stage={scene.stage}
              interactive={route.railInteractive}
              variant="bar"
              onNavigate={handleNavItemClick}
            />
          </nav>

          {/* Mobile: the current stage stays visible in the compact bar. */}
          <span className="vcv-header__stage md:hidden" aria-hidden="true">
            {activeStage?.label}
          </span>

          {/* Right side: restrained. Sign In, at most one contextual action,
              and the menu trigger. */}
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <Link href="/sign-in" className="vcv-header__signin">
              Sign In
            </Link>
            {route.cta ? (
              <Link
                href={route.cta.href}
                className="vcv-header__cta"
                onClick={() => handleNavItemClick(route.cta!.label)}
              >
                {route.cta.label}
              </Link>
            ) : null}
            <button
              ref={canvasTriggerRef}
              type="button"
              aria-expanded={canvasOpen}
              aria-controls="vcv-header-menu"
              className="vcv-header__trigger"
              onClick={() => setCanvasOpen((o) => !o)}
            >
              {canvasOpen ? 'Close' : 'Menu'}
              <span aria-hidden="true" className="vcv-header__trigger-glyph" data-open={canvasOpen ? '' : undefined} />
            </button>
          </div>

          {/* Mobile menu toggle */}
          <button
            ref={toggleRef}
            type="button"
            aria-label={overlayOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={overlayOpen}
            aria-haspopup="dialog"
            className="vcv-header__mobile-toggle rounded-[10px] p-2 md:hidden"
            onClick={() => setOverlayOpen((o) => !o)}
          >
            {overlayOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* The canvas lives INSIDE the plate, so the bar unfolds across the
            page rather than a menu appearing beneath one. */}
        <HeaderMenu
          open={canvasOpen}
          pathname={pathname ?? '/'}
          stage={scene.stage}
          railInteractive={route.railInteractive}
          onNavigate={handleNavItemClick}
        />
      </div>

      {/* The mobile recomposition — full-screen overlay, journey-first. */}
      <LiquidMenu
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        returnFocusRef={toggleRef}
        onNavigate={handleNavItemClick}
        pathname={pathname ?? '/'}
        stage={scene.stage}
        railInteractive={route.railInteractive}
        cta={route.cta}
      />
    </header>
    </>
  );
}
