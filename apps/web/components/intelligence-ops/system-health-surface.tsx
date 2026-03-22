'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useFindings } from '@/hooks/useFindings';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import {
  deriveSystemHealthSurfaceState,
  formatLastRefreshMessage,
  getSurfaceFreshnessState,
  hasDegradedDataSources,
} from '@/lib/intelligence/state';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import { OperationsShell } from './shell';
import { LaunchReadinessPanel } from './launch-readiness-panel';
import { OpsBadge, OpsCard, SurfaceBanner, SurfaceErrorState, severityTone } from './primitives';

interface HealthCountPayload {
  providers?: unknown;
  findings?: unknown;
  storylines?: unknown;
}

interface HealthTickerSource {
  incidents?: Array<{
    id: string;
    severity: string;
    title: string;
    summary: string;
    occurredAt?: string | null;
  }>;
  sources?: Array<{
    source: string;
    status: string;
    artifactCount: number;
    lastSeen?: string | null;
  }>;
  cards?: Array<{
    id: string;
    summary?: string;
    detail?: string;
    label?: string;
    tone?: 'healthy' | 'degraded' | 'critical' | 'neutral';
  }>;
}

interface HealthTrafficCounts {
  providerCount: number | null;
  findingCount: number | null;
  storylineCount: number | null;
}

interface HealthTickerItem {
  id: string;
  tone: 'neutral' | 'info' | 'warning' | 'critical' | 'success';
  title: string;
  detail: string;
  actionLabel: string;
  actionHref: string | null;
}

function parseCountValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value === 'string') {
    const normalized = Number.parseInt(value.replace(/,/g, ''), 10);
    return Number.isFinite(normalized) ? Math.max(0, normalized) : null;
  }

  return null;
}

function parseCountFromText(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/(\d[\d,]*)/);
  if (!match) {
    return null;
  }

  const normalized = Number.parseInt(match[1] ?? '', 10);
  return Number.isFinite(normalized) ? Math.max(0, normalized) : null;
}

function resolveHealthTrafficCounts(
  health: (HealthCountPayload & HealthTickerSource & { cards?: unknown }) | null,
): HealthTrafficCounts {
  const providerFromPayload = parseCountValue(health?.providers);
  const findingFromPayload = parseCountValue(health?.findings);
  const storylineFromPayload = parseCountValue(health?.storylines);
  const cards = Array.isArray(health?.cards) ? health.cards as Array<{ id: string; summary?: string; detail?: string }> : [];
  const providerCard = cards.find((card) => card.id === 'providers');
  const findingCard = cards.find((card) => card.id === 'findings');
  const storylineCard = cards.find((card) => card.id === 'storylines');

  return {
    providerCount: providerFromPayload
      ?? parseCountFromText(providerCard?.summary)
      ?? parseCountFromText(providerCard?.detail),
    findingCount: findingFromPayload
      ?? parseCountFromText(findingCard?.summary)
      ?? parseCountFromText(findingCard?.detail),
    storylineCount: storylineFromPayload
      ?? parseCountFromText(storylineCard?.summary)
      ?? parseCountFromText(storylineCard?.detail),
  };
}

function formatCount(value: number | null): string {
  return value === null ? '—' : `${value}`;
}

function formatSourceLabel(status: string): string {
  switch (status) {
    case 'OPERATIONAL':
      return 'Operational';
    case 'DEGRADED':
      return 'Degraded';
    case 'OUTAGE':
      return 'Outage';
    default:
      return status;
  }
}

