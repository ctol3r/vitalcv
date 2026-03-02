'use client';

import { Button } from '@/components/ui/button';
import { ClaimBadge } from '@/components/ui/claim-badge';
import {
  GlassModal,
  GlassModalBody,
  GlassModalFooter,
  GlassModalHeader,
  GlassModalTitle,
} from '@/components/ui/glass-modal';
import { PrivacyToggle } from '@/components/ui/privacy-toggle';
import type { AuthenticationResponseJSON } from '@simplewebauthn/browser';
import { Eye, EyeOff, Share2, ShieldCheck } from 'lucide-react';
import { useCallback, useState } from 'react';
import { BiometricPrompt } from './BiometricPrompt';
import type { CredentialCardData } from './CredentialCard';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface SelectiveDisclosureModalProps {
  open: boolean;
  onClose: () => void;
  credentials: CredentialCardData[];
}

/* ------------------------------------------------------------------ */
/*  SelectiveDisclosureModal                                           */
/* ------------------------------------------------------------------ */

export function SelectiveDisclosureModal({
  open,
  onClose,
  credentials,
}: SelectiveDisclosureModalProps) {
  const [disclosureLevel, setDisclosureLevel] = useState<'full' | 'proof'>('full');
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(credentials.map((c) => c.id)),
  );
  const [biometricOpen, setBiometricOpen] = useState(false);

  const handleBiometricSuccess = useCallback(
    (_assertion: AuthenticationResponseJSON) => {
      // TODO: Attach assertion to the SD-JWT presentation payload
      // and submit to the verifier endpoint.
      setBiometricOpen(false);
      onClose();
    },
    [onClose],
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

  return (
    <GlassModal open={open} onClose={onClose} className="max-w-xl">
      <GlassModalHeader>
        <GlassModalTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5" />
          Share Credentials
        </GlassModalTitle>
      </GlassModalHeader>

      <GlassModalBody className="space-y-5">
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
                  <ClaimBadge level={cred.claimLevel} />
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
              selectedCredentials.map((cred) => (
                <div
                  key={cred.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-[var(--trust-green)]" />
                    {disclosureLevel === 'full'
                      ? cred.name
                      : cred.type.replace(/_/g, ' ')}
                  </span>
                  {disclosureLevel === 'full' ? (
                    <span className="text-xs text-muted-foreground">{cred.issuer}</span>
                  ) : (
                    <span className="text-xs text-[var(--trust-green)]">Verified</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </GlassModalBody>

      <GlassModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={selected.size === 0}
          onClick={() => setBiometricOpen(true)}
        >
          <Share2 className="h-4 w-4 mr-1.5" />
          Share {selected.size} Credential{selected.size !== 1 ? 's' : ''}
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
