'use client';
/**
 * Readiness Surface — wave-133: UI/UX Unfreeze
 *
 * Split-pane architecture:
 *   LEFT:  source lanes quick scan
 *   RIGHT: deep inspection (claims, receipts, limitations)
 *
 * Live state log replaces spinners.
 * Typography: monospace for IDs/hashes, tabular for scores.
 * Colors only for state — no decoration.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ProofSplitPane } from '@/components/proof/LanePanel';
import { LiveStateLog, buildStateLog } from '@/components/proof/LiveStateLog';
import { PostureBadge, ProofTierBadge, MetricBadge } from '@/components/proof/TrustLabel';
import type { ReadinessSnapshot, StateLogEntry, LaneSnapshot } from '@/components/proof/trust-types';

// ─── Demo/fallback state for when no API is wired ─────────────────
// Replace with real API call in production

function buildDemoSnapshot(): ReadinessSnapshot {
  const now = Date.now();
  return {
    npi: '1457128589',
    name: 'MACIE MILLER',
    posture: 'partial',
    score: 25,
    proofTier: 'partial',
    generatedAt: now,
    nextStep: 'OIG exclusions and state license require institutional access to verify.',
    lanes: [
      { laneId: 'nppes_identity',   status: 'verified',        checkedAt: now,   value: 'Active — Behavior Technician',    source: 'NPPES', receiptId: `rcpt-nppes-${now}` },
      { laneId: 'oig_exclusions',   status: 'access_required', checkedAt: null,  value: null, source: 'OIG LEIE', receiptId: null },
      { laneId: 'state_license',    status: 'access_required', checkedAt: null,  value: null, source: 'State Board', receiptId: null },
      { laneId: 'employment_history', status: 'not_checked',   checkedAt: null,  value: null, source: 'The Work Number', receiptId: null },
    ],
  };
}

const DEMO_LIMITATIONS = [
  'NPPES identity verified against live CMS registry.',
  'OIG exclusions: integration not yet wired — access_required.',
  'State license: no state-board source attached for this clinician; board API not wired.',
  'Score reflects identity lane only (25% = 1 of 4 tracked lanes).',
];

// ─── Surface ──────────────────────────────────────────────────────

export default function ReadinessSurface() {
  const [snapshot, setSnapshot] = useState<ReadinessSnapshot | null>(null);
  const [logEntries, setLogEntries] = useState<StateLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const addLog = useCallback((message: string, level: StateLogEntry['level'] = 'info') => {
    setLogEntries(prev => [...prev, { ts: Date.now(), message, level }]);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      addLog('Initializing readiness check…');
      await delay(150);
      if (cancelled) return;

      addLog('Fetching NPPES identity…');
      await delay(300);
      if (cancelled) return;

      // In production: fetch from /api/manifest
      // For now: demo snapshot
      const snap = buildDemoSnapshot();
      if (cancelled) return;

      addLog('NPPES identity — verified', 'info');
      addLog('OIG exclusions — institutional access required', 'warn');
      addLog('State license — institutional access required', 'warn');
      addLog('Employment history — not checked this session', 'info');
      addLog(`Readiness snapshot generated at ${new Date(snap.generatedAt).toLocaleTimeString()}`);

      setSnapshot(snap);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [addLog]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-slate-900 text-slate-300 text-xs px-6 py-2 flex items-center justify-between">
        <Link href="/holder/home" className="text-slate-400 hover:text-white transition-colors">← Dashboard</Link>
        <span className="font-mono uppercase tracking-widest font-bold">Readiness</span>
        <span className="font-mono text-slate-500 text-[10px]">
          {snapshot ? `v${Date.now().toString(36).slice(-6)}` : '…'}
        </span>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Posture header */}
        {snapshot && (
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">{snapshot.name}</h1>
              <p className="font-mono text-sm text-slate-500 mt-0.5 tracking-wide">NPI {snapshot.npi}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <PostureBadge posture={snapshot.posture} size="md" />
              <ProofTierBadge tier={snapshot.proofTier} />
              {snapshot.score !== null
                ? <MetricBadge label={`${snapshot.score}% coverage`} type="measured" />
                : <MetricBadge label="score unavailable" type="unverified" />
              }
            </div>
          </div>
        )}

        {/* Live state log */}
        <LiveStateLog entries={logEntries} maxHeight={160} />

        {/* Loading state */}
        {loading && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <p className="font-mono text-sm text-slate-500 animate-pulse">Checking sources…</p>
          </div>
        )}

        {/* Split pane */}
        {snapshot && !loading && (
          <>
            <ProofSplitPane
              lanes={snapshot.lanes}
              npi={snapshot.npi}
              name={snapshot.name}
              score={snapshot.score}
              generatedAt={snapshot.generatedAt}
              proofTier={snapshot.proofTier}
              limitations={DEMO_LIMITATIONS}
            />

            {/* Next step */}
            {snapshot.nextStep && (
              <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Next Step</p>
                <p className="text-sm text-slate-700">{snapshot.nextStep}</p>
              </div>
            )}

            {/* Limitations block */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-3">Limitations</p>
              <ul className="space-y-1">
                {DEMO_LIMITATIONS.map((l, i) => (
                  <li key={i} className="text-xs text-amber-800 flex gap-2">
                    <span className="flex-shrink-0 text-amber-400">·</span>{l}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }
