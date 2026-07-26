'use client';

// /auth/resolving — role-resolution interstitial.
//
// The middleware redirects authenticated-but-role-less users here. We resolve
// the role from the BROWSER (the middleware can't reach its own origin from
// inside the container), which sets the signed `vitalcv_role` cookie, then
// navigate back to the original destination — where the middleware now reads
// the cookie and lets the user through.

import { useEffect, useState } from 'react';
import { sanitizeInternalPath } from '@/lib/auth/redirect';

const LOOP_GUARD_KEY = 'vcv_role_resolve';
const LOOP_WINDOW_MS = 20000;
const LOOP_MAX_ATTEMPTS = 3;

/**
 * Guard against a pathological redirect loop (cookie set but not honored):
 * allow a few rapid attempts, then give up to /auth/error. Resets after the
 * window so a legitimate later re-resolution is not blocked.
 */
function tooManyAttempts(): boolean {
  try {
    const now = Date.now();
    const raw = sessionStorage.getItem(LOOP_GUARD_KEY);
    let state = raw ? (JSON.parse(raw) as { n: number; t: number }) : { n: 0, t: 0 };
    if (!state || now - state.t > LOOP_WINDOW_MS) state = { n: 0, t: now };
    state = { n: state.n + 1, t: now };
    sessionStorage.setItem(LOOP_GUARD_KEY, JSON.stringify(state));
    return state.n > LOOP_MAX_ATTEMPTS;
  } catch {
    return false; // sessionStorage unavailable — don't block resolution
  }
}

export default function ResolvingPage() {
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dest = sanitizeInternalPath(params.get('redirect_url'));

    if (tooManyAttempts()) {
      window.location.replace('/auth/error');
      return;
    }

    let cancelled = false;
    const stallTimer = setTimeout(() => {
      if (!cancelled) setStalled(true);
    }, 6000);

    (async () => {
      try {
        const res = await fetch('/api/auth/resolve-role', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (cancelled) return;
        if (res.ok) {
          window.location.replace(dest);
        } else if (res.status === 401) {
          window.location.replace(`/sign-in?redirect_url=${encodeURIComponent(dest)}`);
        } else {
          window.location.replace('/auth/error');
        }
      } catch {
        if (!cancelled) setStalled(true);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(stallTimer);
    };
  }, []);

  return (
    <main
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <p aria-live="polite" style={{ fontSize: '1rem', opacity: 0.8 }}>
        Signing you in…
      </p>
      {stalled && (
        <p style={{ fontSize: '0.875rem', opacity: 0.7 }}>
          Taking longer than expected.{' '}
          <a href="/holder" style={{ textDecoration: 'underline' }}>
            Continue to your wallet
          </a>
          .
        </p>
      )}
      <noscript>
        <a href="/holder">Continue to your wallet</a>
      </noscript>
    </main>
  );
}
