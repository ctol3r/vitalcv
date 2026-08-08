'use client';

/**
 * Eyebrow — the shared public eyebrow (UX-V1 production cutover).
 *
 * One continuous 64px architectural instrument, full browser width:
 * restrained VitalCV identity left, contextual product state center (a mono
 * ticker that follows the homepage work surface's current beat; sparse nav
 * links elsewhere), and a minimal right cluster — quiet Sign in, at most ONE
 * dominant contextual action (from headerRouteContext, unchanged policy), and
 * a boxed menu glyph opening a full-takeover index menu.
 *
 * Geometry is constant: scrolling and theme inversion change color only,
 * never height or layout. Sections keep declaring their register through the
 * existing `data-header-theme` contract (useHeaderScene is unchanged); the
 * bar inverts over light bands and returns over dark ones.
 *
 * Replaces Navbar + AnnouncementRail on public surfaces. Route membership is
 * still owned by publicSurfaceRoutes.ts — this component decides nothing
 * about which routes carry chrome.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getHeaderRouteContext } from '@/components/layout/headerRouteContext';
import { NAV_GROUPS, PRIMARY_NAV } from '@/components/layout/navDestinations';
import { isPublicSurfacePath } from '@/components/layout/publicSurfaceRoutes';
import { useHeaderScene } from '@/components/layout/useHeaderScene';

/** The home work surface announces its current beat through this event. */
export const HOME_BEAT_EVENT = 'vcv:home-beat';

const STATIC_TICKER = 'How VitalCV works';

export default function Eyebrow() {
  const pathname = usePathname() ?? '/';
  const route = getHeaderRouteContext(pathname);
  const scene = useHeaderScene({
    theme: route.defaultTheme,
    stage: route.defaultStage,
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [ticker, setTicker] = useState(STATIC_TICKER);
  const [tickerRoll, setTickerRoll] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const isHome = pathname === '/';

  // The homepage work surface narrates its beat into the bar. Reduced-motion
  // visitors never receive these events (the surface doesn't play), so the
  // static label simply holds.
  useEffect(() => {
    if (!isHome) {
      setTicker(STATIC_TICKER);
      return;
    }
    const onBeat = (event: Event) => {
      const label = (event as CustomEvent<{ label?: string }>).detail?.label;
      if (!label) return;
      setTicker(label);
      setTickerRoll(true);
    };
    window.addEventListener(HOME_BEAT_EVENT, onBeat);
    return () => window.removeEventListener(HOME_BEAT_EVENT, onBeat);
  }, [isHome]);

  useEffect(() => {
    if (!tickerRoll) return;
    const raf = requestAnimationFrame(() => setTickerRoll(false));
    return () => cancelAnimationFrame(raf);
  }, [tickerRoll, ticker]);

  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  // Takeover behavior: scroll lock, Escape, initial focus, focus containment.
  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
        return;
      }
      if (event.key !== 'Tab' || !menuRef.current) return;
      const focusables = menuRef.current.querySelectorAll<HTMLElement>('a, button');
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen, closeMenu]);

  // Route changes close the takeover.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (!isPublicSurfacePath(pathname)) return null;

  const cta = isHome
    ? { href: '/#npi', label: 'Start with your NPI' }
    : route.cta;

  return (
    <header
      className="vcv-eb z-50"
      data-eb-theme={scene.theme}
      data-eb-stage={scene.stage}
      data-menu-open={menuOpen ? 'true' : 'false'}
    >
      <div className="vcv-eb__in">
        <Link href="/" className="vcv-eb__wordmark" aria-label="VitalCV home">
          VitalCV
        </Link>

        <div className="vcv-eb__center">
          {isHome ? (
            <span
              className={tickerRoll ? 'vcv-eb__ticker is-roll' : 'vcv-eb__ticker'}
              aria-hidden="true"
            >
              {ticker}
            </span>
          ) : (
            /*
             * W1079 — clinician-first order, from the shared PRIMARY_NAV, and
             * Trust is no longer a top-level bar destination. A clinician's
             * next actions are the profile (the CTA to the right) and the roles
             * it unlocks; Trust answers a question they have not asked yet. It
             * keeps a full group in the index menu and a direct link in the
             * footer, which is the "compact path" the wave asks for — moved,
             * not demoted.
             */
            <nav aria-label="Primary" className="vcv-eb__center-nav">
              {PRIMARY_NAV.map((link) => (
                <Link key={link.href} className="vcv-eb__navlink" href={link.href}>
                  {link.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        <div className="vcv-eb__right">
          <Link href="/sign-in" className="vcv-eb__signin">
            Sign in
          </Link>
          {cta ? (
            <Link href={cta.href} className="vcv-eb__cta">
              <span className="vcv-eb__cta-long">{cta.label}</span>
              <span className="vcv-eb__cta-short">Start</span>
            </Link>
          ) : null}
          <button
            ref={menuButtonRef}
            type="button"
            className="vcv-eb__menu-btn"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="vcv-eb-menu"
            onClick={openMenu}
          >
            <span className="vcv-eb__menu-glyph" aria-hidden="true">
              <i />
              <i />
            </span>
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div
          id="vcv-eb-menu"
          ref={menuRef}
          className="vcv-eb-menu z-[60]"
          role="dialog"
          aria-modal="true"
          aria-label="Index"
        >
          <div className="vcv-eb-menu__top">
            <span className="vcv-eb__wordmark">VitalCV</span>
            <button
              ref={closeButtonRef}
              type="button"
              className="vcv-eb-menu__close"
              aria-label="Close menu"
              onClick={closeMenu}
            >
              <span aria-hidden="true">&#10005;</span>
            </button>
          </div>
          <div className="vcv-eb-menu__scroll">
            <nav className="vcv-eb-menu__groups" aria-label="Site index">
              {NAV_GROUPS.map((group) => (
                <div key={group.id} className="vcv-eb-menu__group">
                  <p className="vcv-eb-menu__group-label">{group.label}</p>
                  {group.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="vcv-eb-menu__link"
                      onClick={closeMenu}
                    >
                      <span>
                        {link.label}
                        <span className="vcv-eb-menu__detail">{link.detail}</span>
                      </span>
                      <i aria-hidden="true">&#8627;</i>
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
          </div>
          <p className="vcv-eb-menu__foot">VitalCV &middot; Enter your NPI. VitalCV does the rest.</p>
        </div>
      ) : null}
    </header>
  );
}
