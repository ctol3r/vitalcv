'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  RefreshCcw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import type {
  SourceOpsCoverageState,
  SourceOpsEntry,
  SourceOpsReport,
} from '@/lib/mission-ops/sourceOpsTypes';

const COVERAGE_STATE_STYLES: Record<SourceOpsCoverageState, string> = {
  live: 'bg-vt-success/10 text-vt-success border-vt-success/20',
  partial: 'bg-vt-warning/10 text-vt-warning border-vt-warning/20',
  stale: 'bg-vt-danger/10 text-vt-danger/90 border-vt-danger/30',
  unavailable: 'bg-white/5 text-white/45 border-white/10',
  gated: 'bg-vt-info/10 text-vt-info border-vt-info/20',
  accessRequired: 'bg-vt-info/10 text-vt-info border-vt-info/20',
  reviewRequired: 'bg-vt-warning/10 text-vt-warning border-vt-warning/20',
  mock: 'bg-vt-warning/10 text-vt-warning border-vt-warning/20',
  notDecisionGrade: 'bg-white/10 text-white/60 border-white/20',
  notChecked: 'bg-white/10 text-white/60 border-white/20',
};

const SPINE_STATUS_STYLES: Record<SourceOpsReport['spineStatus'], string> = {
  HEALTHY: 'bg-vt-success/10 text-vt-success border-vt-success/20',
  DEGRADED: 'bg-vt-warning/10 text-vt-warning border-vt-warning/20',
  STALE: 'bg-vt-warning/10 text-vt-warning border-vt-warning/20',
  CRITICAL: 'bg-vt-danger/10 text-vt-danger border-vt-danger/20',
};

function formatCoverageState(state: SourceOpsCoverageState): string {
  switch (state) {
    case 'notDecisionGrade':
      return 'Not Decision-Grade';
    case 'notChecked':
      return 'Not Checked';
    case 'accessRequired':
      return 'Access Required';
    case 'reviewRequired':
      return 'Review Required';
    default:
      return state.charAt(0).toUpperCase() + state.slice(1);
  }
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return 'Never';
  }

  return new Date(value).toLocaleString();
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Source health is unavailable right now.';
}

function readStateIcon(state: SourceOpsCoverageState) {
  if (state === 'live') {
    return <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />;
  }

  if (state === 'stale') {
    return <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />;
  }

  if (state === 'unavailable') {
    return <XCircle className="h-3.5 w-3.5" aria-hidden="true" />;
  }

  return null;
}

function SourceOpsRow({ source }: { source: SourceOpsEntry }) {
  return (
    <tr
      className="border-b border-white/5 transition-colors hover:bg-white/[0.02]"
      data-state={source.coverageState}
    >
      <td className="px-4 py-4 align-top">
        <div className="mb-1 flex items-center gap-2">
          <span className="font-medium text-white/90">{source.name}</span>
          {source.isSpine && (
            <span className="rounded border border-vt-info/20 bg-vt-info/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-vt-info">
              Official Spine
            </span>
          )}
        </div>
        <div className="text-xs font-mono text-white/40">{source.sourceId}</div>
      </td>
      <td className="px-4 py-4 align-top">
        <div className="mb-1.5 flex items-center gap-2">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              source.featureFlag.enabled ? 'bg-vt-success' : 'bg-white/25',
            )}
            aria-hidden="true"
          />
          <span className="text-xs text-white/70">{source.featureFlag.key}</span>
        </div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">
          {source.featureFlag.enabled ? 'Enabled' : 'Disabled'}
        </div>
        {source.decisionGrade && (
          <div className="mt-2 inline-flex rounded border border-vt-warning/20 bg-vt-warning/5 px-1.5 py-0.5 text-[10px] text-vt-warning/80">
            Decision-Grade
          </div>
        )}
      </td>
      <td className="px-4 py-4 align-top">
        <div
          className={cn(
            'inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em]',
            COVERAGE_STATE_STYLES[source.coverageState],
          )}
        >
          {readStateIcon(source.coverageState)}
          <span>{formatCoverageState(source.coverageState)}</span>
        </div>

        {source.consecutiveFailures > 0 && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-vt-danger">
            <AlertCircle className="h-3 w-3" aria-hidden="true" />
            {source.consecutiveFailures} consecutive {source.consecutiveFailures === 1 ? 'failure' : 'failures'}
          </div>
        )}
      </td>
      <td className="px-4 py-4 text-right align-top">
        <div className="mb-1 text-xs font-mono text-white/80">
          {formatTimestamp(source.lastSuccessAt)}
        </div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">
          {source.freshnessSlaHours}h SLA
        </div>
        {source.lastFailureAt && (
          <div className="mt-1 text-[10px] text-white/35">
            Last failure {formatTimestamp(source.lastFailureAt)}
          </div>
        )}
      </td>
    </tr>
  );
}

