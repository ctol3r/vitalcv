'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { VerifierOnboardingGuide } from '@/components/verifier/VerifierOnboardingGuide';

interface VerifyResult {
  verified: boolean;
  algorithm?: string;
  key_id?: string;
  issuer?: string;
  subject?: string;
  jti?: string;
  issued_at?: string;
  expires_at?: string;
  vcv?: Record<string, unknown>;
  error?: string;
}

export default function VerifyPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [receiptIdInput, setReceiptIdInput] = useState('');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    if (!token.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/receipts/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = (await res.json()) as VerifyResult;
      setResult(data);
    } catch {
      setResult({ verified: false, error: 'Network error — could not reach verification endpoint.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      {/* Verifier onboarding guide — collapsed by default */}
      <div className="mb-8">
        <VerifierOnboardingGuide collapsible compact={false} />
        <div className="mt-1.5 text-right">
          <Link
            href="/verify/guide"
            className="text-[11px] text-blue-500 hover:text-blue-700 underline underline-offset-2"
          >
            Full guide + offline verification →
          </Link>
        </div>
      </div>

      <h1 className="mb-2 text-3xl font-bold tracking-tight">Credential Verifier</h1>
      <p className="mb-8 text-gray-500">
        Paste a VitalCV JWT to verify its cryptographic signature and inspect its claims.
      </p>

      <div className="mb-4">
        <label htmlFor="token-input" className="mb-2 block text-sm font-medium text-gray-700">
          JWT Token
        </label>
        <textarea
          id="token-input"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          rows={6}
          placeholder="eyJhbGciOiJFUzI1NiIsImtpZCI6Ii4uLiJ9..."
          className="w-full rounded-lg border border-gray-300 px-4 py-3 font-mono text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <button
        onClick={handleVerify}
        disabled={loading || !token.trim()}
        className="mb-8 inline-flex items-center rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Verifying…' : 'Verify'}
      </button>

      <ReceiptReplaySection
        receiptIdInput={receiptIdInput}
        setReceiptIdInput={setReceiptIdInput}
        onNavigate={() => {
          const id = receiptIdInput.trim();
          if (id) router.push(`/verify/receipt/${encodeURIComponent(id)}`);
        }}
      />

      {result !== null && (
        <div
          className={`rounded-lg border p-5 ${
            result.verified
              ? 'border-green-200 bg-green-50'
              : 'border-red-200 bg-red-50'
          }`}
        >
          <div className="mb-4 flex items-center gap-2">
            <span
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold ${
                result.verified ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
              }`}
            >
              {result.verified ? '✓' : '✗'}
            </span>
            <span className={`font-semibold ${result.verified ? 'text-green-800' : 'text-red-800'}`}>
              {result.verified ? 'Valid credential' : 'Invalid credential'}
            </span>
          </div>

          {result.error && (
            <p className="mb-2 text-sm text-red-700">
              <strong>Error:</strong> {result.error}
            </p>
          )}

          {result.verified && (
            <dl className="space-y-2 text-sm">
              {result.algorithm && (
                <Row label="Algorithm" value={result.algorithm} />
              )}
              {result.key_id && (
                <Row label="Key ID" value={result.key_id} mono />
              )}
              {result.issuer && (
                <Row label="Issuer" value={result.issuer} />
              )}
              {result.subject && (
                <Row label="Subject" value={result.subject} mono />
              )}
              {result.jti && (
                <Row label="JTI" value={result.jti} mono />
              )}
              {result.issued_at && (
                <Row label="Issued At" value={result.issued_at} />
              )}
              {result.expires_at && (
                <Row label="Expires At" value={result.expires_at} />
              )}
              {result.vcv && (
                <div>
                  <dt className="font-medium text-gray-600">VCV Claims</dt>
                  <dd className="mt-1 rounded bg-white p-3 font-mono text-xs">
                    <pre>{JSON.stringify(result.vcv, null, 2)}</pre>
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>
      )}
    </main>
  );
}

function ReceiptReplaySection({
  receiptIdInput,
  setReceiptIdInput,
  onNavigate,
}: {
  receiptIdInput: string;
  setReceiptIdInput: (v: string) => void;
  onNavigate: () => void;
}) {
  return (
    <div className="mt-10 border-t border-gray-200 pt-8">
      <h2 className="mb-2 text-xl font-bold tracking-tight">Inspect Receipt Replay</h2>
      <p className="mb-5 text-gray-500 text-sm">
        Enter a VitalCV receipt ID (<code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">rcpt_…</code> or{' '}
        <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">rec-…</code>) to view its replay
        chain, degradation ownership, and survivability score.
      </p>
      <div className="flex gap-3">
        <input
          type="text"
          value={receiptIdInput}
          onChange={(e) => setReceiptIdInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && receiptIdInput.trim() && onNavigate()}
          placeholder="rcpt_1234567890_1234567890123"
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 font-mono text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={onNavigate}
          disabled={!receiptIdInput.trim()}
          className="inline-flex items-center rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
        >
          Inspect
        </button>
      </div>
      <p className="mt-2 text-[11px] text-gray-400">
        Opens <code className="font-mono">/verify/receipt/{'{receiptId}'}</code> — public, no auth required.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <dt className="min-w-[120px] font-medium text-gray-600">{label}</dt>
      <dd className={mono ? 'break-all font-mono text-xs' : ''}>{value}</dd>
    </div>
  );
}
