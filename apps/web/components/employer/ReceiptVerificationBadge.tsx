'use client';
import { useState } from 'react';

interface ReceiptVerificationBadgeProps {
  token?: string;
}

type VerifyStatus = 'idle' | 'verifying' | 'verified' | 'failed';

export default function ReceiptVerificationBadge({ token }: ReceiptVerificationBadgeProps) {
  const [status, setStatus] = useState<VerifyStatus>('idle');
  const [error, setError] = useState<string | undefined>();
  const [payload, setPayload] = useState<Record<string, unknown> | undefined>();

  async function handleVerify() {
    if (!token) return;
    setStatus('verifying');
    setError(undefined);
    try {
      const res = await fetch('/api/receipts/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.verified) {
        setPayload(data.payload);
        setStatus('verified');
      } else {
        setError(data.error ?? 'Signature invalid');
        setStatus('failed');
      }
    } catch {
      setError('Network error during verification');
      setStatus('failed');
    }
  }

  return (
    <div className="p-4 border rounded-lg space-y-3">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-sm">Receipt Integrity</span>
        {status === 'verified' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
            ✓ Cryptographically Verified
          </span>
        )}
        {status === 'failed' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
            ✗ Tampered / Signature Failed
          </span>
        )}
        {status === 'idle' && token && (
          <button
            onClick={handleVerify}
            className="text-xs px-3 py-1 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
          >
            Verify Receipt
          </button>
        )}
        {status === 'verifying' && (
          <span className="text-xs text-muted-foreground">Verifying…</span>
        )}
        {!token && (
          <span className="text-xs text-muted-foreground">No signed receipt attached</span>
        )}
      </div>
      {status === 'failed' && error && (
        <p className="text-xs text-red-600 font-mono bg-red-50 p-2 rounded">{error}</p>
      )}
      {status === 'verified' && payload && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View verified payload</summary>
          <pre className="mt-2 p-2 bg-muted rounded overflow-auto text-xs">{JSON.stringify(payload, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
