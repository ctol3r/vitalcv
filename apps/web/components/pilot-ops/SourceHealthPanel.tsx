'use client';

import { useEffect, useRef, useState } from 'react';
import {
  type SourceOpsEntry,
  type SourceOpsReport,
} from '@/lib/mission-ops/sourceOpsTypes';
import {
  getRemediationHint,
  type RemediationHint,
} from '@/lib/source-health/remediationHints';

const POLL_INTERVAL_MS = 60_000;

function hintToneClasses(tone: RemediationHint['tone']): string {
  switch (tone) {
    case 'critical':
      return 'text-rose-400/80';
    case 'warn':
      return 'text-amber-400/80';
    case 'info':
      return 'text-sky-400/70';
    default:
      return 'text-zinc-400/70';
  }
}

function coverageColor(state: SourceOpsEntry['coverageState']): string {
  switch (state) {
    case 'checked':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
    case 'stale':
    case 'reviewRequired':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
    case 'accessRequired':
    case 'gated':
      // Operator-action-required state — match the amber "warn"
      // tone the remediation hint emits for these lanes. Sky/blue
      // would read as positive info, which contradicts the truth
      // contract for non-decision-grade lanes.
      return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
    case 'pending':
    case 'notDecisionGrade':
    case 'previewOnly':
      return 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400';
    case 'unavailable':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-400';
    default:
      return 'border-zinc-600/30 bg-zinc-600/10 text-zinc-500';
  }
}

function spineStatusColor(status: SourceOpsReport['spineStatus']): string {
  switch (status) {
    case 'HEALTHY':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
    case 'DEGRADED':
    case 'STALE':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
    case 'CRITICAL':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-400';
    default:
      return 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400';
  }
}

function formatAge(isoDate: string | null): string {
  if (!isoDate) return 'never';
  const ms = Date.now() - new Date(isoDate).getTime();
  if (ms < 0) return 'just now';
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) {
    const mins = Math.floor(ms / 60_000);
    return mins < 1 ? 'just now' : `${mins}m ago`;
  }
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function filterPilotSources(sources: SourceOpsEntry[]): SourceOpsEntry[] {
  return sources.filter((source) => (
    source.isSpine
    || source.decisionGrade
    || source.consecutiveFailures > 0
    || source.lastFailureAt !== null
    || source.coverageState === 'accessRequired'
    || source.coverageState === 'reviewRequired'
    || source.coverageState === 'gated'
  ));
}

export function SourceHealthPanel() {
  const [report, setReport] = useState<SourceOpsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Tracks the timestamp of the last successful health-probe fetch so
  // the error state can reassure the operator that auto-retry is
  // running and tell them how stale the last good data is.
  const [lastOkAt, setLastOkAt] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function fetchHealth() {
      try {
        const res = await fetch('/api/internal/source-health');
        if (!res.ok) {
          if (mountedRef.current) setError('Source health unavailable');
          return;
        }
        const data = (await res.json()) as SourceOpsReport;
        if (mountedRef.current) {
          setReport(data);
          setError(null);
          setLastOkAt(new Date().toISOString());
        }
      } catch {
        if (mountedRef.current) setError('Source health unavailable');
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }

    fetchHealth();
    const interval = setInterval(fetchHealth, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
        <p className="text-xs text-zinc-500">Loading source health…</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div
        className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-1"
        data-testid="source-health-error"
      >
        <p className="text-xs text-rose-400">Health probe unreachable.</p>
        <p className="text-[10px] text-zinc-500">
          {lastOkAt
            ? `Last successful poll ${formatAge(lastOkAt)}. Auto-retry every 60s.`
            : 'Retrying every 60s. If this persists, check the source-health probe service.'}
        </p>
      </div>
    );
  }

  const pilotSources = filterPilotSources(report.sources);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Source Health</h3>
          <p className="mt-0.5 text-[10px] text-zinc-500">
            Pilot-relevant sources — polls every 60s
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${spineStatusColor(report.spineStatus)}`}
          data-testid="spine-status-badge"
        >
          {report.spineStatus}
        </span>
      </div>

      {pilotSources.length === 0 ? (
        <p className="text-xs text-zinc-500">No pilot sources found</p>
      ) : (
        <div className="space-y-2">
          {pilotSources.map((source) => (
            <div
              key={source.sourceId}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-300 truncate">
                    {source.name}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    SLA: {source.freshnessSlaHours}h
                  </p>
                  {(() => {
                    const hint = getRemediationHint({
                      sourceId: source.sourceId,
                      operatorStatus: source.operatorStatus,
                      coverageState: source.coverageState,
                    });
                    if (!hint) return null;
                    return (
                      <p
                        className={`mt-1 text-[11px] leading-snug ${hintToneClasses(hint.tone)}`}
                        data-testid="source-health-remediation-hint"
                        data-hint-rule={hint.rule}
                        data-hint-tone={hint.tone}
                      >
                        → {hint.copy}
                      </p>
                    );
                  })()}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="text-[10px] text-zinc-500"
                  title={source.lastSuccessAt ?? 'never'}
                >
                  {formatAge(source.lastSuccessAt)}
                </span>
                {source.consecutiveFailures >= 1 && (
                  <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                    {source.consecutiveFailures} fail{source.consecutiveFailures > 1 ? 's' : ''}
                  </span>
                )}
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${coverageColor(source.coverageState)}`}
                >
                  {source.coverageState}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 border-t border-zinc-800 pt-3">
        <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Alerts
        </h4>
        {report.alerts.length === 0 ? (
          <p className="text-xs text-zinc-500">No active alerts</p>
        ) : (
          <div className="max-h-32 space-y-1 overflow-y-auto">
            {report.alerts.map((alert, i) => (
              <p key={i} className="text-[11px] leading-relaxed text-amber-300/80">
                {alert}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
