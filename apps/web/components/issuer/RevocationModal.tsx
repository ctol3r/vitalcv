'use client';

import { useState } from 'react';
import { AlertTriangle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  GlassModal,
  GlassModalHeader,
  GlassModalTitle,
  GlassModalBody,
  GlassModalFooter,
} from '@/components/ui/glass-modal';
import type { CredentialRecord } from './issuer-types';
import { REVOCATION_REASONS, CREDENTIAL_TYPE_LABELS, type CredentialType } from './issuer-types';

// ── Muted terracotta design tokens ────────────────────────────────────────
const TC = {
  bg:     'oklch(0.52 0.11 30 / 0.07)',
  border: 'oklch(0.52 0.11 30 / 0.28)',
  text:   'oklch(0.52 0.11 30)',
  ring:   'oklch(0.52 0.11 30 / 0.35)',
} as const;

// ── Props ─────────────────────────────────────────────────────────────────

interface RevocationModalProps {
  open:       boolean;
  onClose:    () => void;
  credential: CredentialRecord | null;
  onRevoke:   (credentialId: string, reason: string, context: string) => void;
  loading?:   boolean;
}

// ── Component ─────────────────────────────────────────────────────────────

export function RevocationModal({
  open, onClose, credential, onRevoke, loading,
}: RevocationModalProps) {
  const [reason,      setReason]      = useState('');
  const [context,     setContext]     = useState('');
  const [confirmText, setConfirmText] = useState('');

  if (!credential) return null;

  const typeLabel =
    CREDENTIAL_TYPE_LABELS[credential.credentialType as CredentialType] ??
    credential.credentialType;

  const confirmed = confirmText === 'REVOKE';
  const canRevoke = Boolean(reason) && confirmed && !loading;

  const handleRevoke = () => {
    if (!canRevoke) return;
    onRevoke(credential.id, reason, context.trim());
    setReason('');
    setContext('');
    setConfirmText('');
  };

  const handleClose = () => {
    setReason('');
    setContext('');
    setConfirmText('');
    onClose();
  };

  return (
    <GlassModal open={open} onClose={handleClose} className="max-w-lg">
      {/* Terracotta top-border accent */}
      <div
        className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl"
        style={{ background: TC.text }}
        aria-hidden="true"
      />

      <GlassModalHeader>
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: TC.bg, border: `1px solid ${TC.border}` }}
          >
            <XCircle className="h-4 w-4" style={{ color: TC.text }} />
          </div>
          <div>
            <GlassModalTitle style={{ color: TC.text }}>
              Revoke Credential
            </GlassModalTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Irreversible · Network-wide propagation
            </p>
          </div>
        </div>
      </GlassModalHeader>

      <GlassModalBody className="space-y-5">
        {/* ── Warning banner ──────────────────────────────────────── */}
        <div
          className="flex items-start gap-3 rounded-xl p-3.5"
          style={{ background: TC.bg, border: `1px solid ${TC.border}` }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: TC.text }} />
          <div className="space-y-1 text-xs" style={{ color: TC.text }}>
            <p className="font-semibold">
              This action is immediate and propagates across the VitalCV network.
            </p>
            <p className="opacity-80">
              All employers and verifiers holding active references to this credential
              will receive an immediate{' '}
              <code className="font-mono text-[10px]">BIDIRECTIONAL_FLAG_INVALID</code>{' '}
              signal.
            </p>
          </div>
        </div>

        {/* ── Credential info ─────────────────────────────────────── */}
        <div className="space-y-2 rounded-xl border border-[var(--glass-border)] bg-muted/20 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{typeLabel}</span>
            <Badge
              variant="outline"
              className="text-[10px]"
              style={{ color: TC.text, borderColor: TC.border }}
            >
              Currently Active
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{credential.subjectName}</span>
            {' — '}
            <span className="font-mono">{credential.subjectNpi}</span>
          </p>
        </div>

        {/* ── Revocation reason ───────────────────────────────────── */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Revocation Reason <span style={{ color: TC.text }}>*</span>
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl border border-[var(--glass-border)] bg-background px-3 py-2 text-sm focus:outline-none transition-colors"
            style={reason ? { borderColor: TC.border } : undefined}
          >
            <option value="">Select a reason…</option>
            {REVOCATION_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* ── Additional context ──────────────────────────────────── */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Additional Context{' '}
            <span className="font-normal normal-case">(optional)</span>
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Provide any additional details about this revocation…"
            rows={2}
            className="w-full resize-none rounded-xl border border-[var(--glass-border)] bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[var(--glass-border)]"
          />
        </div>

        {/* ── REVOKE confirmation gate ─────────────────────────────── */}
        <div
          className="space-y-2.5 rounded-xl p-4"
          style={{ background: TC.bg, border: `1px solid ${TC.border}` }}
        >
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: TC.text }}>
            Type <span className="font-mono">REVOKE</span> to confirm
          </label>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="REVOKE"
            className="bg-background/60 font-mono placeholder:opacity-30"
            style={{
              borderColor: confirmed ? TC.text : TC.border,
              boxShadow:   confirmed ? `0 0 0 2px ${TC.ring}` : undefined,
            }}
            autoComplete="off"
            spellCheck={false}
          />
          {confirmText.length > 0 && !confirmed && (
            <p className="text-[11px]" style={{ color: TC.text }}>
              Must match exactly:{' '}
              <span className="font-mono font-bold">REVOKE</span>
            </p>
          )}
        </div>
      </GlassModalBody>

      <GlassModalFooter>
        <Button variant="outline" onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleRevoke}
          disabled={!canRevoke}
          style={canRevoke ? {
            background:  TC.text,
            borderColor: TC.border,
            color:       '#fff',
          } : undefined}
        >
          {loading ? 'Revoking…' : 'Confirm Revocation'}
        </Button>
      </GlassModalFooter>
    </GlassModal>
  );
}
