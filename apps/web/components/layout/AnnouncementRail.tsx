'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, X } from 'lucide-react';

/**
 * AnnouncementRail — the narrow utility strip above the nav (the Anyscale
 * pattern), translated to Calm Wave. Exactly ONE timely message + one link,
 * dismissible with the dismissal stored locally.
 *
 * Honesty: the message must be true TODAY. Pilots are not yet enrolling, so the
 * live copy is the free-wallet fact, not a pilot call. Bump ANNOUNCE_VERSION
 * when the message changes so a prior dismissal doesn't hide the new one.
 */
const ANNOUNCE_VERSION = 'v2';
const STORAGE_KEY = `vcv-announce-dismissed-${ANNOUNCE_VERSION}`;

/**
 * Buyer surfaces where the clinician-wallet pitch must not render. The
 * employer doorway (Wave 6) opens with "Start clinicians faster from
 * source-backed evidence" — a strip above it addressing a different audience
 * ("The VitalCV Wallet is free for clinicians → Check your NPI") undercuts the
 * page's one argument, and "wallet" is on the buyer-surface banned list that
 * buyer-proof-page.test.tsx enforces for page copy. Suppressing here closes
 * the gap between the component-level guard and what the layout actually
 * serves on those routes.
 */
const BUYER_PATH_PREFIXES = ['/employers', '/employer', '/pilot', '/review', '/for/'] as const;

/**
 * Surfaces that already make this exact offer, louder and better.
 *
 * The homepage IS the NPI check: it carries the field at display scale, says
 * "Free for clinicians" in its own hint line, and labels the act "Step 1 ·
 * Start with your NPI". The rail above it therefore repeated the page's offer
 * and its call to action in the first line a visitor reads — and did it in a
 * different vocabulary ("Wallet"), a noun that appears nowhere else on the
 * page. A utility strip earns its place by carrying a message the page does
 * not; here it competed with one.
 */
const REDUNDANT_PATHS = ['/'] as const;

export function isRedundantAnnouncementPath(pathname: string | null): boolean {
  return Boolean(pathname) && REDUNDANT_PATHS.includes(pathname as (typeof REDUNDANT_PATHS)[number]);
}

export function isBuyerSurfacePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return BUYER_PATH_PREFIXES.some(
    (prefix) =>
      pathname === prefix ||
      pathname === prefix.replace(/\/$/, '') ||
      pathname.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`),
  );
}

export function AnnouncementRail() {
  const pathname = usePathname();
  const [dismissed, setDismissed] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    try {
      setDismissed(window.localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      /* private mode / storage blocked — just keep it visible */
    }
  }, []);

  // Buyer surfaces never render the clinician pitch — server and client agree
  // on pathname, so this is hydration-safe and holds for no-JS readers too.
  if (isBuyerSurfacePath(pathname)) return null;
  if (isRedundantAnnouncementPath(pathname)) return null;

  // Renders on the server + first paint (so no-JS users see it), then hides
  // itself after mount if this message was already dismissed.
  if (mounted && dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      role="region"
      aria-label="Announcement"
      className="mz mz-paper relative z-40 border-b border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] text-[var(--vt-text-secondary)]"
    >
      <div className="mx-auto flex min-h-[34px] max-w-7xl items-center justify-center gap-3 px-10 py-1.5 text-center text-[13px]">
        <p className="leading-tight">
          VitalCV is free for clinicians.{' '}
          <Link
            href="/#npi"
            className="group inline-flex items-center gap-1 font-semibold text-[var(--vt-text-primary)] underline-offset-4 hover:underline"
          >
            Check your NPI
            <ArrowRight
              size={13}
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </Link>
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--vt-text-muted)] transition-colors hover:text-[var(--vt-text-primary)]"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

export default AnnouncementRail;
