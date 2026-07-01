'use client';
/**
 * Readiness Surface — live source-backed readiness for the signed-in clinician.
 *
 * Reads the clinician's NPI/name from the shared mobile context, fetches their
 * real passport (/api/passport/:npi — the same source the wallet/packet use),
 * and maps its source coverage into the readiness lanes. No demo data: when the
 * NPI is missing or the passport can't be loaded it shows an honest empty/error
 * state instead of a fabricated snapshot.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { ProofSplitPane } from '@/components/proof/LanePanel';
import { LiveStateLog } from '@/components/proof/LiveStateLog';
import { PostureBadge, ProofTierBadge, MetricBadge } from '@/components/proof/TrustLabel';
import { KNOWN_LANES, type ReadinessSnapshot, type StateLogEntry } from '@/components/proof/trust-types';
import { isPassportData } from '@/lib/trust/passport-contract';
import {
  buildReadinessLimitations,
  buildReadinessSnapshotFromPassport,
} from '@/lib/readiness/passport-readiness-snapshot';

type LoadState = 'loading' | 'ready' | 'no-npi' | 'error';

function laneLogMessage(laneId: string, status: string): { message: string; level: StateLogEntry['level'] } {
  const def = KNOWN_LANES.find((lane) => lane.laneId === laneId);
  const name = def?.displayName ?? laneId;
  const level: StateLogEntry['level'] =
    status === 'verified' ? 'info' : status === 'adverse' ? 'error' : 'warn';
  const label = status.replace(/_/g, ' ');
  return { message: `${name} — ${label}`, level };
}

export default function ReadinessSurface() {
  const { data } = useClinicianMobile();
  const npi = data.workspace?.personProfile?.npi ?? null;
  const name =
    [data.workspace?.personProfile?.firstName, data.workspace?.personProfile?.lastName]
      .filter(Boolean)
      .join(' ') || 'Your profile';

  const [snapshot, setSnapshot] = useState<ReadinessSnapshot | null>(null);
  const [limitations, setLimitations] = useState<string[]>([]);
  const [logEntries, setLogEntries] = useState<StateLogEntry[]>([]);
  const [loadState, setLoadState] = useState<LoadState>(npi ? 'loading' : 'no-npi');

  // Synchronous reset on identity change (React "adjust state during render"
  // pattern): React re-renders immediately with cleared state, so not one
  // frame of a prior clinician's readiness, limitations, or state log can
  // ever be shown for a different NPI.
  const [renderedNpi, setRenderedNpi] = useState(npi);
  if (renderedNpi !== npi) {
    setRenderedNpi(npi);
    setSnapshot(null);
    setLimitations([]);
    setLogEntries([]);
    setLoadState(npi ? 'loading' : 'no-npi');
  }

  const addLog = useCallback((message: string, level: StateLogEntry['level'] = 'info') => {
    setLogEntries((prev) => [...prev, { ts: Date.now(), message, level }]);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Reset all readiness state whenever the identity changes so a prior
      // clinician's snapshot can never linger while (or after) a new NPI loads.
      setSnapshot(null);
      setLimitations([]);
      setLogEntries([]);

      if (!npi) {
        setLoadState('no-npi');
        return;
      }

      setLoadState('loading');
      addLog('Loading source-backed readiness…');
      try {
        const res = await fetch(`/api/passport/${encodeURIComponent(npi)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`passport ${res.status}`);
        const payload: unknown = await res.json();
        if (cancelled) return;

        if (!isPassportData(payload)) {
          throw new Error('passport payload invalid');
        }

        const snap = buildReadinessSnapshotFromPassport(payload, { npi, name });
        snap.lanes.forEach((lane) => {
          const { message, level } = laneLogMessage(lane.laneId, lane.status);
          addLog(message, level);
        });
        addLog(`Readiness snapshot generated at ${new Date(snap.generatedAt).toLocaleTimeString()}`);

        setSnapshot(snap);
        setLimitations(buildReadinessLimitations(snap));
        setLoadState('ready');
      } catch {
        if (cancelled) return;
        addLog('Could not load source-backed readiness.', 'error');
        setLoadState('error');
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [npi, name, addLog]);

  // Render-time identity guard: a snapshot is only valid for the NPI it was
  // built from. On NPI change (or disappearance) the effect resets state a
  // tick later — this guard makes sure not even one frame of another
  // clinician's readiness can render in the gap.
  const activeSnapshot = snapshot && snapshot.npi === npi ? snapshot : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-slate-900 text-slate-300 text-xs px-6 py-2 flex items-center justify-between">
        <Link href="/holder/home" className="text-slate-400 hover:text-white transition-colors">← Dashboard</Link>
        <span className="font-mono uppercase tracking-widest font-bold">Readiness</span>
        <span className="font-mono text-slate-500 text-[10px]">{npi ? `NPI ${npi}` : '…'}</span>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Posture header */}
        {activeSnapshot && (
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">{activeSnapshot.name}</h1>
              <p className="font-mono text-sm text-slate-500 mt-0.5 tracking-wide">NPI {activeSnapshot.npi}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <PostureBadge posture={activeSnapshot.posture} size="md" />
              <ProofTierBadge tier={activeSnapshot.proofTier} />
              {activeSnapshot.score !== null
                ? <MetricBadge label={`${activeSnapshot.score}% readiness`} type="measured" />
                : <MetricBadge label="score unavailable" type="unverified" />}
            </div>
          </div>
        )}

        {/* No NPI — honest CTA, not demo */}
        {loadState === 'no-npi' && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
            <p className="text-sm text-slate-700">Add your NPI to see your source-backed readiness.</p>
            <Link href="/get-ready" className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors">
              Connect your NPI →
            </Link>
          </div>
        )}

        {/* Live state log */}
        {loadState !== 'no-npi' && <LiveStateLog entries={logEntries} maxHeight={160} />}

        {/* Loading */}
        {loadState === 'loading' && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <p className="font-mono text-sm text-slate-500 animate-pulse">Checking sources…</p>
          </div>
        )}

        {/* Error — honest, not demo */}
        {loadState === 'error' && (
          <div className="bg-white border border-rose-200 rounded-xl p-8 text-center space-y-2">
            <p className="text-sm text-rose-700">Source-backed readiness is temporarily unavailable.</p>
            <p className="text-xs text-slate-500">This is a system state — not a finding about your credentials. Try again shortly.</p>
          </div>
        )}

        {/* Split pane */}
        {activeSnapshot && loadState === 'ready' && (
          <>
            <ProofSplitPane
              lanes={activeSnapshot.lanes}
              npi={activeSnapshot.npi}
              name={activeSnapshot.name}
              score={activeSnapshot.score}
              generatedAt={activeSnapshot.generatedAt}
              proofTier={activeSnapshot.proofTier}
              limitations={limitations}
            />

            {activeSnapshot.nextStep && (
              <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Next Step</p>
                <p className="text-sm text-slate-700">{activeSnapshot.nextStep}</p>
              </div>
            )}

            {limitations.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-3">Limitations</p>
                <ul className="space-y-1">
                  {limitations.map((limitation, index) => (
                    <li key={index} className="text-xs text-amber-800 flex gap-2">
                      <span className="flex-shrink-0 text-amber-400">·</span>{limitation}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
