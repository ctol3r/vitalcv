'use client';

/**
 * CreateAccountModal — post-value account creation prompt
 *
 * Triggered AFTER the user sees the readiness preview.
 * Never blocks anonymous usage.
 *
 * Layout:
 *   - Mobile:  bottom-sheet (slides up from bottom)
 *   - Desktop: centered modal with dark overlay
 *
 * Wave A3 — Auth Architecture
 */

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

interface CreateAccountModalProps {
  npi:         string;
  displayName: string;
  onDismiss:   () => void;
}

export function CreateAccountModal({ npi, displayName, onDismiss }: CreateAccountModalProps) {
  const router  = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onDismiss]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onDismiss();
  };

  const handleClaim = () => {
    const params = new URLSearchParams({ npi, displayName });
    router.push(`/sign-up?${params.toString()}`);
  };

  return (
    /* Backdrop */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-account-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* Card — bottom-sheet on mobile, centered on desktop */}
      <div
        ref={cardRef}
        className="w-full sm:max-w-sm bg-vt-surface-ops-base border border-white/10 rounded-t-2xl sm:rounded-2xl p-6 mx-0 sm:mx-4 space-y-5 animate-slide-up sm:animate-fade-in-up"
      >
        {/* Close button */}
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="absolute top-4 right-4 text-white/30 hover:text-white/60 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Heading */}
        <div className="space-y-1.5 pr-8">
          <h2 id="create-account-title" className="text-white text-lg font-semibold tracking-tight">
            Your profile is ready
          </h2>
          <p className="text-white/55 text-sm">
            {displayName} · NPI {npi}
          </p>
        </div>

        {/* Body */}
        <p className="text-white/65 text-sm leading-relaxed">
          Create a free account to save, share, and track your credential readiness.
          Takes 15 seconds. No password required.
        </p>

        {/* Trust indicators */}
        <ul className="space-y-2">
          {[
            'Face ID or Touch ID to sign in',
            'Share proof with one tap',
            'Real-time credential monitoring',
          ].map((item) => (
            <li key={item} className="flex items-center gap-2.5 text-white/55 text-sm">
              <span className="w-1 h-1 rounded-full bg-white/25 flex-shrink-0" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>

        {/* Primary CTA */}
        <button
          onClick={handleClaim}
          className="w-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white rounded-full py-3.5 text-sm font-medium transition-all min-h-[48px]"
        >
          Claim with Face ID
        </button>

        {/* Skip */}
        <button
          onClick={onDismiss}
          className="w-full text-white/35 hover:text-white/55 text-sm py-2 transition-colors min-h-[44px]"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
