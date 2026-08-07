'use client';

/**
 * LiquidMenu — the mobile navigation recomposition (VHS-2.5, rebuilt by the
 * 2026-08-06 shared-header wave).
 *
 * Not the desktop menu shrunk: a full-screen overlay composed for touch —
 * the journey rail stacked vertically with the current stage marked, then
 * the destination groups at editorial scale, then the CTA pair. Destinations
 * come from navDestinations (the same source the desktop canvas consumes);
 * stages come from journeyStages.
 *
 * It remains a real modal dialog: focus is trapped, background scroll is
 * locked, Escape closes it, and focus returns to the trigger on close. The
 * organic circular "liquid" bloom survives from the shipped version;
 * prefers-reduced-motion drops the bloom + stagger and just shows the panel.
 * Rendered only while open, so it never affects the NPI field's keyboard
 * focus when closed.
 */

import * as React from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { NAV_GROUPS } from './navDestinations';
import { JourneyRail } from './JourneyRail';
import { isRouteActive } from './publicSurfaceRoutes';
import type { JourneyStageId } from './journeyStages';
import type { HeaderCta } from './headerRouteContext';

export function LiquidMenu({
  open,
  onClose,
  returnFocusRef,
  onNavigate,
  pathname,
  stage,
  railInteractive,
  cta,
}: {
  open: boolean;
  onClose: () => void;
  /** Focus returns here on close (the toggle button). */
  returnFocusRef: React.RefObject<HTMLElement | null>;
  onNavigate?: (label: string) => void;
  pathname: string;
  stage: JourneyStageId;
  railInteractive: boolean;
  cta: HeaderCta | null;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const firstLinkRef = React.useRef<HTMLAnchorElement>(null);

  // Scroll lock + focus management + Escape + focus trap, all while open.
  React.useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Move focus into the dialog on the next frame (after the mount paints).
    const raf = requestAnimationFrame(() => {
      const target =
        firstLinkRef.current ?? panelRef.current?.querySelector<HTMLElement>('a[href], button');
      target?.focus();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown);
      // Return focus to the trigger.
      returnFocusRef.current?.focus();
    };
  }, [open, onClose, returnFocusRef]);

  if (!open) return null;

  const navigate = (label: string) => {
    onNavigate?.(label);
    onClose();
  };

  return (
    <div
      className="liquid-menu md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Site navigation"
      data-liquid-menu=""
      data-header-theme-scope="overlay"
    >
      {/* Scrim — clicking outside the sheet closes it. */}
      <button
        type="button"
        aria-label="Close menu"
        tabIndex={-1}
        className="liquid-menu__scrim"
        onClick={onClose}
      />
      <div ref={panelRef} className="liquid-menu__panel">
        <div className="liquid-menu__head">
          <Link
            ref={firstLinkRef}
            href="/"
            className="liquid-menu__brand"
            onClick={() => navigate('Home')}
          >
            VitalCV
          </Link>
          <button type="button" aria-label="Close menu" className="liquid-menu__close" onClick={onClose}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* The journey, vertical — the same four stages the desktop rail
            shows, with the current stage marked for this route. */}
        <div className="liquid-menu__journey liquid-menu__item" style={{ ['--i' as string]: 0 }}>
          <p className="liquid-menu__eyebrow">The journey</p>
          <JourneyRail
            stage={stage}
            interactive={railInteractive}
            variant="overlay"
            onNavigate={navigate}
          />
        </div>

        <nav aria-label="Primary" className="liquid-menu__nav">
          {NAV_GROUPS.map((group, gi) => (
            <div
              key={group.id}
              className="liquid-menu__group liquid-menu__item"
              style={{ ['--i' as string]: gi + 1 }}
            >
              <p className="liquid-menu__eyebrow" id={`liquid-group-${group.id}`}>
                {group.label}
              </p>
              <ul className="liquid-menu__list" aria-labelledby={`liquid-group-${group.id}`}>
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={isRouteActive(pathname, link.href) ? 'page' : undefined}
                      onClick={() => navigate(link.label)}
                      className="liquid-menu__link"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="liquid-menu__cta">
          <Link href="/sign-in" onClick={() => navigate('Sign In')} className="liquid-menu__cta-secondary">
            Sign In
          </Link>
          {cta ? (
            <Link href={cta.href} onClick={() => navigate(cta.label)} className="liquid-menu__cta-primary">
              {cta.label}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default LiquidMenu;
