'use client';

import * as React from 'react';
import Link from 'next/link';
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
const ANNOUNCE_VERSION = 'v1';
const STORAGE_KEY = `vcv-announce-dismissed-${ANNOUNCE_VERSION}`;

export function AnnouncementRail() {
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
          The VitalCV Wallet is free for clinicians.{' '}
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