function buildHealthTickerItems(input: {
  health: (HealthCountPayload & HealthTickerSource & { cards?: unknown }) | null;
  findings: Array<{
    id: string;
    title: string;
    summary: string;
    severity: string;
    status: string;
    providerNpi: string | null;
    providerLabel: string | null;
  }>;
}): HealthTickerItem[] {
  const items: HealthTickerItem[] = [];

  for (const finding of input.findings.slice(0, 4)) {
    items.push({
      id: `finding:${finding.id}`,
      tone: finding.severity === 'critical'
        ? 'critical'
        : finding.severity === 'high'
          ? 'warning'
          : finding.severity === 'medium'
            ? 'info'
            : 'neutral',
      title: finding.title,
      detail: `${finding.severity.toUpperCase()} · ${finding.status.toUpperCase()} · ${finding.providerLabel ?? finding.providerNpi ?? 'Unscoped'} · ${finding.summary}`,
      actionLabel: 'Open finding',
      actionHref: `/findings/${finding.id}`,
    });
  }

  for (const incident of input.health?.incidents?.slice(0, 3) ?? []) {
    items.push({
      id: `incident:${incident.id}`,
      tone: incident.severity === 'critical'
        ? 'critical'
        : incident.severity === 'high'
          ? 'warning'
          : 'info',
      title: incident.title,
      detail: `${incident.severity.toUpperCase()} incident · ${incident.summary}`,
      actionLabel: 'Review health',
      actionHref: '/intelligence?view=system-health',
    });
  }

  const cards = Array.isArray(input.health?.cards) ? input.health.cards as Array<{
    id: string;
    label?: string;
    summary?: string;
    detail?: string;
    tone?: 'healthy' | 'degraded' | 'critical' | 'neutral';
  }> : [];
  const verificationCard = cards.find((card) => card.id === 'verification');
  if (verificationCard) {
    items.push({
      id: `card:${verificationCard.id}`,
      tone: verificationCard.tone === 'critical'
        ? 'critical'
        : verificationCard.tone === 'degraded'
          ? 'warning'
          : 'neutral',
      title: verificationCard.label ?? 'Verification',
      detail: [verificationCard.summary, verificationCard.detail].filter(Boolean).join(' · '),
      actionLabel: 'Open findings',
      actionHref: '/intelligence?view=findings',
    });
  }

  for (const source of input.health?.sources ?? []) {
    items.push({
      id: `source:${source.source}`,
      tone: source.status === 'OUTAGE'
        ? 'critical'
        : source.status === 'DEGRADED'
          ? 'warning'
          : 'neutral',
      title: source.source,
      detail: `${formatSourceLabel(source.status)} · ${source.artifactCount} artifact${source.artifactCount === 1 ? '' : 's'} · ${source.lastSeen ?? 'not reported'}`,
      actionLabel: 'Refresh health',
      actionHref: '/intelligence?view=system-health',
    });
  }

  return items;
}

function formatLastUpdatedLabel(lastUpdated: string | null): string {
  if (!lastUpdated) {
    return 'No updates yet';
  }

  const timestamp = Date.parse(lastUpdated);
  if (!Number.isFinite(timestamp)) {
    return 'No updates yet';
  }

  const ageSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (ageSeconds < 60) {
    return `${ageSeconds} sec ago`;
  }

  const ageMinutes = Math.max(1, Math.floor(ageSeconds / 60));
  return `${ageMinutes} min ago`;
}

