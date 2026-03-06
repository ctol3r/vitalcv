'use client';

import { Button } from '@/components/ui/button';
import {
  GlassModal,
  GlassModalBody,
  GlassModalFooter,
  GlassModalHeader,
  GlassModalTitle,
} from '@/components/ui/glass-modal';
import {
  startAuthentication,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { AlertCircle, Fingerprint, Loader2, ShieldCheck } from 'lucide-react';
import { useCallback, useState } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type PromptState = 'idle' | 'authenticating' | 'success' | 'error';

interface BiometricPromptProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (assertion: AuthenticationResponseJSON) => void;
  credentialCount: number;
  verifierName?: string;
}

/* ------------------------------------------------------------------ */
/*  Challenge fetcher — real /api/webauthn/authenticate-options        */
/* ------------------------------------------------------------------ */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface WebAuthnOptionsResponse {
  options: PublicKeyCredentialRequestOptionsJSON;
  challengeId: string;
}

async function fetchAuthenticationOptions(): Promise<WebAuthnOptionsResponse> {
  const res = await fetch(`${API_BASE}/api/webauthn/authenticate-options`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`Failed to fetch WebAuthn options: ${res.status}`);
  return res.json() as Promise<WebAuthnOptionsResponse>;
}

/* ------------------------------------------------------------------ */
/*  BiometricPrompt                                                    */
/* ------------------------------------------------------------------ */

export function BiometricPrompt({
  open,
  onClose,
  onSuccess,
  credentialCount,
  verifierName,
}: BiometricPromptProps) {
  const [state, setState] = useState<PromptState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleAuthenticate = useCallback(async () => {
    setState('authenticating');
    setErrorMessage('');

    try {
      // Fetch a fresh server-signed challenge
      const { options } = await fetchAuthenticationOptions();
      const assertion = await startAuthentication({ optionsJSON: options });

      setState('success');

      // Auto-complete after brief success display
      setTimeout(() => {
        onSuccess(assertion);
      }, 1500);
    } catch (err) {
      setState('error');

      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setErrorMessage(
            'Biometric verification was cancelled. You can try again when ready.',
          );
        } else if (err.name === 'NotSupportedError') {
          setErrorMessage(
            'This device does not support biometric authentication. Please use a device with FaceID, TouchID, or Windows Hello.',
          );
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage('An unexpected error occurred during biometric verification.');
      }
    }
  }, [onSuccess]);

  const handleClose = useCallback(() => {
    if (state === 'authenticating') return; // Don't close during auth
    setState('idle');
    setErrorMessage('');
    onClose();
  }, [state, onClose]);

  return (
    <GlassModal open={open} onClose={handleClose} className="max-w-md">
      <GlassModalHeader>
        <GlassModalTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[var(--trust-green)]" />
          Biometric Verification
        </GlassModalTitle>
      </GlassModalHeader>

      <GlassModalBody className="space-y-5">
        {/* ── Idle ─────────────────────────────────────────── */}
        {state === 'idle' && (
          <div className="flex flex-col items-center text-center space-y-4 py-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--trust-green)]/10 ring-1 ring-[var(--trust-green)]/20">
              <Fingerprint className="h-8 w-8 text-[var(--trust-green)]" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">
                Hardware-bound verification required
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
                Your device&apos;s secure enclave will cryptographically sign
                {credentialCount === 1
                  ? ' this credential presentation'
                  : ` these ${credentialCount} credential presentations`}
                {verifierName ? ` for ${verifierName}` : ''}.
                This proves you are the legitimate holder.
              </p>
            </div>
          </div>
        )}

        {/* ── Authenticating ───────────────────────────────── */}
        {state === 'authenticating' && (
          <div className="flex flex-col items-center text-center space-y-4 py-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20 animate-pulse">
              <Fingerprint className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Waiting for biometric confirmation…
              </p>
              <p className="text-xs text-muted-foreground">
                Use FaceID, TouchID, or your device&apos;s biometric sensor to proceed.
              </p>
            </div>
          </div>
        )}

        {/* ── Success ──────────────────────────────────────── */}
        {state === 'success' && (
          <div className="flex flex-col items-center text-center space-y-4 py-2 animate-trust-band-rise">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--trust-green)]/15 ring-2 ring-[var(--trust-green)]/30">
              <ShieldCheck className="h-8 w-8 text-[var(--trust-green)]" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-[var(--trust-green)]">
                Hardware Enclave Verified
              </p>
              <p className="text-xs text-muted-foreground">
                Cryptographic keys unlocked via biometrics.
              </p>
            </div>
            {/* Trust badge strip */}
            <div className="flex items-center gap-1.5 rounded-full bg-[var(--trust-green)]/8 px-3 py-1 text-[10px] font-medium tracking-wider text-[var(--trust-green)] uppercase">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--trust-green)]" />
              Holder binding confirmed
            </div>
          </div>
        )}

        {/* ── Error ────────────────────────────────────────── */}
        {state === 'error' && (
          <div className="flex flex-col items-center text-center space-y-4 py-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--trust-red)]/10 ring-1 ring-[var(--trust-red)]/20">
              <AlertCircle className="h-8 w-8 text-[var(--trust-red)]" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-[var(--trust-red)]">
                Verification Failed
              </p>
              <p className="text-xs text-muted-foreground max-w-xs">
                {errorMessage}
              </p>
            </div>
          </div>
        )}
      </GlassModalBody>

      <GlassModalFooter>
        {state === 'idle' && (
          <>
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleAuthenticate}>
              <Fingerprint className="h-4 w-4 mr-1.5" />
              Verify with Biometrics
            </Button>
          </>
        )}
        {state === 'error' && (
          <>
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleAuthenticate}>
              Try Again
            </Button>
          </>
        )}
        {state === 'success' && (
          <p className="text-xs text-muted-foreground w-full text-center">
            Releasing credentials…
          </p>
        )}
      </GlassModalFooter>
    </GlassModal>
  );
}
