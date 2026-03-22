'use client';

/**
 * useAuthPrompt — post-value auth gate
 *
 * Fires AFTER the user has seen the readiness preview.
 * Never fires before the user has seen value.
 * Respects a session-level dismissal flag.
 *
 * Wave A3 — Auth Architecture
 */

import { useAuth } from '@clerk/nextjs';
import { useState, useEffect, useCallback } from 'react';

const DISMISSED_KEY = 'vcv_auth_dismissed';

export function useAuthPrompt(npi: string | null) {
  const { isSignedIn, isLoaded } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted]     = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setDismissed(sessionStorage.getItem(DISMISSED_KEY) === '1');
    } catch {
      // sessionStorage unavailable (e.g., incognito w/ strict settings)
      setDismissed(false);
    }
  }, []);

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch { /* ignore */ }
    setDismissed(true);
  }, []);

  // Show the prompt when:
  //   - Component has hydrated (avoids SSR mismatch)
  //   - Clerk has loaded (avoids flash before auth state resolves)
  //   - User is NOT signed in
  //   - User has NOT dismissed this session
  //   - An NPI has been resolved (user has seen value)
  const shouldPrompt =
    mounted && isLoaded && !isSignedIn && !dismissed && !!npi;

  return { shouldPrompt, dismiss, npi, isLoaded };
}