export function SystemHealthSurface() {
  const health = useSystemHealth();
  const findings = useFindings({
    limit: 8,
    pollIntervalMs: 30_000,
  });
  const [scanState, setScanState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [pollState, setPollState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [tickerIndex, setTickerIndex] = useState(0);

  const staleState = getSurfaceFreshnessState({
    generatedAt: health.data?.generatedAt,
    lastUpdated: health.lastUpdated,
  });
  const degradedSources = hasDegradedDataSources(health.data);
  const surfaceState = deriveSystemHealthSurfaceState(health.data, Boolean(health.error && !health.data));
  const trafficCounts = resolveHealthTrafficCounts((health.data ?? null) as (HealthCountPayload & HealthTickerSource) | null);
  const tickerItems = buildHealthTickerItems({
    health: health.data ?? null,
    findings: findings.data?.findings?.map((finding) => ({
      id: finding.id,
      title: finding.title,
      summary: finding.summary,
      severity: finding.severity,
      status: finding.status,
      providerNpi: finding.providerNpi,
      providerLabel: finding.providerLabel,
    })) ?? [],
  });
  const providerCount = trafficCounts.providerCount ?? 0;
  const findingCount = trafficCounts.findingCount ?? 0;
  const storylineCount = trafficCounts.storylineCount ?? 0;
  const countsAvailable = trafficCounts.providerCount !== null
    && trafficCounts.findingCount !== null
    && trafficCounts.storylineCount !== null;
  const isHeartbeatHealthy = countsAvailable
    && providerCount > 0
    && findingCount > 0
    && storylineCount > 0;
  const healthReadinessLabel = surfaceState.mode === 'broken'
    ? 'BROKEN'
    : isHeartbeatHealthy
      ? 'LIVE'
      : surfaceState.mode === 'empty'
        ? 'QUIET'
        : 'ATTENTION';
  const healthReadinessTone = surfaceState.mode === 'broken'
    ? 'critical'
    : isHeartbeatHealthy
      ? 'success'
      : surfaceState.mode === 'empty'
        ? 'neutral'
        : 'warning';
  const healthReadinessDescription = surfaceState.mode === 'broken'
    ? 'System health is degraded and requires operator attention.'
    : isHeartbeatHealthy
      ? 'Provider, finding, and storyline counts are being refreshed from live telemetry.'
      : surfaceState.mode === 'empty'
        ? 'Telemetry is live but quiet in the current window.'
        : 'System signals need attention before the feed can be considered healthy.';
  const tickerSignature = tickerItems.map((item) => item.id).join('||');
  const lastUpdatedLabel = formatLastUpdatedLabel(health.lastUpdated ?? health.data?.generatedAt ?? null);

  useEffect(() => {
    setTickerIndex(0);
  }, [tickerSignature]);

  useEffect(() => {
    if (tickerItems.length <= 1) {
      return;
    }

    const interval = window.setInterval(() => {
      setTickerIndex((current) => (current + 1) % tickerItems.length);
    }, 6500);

    return () => {
      window.clearInterval(interval);
    };
  }, [tickerSignature, tickerItems.length]);

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
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                surfaceState.mode === 'broken'
                  ? 'bg-red-500 animate-pulse'
                  : isHeartbeatHealthy
                    ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30'
                    : 'bg-cyan-400 animate-pulse'
              }`}
            />
            <p className="font-medium text-[var(--vt-text-1)]">{surfaceState.label}</p>
          </div>
          <p className="text-xs text-[var(--vt-text-2)]">
            {health.loading ? 'Loading live health telemetry.' : (health.data?.headline ?? 'Live headline unavailable.')}
          </p>
          <div className="space-y-1 border-t border-[var(--vt-border)] pt-1 text-[10px] text-[var(--vt-text-3)]">
            <p className="inline-flex items-center gap-2 uppercase tracking-wider text-[9px]">
              <span
                className={`h-2 w-2 rounded-full ${
                  surfaceState.mode === 'broken'
                    ? 'bg-red-500'
                    : health.error && !health.data
                      ? 'bg-red-500'
                      : health.error
                        ? 'bg-amber-400 animate-pulse'
                        : 'bg-emerald-500 animate-pulse'
                }`}
              />
              {surfaceState.mode === 'broken'
                ? 'SIGNALS BROKEN'
                : health.error && !health.data
                  ? 'SIGNALS UNAVAILABLE'
                  : health.error
                    ? 'SIGNALS DEGRADED'
                    : 'LIVE SIGNALS ACTIVE'}
            </p>
            <p>Readiness: {healthReadinessLabel}</p>
            <p title={health.lastUpdated ? formatAbsoluteTime(health.lastUpdated) : undefined}>
              Last updated {lastUpdatedLabel}
            </p>
          </div>
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
              One or more data sources are degraded. Open the findings feed and system health view to inspect impact.
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

      <LaunchReadinessPanel compact />

      <OpsCard className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Current state</h2>
          <OpsBadge label={healthReadinessLabel} tone={healthReadinessTone} />
        </div>
        <p className="text-sm text-[var(--vt-text-2)]">{healthReadinessDescription}</p>
        <p className="text-sm text-[var(--vt-text-3)]">
          {health.loading ? 'Health telemetry is loading.' : (health.data?.headline ?? 'Live headline unavailable.')}
        </p>
        <div className="flex flex-wrap gap-2 text-sm text-[var(--vt-text-3)]">
          <span>{formatCount(trafficCounts.providerCount)} providers</span>
          <span>{formatCount(trafficCounts.findingCount)} findings</span>
          <span>{formatCount(trafficCounts.storylineCount)} storylines</span>
          <span>{health.data?.sources?.length ?? 0} connectors</span>
          <span>{health.data?.incidents?.length ?? 0} incidents</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/intelligence?view=findings"
            className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-400/15"
          >
            Open findings feed
          </Link>
          <Link
            href="/intelligence?view=system-health"
            className="rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--vt-text-2)] transition hover:text-[var(--vt-text-1)]"
          >
            Inspect health plane
          </Link>
        </div>
      </OpsCard>

      <OpsCard className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Live signal ticker</h2>
          <span className="text-xs text-[var(--vt-text-3)]">
            {tickerItems.length > 0
              ? `${tickerIndex % tickerItems.length + 1}/${tickerItems.length}`
              : '0/0'}
          </span>
        </div>
        {tickerItems.length > 0 ? (
          (() => {
            const activeItem = tickerItems[tickerIndex % tickerItems.length]!;
            return (
              <div className="space-y-3 rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Now reading</p>
                    <p className="text-sm font-semibold text-[var(--vt-text-1)]">{activeItem.title}</p>
                  </div>
                  <OpsBadge label={activeItem.tone} tone={activeItem.tone} />
                </div>
                <p className="text-sm leading-6 text-[var(--vt-text-2)]">{activeItem.detail}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {activeItem.actionHref ? (
                    <Link
                      href={activeItem.actionHref}
                      className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-400/15"
                    >
                      {activeItem.actionLabel}
                    </Link>
                  ) : null}
                  <span className="text-xs text-[var(--vt-text-3)]">
                    {formatRelativeTime(health.lastUpdated ?? findings.lastUpdated ?? new Date().toISOString())}
                  </span>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="space-y-3 rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Now reading</p>
                <p className="text-sm font-semibold text-[var(--vt-text-1)]">
                  {health.loading ? 'Loading live telemetry' : 'Telemetry is quiet in the current window'}
                </p>
              </div>
              <OpsBadge label={surfaceState.mode === 'empty' ? 'QUIET' : healthReadinessLabel} tone={healthReadinessTone} />
            </div>
            <p className="text-sm leading-6 text-[var(--vt-text-2)]">
              {health.loading
                ? 'Waiting for the first live health payload and findings feed.'
                : 'The health plane is live, but there are no active findings, incidents, or source deltas to cycle right now.'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/intelligence?view=findings"
                className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-400/15"
              >
                Open findings
              </Link>
              <button
                type="button"
                onClick={health.refresh}
                className="rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-1.5 text-xs font-medium text-[var(--vt-text-2)] transition hover:text-[var(--vt-text-1)]"
              >
                Refresh telemetry
              </button>
              <span className="text-xs text-[var(--vt-text-3)]">
                {formatRelativeTime(health.lastUpdated ?? findings.lastUpdated ?? new Date().toISOString())}
              </span>
            </div>
          </div>
        )}
      </OpsCard>

      <OpsCard className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">System heartbeat counts</h2>
          <span className="text-sm text-[var(--vt-text-3)]">
            {health.data?.sources?.length ?? 0} connector{(health.data?.sources?.length ?? 0) === 1 ? '' : 's'}
          </span>
        </div>
        <p className="text-sm text-[var(--vt-text-2)]">
          Provider {formatCount(trafficCounts.providerCount)} • Finding {formatCount(trafficCounts.findingCount)} • Storyline {formatCount(trafficCounts.storylineCount)}
        </p>
        <p className="text-sm text-[var(--vt-text-3)]">
          {health.data?.incidents?.length ?? 0} active incident{(health.data?.incidents?.length ?? 0) === 1 ? '' : 's'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/intelligence?view=findings"
            className="rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-1.5 text-xs font-medium text-[var(--vt-text-2)] transition hover:text-[var(--vt-text-1)]"
          >
            Open findings
          </Link>
          <button
            type="button"
            onClick={health.refresh}
            className="rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-1.5 text-xs font-medium text-[var(--vt-text-2)] transition hover:text-[var(--vt-text-1)]"
          >
            Reload health data
          </button>
        </div>
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Telemetry is live</h2>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/intelligence?view=findings"
                  className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-400/15"
                >
                  Open findings
                </Link>
                <button
                  type="button"
                  onClick={health.refresh}
                  className="rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-1.5 text-xs font-medium text-[var(--vt-text-2)] transition hover:text-[var(--vt-text-1)]"
                >
                  Refresh
                </button>
              </div>
            </div>
            <p className="text-sm text-[var(--vt-text-2)]">
              The health plane is serving live counts and source status. Use the findings feed and scan controls above to push the next update through the trust pipeline.
            </p>
            <div className="grid gap-2 md:grid-cols-3">
              {(health.data?.sources ?? []).slice(0, 3).map((source) => (
                <div key={source.source} className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--vt-text-3)]">{source.source}</p>
                  <p className="mt-1 text-sm font-medium text-[var(--vt-text-1)]">{formatSourceLabel(source.status)}</p>
                  <p className="mt-1 text-xs text-[var(--vt-text-3)]">
                    {source.artifactCount} artifact{source.artifactCount === 1 ? '' : 's'} · {source.lastSeen ?? 'not reported'}
                  </p>
                </div>
              ))}
            </div>
          </OpsCard>
        ) : null}
      </div>

      <OpsCard className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Active incidents</h2>
          <span className="text-sm text-[var(--vt-text-3)]">{health.data?.incidents?.length ?? 0} incidents</span>
        </div>
        <div className="space-y-3">
          {(health.data?.incidents ?? []).length === 0 ? (
            <div className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
              <p className="text-sm text-[var(--vt-text-2)]">No active incidents are being surfaced right now.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/intelligence?view=findings"
                  className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-400/15"
                >
                  Review findings
                </Link>
                <button
                  type="button"
                  onClick={health.refresh}
                  className="rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--vt-text-2)] transition hover:text-[var(--vt-text-1)]"
                >
                  Recheck incidents
                </button>
              </div>
            </div>
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
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href="/intelligence?view=system-health"
                    className="rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--vt-text-2)] transition hover:text-[var(--vt-text-1)]"
                  >
                    Open health plane
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </OpsCard>
    </OperationsShell>
  );
}
