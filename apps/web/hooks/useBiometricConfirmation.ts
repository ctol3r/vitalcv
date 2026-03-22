'use client';

/**
 * useBiometricConfirmation — WebAuthn assertion hook
 *
 * Orchestrates the full WebAuthn authentication flow:
 *   1. Fetch challenge options from /api/webauthn/authenticate-options
 *   2. Pass options to @simplewebauthn/browser startAuthentication()
 *   3. Post the assertion to /api/webauthn/verify-assertion
 *   4. Return true if verified
 *
 * Gracefully degrades: if WebAuthn is not supported by the browser,
 * returns true with a console.warn so the caller flow is never hard-blocked.
 */

import { startAuthentication } from '@simplewebauthn/browser';

export interface BiometricResult {
  verified: boolean;
  devBypass?: boolean;
  error?: string;
}

export async function confirmWithBiometric(): Promise<BiometricResult> {
  // Graceful degradation — WebAuthn not supported
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    console.warn('[useBiometricConfirmation] WebAuthn not supported — bypassing biometric gate');
    return { verified: true };
  }

  try {
    // Step 1 — fetch challenge
    const optRes = await fetch('/api/webauthn/authenticate-options');
    if (!optRes.ok) {
      return { verified: false, error: 'Failed to fetch WebAuthn challenge.' };
    }
    const { options, challengeId } = await optRes.json() as {
      options: Parameters<typeof startAuthentication>[0];
      challengeId: string;
    };

    // Step 2 — prompt biometric
    // Backend returns raw WebAuthn options object; cast to satisfy the typed API
    const assertion = await startAuthentication({ optionsJSON: options as any });

    // Step 3 — verify
    const verRes = await fetch('/api/webauthn/verify-assertion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, assertion }),
    });

    if (!verRes.ok) {
      const body = await verRes.json().catch(() => ({})) as { error?: string };
      return { verified: false, error: body.error ?? 'Biometric verification failed.' };
    }

    const result = await verRes.json() as BiometricResult;
    return result;
  } catch (err: unknown) {
    // User cancelled or device error — treat as unverified
    const message = err instanceof Error ? err.message : String(err);
    // NotAllowedError = user dismissed the prompt; don't surface as an error
    if (message.includes('NotAllowedError') || message.includes('not allowed')) {
      return { verified: false, error: 'Biometric prompt dismissed.' };
    }
    console.warn('[useBiometricConfirmation] WebAuthn error:', message);
    return { verified: false, error: message };
  }
}

/**
 * React hook wrapper for confirmWithBiometric.
 * Returns a confirm function + loading/error state.
 */
import { useState, useCallback } from 'react';

export function useBiometricConfirmation() {
  const [isConfirming, setIsConfirming] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);

  const confirm = useCallback(async (): Promise<boolean> => {
    setIsConfirming(true);
    setBiometricError(null);
    try {
      const result = await confirmWithBiometric();
      if (!result.verified) {
        setBiometricError(result.error ?? 'Biometric verification failed.');
      }
      return result.verified;
    } finally {
      setIsConfirming(false);
    }
  }, []);

  return { confirm, isConfirming, biometricError };
}
