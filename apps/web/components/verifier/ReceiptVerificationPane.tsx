'use client';

/**
 * ReceiptVerificationPane.tsx
 *
 * Shows receipt metadata and a "Verify signature" button that POSTs
 * the receipt JWT to /api/receipts/verify. Renders inline status.
 */

import { useState } from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
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
    <div className="border border-gray-200 rounded overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          Receipt
        </span>
        {status === 'verified' && (
          <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            Signature valid
          </span>
        )}
        {status === 'failed' && (
          <span className="flex items-center gap-1 text-xs text-red-700 font-medium">
            <XCircle className="w-3.5 h-3.5" />
            Invalid
          </span>
        )}
      </div>

      {/* Fields */}
      <div className="divide-y divide-gray-100">
        <Field label="receipt_id" value={receiptId} mono />
        <Field label="source" value={source} />
        <Field label="checked_at" value={checkedAt} mono />
        <Field label="signed_payload.algorithm" value={algorithm} mono />
        <Field label="signing_key_id" value={signingKeyId} mono />
      </div>

      {/* Verify action */}
      <div className="px-3 py-2.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-2">
        <button
          onClick={handleVerify}
          disabled={!jwt || status === 'loading' || status === 'verified'}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors',
            !jwt || status === 'verified'
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-black text-white hover:bg-gray-800 cursor-pointer',
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
          <span className="text-[10px] text-gray-400">JWT not available in this view</span>
        )}

        {status === 'failed' && errorMsg && (
          <span className="text-[10px] text-red-600 truncate max-w-[200px]" title={errorMsg}>
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
      <span className="text-[10px] text-gray-400 w-40 flex-shrink-0 pt-0.5 font-mono">{label}</span>
      <span
        className={cn(
          'text-xs text-gray-800 break-all',
          mono ? 'font-mono' : 'font-sans',
        )}
      >
        {value || '—'}
      </span>
    </div>
  );
}
