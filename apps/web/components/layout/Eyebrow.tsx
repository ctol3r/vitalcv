'use client';

/**
 * Eyebrow — the shared public chrome, rebuilt to the palantir.com header
 * grammar (founder directive 2026-08-09: "exact to palantir").
 *
 * There is no bar. The chrome is a zero-height sticky group whose instruments
 * float over the page: wordmark upper-left at the gutter, and a right cluster —
 * quiet sign-in, ONE dominant rectangular action (from headerRouteContext,
 * unchanged policy), and a fused pair of 40px square instruments (NPI lookup,
 * menu). The menu opens a full-viewport ink takeover that paints BELOW the
 * chrome — the same instruments stay live over it and the menu glyph becomes
 * the close control.
 *
 * Geometry is constant: scrolling and theme inversion change color only,
 * never position or size. Sections keep declaring their register through the
 * existing `data-header-theme` contract (useHeaderScene is unchanged); the
 * instruments invert over light bands and return over dark ones. While the
 * takeover is open the chrome holds the dark register — it sits on ink.
 *
 * On mobile the wordmark stays upper-left and the control cluster pins to the
 * BOTTOM of the viewport (menu, lookup left; action right), matching the
 * reference exactly.
 *
 * Route membership is still owned by publicSurfaceRoutes.ts — this component
 * decides nothing about which routes carry chrome. Off the homepage a spacer
 * keeps page tops clear of the floating instruments; the homepage hero owns
 * its own clearance (easy-home.css).
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getHeaderRouteContext } from '@/components/layout/headerRouteContext';
import { NAV_GROUPS } from '@/components/layout/navDestinations';
import { isPublicSurfacePath } from '@/components/layout/publicSurfaceRoutes';
import { useOptionalRoleContext } from '@/components/auth/RoleContext';
import { useHeaderScene } from '@/components/layout/useHeaderScene';

/**
 * The home work surface announces its current beat through this event.
 * The chrome no longer narrates (the reference carries no center content);
 * the constant stays exported because the surface still dispatches it and
 * the composition manifest records the relationship.
 */
export const HOME_BEAT_EVENT = 'vcv:home-beat';

export default function Eyebrow() {
  const pathname = usePathname() ?? '/';
  const route = getHeaderRouteContext(pathname);
  const scene = useHeaderScene({
    theme: route.defaultTheme,
    stage: route.defaultStage,
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  const isHome = pathname === '/';

  const toggleMenu = useCallback(() => setMenuOpen((open) => !open), []);
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  // Takeover behavior: scroll lock, Escape, focus containment. The trap spans
  // the whole header — the floating instruments stay interactive over the
  // takeover, exactly like the reference chrome.
  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
        return;
      }
      if (event.key !== 'Tab' || !headerRef.current) return;
      const focusables = headerRef.current.querySelectorAll<HTMLElement>('a, button');
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

  const roleContext = useOptionalRoleContext();
  const isSignedIn = roleContext?.isSignedIn ?? false;
  const workspaceHref = roleContext?.landingRoute ?? '/holder/home';

  if (!isPublicSurfacePath(pathname)) return null;

  const cta = isHome
    ? { href: '/#npi', label: 'Start with your NPI' }
    : route.cta;

  return (
    <>
      <header
        ref={headerRef}
        className="vcv-eb z-50"
        data-eb-theme={menuOpen ? 'dark' : scene.theme}
        data-eb-stage={scene.stage}
        data-menu-open={menuOpen ? 'true' : 'false'}
      >
        {/* The wide frosted rectangle the instruments sit inside. First child,
            so everything after it paints on top — stacking is DOM order.
            Decorative and inert: it must never intercept a click aimed at the
            page beneath it. */}
        <div className="vcv-eb__shape" aria-hidden="true" />

        {/* The takeover paints next so the chrome instruments that follow it
            in DOM order sit above it — again, no z-index. */}
        {menuOpen ? (
          <div
            id="vcv-eb-menu"
            className="vcv-eb-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Index"
          >
            <nav className="vcv-eb-menu__grid" aria-label="Site index">
              {NAV_GROUPS.map((group) => (
                <section key={group.id} className="vcv-eb-menu__col">
                  <p className="vcv-eb-menu__label">{group.label}</p>
                  <ul className="vcv-eb-menu__list">
                    {group.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="vcv-eb-menu__link"
                          onClick={closeMenu}
                        >
                          <span className="vcv-eb-menu__link-label">{link.label}</span>
                          <span className="vcv-eb-menu__detail">
                            <i aria-hidden="true">&#8627;</i> {link.detail}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </nav>
            <p className="vcv-eb-menu__foot">
              VitalCV &middot; Enter your NPI. VitalCV does the rest.
            </p>
          </div>
        ) : null}

        <div className="vcv-eb__brand">
          <Link href="/" className="vcv-eb__wordmark" aria-label="VitalCV home">
            VitalCV
          </Link>
        </div>

        <div className="vcv-eb__controls">
          {/* Signed-in visitors get their workspace, not a sign-in prompt.
              Resolves client-side only — the root layout must stay static
              (static-marketing-cache-contract), so no auth() on the server. */}
          {isSignedIn ? (
            <Link href={workspaceHref} className="vcv-eb__signin">
              Workspace
            </Link>
          ) : (
            <Link href="/sign-in" className="vcv-eb__signin">
              Sign in
            </Link>
          )}
          {/* Every instrument draws its visible box in an inner span. The
              reference's boxes are 40px; EC-5's floor is 44px. Rather than
              choose, the interactive element is 44px and the painted box
              stays 40px inside it — the geometry matches the reference and
              the target clears the floor. eyebrow.css compensates the 2px of
              transparent padding so the VISIBLE edges land on the gutter. */}
          {cta ? (
            <Link href={cta.href} className="vcv-eb__cta">
              <span className="vcv-eb__cta-box">
                <span className="vcv-eb__cta-long">{cta.label}</span>
                <span className="vcv-eb__cta-short">Start</span>
              </span>
            </Link>
          ) : null}
          <div className="vcv-eb__cluster">
            {/* The reference's search slot, mapped to VitalCV's real reviewer
                tool: /verify (check a shared record's signature and claims). A
                magnifier here read as "search" and opened a JWT verifier, so
                the glyph now matches the destination. Geometry is unchanged
                (EC-10) — only the glyph and label. */}
            <Link
              href="/verify"
              className="vcv-eb__icon-btn vcv-eb__lookup"
              aria-label="Verify a shared record"
            >
              <span className="vcv-eb__instr">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M8 1.5 2.75 3.4v3.9c0 3.05 2.15 5.4 5.25 6.7 3.1-1.3 5.25-3.65 5.25-6.7V3.4L8 1.5Z" />
                  <path d="M5.9 7.9 7.4 9.4l2.9-3.1" />
                </svg>
              </span>
            </Link>
            <button
              ref={menuButtonRef}
              type="button"
              className="vcv-eb__icon-btn vcv-eb__menu-btn"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="vcv-eb-menu"
              onClick={toggleMenu}
            >
              <span className="vcv-eb__instr">
                <span className="vcv-eb__menu-glyph" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </span>
            </button>
          </div>
        </div>
      </header>
      {/* Off the homepage, page tops were composed under a 64px solid bar.
          The floating chrome has zero footprint, so a spacer keeps those
          compositions clear of the instruments. The homepage hero is a
          full-bleed scene and owns its own clearance. */}
      {!isHome ? <div className="vcv-eb__space" aria-hidden="true" /> : null}
    </>
  );
}
