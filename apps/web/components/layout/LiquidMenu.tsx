'use client';

/**
 * LiquidMenu — the accessible mobile navigation overlay (VHS-2.5).
 *
 * Opens with an organic circular "liquid" bloom from the toggle button (top
 * corner), staggering the destinations in. It is a real modal dialog: focus is
 * trapped, background scroll is locked, Escape closes it, and focus returns to
 * the trigger on close. prefers-reduced-motion drops the bloom + stagger and
 * just shows/hides the panel. Rendered only while open, so it never affects the
 * NPI field's keyboard focus when closed.
 */

import * as React from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

export interface LiquidMenuItem {
  href: string;
  label: string;
  active?: boolean;
}

export function LiquidMenu({
  open,
  onClose,
  items,
  returnFocusRef,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  items: readonly LiquidMenuItem[];
  /** Focus returns here on close (the toggle button). */
  returnFocusRef: React.RefObject<HTMLElement | null>;
  onNavigate?: (label: string) => void;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const firstLinkRef = React.useRef<HTMLAnchorElement>(null);

  // Scroll lock + focus management + Escape + focus trap, all while open.
  React.useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Move focus into the dialog on the next frame (after the mount paints).
    const raf = requestAnimationFrame(() => firstLinkRef.current?.focus());

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

  return (
    <div
      className="liquid-menu md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Site navigation"
      data-liquid-menu=""
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
          <span className="liquid-menu__brand">VitalCV</span>
          <button type="button" aria-label="Close menu" className="liquid-menu__close" onClick={onClose}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Primary">
          <ul className="liquid-menu__list">
            {items.map((item, i) => (
              <li key={item.href} className="liquid-menu__item" style={{ ['--i' as string]: i }}>
                <Link
                  ref={i === 0 ? firstLinkRef : undefined}
                  href={item.href}
                  aria-current={item.active ? 'page' : undefined}
                  onClick={() => { onNavigate?.(item.label); onClose(); }}
                  className="liquid-menu__link"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="liquid-menu__cta">
          <Link href="/sign-in" onClick={onClose} className="liquid-menu__cta-secondary">
            Sign In
          </Link>
          <Link href="/passport" onClick={onClose} className="liquid-menu__cta-primary">
            Check Readiness
          </Link>
        </div>
      </div>
    </div>
  );
}

export default LiquidMenu;
