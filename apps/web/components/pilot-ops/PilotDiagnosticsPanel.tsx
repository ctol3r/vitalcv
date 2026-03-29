'use client';

import { useEffect, useRef, useState } from 'react';
import {
  type SourceOpsReport,
} from '@/lib/mission-ops/sourceOpsTypes';
import {
  classifySourceHealthErrors,
  formatSourceHealthAge,
  type SourceHealthErrorClass,
} from '@/lib/mission-ops/sourceHealthContract';

const ERROR_CLASS_COLORS: Record<SourceHealthErrorClass, string> = {
  connectivity: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
  freshness: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  config: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400',
  unsupported: 'border-zinc-600/30 bg-zinc-600/10 text-zinc-500',
  review: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
};

export function PilotDiagnosticsPanel() {
  const [report, setReport] = useState<SourceOpsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function fetchData() {
      try {
        const res = await fetch('/api/internal/source-health');
        if (!res.ok) {
          if (mountedRef.current) setError('Diagnostics unavailable');
          return;
        }
        const data = (await res.json()) as SourceOpsReport;
        if (mountedRef.current) {
          setReport(data);
          setError(null);
        }
      } catch {
        if (mountedRef.current) setError('Diagnostics unavailable');
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }

    fetchData();
    return () => { mountedRef.current = false; };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
        <p className="text-xs text-zinc-500">Loading diagnostics…</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
        <p className="text-xs text-rose-400">{error ?? 'No data available'}</p>
      </div>
    );
  }

  const spineSources = report.sources.filter((s) => s.isSpine);
  const failingSources = [...spineSources]
    .filter((s) => s.consecutiveFailures > 0)
    .sort((a, b) => b.consecutiveFailures - a.consecutiveFailures);
  const mostFailing = failingSources[0] ?? null;
  const errorGroups = classifySourceHealthErrors(spineSources);
  const allHealthy = !mostFailing && errorGroups.length === 0;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
      <h3 className="mb-4 text-sm font-semibold text-zinc-200">Pilot Diagnostics</h3>

      {allHealthy ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <p className="text-xs text-emerald-400">All spine sources healthy</p>
        </div>
      ) : (
        <div className="space-y-4">
          {mostFailing && (
            <div>
              <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Most failing source
              </h4>
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2.5">
                <p className="text-xs font-medium text-zinc-300">{mostFailing.name}</p>
                <p className="mt-0.5 text-[10px] text-rose-400">
                  {mostFailing.consecutiveFailures} consecutive failure{mostFailing.consecutiveFailures > 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )}

          <div>
            <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Last successful run per source
            </h4>
            <div className="space-y-1">
              {spineSources.map((source) => (
              <div key={source.sourceId} className="flex items-center justify-between px-1 py-1">
                <span className="text-[11px] text-zinc-400">{source.name}</span>
                <span className="text-[11px] text-zinc-500">{formatSourceHealthAge(source.lastSuccessAt)}</span>
              </div>
            ))}
          </div>
          </div>

          {errorGroups.length > 0 && (
            <div>
              <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Error classes
              </h4>
              <div className="space-y-1.5">
                {errorGroups.map((group) => (
                  <div
                    key={group.className}
                    className={`rounded-lg border px-3 py-2 ${ERROR_CLASS_COLORS[group.className]}`}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider">{group.label}</p>
                    <p className="mt-0.5 text-[11px] opacity-80">
                      {group.sources.map((s) => s.name).join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
