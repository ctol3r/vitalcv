'use client';

import { Button } from '@/components/ui/button';
import {
  GlassModal,
  GlassModalBody,
  GlassModalFooter,
  GlassModalHeader,
  GlassModalTitle,
} from '@/components/ui/glass-modal';
import { PrivacyToggle } from '@/components/ui/privacy-toggle';
import { buildSelectiveDisclosureSnapshot } from '@/lib/trust/ui-truth-integrity';
import type { AuthenticationResponseJSON } from '@simplewebauthn/browser';
import { CheckCircle, Eye, EyeOff, Loader2, Share2, ShieldCheck, XCircle } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { BiometricPrompt } from './BiometricPrompt';
import type { CredentialCardData } from './CredentialCard';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SelectiveDisclosureModalProps {
  open: boolean;
  onClose: () => void;
  credentials: CredentialCardData[];
  /** Optional: verifier-provided request ID to include in the presentation */
  verifierRequestId?: string;
  initialDisclosureLevel?: 'full' | 'proof';
}

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

/* ------------------------------------------------------------------ */
/*  API helpers                                                        */
/* ------------------------------------------------------------------ */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface PresentationResult {
  presentationId: string;
  status: string;
  credentialCount: number;
}

async function submitSelectivePresentation(
  credentialIds: string[],
  assertion: AuthenticationResponseJSON,
  disclosureLevel: 'full' | 'proof',
  verifierRequestId?: string,
): Promise<PresentationResult> {
  const res = await fetch(`${API_BASE}/api/credentials/present/selective`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      credentialIds,
      assertion,
      disclosureMode: disclosureLevel === 'full' ? 'full' : 'sd_jwt',
      verifierRequestId,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as { error?: string }).error ?? `Submission failed (${res.status})`);
  }

  return res.json() as Promise<PresentationResult>;
}

/* ------------------------------------------------------------------ */
/*  SelectiveDisclosureModal                                           */
/* ------------------------------------------------------------------ */

