'use client';

/**
 * Eyebrow — the shared public chrome, rebuilt as the v4 FLOATING GLASS RAIL
 * (founder directive 2026-08-16: "build the glass rail"; EC-10 amendment A-4).
 *
 * The chrome is a single detached glass bar floating over the page: a fixed,
 * centred, max-width frosted rectangle held 14px from the top. LEFT: the
 * wordmark. MIDDLE: the durable primary link row (PRIMARY_NAV — Jobs, For
 * employers, How it works, honest from any public route). RIGHT: quiet
 * sign-in, the shield-check "Verify a shared record" affordance, the one
 * contextual dominant action (Start with your NPI / Build my profile / Request
 * organization access, swapped by route via headerRouteContext), and the menu
 * trigger that opens the full index.
 *
 * Geometry is architecturally stable on scroll — content moves under the glass,
 * the bar never moves; register/colour changes, position never. Sections keep
 * declaring their treatment through the existing `data-header-theme` contract
 * (useHeaderScene unchanged); the frost and instruments invert over dark bands
 * and return over light ones. While the takeover is open the rail holds the
 * dark register — it sits on ink.
 *
 * The takeover is a full-viewport ink canvas painted BELOW the still-live rail
 * (DOM order, no z-index). Its state machine is a single boolean: the trigger
 * toggles it, Escape and a route change close it, the trigger glyph syncs
 * ≡ → ×, and the overlay carries its own visible ✕ close (audit #56). Focus is
 * trapped across the whole header — the rail instruments stay live over the
 * takeover.
 *
 * Route membership is still owned by publicSurfaceRoutes.ts. Off the homepage a
 * spacer keeps page tops clear of the floating bar; the homepage hero owns its
 * own clearance (easy-home.css).
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getHeaderRouteContext } from '@/components/layout/headerRouteContext';
import { NAV_GROUPS, PRIMARY_NAV } from '@/components/layout/navDestinations';
import { isPublicSurfacePath } from '@/components/layout/publicSurfaceRoutes';
import { useOptionalRoleContext } from '@/components/auth/RoleContext';
import { useHeaderScene } from '@/components/layout/useHeaderScene';

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

  // Takeover behaviour: scroll lock, Escape, focus containment. The trap spans
  // the whole header — the floating rail instruments stay interactive over the
  // takeover, so Tab cycles the menu destinations AND the live rail.
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
      const focusables = headerRef.current.querySelectorAll<HTMLElement>('a[href], button');
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

  // A route change closes the takeover.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const roleContext = useOptionalRoleContext();
  const isSignedIn = roleContext?.isSignedIn ?? false;
  const workspaceHref = roleContext?.landingRoute ?? '/holder/home';

  if (!isPublicSurfacePath(pathname)) return null;

  const cta = isHome
    ? { href: '/#npi', label: 'Start with your NPI', shortLabel: 'Start' }
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
        {/* The takeover paints FIRST so the rail that follows it in DOM order
            sits above it — no z-index. */}
        {menuOpen ? (
          <div
            id="vcv-eb-menu"
            className="vcv-eb-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Index"
          >
            <button
              type="button"
              className="vcv-eb-menu__close"
              onClick={closeMenu}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
              Close
            </button>
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
              {/* Sign-in folds off the resting rail on mobile; the takeover keeps
                  it reachable there. */}
              <Link
                href={isSignedIn ? workspaceHref : '/sign-in'}
                className="vcv-eb-menu__foot-link"
                onClick={closeMenu}
              >
                {isSignedIn ? 'Go to your workspace' : 'Sign in'}
              </Link>
              {' · '}Enter your NPI. VitalCV does the rest.
            </p>
          </div>
        ) : null}

        <nav className="vcv-eb__rail" aria-label="Primary">
          <Link href="/" className="vcv-eb__wordmark" aria-label="VitalCV home">
            VitalCV
          </Link>

          <div className="vcv-eb__links">
            {PRIMARY_NAV.map((link) => (
              <Link key={link.href} href={link.href} className="vcv-eb__link">
                {link.label}
              </Link>
            ))}
          </div>

          <div className="vcv-eb__end">
            {/* Signed-in visitors get their workspace, not a sign-in prompt.
                Resolves client-side only — the root layout stays static
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

            {/* The verify affordance: a shield-check, not a magnifier (#1430).
                The public NPI check is VitalCV's one real lookup — a reviewer
                confirming a shared record, never decorative. */}
            <Link
              href="/verify"
              className="vcv-eb__icon-btn vcv-eb__verify"
              aria-label="Verify a shared record"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M10 2.5 4 5v4.2c0 3.5 2.5 6.3 6 8.3 3.5-2 6-4.8 6-8.3V5l-6-2.5Z" />
                <path d="m7.3 9.7 1.9 1.9 3.5-3.7" />
              </svg>
            </Link>

            {cta ? (
              <Link href={cta.href} className="vcv-eb__cta">
                <span className="vcv-eb__cta-long">{cta.label}</span>
                <span className="vcv-eb__cta-short">
                  {cta.shortLabel ?? cta.label}
                </span>
              </Link>
            ) : null}

            <button
              ref={menuButtonRef}
              type="button"
              className="vcv-eb__icon-btn vcv-eb__menu-btn"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="vcv-eb-menu"
              onClick={toggleMenu}
            >
              <span className="vcv-eb__menu-glyph" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </button>
          </div>
        </nav>
      </header>
      {/* Off the homepage, page tops were composed under a solid bar. The
          floating rail has zero layout footprint, so a spacer keeps those
          compositions clear of it. The homepage hero owns its own clearance. */}
      {!isHome ? <div className="vcv-eb__space" aria-hidden="true" /> : null}
    </>
  );
}
