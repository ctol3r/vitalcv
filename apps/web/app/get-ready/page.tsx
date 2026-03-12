'use client';

/**
 * /get-ready — Clinician NPI Onboarding
 *
 * Step 1: Enter NPI → NPPES verify → confirm identity → bootstrap profile → redirect to /holder/home
 *
 * Calls POST /api/profile/npi/bootstrap (Next.js proxy → backend intakeService.bootstrapNpiIntake)
 * Requires Clerk auth (x-clerk-user-id forwarded by proxy).
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckCircle2, ChevronRight, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';

type BootstrapResult = {
  npi: string;
  npiType: 'TYPE_1' | 'TYPE_2';
  inferredPersona: 'CLINICIAN' | 'VERIFIER' | 'UNKNOWN';
  firstName?: string;
  lastName?: string;
  specialty?: string;
  state?: string;
  alreadyRegistered: boolean;
};

type Phase = 'input' | 'loading' | 'confirm' | 'saving' | 'error';

export default function GetReadyPage() {
  const router = useRouter();
  const [npi, setNpi] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [result, setResult] = useState<BootstrapResult | null>(null);
  const [error, setError] = useState('');

  function validateNpi(value: string) {
    return /^\d{10}$/.test(value.trim());
  }

  async function handleVerify() {
    const trimmed = npi.trim();
    if (!validateNpi(trimmed)) {
      setError('NPI must be exactly 10 digits.');
      return;
    }
    setError('');
    setPhase('loading');

    try {
      const res = await fetch('/api/profile/npi/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npi: trimmed }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = (body as { error?: string }).error ?? `Verification failed (${res.status})`;
        setError(msg);
        setPhase('error');
        return;
      }

      const data = (await res.json()) as BootstrapResult;
      setResult(data);
      setPhase('confirm');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      setPhase('error');
    }
  }

  function handleConfirm() {
    setPhase('saving');
    // Profile is already saved by bootstrap. Just redirect.
    router.push('/holder/home');
  }

  function handleRetry() {
    setPhase('input');
    setError('');
    setResult(null);
  }

  return (
    <div className="min-h-screen bg-ops-gradient text-white flex flex-col">
      {/* Header */}
      <section className="border-b border-vt-neutral-800 px-6 py-14 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-vt-success/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-vt-success ring-1 ring-vt-success/20 mb-5">
          <ShieldCheck className="h-3.5 w-3.5" />
          Clinician Onboarding
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          Verify your identity.<br />
          <span className="text-vt-success">Build your trust passport.</span>
        </h1>
        <p className="mt-4 text-vt-neutral-200 max-w-md mx-auto text-base leading-relaxed">
          Enter your NPI once. VitalCV verifies directly with public registries
          and creates a portable, cryptographically-anchored credential profile.
        </p>
      </section>

      {/* Form */}
      <main className="flex-1 flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-md">

          {/* ── Phase: input ── */}
          {(phase === 'input' || phase === 'error') && (
            <div className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-7 space-y-5">
              <div>
                <label
                  htmlFor="npi-input"
                  className="block text-sm font-semibold text-white mb-2"
                >
                  Your NPI Number
                </label>
                <input
                  id="npi-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={npi}
                  onChange={(e) => {
                    setNpi(e.target.value.replace(/\D/g, ''));
                    setError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                  placeholder="10-digit NPI (e.g. 1234567890)"
                  className="w-full rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-base px-4 py-3 text-white placeholder:text-vt-neutral-800 font-mono text-lg tracking-wider focus:border-vt-success focus:outline-none focus:ring-1 focus:ring-vt-success transition"
                />
                {error && (
                  <div className="mt-2.5 flex items-center gap-2 text-sm text-red-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}
                <p className="mt-2 text-xs text-vt-neutral-800">
                  Find your NPI at{' '}
                  <a
                    href="https://npiregistry.cms.hhs.gov"
                    target="_blank"
                    rel="noreferrer"
                    className="text-vt-success/70 hover:text-vt-success underline"
                  >
                    npiregistry.cms.hhs.gov
                  </a>
                </p>
              </div>

              <button
                onClick={handleVerify}
                disabled={npi.length !== 10}
                className="w-full rounded-xl bg-vt-success px-6 py-3.5 text-base font-semibold text-black hover:bg-vt-success/90 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                Verify NPI <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ── Phase: loading ── */}
          {phase === 'loading' && (
            <div className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-10 flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 text-vt-success animate-spin" />
              <p className="text-white font-medium">Looking up NPI {npi}…</p>
              <p className="text-sm text-vt-neutral-200">Querying NPPES registry</p>
            </div>
          )}

          {/* ── Phase: confirm ── */}
          {phase === 'confirm' && result && (
            <div className="rounded-2xl border border-vt-success/30 bg-vt-success/5 p-7 space-y-5">
              <div className="flex items-center gap-3 mb-1">
                <CheckCircle2 className="h-6 w-6 text-vt-success shrink-0" />
                <span className="text-lg font-semibold text-white">Identity Verified</span>
              </div>

              <div className="space-y-2 rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-base px-5 py-4">
                {[
                  { label: 'NPI', value: result.npi },
                  { label: 'Name', value: [result.firstName, result.lastName].filter(Boolean).join(' ') || '—' },
                  { label: 'Specialty', value: result.specialty || 'Not listed' },
                  { label: 'State', value: result.state || 'Not listed' },
                  { label: 'NPI Type', value: result.npiType === 'TYPE_1' ? 'Type 1 — Individual' : 'Type 2 — Organization' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-vt-neutral-200">{label}</span>
                    <span className="text-white font-medium">{value}</span>
                  </div>
                ))}
              </div>

              {result.alreadyRegistered && (
                <p className="text-xs text-vt-neutral-200 bg-vt-surface-ops-raised/40 rounded-lg px-4 py-2">
                  This NPI was already on file — your profile has been updated.
                </p>
              )}

              <p className="text-sm text-vt-neutral-200">
                Is this you? Confirm to save your profile and open your trust passport.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={handleRetry}
                  className="flex-1 rounded-xl border border-vt-neutral-800 px-4 py-3 text-sm font-medium text-vt-neutral-200 hover:border-vt-neutral-200 transition"
                >
                  Not me
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 rounded-xl bg-vt-success px-4 py-3 text-sm font-semibold text-black hover:bg-vt-success/90 transition flex items-center justify-center gap-2"
                >
                  Yes, that&apos;s me <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Phase: saving ── */}
          {phase === 'saving' && (
            <div className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-10 flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 text-vt-success animate-spin" />
              <p className="text-white font-medium">Setting up your workspace…</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
