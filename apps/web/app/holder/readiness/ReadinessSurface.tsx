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
import { PageFrame } from '@/components/layout/PageFrame';
import { Skeleton } from '@/components/ui/skeleton';
import { Award, Building2, Share2, TrendingUp } from 'lucide-react';
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

/**
 * Provenance legend — readiness is a map, not a score. Each row names where a
 * fact stands and what it means, so a clinician (and later a reviewer) can read
 * trust at a glance. Colors map to the .vcv-doc state tokens.
 */
const PROVENANCE_LEGEND = [
  { label: 'NPI-confirmed', meaning: 'Matched to your federal NPPES record.', token: 'var(--accent)' },
  { label: 'Source-backed', meaning: 'Read from a primary source and current.', token: 'var(--state-verified)' },
  { label: 'Self-attested', meaning: 'You entered it — not yet source-backed.', token: 'var(--state-pending)' },
  { label: 'Needs review', meaning: 'Flagged for a closer look before it counts.', token: 'var(--state-pending)' },
  { label: 'Missing', meaning: 'Not provided yet — add it to lift readiness.', token: 'var(--ink-mute)' },
] as const;

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
        if (!res.ok) throw new Error(`readiness ${res.status}`);
        const payload: unknown = await res.json();
        if (cancelled) return;

        if (!isPassportData(payload)) {
          throw new Error('readiness payload invalid');
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
    <div className="vcv-doc min-h-screen">
      {/* Top bar — signed-artifact register (D57 dark op-bar) */}
      <div className="vcv-register text-xs px-6 py-2 flex items-center justify-between">
        <Link href="/holder/home" className="vcv-mono transition-opacity hover:opacity-80">← Dashboard</Link>
        <span className="vcv-eyebrow">Readiness</span>
        <span className="vcv-mono text-[10px] opacity-70">{npi ? `NPI ${npi}` : '…'}</span>
      </div>

      <PageFrame mode="product" className="max-w-5xl space-y-6">
        {/* The page h1 cannot live inside the activeSnapshot branch — with
            no NPI, on error, or while loading the page had no h1 at all. */}
        <h1 className="vcv-title text-2xl">Readiness</h1>

        {/* Identity + posture header — serif title, mono identifier */}
        {activeSnapshot && (
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <h2 className="vcv-title text-3xl">{activeSnapshot.name}</h2>
              <p className="vcv-mono text-sm vcv-muted mt-1">NPI {activeSnapshot.npi}</p>
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
          <div className="vcv-panel p-8 text-center space-y-3">
            <p className="text-sm" style={{ color: 'var(--ink)' }}>Add your NPI to see your source-backed readiness.</p>
            <Link href="/onboarding" className="vcv-cta inline-flex items-center px-4 py-2 text-sm">
              Connect your NPI →
            </Link>
          </div>
        )}

        {/* Live state log */}
        {loadState !== 'no-npi' && <LiveStateLog entries={logEntries} maxHeight={160} />}

        {/* The same "open readiness items" the home surface counts — one
            selector (data.blockers), both surfaces. Home said "5 open
            readiness items" while this page rendered only passport lanes, so
            the number appeared to vanish on click-through. */}
        {data.blockers.length > 0 && (
          <div className="vcv-panel px-5 py-4" data-readiness-blockers="">
            <p className="vcv-eyebrow mb-2">
              What&rsquo;s left ({data.blockers.length})
            </p>
            <ul className="space-y-2.5">
              {data.blockers.map((blocker) => (
                <li key={blocker.id} className="flex items-start justify-between gap-3 text-sm">
                  <span style={{ color: 'var(--ink)' }}>{blocker.label}</span>
                  <Link
                    href={blocker.nextActionHref}
                    className="vcv-mono shrink-0 text-xs underline underline-offset-4 transition-opacity hover:opacity-80"
                  >
                    {blocker.nextActionLabel}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Loading — a readiness-shaped skeleton, not a spinner */}
        {loadState === 'loading' && (
          <div className="space-y-4" aria-busy="true" aria-live="polite">
            <span className="sr-only">Checking sources…</span>
            <div className="vcv-panel px-5 py-4">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-3 h-4 w-3/4" />
            </div>
            <div className="vcv-panel overflow-hidden">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-4 border-t border-black/5 px-5 py-4 first:border-t-0"
                >
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-2.5 w-24" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error — honest, not demo */}
        {loadState === 'error' && (
          <div
            className="vcv-panel p-8 text-center space-y-2"
            style={{ borderColor: 'color-mix(in oklch, var(--state-blocked) 30%, transparent)' }}
          >
            <p className="text-sm" style={{ color: 'var(--state-blocked)' }}>Source-backed readiness is temporarily unavailable.</p>
            <p className="text-xs vcv-subtle">This is a system state — not a finding about your credentials. Try again shortly.</p>
          </div>
        )}

        {/* Split pane */}
        {activeSnapshot && loadState === 'ready' && (
          <>
            {/* Share / prove + recognition — close the readiness → proof → recognition loop */}
            <div
              data-readiness-share=""
              className="vcv-panel flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="vcv-eyebrow mb-1">Share your evidence</p>
                <p className="text-sm vcv-muted">
                  Send the public, source-backed view an employer can read — or see where you have been recognized.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/verify/${activeSnapshot.npi}`}
                  className="vcv-cta inline-flex items-center gap-1.5 px-4 py-2 text-sm"
                >
                  <Share2 className="h-4 w-4" aria-hidden />
                  Share proof
                </Link>
                <Link
                  href="/holder/recognition"
                  className="vcv-link inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm"
                  style={{ borderColor: 'color-mix(in oklch, var(--accent) 32%, transparent)' }}
                >
                  <Award className="h-4 w-4" aria-hidden />
                  Your recognition
                </Link>
              </div>
            </div>

            {/* Reading your readiness — provenance legend + what it unlocks.
                Makes readiness a map (source · state · what to do), not a bare score. */}
            <div data-readiness-explainer="" className="vcv-panel px-5 py-5">
              <p className="vcv-eyebrow mb-1">Reading your readiness</p>
              <p className="text-sm vcv-muted mb-4">
                Readiness is a map, not a grade. Every row below names its source and where it
                stands — so you can see what is trusted, what is missing, and what to do next.
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {PROVENANCE_LEGEND.map((item) => (
                  <li key={item.label} className="flex items-start gap-2.5">
                    <span
                      aria-hidden
                      className="mt-1.5 h-2.5 w-2.5 flex-none rounded-full"
                      style={{ background: item.token }}
                    />
                    <span className="min-w-0">
                      <span className="text-sm font-semibold" style={{ color: 'var(--ink-strong)' }}>
                        {item.label}
                      </span>
                      <span className="text-sm vcv-muted"> — {item.meaning}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div
                  className="flex items-start gap-2.5 rounded-lg p-3"
                  style={{ background: 'var(--state-verified-wash)', border: 'var(--hairline)' }}
                >
                  <TrendingUp className="mt-0.5 h-4 w-4 flex-none" style={{ color: 'var(--state-verified)' }} aria-hidden />
                  <p className="text-sm vcv-muted">
                    <span className="font-semibold" style={{ color: 'var(--ink-strong)' }}>Improves your Recognition.</span>{' '}
                    Source-backed rows are what an employer accepts as a head start.
                  </p>
                </div>
                <div
                  className="flex items-start gap-2.5 rounded-lg p-3"
                  style={{ background: 'var(--state-verified-wash)', border: 'var(--hairline)' }}
                >
                  <Building2 className="mt-0.5 h-4 w-4 flex-none" style={{ color: 'var(--accent)' }} aria-hidden />
                  <p className="text-sm vcv-muted">
                    <span className="font-semibold" style={{ color: 'var(--ink-strong)' }}>Helps employers trust faster.</span>{' '}
                    A reviewer starts from evidence and freshness, not a fresh intake pile.
                  </p>
                </div>
              </div>
            </div>

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
              <div className="vcv-panel px-5 py-4">
                <p className="vcv-eyebrow mb-2">Next Step</p>
                <p className="text-sm" style={{ color: 'var(--ink)' }}>{activeSnapshot.nextStep}</p>
              </div>
            )}

            {limitations.length > 0 && (
              <div
                className="vcv-panel px-5 py-4"
                style={{ background: 'var(--state-pending-wash)', borderColor: 'color-mix(in oklch, var(--state-pending) 30%, transparent)' }}
              >
                <p className="vcv-eyebrow mb-3" style={{ color: 'var(--state-pending)' }}>Limitations</p>
                <ul className="space-y-1">
                  {limitations.map((limitation, index) => (
                    <li key={index} className="text-xs flex gap-2" style={{ color: 'var(--state-pending)' }}>
                      <span className="flex-shrink-0" style={{ color: 'var(--state-pending)', opacity: 0.6 }}>·</span>{limitation}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </PageFrame>
    </div>
  );
}
