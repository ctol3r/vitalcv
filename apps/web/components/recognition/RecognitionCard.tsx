'use client';

/**
 * Recognition card — the holder-facing answer to "Am I recognized?".
 *
 * Renders the clinician's employer acceptance record (the product form of the
 * canonical Recognition → Acceptance → Start path) from the public
 * acceptance-history read. States are honest: a lookup failure is a system
 * state, never a finding about the record, and an empty record says exactly
 * that — no demo data, no synthesized recognition.
 */

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Award, ChevronRight, Loader2 } from 'lucide-react';
import {
  acceptanceScopeLabel,
  fetchAcceptanceRecognition,
  formatAcceptedAt,
  type AcceptanceRecognitionResult,
} from '@/lib/recognition/acceptance-recognition';

type Phase = { state: 'loading' } | AcceptanceRecognitionResult;

export function RecognitionCard({ npi }: { npi: string }) {
  const [phase, setPhase] = useState<Phase>({ state: 'loading' });

  const load = useCallback(async () => {
    setPhase({ state: 'loading' });
    setPhase(await fetchAcceptanceRecognition(npi));
  }, [npi]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section
      aria-label="Recognition"
      className="mz mz-card mz-card-pad"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="mz-eyebrow">Recognition</p>
        <Award className="h-4 w-4" style={{ color: 'var(--accent)' }} aria-hidden />
      </div>

      {phase.state === 'loading' && (
        <div className="mt-3 flex items-center gap-2 mz-small">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Checking your acceptance record…
        </div>
      )}

      {phase.state === 'unavailable' && (
        <div className="mt-3 space-y-2">
          <p className="mz-h2">
            Recognition status is temporarily unavailable
          </p>
          <p className="mz-body">
            This is a system state — not a finding about your record. Try again shortly.
          </p>
          <button
            onClick={() => { void load(); }}
            className="mz-btn mz-btn-ghost mz-btn-sm"
          >
            Try again
          </button>
        </div>
      )}

      {phase.state === 'none_recorded' && (
        <div className="mt-3 space-y-2">
          <p className="mz-h2">
            No employer acceptances recorded yet
          </p>
          <p className="mz-body">
            When an employer accepts your evidence as a head start, the acceptance is
            recorded here and stays part of your career record.
          </p>
          <Link
            href="/holder/readiness"
            className="inline-flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ color: 'var(--accent)' }}
          >
            Keep your readiness current <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      )}

      {phase.state === 'recognized' && (
        <RecognizedBody recognition={phase.recognition} />
      )}
    </section>
  );
}

function RecognizedBody({
  recognition,
}: {
  recognition: Extract<AcceptanceRecognitionResult, { state: 'recognized' }>['recognition'];
}) {
  const latest = recognition.history[0] ?? null;
  const latestDate = latest ? formatAcceptedAt(latest.acceptedAt) : null;

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className="mz-chip mz-chip-ok" aria-hidden="true"><span className="mz-gl" /></span>
        <p className="mz-h2">{recognition.summary.headline}</p>
      </div>

      {latest && (
        <p className="mz-body">
          Most recent: <span style={{ color: 'var(--ink-900)' }}>{latest.orgLabel}</span>
          {' · '}
          {acceptanceScopeLabel(latest.acceptanceScope)}
          {latestDate ? ` · ${latestDate}` : ''}
        </p>
      )}

      {recognition.summary.trustCopy && (
        <p className="mz-small">{recognition.summary.trustCopy}</p>
      )}

      <Link
        href="/holder/recognition"
        className="inline-flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-80"
        style={{ color: 'var(--accent)' }}
      >
        View your recognition record <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}
