'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import {
  deriveSystemHealthSurfaceState,
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
  const surfaceState = deriveSystemHealthSurfaceState(health.data, Boolean(health.error && !health.data));

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
      activeHref="/intelligence"
      activeNavKey="system-health"
      title="System Health"
      description="Connector, graph, and pipeline posture with degraded-state messaging and direct operator triggers for scans and polling."
      breadcrumbs={[{ label: 'System Health' }]}
      meta={(
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Platform state</p>
          <div className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full ${
              surfaceState.mode === 'broken'
                ? 'bg-red-500 animate-pulse'
                : surfaceState.mode === 'degraded'
                  ? 'bg-amber-500'
                  : surfaceState.mode === 'empty'
                    ? 'bg-sky-500'
                    : 'bg-emerald-500 shadow-sm shadow-emerald-500/30'
            }`} />
            <p className="font-medium text-[var(--vt-text-1)]">
              {surfaceState.label}
            </p>
          </div>
          <p className="text-xs text-[var(--vt-text-2)]">{surfaceState.description}</p>
          <p className="text-xs text-[var(--vt-text-3)]">{health.data?.headline ?? 'Waiting for telemetry'}</p>
          {health.lastUpdated ? (
            <p className="text-[10px] text-[var(--vt-text-3)]" title={formatAbsoluteTime(health.lastUpdated)}>Updated {formatRelativeTime(health.lastUpdated)}</p>
          ) : null}
        </div>
      )}
      actions={(
        <>
          <button
            type="button"
            onClick={health.refresh}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-4 py-2 text-sm font-medium text-[var(--vt-text-1)] transition hover:bg-[var(--vt-surface-2)]"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void runScan()}
            className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[var(--vt-accent)]"
          >
            {scanState === 'running' ? 'Scanning…' : 'Run scan'}
          </button>
          <button
            type="button"
            onClick={() => void triggerPolls()}
            className="rounded-full border border-[var(--vt-border)] px-4 py-2 text-sm font-medium text-[var(--vt-text-2)] transition hover:bg-[var(--vt-surface-2)] hover:text-[var(--vt-text-1)]"
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
          {surfaceState.mode === 'empty' ? (
            <SurfaceBanner tone="info">
              The health plane is reachable, but it has not observed meaningful verification traffic yet.
            </SurfaceBanner>
          ) : null}
          {surfaceState.mode === 'broken' && health.data ? (
            <SurfaceBanner tone="critical">
              Multiple trust subsystems are failing closed. Treat evidence freshness and connector coverage as incomplete until operators remediate the outage.
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

      <OpsCard className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Current state</h2>
          <OpsBadge
            label={surfaceState.label}
            tone={surfaceState.mode === 'healthy' ? 'success' : surfaceState.mode === 'empty' ? 'info' : surfaceState.mode === 'degraded' ? 'warning' : 'critical'}
          />
        </div>
        <p className="text-sm text-[var(--vt-text-2)]">{surfaceState.description}</p>
        <p className="text-sm text-[var(--vt-text-3)]">
          {health.data?.sources.length ?? 0} connector{(health.data?.sources.length ?? 0) === 1 ? '' : 's'} • {health.data?.incidents.length ?? 0} active incident{(health.data?.incidents.length ?? 0) === 1 ? '' : 's'}
        </p>
      </OpsCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(health.data?.cards ?? []).length > 0 ? (
          (health.data?.cards ?? []).map((card) => (
            <OpsCard key={card.id} className="space-y-2">
              <OpsBadge label={card.tone} tone={severityTone(card.tone)} />
              <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">{card.label}</h2>
              <p className="text-sm text-[var(--vt-text-2)]">{card.summary}</p>
              <p className="text-sm text-[var(--vt-text-3)]">{card.detail}</p>
            </OpsCard>
          ))
        ) : !health.loading && !health.error ? (
          <OpsCard className="col-span-full space-y-3">
            <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">System online — awaiting data</h2>
            <p className="text-sm text-[var(--vt-text-2)]">
              The intelligence layer is running but no health cards are reporting yet. This is normal for a fresh deployment.
            </p>
            <div className="space-y-1.5 text-sm text-[var(--vt-text-3)]">
              <p>To populate health data:</p>
              <p>1. Add providers via the <a href="/onboarding" className="underline">onboarding flow</a> or NPI lookup</p>
              <p>2. Click <strong>Run scan</strong> above to trigger investigators</p>
              <p>3. Click <strong>Trigger polls</strong> to refresh data sources</p>
            </div>
          </OpsCard>
        ) : null}
      </div>

      <OpsCard className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Active incidents</h2>
          <span className="text-sm text-[var(--vt-text-3)]">{health.data?.incidents.length ?? 0} incidents</span>
        </div>
        <div className="space-y-3">
          {(health.data?.incidents ?? []).length === 0 ? (
            <p className="text-sm text-[var(--vt-text-3)]">No active incidents are currently being surfaced by the intelligence health layer.</p>
          ) : (
            health.data?.incidents.map((incident) => (
              <div key={incident.id} className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <OpsBadge label={incident.severity} tone={severityTone(incident.severity)} />
                  <span className="text-sm text-[var(--vt-text-1)]">{incident.title}</span>
                  {incident.occurredAt ? (
                    <span className="text-sm text-[var(--vt-text-3)]" title={formatAbsoluteTime(incident.occurredAt)}>
                      {formatRelativeTime(incident.occurredAt)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-[var(--vt-text-2)]">{incident.summary}</p>
              </div>
            ))
          )}
        </div>
      </OpsCard>
    </OperationsShell>
  );
}
