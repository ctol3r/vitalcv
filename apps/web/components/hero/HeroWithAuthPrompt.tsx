'use client';

/**
 * HeroWithAuthPrompt — wraps LiveTrustConsole with post-value auth prompt
 *
 * Sequence:
 *   1. User enters NPI → LiveTrustConsole runs pipeline
 *   2. Preview appears → onPreviewReady fires with NPI + name
 *   3. useAuthPrompt detects: user is anon, hasn't dismissed → shouldPrompt = true
 *   4. CreateAccountModal waits until the preview is readable before appearing
 *   5. User can claim or dismiss; anonymous flow continues either way
 *
 * Wave A3 — Auth Architecture
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { LiveTrustConsole } from './LiveTrustConsole';
import { CreateAccountModal } from '@/components/auth/CreateAccountModal';
import { useAuthPrompt } from '@/hooks/useAuthPrompt';
import { CLERK_PROVIDER_ENABLED } from '@/lib/auth/clerkConfig';

function HeroWithPromptShell() {
  const [resolvedNpi,  setResolvedNpi]  = useState<string | null>(null);
  const [displayName,  setDisplayName]  = useState('Provider');
  const [showModal,    setShowModal]    = useState(false);
  const modalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { shouldPrompt, dismiss } = useAuthPrompt(resolvedNpi);

  useEffect(() => {
    return () => {
      if (modalTimer.current) {
        clearTimeout(modalTimer.current);
      }
    };
  }, []);

  const handlePreviewReady = useCallback((npi: string, name: string) => {
    if (modalTimer.current) {
      clearTimeout(modalTimer.current);
    }
    setResolvedNpi(npi);
    setDisplayName(name);
    setShowModal(false);
    modalTimer.current = setTimeout(() => setShowModal(true), 1200);
  }, []);

  const handleDismiss = useCallback(() => {
    if (modalTimer.current) {
      clearTimeout(modalTimer.current);
    }
    dismiss();
    setShowModal(false);
  }, [dismiss]);

  return (
    <>
      <LiveTrustConsole onPreviewReady={handlePreviewReady} />

      {showModal && shouldPrompt && resolvedNpi && (
        <CreateAccountModal
          npi={resolvedNpi}
          displayName={displayName}
          onDismiss={handleDismiss}
        />
      )}
    </>
  );
}

export function HeroWithAuthPrompt() {
  if (!CLERK_PROVIDER_ENABLED) {
    return <LiveTrustConsole />;
  }

  return <HeroWithPromptShell />;
}