export function SourceOpsPanel() {
  const [report, setReport] = useState<SourceOpsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadReport(): Promise<void> {
      setError(null);
      setReport(null);

      try {
        const response = await fetch('/api/internal/mission-ops/sources', {
          cache: 'no-store',
          signal: controller.signal,
        });

        const payload = await response.json().catch(() => null) as
          | SourceOpsReport
          | { error?: string }
          | null;

        if (!response.ok) {
          throw new Error(
            payload && 'error' in payload && typeof payload.error === 'string'
              ? payload.error
              : 'Failed to fetch source ops report.',
          );
        }

        setReport(payload as SourceOpsReport);
      } catch (nextError) {
        if (!controller.signal.aborted) {
          setError(readErrorMessage(nextError));
        }
      }
    }

    void loadReport();

    return () => controller.abort();
  }, [requestKey]);

  if (!report && !error) {
    return (
      <div
        className="flex flex-1 items-center justify-center px-8 text-sm text-white/55"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-full border-2 border-vt-info border-t-transparent motion-safe:animate-spin" />
          <span>Loading live source health…</span>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div
          className="max-w-md rounded-xl border border-vt-danger/20 bg-vt-danger/5 p-5 text-sm text-white/75"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-vt-danger" aria-hidden="true" />
            <div>
              <p className="font-medium text-vt-danger">Source health unavailable</p>
              <p className="mt-1 text-xs text-white/55">{error ?? 'No report was returned.'}</p>
              <button
                type="button"
                onClick={() => setRequestKey((value) => value + 1)}
                className="mt-4 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/20 hover:text-white"
              >
                <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (report.sources.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-8 text-sm text-white/55" role="status">
        No monitored sources are configured for this environment.
      </div>
    );
  }

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-[#050508] text-white">
      <div className="shrink-0 border-b border-white/5 bg-[#0a0a0f] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium tracking-tight text-white">Source Ops Health</h2>
            <p className="mt-1 text-xs text-white/40">
              Live source coverage and connector freshness.
              Generated {` ${formatTimestamp(report.timestamp)}`}.
            </p>
          </div>
          <div className="text-right">
            <div className="mb-2 text-xs text-white/40">Spine status</div>
            <div
              className={cn(
                'inline-flex rounded border px-3 py-1 text-xs font-bold uppercase tracking-[0.16em]',
                SPINE_STATUS_STYLES[report.spineStatus],
              )}
            >
              {report.spineStatus}
            </div>
          </div>
        </div>

        <p className="mt-4 text-[11px] text-white/45">
          Canonical coverage labels stay literal here: live, stale, gated, unavailable, and not checked are not softened.
        </p>

        {report.alerts.length > 0 && (
          <div className="relative mt-4 overflow-hidden rounded-md border border-vt-danger/20 bg-vt-danger/5 p-4">
            <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 -translate-y-1/2 translate-x-1/3 rounded-full bg-vt-danger/5 blur-3xl" />
            <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-vt-danger">
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              Operator warnings ({report.alerts.length})
            </h3>
            <ul className="mt-2 space-y-1.5">
              {report.alerts.map((alert) => (
                <li key={alert} className="flex items-start gap-2 text-xs text-white/70">
                  <span className="mt-0.5 text-vt-danger/50" aria-hidden="true">
                    •
                  </span>
                  <span>{alert}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-0 p-6">
          <div className="overflow-x-auto rounded-xl border border-white/6 bg-white/[0.02]">
            <table className="min-w-full border-collapse text-left">
              <caption className="sr-only">Live source operations report</caption>
              <thead className="sticky top-0 z-10 bg-[#0f1115] shadow-[0_1px_0_rgba(255,255,255,0.08)]">
                <tr className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                  <th className="px-4 py-3 font-medium">Source Identity</th>
                  <th className="px-4 py-3 font-medium">Configuration</th>
                  <th className="px-4 py-3 font-medium">Coverage State</th>
                  <th className="px-4 py-3 text-right font-medium">Fetch Freshness</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {report.sources.map((source) => (
                  <SourceOpsRow key={source.sourceId} source={source} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
