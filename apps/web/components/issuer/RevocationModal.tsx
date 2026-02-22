'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  GlassModal,
  GlassModalHeader,
  GlassModalTitle,
  GlassModalBody,
  GlassModalFooter,
} from '@/components/ui/glass-modal';
import { AlertTriangle, XCircle } from 'lucide-react';
import { useState } from 'react';

import type { CredentialRecord } from './issuer-types';
import {
  REVOCATION_REASONS,
  CREDENTIAL_TYPE_LABELS,
  type CredentialType,
} from './issuer-types';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface RevocationModalProps {
  open: boolean;
  onClose: () => void;
  credential: CredentialRecord | null;
  onRevoke: (credentialId: string, reason: string, context: string) => void;
  loading?: boolean;
}

/* ------------------------------------------------------------------ */
/*  RevocationModal — reason + context + confirm                       */
/* ------------------------------------------------------------------ */

export function RevocationModal({
  open,
  onClose,
  credential,
  onRevoke,
  loading,
}: RevocationModalProps) {
  const [reason, setReason] = useState('');
  const [context, setContext] = useState('');

  if (!credential) return null;

  const typeLabel =
    CREDENTIAL_TYPE_LABELS[credential.credentialType as CredentialType] ||
    credential.credentialType;

  const handleRevoke = () => {
    if (!reason) return;
    onRevoke(credential.id, reason, context.trim());
    setReason('');
    setContext('');
  };

  return (
    <GlassModal open={open} onClose={onClose} className="max-w-lg">
      <GlassModalHeader>
        <div className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-destructive" />
          <GlassModalTitle>Revoke Credential</GlassModalTitle>
        </div>
      </GlassModalHeader>

      <GlassModalBody className="space-y-4">
        {/* Warning */}
        <div className="flex items-start gap-3 rounded-xl bg-destructive/5 border border-destructive/20 p-3">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="text-xs text-destructive/80 space-y-1">
            <p className="font-medium text-destructive">
              This action will immediately propagate across the VitalCV network.
            </p>
            <p>
              All employers and verifiers with active references to this credential
              will receive real-time status updates.
            </p>
          </div>
        </div>

        {/* Credential info */}
        <div className="rounded-xl bg-muted/20 p-3 border border-[var(--glass-border)] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{typeLabel}</span>
            <Badge
              variant="outline"
              className="text-[10px] text-[var(--trust-green)] border-[var(--trust-green)]/20"
            >
              Currently Active
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{credential.subjectName}</span>
            {' — '}
            <span className="font-mono">{credential.subjectNpi}</span>
          </div>
        </div>

        {/* Reason select */}
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Revocation Reason
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl border border-[var(--glass-border)] bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-destructive/30"
          >
            <option value="">Select a reason...</option>
            {REVOCATION_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Additional context */}
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Additional Context (optional)
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Provide any additional details about this revocation..."
            rows={3}
            className="w-full rounded-xl border border-[var(--glass-border)] bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-destructive/30 placeholder:text-muted-foreground/60"
          />
        </div>
      </GlassModalBody>

      <GlassModalFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={handleRevoke}
          disabled={!reason || loading}
        >
          {loading ? 'Revoking...' : 'Confirm Revocation'}
        </Button>
      </GlassModalFooter>
    </GlassModal>
  );
}
