'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Reveal } from '@/components/motion/Reveal';
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
    <main className="mz mz-paper mz-persona-verifier mz-ambient overflow-hidden mx-auto max-w-2xl px-6 py-16">
      {/* Verifier onboarding guide — collapsed by default */}
      <div className="mb-8">
        <VerifierOnboardingGuide collapsible compact={false} />
        <div className="mt-1.5 text-right">
          <Link
            href="/verify/guide"
            className="text-[11px] text-[var(--accent)] hover:opacity-80 underline underline-offset-2"
          >
            Full guide + offline verification →
          </Link>
        </div>
      </div>

      <Reveal variant="fade">
        <h1 className="mz-display mb-3">Credential <span className="mz-accent">Verifier</span></h1>
        <p className="mz-lede mb-8 max-w-xl">
          Paste a VitalCV JWT to verify its cryptographic signature and inspect its claims.
        </p>
      </Reveal>

      <Reveal delay={80}>
        <div className="mb-4">
          <label htmlFor="token-input" className="mb-2 block mz-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--ink-500)]">
            JWT Token
          </label>
          <textarea
            id="token-input"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            rows={6}
            placeholder="eyJhbGciOiJFUzI1NiIsImtpZCI6Ii4uLiJ9..."
            className="mz-input font-mono text-sm"
          />
        </div>

        <button
          onClick={handleVerify}
          disabled={loading || !token.trim()}
          className="mz-btn mb-8 disabled:cursor-not-allowed disabled:border-[var(--ink-200)]! disabled:bg-[var(--ink-100)]! disabled:text-[var(--ink-700)]!"
        >
          {loading ? 'Verifying…' : 'Verify'}
        </button>
      </Reveal>

      <Reveal delay={120}>
        <ReceiptReplaySection
          receiptIdInput={receiptIdInput}
          setReceiptIdInput={setReceiptIdInput}
          onNavigate={() => {
            const id = receiptIdInput.trim();
            if (id) router.push(`/verify/receipt/${encodeURIComponent(id)}`);
          }}
        />
      </Reveal>

      {result !== null && (
        <Reveal>
        <div className="mz-glass mt-8 rounded-[12px] p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold text-white ${
                result.verified ? 'bg-[var(--ok)]' : 'bg-[var(--p0)]'
              }`}
            >
              {result.verified ? '✓' : '✗'}
            </span>
            <span className={`mz-chip ${result.verified ? 'mz-chip-ok' : 'mz-chip-p0'}`}>
              {result.verified ? 'Valid credential' : 'Invalid credential'}
            </span>
          </div>

          {result.error && (
            <p className="mb-2 text-sm text-[var(--p0)]">
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
                  <dt className="font-medium text-[var(--ink-600)]">VCV Claims</dt>
                  <dd className="mt-1 mz-inset p-3 font-mono text-xs text-[var(--ink-700)]">
                    <pre>{JSON.stringify(result.vcv, null, 2)}</pre>
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>
        </Reveal>
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
    <div className="mt-10 border-t border-[var(--rule)] pt-8">
      <h2 className="mb-2 mz-h2 text-xl">Inspect Receipt Replay</h2>
      <p className="mb-5 text-[var(--ink-500)] text-sm">
        Enter a VitalCV receipt ID (<code className="mz-mono text-xs bg-[var(--ink-50)] border border-[var(--rule-soft)] px-1 py-0.5 rounded-[3px]">rcpt_…</code> or{' '}
        <code className="mz-mono text-xs bg-[var(--ink-50)] border border-[var(--rule-soft)] px-1 py-0.5 rounded-[3px]">rec-…</code>) to view its replay
        chain, degradation ownership, and survivability score.
      </p>
      <div className="flex gap-3">
        <input
          type="text"
          value={receiptIdInput}
          onChange={(e) => setReceiptIdInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && receiptIdInput.trim() && onNavigate()}
          placeholder="rcpt_1234567890_1234567890123"
          className="mz-input flex-1 font-mono text-sm"
        />
        <button
          onClick={onNavigate}
          disabled={!receiptIdInput.trim()}
          className="mz-btn disabled:cursor-not-allowed disabled:border-[var(--ink-200)]! disabled:bg-[var(--ink-100)]! disabled:text-[var(--ink-700)]!"
        >
          Inspect
        </button>
      </div>
      <p className="mt-2 text-[11px] text-[var(--ink-400)]">
        Opens <code className="mz-mono">/verify/receipt/{'{receiptId}'}</code> — public, no auth required.
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
      <dt className="min-w-[120px] font-medium text-[var(--ink-600)]">{label}</dt>
      <dd className={mono ? 'break-all font-mono text-xs text-[var(--ink-800)]' : 'text-[var(--ink-800)]'}>{value}</dd>
    </div>
  );
}
