'use client';

export const dynamic = 'force-dynamic';

/**
 * /passport — Wallet entry + live ingest hydration
 *
 * Flow: TYPE → SEE → TRUST → SHARE
 *
 * 1. User enters NPI
 * 2. POST /api/ingest/:npi → runId
 * 3. SSE stream → progressive hydration
 *    - Identity appears first (NPPES, ~1s)
 *    - Sanctions status next (OIG, ~2s)
 *    - Enrollment next (PECOS, ~3s)
 *    - Readiness recalculates on claim_update
 * 4. Done → [View full passport] or [View as employer]
 *
 * No polling. No full-page reload. No fake refresh.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useIngestStream, type StreamPhase, type SourceStatus } from '@/hooks/useIngestStream';

// ── Status label helper ────────────────────────────────────────────────────────

const PHASE_LABEL: Record<StreamPhase, string> = {
  idle:       '',
  starting:   'Connecting to primary sources…',
  nppes:      'Checking primary sources…',
  sanctions:  'Checking sanctions and exclusions…',
  enrollment: 'Checking Medicare enrollment…',
  done:       'Complete',
  error:      'Error',
};

// ── Source row ─────────────────────────────────────────────────────────────────

type SourceState = 'pending' | 'checking' | 'done' | 'error';

function SourceRow({ label, state, value }: { label: string; state: SourceState; value?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2.5">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{
            backgroundColor:
              state === 'done'     ? 'rgba(255,255,255,0.45)' :
              state === 'checking' ? 'rgba(255,255,255,0.20)' :
              state === 'error'    ? 'rgba(255,255,255,0.15)' :
                                     'rgba(255,255,255,0.08)',
          }}
          aria-hidden
        />
        <span className="text-white/55 text-sm">{label}</span>
      </div>
      <span className="text-white/30 text-xs">
        {state === 'checking' ? 'Checking…'
       : state === 'done'     ? (value ?? 'Done')
       : state === 'error'    ? 'Unavailable'
       :                        '—'}
      </span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PassportPage() {
  const [npi,       setNpi]       = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const { state, startIngest, reset } = useIngestStream();

  const isActive  = state.phase !== 'idle';
  const isDone    = state.phase === 'done';
  const isError   = state.phase === 'error';
  const isRunning = !isDone && !isError && isActive;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = npi.trim();
    if (!/^\d{10}$/.test(trimmed)) { setInputError('Enter a valid 10-digit NPI.'); return; }
    setInputError(null);
    startIngest(trimmed);
  }

  const { identity, standing, sources } = state;

  const exclusionLabel =
    !standing.exclusionChecked              ? undefined
    : standing.exclusionClear === true      ? 'Clear'
    : standing.exclusionClear === false     ? 'Flag found'
    :                                         'Checking…';

  const enrollmentLabel =
    !standing.enrollmentChecked             ? undefined
    : standing.enrollmentStatus === 'ENROLLED' ? 'Enrolled'
    : standing.enrollmentStatus             ? standing.enrollmentStatus
    :                                         'Unknown';

  return (
    <main className="min-h-screen bg-vt-surface-ops-base flex flex-col items-center px-4 pt-16 sm:pt-24 pb-24">
      <div className="w-full max-w-sm space-y-8">

        {/* Wordmark */}
        <div className="text-center">
          <span className="text-white/30 text-xs tracking-widest uppercase">VitalCV</span>
          <h1 className="text-white text-2xl font-semibold tracking-tight mt-1">
            Your your readiness
          </h1>
          {!isActive && (
            <p className="text-white/35 text-sm mt-2">
              Enter your NPI. No login required.
            </p>
          )}
        </div>

        {/* NPI entry — hidden while running */}
        {!isActive && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <label htmlFor="passport-npi" className="sr-only">Your NPI number</label>
            <input
              id="passport-npi"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{10}"
              maxLength={10}
              value={npi}
              onChange={e => setNpi(e.target.value.replace(/\D/g, ''))}
              placeholder="1234567890"
              className="w-full bg-white/6 border border-white/12 rounded-xl px-4 py-4 text-white placeholder:text-white/20 text-[16px] tracking-widest text-center focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
              aria-label="NPI number"
              autoComplete="off"
            />
            {inputError && (
              <p className="text-red-400/70 text-xs text-center">{inputError}</p>
            )}
            <button
              type="submit"
              disabled={npi.length !== 10}
              className="w-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-40 text-white rounded-full py-3.5 text-sm font-medium transition-all min-h-[48px]"
            >
              Check my readiness
            </button>
          </form>
        )}

        {/* Live ingest panel */}
        {isActive && (
          <div className="space-y-5 animate-fade-in-up">

            {/* Phase label */}
            {isRunning && (
              <p className="text-white/40 text-sm text-center">
                {PHASE_LABEL[state.phase]}
              </p>
            )}

            {/* Identity block — appears when NPPES resolves */}
            {identity.displayName && (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                <p className="text-white/30 text-xs uppercase tracking-widest mb-1">Provider</p>
                <h2 className="text-white text-xl font-semibold leading-tight">
                  {identity.displayName}
                </h2>
                {identity.specialty && (
                  <p className="text-white/50 text-sm mt-0.5">{identity.specialty}</p>
                )}
                <p className="text-white/25 text-xs mt-1">NPI {state.npi}</p>
              </div>
            )}

            {/* Source status rows */}
            <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-2">
              <SourceRow
                label="Identity"
                state={sources.nppes}
                value={identity.displayName ? 'Verified' : undefined}
              />
              <SourceRow
                label="Sanctions (OIG)"
                state={sources.oig}
                value={exclusionLabel}
              />
              <SourceRow
                label="Enrollment (CMS)"
                state={sources.pecos}
                value={enrollmentLabel}
              />
            </div>

            {/* Readiness score — appears when claims update */}
            {state.readiness.score !== undefined && (
              <div className="flex items-center justify-between px-1">
                <span className="text-white/35 text-sm">Readiness</span>
                <span className="text-white/65 text-sm tabular-nums">
                  {state.readiness.score}/100
                </span>
              </div>
            )}

            {/* Done state — full passport available */}
            {isDone && identity.entityId && (
              <div className="space-y-3">
                <Link
                  href={`/passport/${identity.entityId}`}
                  className="block w-full bg-emerald-500 hover:bg-emerald-400 text-white text-center rounded-full py-3.5 text-sm font-medium transition-all min-h-[48px] leading-[48px]"
                >
                  View full passport
                </Link>
                <Link
                  href={`/review/${identity.entityId}`}
                  className="block w-full rounded-full border border-white/10 bg-white/4 py-3.5 text-center text-sm font-medium text-white/60 transition-all hover:border-white/20 hover:bg-white/7 hover:text-white"
                >
                  View as employer
                </Link>
              </div>
            )}

            {/* Error state */}
            {isError && (
              <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-center space-y-2">
                <p className="text-white/45 text-sm">
                  {state.error ?? 'Something went wrong.'}
                </p>
                <p className="text-white/25 text-xs">
                  Data may still be available from prior ingest.
                </p>
              </div>
            )}

            {/* Start over */}
            <div className="text-center">
              <button
                onClick={reset}
                className="text-white/25 hover:text-white/45 text-xs transition-colors min-h-[44px] px-4"
              >
                {isDone ? 'Check another NPI' : 'Cancel'}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        {!isActive && (
          <p className="text-center text-white/20 text-xs">
            Already have an account?{' '}
            <Link href="/sign-in" className="text-white/40 underline underline-offset-2 hover:text-white/60 transition-colors">
              Sign in
            </Link>
          </p>
        )}

      </div>
    </main>
  );
}
