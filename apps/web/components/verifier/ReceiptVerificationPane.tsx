'use client';

/**
 * ReceiptVerificationPane.tsx
 *
 * Shows receipt metadata and a "Verify signature" button that POSTs
 * the receipt JWT to /api/receipts/verify. Renders inline status.
 */

import { useState } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ReceiptVerificationPaneProps {
  receiptId: string;
  source: string;
  checkedAt: string;
  /** algorithm from signed_payload — e.g. "ES256" */
  algorithm: string;
  /** signing key ID from JWKS */
  signingKeyId: string;
  /** The raw JWT to verify. If absent, button is disabled. */
  jwt?: string | null;
}

type VerifyStatus = 'idle' | 'loading' | 'verified' | 'failed';

export function ReceiptVerificationPane({
  receiptId,
  source,
  checkedAt,
  algorithm,
  signingKeyId,
  jwt,
}: ReceiptVerificationPaneProps) {
  const [status, setStatus] = useState<VerifyStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleVerify() {
    if (!jwt) return;
    setStatus('loading');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/receipts/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: jwt }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.verified === true) {
        setStatus('verified');
      } else {
        setStatus('failed');
        setErrorMsg(data.error ?? 'Signature invalid or payload tampered.');
      }
    } catch (err) {
      setStatus('failed');
      setErrorMsg(err instanceof Error ? err.message : 'Network error.');
    }
  }

  return (
    <div className="mz mz-card overflow-hidden">
      {/* Header */}
      <div className="bg-[var(--paper-2)] border-b border-[var(--rule)] px-3 py-2 flex items-center justify-between">
        <span className="mz-mono text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-400)]">
          Receipt
        </span>
        {status === 'verified' && (
          <span className="mz-chip mz-chip-ok">
            <span className="mz-gl" aria-hidden="true" />
            Signature valid
          </span>
        )}
        {status === 'failed' && (
          <span className="mz-chip mz-chip-p0">
            <span className="mz-gl" aria-hidden="true" />
            Invalid
          </span>
        )}
      </div>

      {/* Fields */}
      <div className="divide-y divide-[var(--rule-soft)]">
        <Field label="receipt_id" value={receiptId} mono />
        <Field label="source" value={source} />
        <Field label="checked_at" value={checkedAt} mono />
        <Field label="signed_payload.algorithm" value={algorithm} mono />
        <Field label="signing_key_id" value={signingKeyId} mono />
      </div>

      {/* Verify action */}
      <div className="px-3 py-2.5 bg-[var(--paper-2)] border-t border-[var(--rule)] flex items-center justify-between gap-2">
        <button
          onClick={handleVerify}
          disabled={!jwt || status === 'loading' || status === 'verified'}
          className={cn(
            'mz-btn mz-btn-sm',
            (!jwt || status === 'verified') && 'opacity-45 cursor-not-allowed',
          )}
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Verifying…
            </>
          ) : status === 'verified' ? (
            <>
              <CheckCircle className="w-3 h-3" />
              Signature valid
            </>
          ) : (
            'Verify signature'
          )}
        </button>

        {!jwt && (
          <span className="mz-mono text-[10px] text-[var(--ink-400)]">JWT not available in this view</span>
        )}

        {status === 'failed' && errorMsg && (
          <span className="mz-mono text-[10px] text-[var(--p0)] truncate max-w-[200px]" title={errorMsg}>
            {errorMsg}
          </span>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 px-3 py-2">
      <span className="mz-mono text-[10px] text-[var(--ink-400)] w-40 flex-shrink-0 pt-0.5">{label}</span>
      <span
        className={cn(
          'text-xs text-[var(--ink-800)] break-all',
          mono ? 'mz-mono' : 'font-sans',
        )}
      >
        {value || '—'}
      </span>
    </div>
  );
}
