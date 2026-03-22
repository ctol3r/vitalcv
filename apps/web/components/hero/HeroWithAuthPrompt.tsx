'use client';

/**
 * HeroWithAuthPrompt — wraps LiveTrustConsole with post-value auth prompt
 *
 * Sequence:
 *   1. User enters NPI → LiveTrustConsole runs pipeline
 *   2. Preview appears → onPreviewReady fires with NPI + name
 *   3. useAuthPrompt detects: user is anon, hasn't dismissed → shouldPrompt = true
 *   4. CreateAccountModal slides up (600ms delay — let user read the preview first)
 *   5. User can claim or dismiss; anonymous flow continues either way
 *
 * Wave A3 — Auth Architecture
 */

import { useCallback, useState } from 'react';
import { LiveTrustConsole } from './LiveTrustConsole';
import { CreateAccountModal } from '@/components/auth/CreateAccountModal';
import { useAuthPrompt } from '@/hooks/useAuthPrompt';

export function HeroWithAuthPrompt() {
  const [resolvedNpi,  setResolvedNpi]  = useState<string | null>(null);
  const [displayName,  setDisplayName]  = useState('Provider');
  const [showModal,    setShowModal]    = useState(false);

  const { shouldPrompt, dismiss } = useAuthPrompt(resolvedNpi);

  const handlePreviewReady = useCallback((npi: string, name: string) => {
    setResolvedNpi(npi);
    setDisplayName(name);
    // Short delay — let the user read the preview before the modal appears
    setTimeout(() => setShowModal(true), 700);
  }, []);

  const handleDismiss = useCallback(() => {
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