export function SelectiveDisclosureModal({
  open,
  onClose,
  credentials,
  verifierRequestId,
  initialDisclosureLevel = 'full',
}: SelectiveDisclosureModalProps) {
  const [disclosureLevel, setDisclosureLevel] = useState<'full' | 'proof'>(initialDisclosureLevel);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(credentials.map((c) => c.id)),
  );
  const [biometricOpen, setBiometricOpen] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitError, setSubmitError] = useState('');
  const [presentationId, setPresentationId] = useState('');

  const handleBiometricSuccess = useCallback(
    async (assertion: AuthenticationResponseJSON) => {
      setBiometricOpen(false);
      setSubmitState('submitting');
      setSubmitError('');

      try {
        const result = await submitSelectivePresentation(
          Array.from(selected),
          assertion,
          disclosureLevel,
          verifierRequestId,
        );

        setPresentationId(result.presentationId);
        setSubmitState('success');

        // Auto-close after 2.5 s on success
        setTimeout(() => {
          setSubmitState('idle');
          onClose();
        }, 2500);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Submission failed.');
        setSubmitState('error');
      }
    },
    [selected, disclosureLevel, verifierRequestId, onClose],
  );

  const toggleCredential = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectedCredentials = credentials.filter((c) => selected.has(c.id));

  // ── Success overlay ──────────────────────────────────────────────
  if (submitState === 'success') {
    return (
      <GlassModal open={open} onClose={onClose} className="max-w-md">
        <GlassModalBody className="flex flex-col items-center text-center gap-5 py-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--trust-green)]/10 ring-2 ring-[var(--trust-green)]/30">
            <CheckCircle className="h-8 w-8 text-[var(--trust-green)]" />
          </div>
          <div className="space-y-1.5">
            <p className="text-base font-semibold text-[var(--trust-green)]">
              Credentials Shared
            </p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Your presentation was cryptographically signed and delivered.
            </p>
            {presentationId && (
              <p className="text-[10px] font-mono text-muted-foreground/60 break-all mt-2">
                {presentationId}
              </p>
            )}
          </div>
        </GlassModalBody>
      </GlassModal>
    );
  }

  return (
    <GlassModal open={open} onClose={onClose} className="max-w-xl">
      <GlassModalHeader>
        <GlassModalTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5" />
          Share Credentials
        </GlassModalTitle>
      </GlassModalHeader>

      <GlassModalBody className="space-y-5">
        {/* Error banner */}
        {submitState === 'error' && (
          <div className="flex items-start gap-2.5 rounded-xl bg-[var(--trust-red)]/8 border border-[var(--trust-red)]/20 px-3 py-2.5">
            <XCircle className="h-4 w-4 text-[var(--trust-red)] shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--trust-red)]">{submitError}</p>
          </div>
        )}

        {/* Disclosure level toggle */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Disclosure Level
          </p>
          <PrivacyToggle value={disclosureLevel} onChange={setDisclosureLevel} />
          <p className="text-xs text-muted-foreground">
            {disclosureLevel === 'full'
              ? 'The verifier will see full credential details including issuer, dates, and identifiers.'
              : 'The verifier will only see proof that you hold valid credentials — no specifics are revealed.'}
          </p>
        </div>

        {/* Credential selection */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Select Credentials to Share ({selected.size} of {credentials.length})
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {credentials.map((cred) => {
              const isSelected = selected.has(cred.id);
              const proofSnapshot = buildSelectiveDisclosureSnapshot(cred, 'proof');
              return (
                <button
                  key={cred.id}
                  type="button"
                  onClick={() => toggleCredential(cred.id)}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                    isSelected
                      ? 'bg-primary/5 border border-primary/20'
                      : 'bg-muted/30 border border-transparent hover:border-border/40'
                  }`}
                >
                  <div className="shrink-0">
                    {isSelected ? (
                      <Eye className="h-4 w-4 text-primary" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{cred.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{cred.issuer}</p>
                  </div>
                  <span className={proofSnapshot.receiptBacked
                    ? 'rounded-full border border-[var(--trust-green)]/20 bg-[var(--trust-green)]/8 px-2.5 py-1 text-[10px] font-semibold text-[var(--trust-green)]'
                    : 'rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground'}
                  >
                    {proofSnapshot.receiptBacked ? 'Receipt-backed L3' : `${cred.claimLevel} attached`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Preview of what verifier sees */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Verifier Preview
          </p>
          <div className="rounded-xl bg-muted/30 border border-border/40 p-3 space-y-2">
            {selectedCredentials.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                No credentials selected
              </p>
            ) : (
              selectedCredentials.map((cred) => {
                const snapshot = buildSelectiveDisclosureSnapshot(cred, disclosureLevel);
                return (
                  <div key={cred.id} className="rounded-xl border border-border/40 bg-background/40 p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5 text-[var(--trust-green)]" />
                        {cred.name}
                      </span>
                      <span className={snapshot.receiptBacked ? 'text-xs text-[var(--trust-green)]' : 'text-xs text-amber-600'}>
                        {snapshot.receiptBacked ? 'Receipt attached' : 'Receipt missing'}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Visible fields
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {snapshot.visibleFields.map((field) => (
                            <span
                              key={field}
                              className="rounded-full border border-[var(--trust-green)]/20 bg-[var(--trust-green)]/8 px-2.5 py-1 text-xs text-foreground"
                            >
                              {field}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Locked fields
                        </p>
                        {snapshot.lockedFields.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {snapshot.lockedFields.map((field) => (
                              <span
                                key={field}
                                className="rounded-full border border-border/60 bg-muted/50 px-2.5 py-1 text-xs text-foreground/80 blur-[2px]"
                              >
                                {field}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No fields are locked in full disclosure mode.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </GlassModalBody>

      <GlassModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={submitState === 'submitting'}>
          Cancel
        </Button>
        <Button
          disabled={selected.size === 0 || submitState === 'submitting'}
          onClick={() => setBiometricOpen(true)}
        >
          {submitState === 'submitting' ? (
            <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Submitting…</>
          ) : (
            <><Share2 className="h-4 w-4 mr-1.5" />Share {selected.size} Credential{selected.size !== 1 ? 's' : ''}</>
          )}
        </Button>
      </GlassModalFooter>

      {/* Biometric holder-binding confirmation */}
      <BiometricPrompt
        open={biometricOpen}
        onClose={() => setBiometricOpen(false)}
        onSuccess={handleBiometricSuccess}
        credentialCount={selected.size}
      />
    </GlassModal>
  );
}
