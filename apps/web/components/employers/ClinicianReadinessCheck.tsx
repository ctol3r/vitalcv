'use client';

/**
 * ClinicianReadinessCheck — inline NPI → readiness → TTS check on employer profiles.
 *
 * Runs the same ingest + trust-state API calls as the homepage LiveTrustConsole,
 * then shows a compact readiness summary with a TTS estimate specific to this employer.
 */

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TrustStatusBadge } from '@/components/ui/trust-status-badge';
import { TTSEstimateCard } from '@/components/tts/TTSEstimateCard';
import {
  estimateTimeToStart,
  type EmployerTTSInput,
  type ClinicianTTSInput,
} from '@/lib/tts/estimator';
import { LIVE_PATH_NPI_RE } from '@/lib/live-path/contracts';

interface ClinicianTrustState {
  npi: string;
  identityVerified: boolean;
  exclusionClear: boolean;
  exclusionStatus?: string;
  readiness_level: string;
  readiness_score: number;
  readiness_status: string;
  gap_summary: string[];
  gaps: string[];
  facts: Array<{ factType: string; source: string; status: string; details?: string }>;
}

type CheckPhase = 'idle' | 'loading' | 'done' | 'error';

interface Props {
  employerName: string;
  employerSlug: string;
  employer: EmployerTTSInput;
}

export function ClinicianReadinessCheck({ employerName, employerSlug, employer }: Props) {
  const [npi, setNpi] = useState('');
  const [phase, setPhase] = useState<CheckPhase>('idle');
  const [trustState, setTrustState] = useState<ClinicianTrustState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = npi.trim();

    if (!LIVE_PATH_NPI_RE.test(trimmed)) {
      setErrorMessage('Enter a valid 10-digit NPI.');
      inputRef.current?.focus({ preventScroll: true });
      return;
    }

    setPhase('loading');
    setErrorMessage(null);
    setTrustState(null);

    try {
      // Step 1: Ingest
      await fetch(`/api/identity/${encodeURIComponent(trimmed)}/ingest`, { method: 'POST' });

      // Step 2: Fetch trust state
      const tsRes = await fetch(`/api/trust-state/${encodeURIComponent(trimmed)}`);
      const tsData = await tsRes.json() as ClinicianTrustState;

      if (tsRes.ok && tsData.npi) {
        setTrustState(tsData);
        setPhase('done');
      } else {
        setErrorMessage('Could not load readiness snapshot for this NPI. Try again in a moment.');
        setPhase('error');
      }
    } catch {
      setErrorMessage('Could not reach the readiness service. Try again in a moment.');
      setPhase('error');
    }
  }

  const identityFact = trustState?.facts.find(
    f => f.factType === 'PERSONAL_IDENTITY' || f.factType === 'NPI_IDENTITY',
  );
  const displayName = identityFact?.details ?? (trustState ? `NPI ${trustState.npi}` : null);
  const specFact = trustState?.facts.find(f => f.factType === 'SPECIALTY');

  const ttsEstimate = trustState ? estimateTimeToStart(employer, {
    identityVerified: trustState.identityVerified,
    exclusionClear: trustState.exclusionClear,
    readinessLevel: trustState.readiness_level,
    readinessScore: trustState.readiness_score,
    gaps: [...trustState.gap_summary, ...trustState.gaps],
    facts: trustState.facts,
  } satisfies ClinicianTTSInput) : null;

  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
        Check readiness
      </p>
      <p className="mt-2 text-sm text-white/65">
        Enter a clinician&apos;s NPI to check readiness for {employerName}.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <Input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          maxLength={10}
          value={npi}
          readOnly={phase === 'loading'}
          onChange={(e) => {
            setErrorMessage(null);
            setNpi(e.target.value.replace(/\D/g, ''));
          }}
          placeholder="10-digit NPI"
          aria-label="Clinician NPI"
          className={`h-11 flex-1 rounded-xl border-white/12 bg-white/5 px-3 text-sm text-white placeholder:text-white/30 shadow-none focus-visible:border-emerald-500/40 focus-visible:ring-white/10 ${
            errorMessage ? 'border-amber-400/30' : ''
          }`}
        />
        <Button
          type="submit"
          variant="success"
          disabled={phase === 'loading'}
          className="h-11 shrink-0 rounded-xl px-4 text-sm font-semibold"
        >
          {phase === 'loading' ? (
            <span className="h-4 w-4 rounded-full border-2 border-black/30 border-t-transparent animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </form>

      {errorMessage && (
        <p className="mt-2 text-xs text-amber-200/80">{errorMessage}</p>
      )}

      {phase === 'done' && trustState && (
        <div className="mt-4 space-y-4 animate-fade-in-up">
          {/* Clinician identity summary */}
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{displayName}</p>
                {specFact?.details && (
                  <p className="mt-0.5 text-xs text-white/40">{specFact.details}</p>
                )}
              </div>
              <TrustStatusBadge
                status={trustState.readiness_level === 'L3' ? 'clear' : trustState.readiness_level === 'L2' ? 'pending' : 'blocked'}
                label={trustState.readiness_status}
                size="sm"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/40">
              {trustState.identityVerified && <span>Identity checked</span>}
              {trustState.exclusionClear && <span>Sanctions clear</span>}
              <span>{trustState.readiness_score}/100</span>
            </div>
          </div>

          {/* TTS estimate */}
          {ttsEstimate && (
            <TTSEstimateCard estimate={ttsEstimate} employerName={employerName} />
          )}

          {/* CTA */}
          <Link
            href={`/review?npi=${encodeURIComponent(trustState.npi)}&employer=${encodeURIComponent(employerSlug)}`}
            className="mt-2 inline-flex w-full items-center justify-between rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400"
          >
            <span>Request full review</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
