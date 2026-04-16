'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TrustStatusBadge } from '@/components/ui/trust-status-badge';
import { TTSEstimateCard } from '@/components/tts/TTSEstimateCard';
import { estimateTimeToStart } from '@/lib/tts/estimator';
import type { ClinicianTrustState } from '@/components/hero/ReadinessPreview';

interface ClinicianReadinessCheckProps {
  employerName: string;
  employerSlug: string;
  timeToStart: string;
  requirements: Array<{ label: string; level: string; note?: string }>;
}

type CheckPhase = 'idle' | 'loading' | 'result' | 'error';

export default function ClinicianReadinessCheck({
  employerName,
  employerSlug,
  timeToStart,
  requirements,
}: ClinicianReadinessCheckProps) {
  const [npi, setNpi] = useState('');
  const [phase, setPhase] = useState<CheckPhase>('idle');
  const [trustState, setTrustState] = useState<ClinicianTrustState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = npi.trim();
    if (!/^\d{10}$/.test(trimmed)) return;

    setPhase('loading');
    setErrorMsg(null);

    try {
      // Start ingest + fetch trust state
      const ingestRes = await fetch(`/api/ingest/${trimmed}`, { method: 'POST' });
      if (!ingestRes.ok) {
        throw new Error(`Ingest failed (${ingestRes.status})`);
      }

      // Wait briefly for ingest to populate, then fetch trust state
      await new Promise(resolve => setTimeout(resolve, 2000));

      const tsRes = await fetch(`/api/trust-state/${trimmed}`);
      if (!tsRes.ok) {
        throw new Error(`Trust state unavailable (${tsRes.status})`);
      }

      const data = (await tsRes.json()) as ClinicianTrustState;
      setTrustState(data);
      setPhase('result');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
      setPhase('error');
    }
  }

  const ttsEstimate = trustState
    ? estimateTimeToStart(
        { name: employerName, timeToStart, requirements },
        {
          readinessLevel: trustState.readiness_level,
          readinessScore: trustState.readiness_score,
          gaps: trustState.gaps,
          facts: trustState.facts.map(f => ({ factType: f.factType, status: f.status })),
        },
      )
    : null;

  const displayName = trustState?.facts.find(f => f.factType === 'provider_name')?.details
    ?? trustState?.facts.find(f => f.factType === 'identity')?.details
    ?? `NPI ${npi}`;

  return (
    <div className="rounded-3xl border border-[var(--ops-border)] bg-[var(--ops-surface)] p-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-foreground">
        Check readiness
      </p>
      <p className="mt-2 text-sm text-foreground">
        Enter a clinician NPI to check readiness for {employerName}
      </p>

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <Input
          id="npi-input-employer"
          name="npi"
          aria-label="Enter a clinician NPI to check readiness for this employer"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{10}"
          maxLength={10}
          value={npi}
          onChange={e => setNpi(e.target.value.replace(/\D/g, ''))}
          placeholder="NPI (10 digits)"
          className="h-10 flex-1 rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-alt)] px-3 text-sm tracking-wider text-[var(--ops-text)] placeholder:text-[var(--ops-text-subtle)]"
          disabled={phase === 'loading'}
        />
        <Button
          type="submit"
          variant="outline"
          disabled={npi.length !== 10 || phase === 'loading'}
          className="h-10 rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-alt)] px-3 text-[var(--ops-text)]"
        >
          <Search className="h-4 w-4" />
        </Button>
      </form>

      {phase === 'loading' && (
        <p className="mt-3 text-xs text-muted-foreground animate-pulse">
          Checking sources…
        </p>
      )}

      {phase === 'error' && (
        <p className="mt-3 text-xs text-red-400/70">
          {errorMsg}
        </p>
      )}

      {phase === 'result' && trustState && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{displayName}</p>
              <p className="text-xs text-muted-foreground">NPI {npi}</p>
            </div>
            <TrustStatusBadge
              status={
                trustState.readiness_level === 'L3' ? 'checked'
                : trustState.readiness_level === 'L2' ? 'pending'
                : 'review_required'
              }
              label={`${trustState.readiness_level} — ${trustState.readiness_score}/100`}
              size="sm"
            />
          </div>

          {ttsEstimate && (
            <TTSEstimateCard estimate={ttsEstimate} employerName={employerName} />
          )}

          <Link
            href={`/passport?npi=${npi}&employer=${encodeURIComponent(employerSlug)}`}
            className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-emerald-300 transition hover:text-emerald-200"
          >
            Check your full passport requirements
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
