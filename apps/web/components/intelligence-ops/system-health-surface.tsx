'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import {
  formatLastRefreshMessage,
  getSurfaceFreshnessState,
  hasDegradedDataSources,
} from '@/lib/intelligence/state';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import { OperationsShell } from './shell';
import { OpsBadge, OpsCard, SurfaceBanner, SurfaceErrorState, severityTone } from './primitives';

export function SystemHealthSurface() {
  const health = useSystemHealth();
  const [scanState, setScanState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [pollState, setPollState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const staleState = getSurfaceFreshnessState({
    generatedAt: health.data?.generatedAt,
    lastUpdated: health.lastUpdated,
  });
  const degradedSources = hasDegradedDataSources(health.data);

  async function runScan() {
    setScanState('running');
    try {
      const response = await fetch('/api/system-health/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        throw new Error(`Scan request failed with ${response.status}`);
      }
      setScanState('done');
      health.refresh();
    } catch {
      setScanState('error');
    }
  }

  async function triggerPolls() {
    setPollState('running');
    try {
      const response = await fetch('/api/polling/trigger-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        throw new Error(`Poll request failed with ${response.status}`);
      }
      setPollState('done');
      health.refresh();
    } catch {
      setPollState('error');
    }
  }

  return (
    <OperationsShell
      activeHref="/system-health"
      title="System Health"
      description="Connector, graph, and pipeline posture with degraded-state messaging and direct operator triggers for scans and polling."
      breadcrumbs={[{ label: 'System Health' }]}
      meta={(
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Platform state</p>
          <p>{health.data?.headline ?? 'Waiting for telemetry'}</p>
          {health.lastUpdated ? (
            <p title={formatAbsoluteTime(health.lastUpdated)}>Updated {formatRelativeTime(health.lastUpdated)}</p>
          ) : null}
        </div>
      )}
      actions={(
        <>
          <button
            type="button"
            onClick={health.refresh}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void runScan()}
            className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            {scanState === 'running' ? 'Scanning…' : 'Run scan'}
          </button>
          <button
            type="button"
            onClick={() => void triggerPolls()}
            className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/5 hover:text-white"
          >
            {pollState === 'running' ? 'Triggering…' : 'Trigger polls'}
          </button>
        </>
      )}
      banner={(
        <>
          {health.recovering && health.error ? (
            <SurfaceBanner tone="warning">
              Live refresh failed. Showing the last successful health snapshot while retries continue.
            </SurfaceBanner>
          ) : null}
          {degradedSources ? (
            <SurfaceBanner tone="warning">
              Some data sources are degraded. Findings may be incomplete.
            </SurfaceBanner>
          ) : null}
          {staleState.isStale && staleState.ageMinutes !== null ? (
            <SurfaceBanner tone="info">
              {formatLastRefreshMessage(staleState.ageMinutes)}
            </SurfaceBanner>
          ) : null}
          {scanState === 'error' || pollState === 'error' ? (
            <SurfaceBanner tone="critical">
              One of the operator actions failed. Retry from this page after checking backend availability.
            </SurfaceBanner>
          ) : null}
        </>
      )}
    >
      {health.error && !health.data ? (
        <SurfaceErrorState
          title="System health unavailable"
          description={health.error}
          onRetry={health.refresh}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(health.data?.cards ?? []).map((card) => (
          <OpsCard key={card.id} className="space-y-2">
            <OpsBadge label={card.tone} tone={severityTone(card.tone)} />
            <h2 className="text-lg font-semibold text-white">{card.label}</h2>
            <p className="text-sm text-slate-300">{card.summary}</p>
            <p className="text-sm text-slate-400">{card.detail}</p>
          </OpsCard>
        ))}
      </div>

      <OpsCard className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Active incidents</h2>
          <span className="text-sm text-slate-400">{health.data?.incidents.length ?? 0} incidents</span>
        </div>
        <div className="space-y-3">
          {(health.data?.incidents ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">No active incidents are currently being surfaced by the intelligence health layer.</p>
          ) : (
            health.data?.incidents.map((incident) => (
              <div key={incident.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <OpsBadge label={incident.severity} tone={severityTone(incident.severity)} />
                  <span className="text-sm text-white">{incident.title}</span>
                  {incident.occurredAt ? (
                    <span className="text-sm text-slate-400" title={formatAbsoluteTime(incident.occurredAt)}>
                      {formatRelativeTime(incident.occurredAt)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-slate-300">{incident.summary}</p>
              </div>
            ))
          )}
        </div>
      </OpsCard>
    </OperationsShell>
  );
}
