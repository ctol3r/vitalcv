'use client';

/**
 * SignUpBanner — non-intrusive post-results sign-up prompt.
 *
 * Slides up from the bottom of the results area after a delay.
 * Does NOT overlay or block the results view.
 * User can dismiss and still see their full results.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FUNNEL_EVENTS, trackFunnelEvent } from '@/lib/analytics/funnel';

interface SignUpBannerProps {
  npi: string;
  displayName: string;
  onDismiss: () => void;
  /** Delay in ms before showing the banner. Default: 2500ms */
  delayMs?: number;
}

export function SignUpBanner({
  npi,
  displayName,
  onDismiss,
  delayMs = 2500,
}: SignUpBannerProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const shownTrackedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  useEffect(() => {
    if (visible && !shownTrackedRef.current) {
      trackFunnelEvent(FUNNEL_EVENTS.SIGNUP_PROMPT_SHOWN, { variant: 'banner' });
      shownTrackedRef.current = true;
    }
  }, [visible]);

  if (!visible || dismissed) return null;

  const handleClaim = () => {
    trackFunnelEvent(FUNNEL_EVENTS.SIGNUP_CLICKED, { variant: 'banner' });
    const params = new URLSearchParams({ npi, displayName });
    router.push(`/sign-up?${params.toString()}`);
  };

  const handleDismiss = () => {
    trackFunnelEvent(FUNNEL_EVENTS.SIGNUP_PROMPT_DISMISSED, { variant: 'banner', method: 'button' });
    setDismissed(true);
    onDismiss();
  };

  return (
    <div
      className="mt-4 overflow-hidden rounded-2xl border border-[var(--vt-accent)]/15 bg-[var(--vt-accent)]/[0.04]"
      style={{ animation: 'vcv-banner-slide-up 400ms ease-out both' }}
      role="complementary"
      aria-label="Save your results"
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--vt-text-primary)]">
            Create your VitalCV Passport
          </p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--vt-text-muted)]">
            Carry this snapshot to any employer. Free, takes 30 seconds.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleClaim}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--vt-accent)] px-4 text-sm font-medium text-white transition-colors hover:bg-[var(--vt-accent)]/90 active:bg-[var(--vt-accent)]/80 min-w-[44px] min-h-[44px]"
          >
            Save my results
          </button>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[var(--vt-text-muted)] transition-colors hover:text-[var(--vt-text-primary)] hover:bg-[var(--vt-surface-subtle)] min-w-[44px] min-h-[44px]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
