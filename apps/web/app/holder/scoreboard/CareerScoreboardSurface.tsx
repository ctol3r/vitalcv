'use client';

/**
 * Career Scoreboard (Wave 6) — "your career at a glance" for the signed-in
 * clinician. A thin renderer over the pure truth model in
 * lib/matcha/scoreboard.ts: it maps the clinician's REAL account signals
 * (source-backed readiness, recorded employer acceptances, live MATCHA matches,
 * tracked applications, profile completeness, and — when the MATCHA pilot is on
 * — their own stated preferences) into honest tiles. No demo data: absent
 * signals render explicit empty states, never fabricated numbers.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { fetchAcceptanceRecognition } from '@/lib/recognition/acceptance-recognition';
import { completenessPercent } from '@/lib/matcha/preferences';
import { loadStoredPreferences } from '@/lib/matcha/storage';
import { FEATURES } from '@/lib/features';
import { OpportunitySimulator } from '@/components/matcha/OpportunitySimulator';
import {
  buildCareerScoreboard,
  type RecognitionSummaryInput,
  type ScoreboardTile,
  type ScoreboardTone,
} from '@/lib/matcha/scoreboard';

const CLEARED_BANDS = new Set(['CLEAR', 'NEAR_CLEAR']);

const TONE_ACCENT: Record<ScoreboardTone, string> = {
  strong: 'var(--state-ok, #0f766e)',
  progress: 'var(--state-info, #2563eb)',
  attention: 'var(--state-pending, #b45309)',
  empty: 'var(--hairline, #cbd2cc)',
  unavailable: 'var(--hairline, #cbd2cc)',
};

export default function CareerScoreboardSurface() {
  const { data } = useClinicianMobile();
  const npi = data.workspace?.personProfile?.npi ?? null;
  const name =
    [data.workspace?.personProfile?.firstName, data.workspace?.personProfile?.lastName]
      .filter(Boolean)
      .join(' ') || 'Your career';

  const [recognition, setRecognition] = useState<RecognitionSummaryInput>({ state: 'unavailable' });
  const [matchaPercent, setMatchaPercent] = useState<number | null>(null);

  // Recognition — public acceptance-history read, keyed to the clinician NPI.
  useEffect(() => {
    let cancelled = false;
    if (!npi) {
      setRecognition({ state: 'none_recorded' });
      return;
    }
    void (async () => {
      const result = await fetchAcceptanceRecognition(npi);
      if (cancelled) return;
      if (result.state === 'recognized') {
        setRecognition({ state: 'recognized', count: result.recognition.history.length });
      } else {
        setRecognition({ state: result.state });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [npi]);

  // MATCHA tuning — only when the pilot surface is reachable, so the tile never
  // links to a gated route. Read from the clinician's own stored answers.
  useEffect(() => {
    if (!FEATURES.MATCHA_V2) {
      setMatchaPercent(null);
      return;
    }
    setMatchaPercent(completenessPercent(loadStoredPreferences()));
  }, []);

  const board = useMemo(() => {
    const readiness = data.trustState
      ? {
          score: data.trustState.readinessScore,
          level: data.trustState.readinessLevel,
          status: data.trustState.readinessStatus,
        }
      : null;

    const profile = data.profileCompleteness
      ? {
          score: data.profileCompleteness.score,
          answered: Object.values(data.profileCompleteness.dimensions).filter(Boolean).length,
          total: Object.keys(data.profileCompleteness.dimensions).length,
        }
      : null;

    const clearedToApply = data.availableOpportunities.filter(
      (opp) => opp.match && CLEARED_BANDS.has(opp.match.band),
    ).length;

    return buildCareerScoreboard({
      readiness,
      recognition,
      opportunities: { total: data.availableOpportunities.length, clearedToApply },
      applicationsInMotion: data.activeApplications.length,
      profile,
      matchaTuning: matchaPercent === null ? null : { percent: matchaPercent },
      blockers: data.blockers.length,
    });
  }, [data, recognition, matchaPercent]);

  return (
    <div className="vcv-doc min-h-screen">
      {/* Top bar — signed-artifact register (D57 op-bar), matches readiness/recognition */}
      <div className="vcv-register text-xs px-6 py-2 flex items-center justify-between">
        <Link href="/holder/home" className="vcv-mono transition-opacity hover:opacity-80">
          ← Dashboard
        </Link>
        <span className="vcv-eyebrow">Scoreboard</span>
        <span className="vcv-mono text-[10px] opacity-70">{npi ? `NPI ${npi}` : '…'}</span>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <header>
          <p className="vcv-mono text-xs vcv-muted">{name}</p>
          <h1 className="vcv-title text-3xl mt-1">{board.headline}</h1>
          <p className="text-sm vcv-muted mt-2 max-w-2xl">{board.subhead}</p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {board.tiles.map((tile) => (
            <TileCard key={tile.key} tile={tile} />
          ))}
        </div>

        <OpportunitySimulator npi={npi} />

        <p className="text-xs vcv-subtle max-w-2xl leading-relaxed border-t pt-4" style={{ borderColor: 'var(--hairline, #e3e7e3)' }}>
          {board.note}
        </p>
      </div>
    </div>
  );
}

function TileCard({ tile }: { tile: ScoreboardTile }) {
  const accent = TONE_ACCENT[tile.tone];
  const muted = tile.tone === 'empty' || tile.tone === 'unavailable';
  return (
    <Link
      href={tile.href}
      className="vcv-panel group flex flex-col gap-2 p-4 transition-colors hover:border-[color:var(--ink)]"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="vcv-eyebrow">{tile.label}</span>
        <ArrowUpRight className="h-3.5 w-3.5 opacity-40 transition-opacity group-hover:opacity-80" aria-hidden />
      </div>
      <p
        className="vcv-title text-2xl leading-none"
        style={muted ? { color: 'var(--muted-ink, #6b7280)' } : undefined}
      >
        {tile.value}
      </p>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--ink)' }}>
        {tile.detail}
      </p>
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="vcv-mono text-[10px] vcv-subtle uppercase tracking-wide">{tile.source}</span>
        <span className="text-[11px] font-medium" style={{ color: 'var(--accent, #0f766e)' }}>
          {tile.ctaLabel} →
        </span>
      </div>
    </Link>
  );
}
