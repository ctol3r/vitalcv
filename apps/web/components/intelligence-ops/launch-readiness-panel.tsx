'use client';

import { RefreshCw } from 'lucide-react';
import { useLaunchReadiness } from '@/hooks/useLaunchReadiness';
import {
  formatNullableCount,
  readinessTone,
  shortSha,
  type LaunchReadinessStatus,
  type LaunchReadinessTone,
} from '@/lib/launch/readiness';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import { OpsBadge, OpsCard, SurfaceErrorState } from './primitives';

function badgeToneForLaunchTone(tone: LaunchReadinessTone): 'success' | 'warning' | 'critical' | 'neutral' {
  switch (tone) {
    case 'healthy':
      return 'success';
    case 'warning':
      return 'warning';
    case 'critical':
      return 'critical';
    case 'neutral':
    default:
      return 'neutral';
  }
}

function badgeToneForStatus(status: LaunchReadinessStatus): 'success' | 'warning' | 'critical' {
  switch (status) {
    case 'pass':
      return 'success';
    case 'warn':
      return 'warning';
    case 'fail':
    default:
      return 'critical';
  }
}

function MetricTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-3">
      <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--vt-text-3)]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[var(--vt-text-1)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--vt-text-3)]">{detail}</p>
    </div>
  );
}

function StatusRow({
  label,
  status,
  detail,
}: {
  label: string;
  status: LaunchReadinessStatus;
  detail: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--vt-text-1)]">{label}</p>
        <p className="text-xs leading-5 text-[var(--vt-text-3)]">{detail}</p>
      </div>
      <OpsBadge label={status} tone={badgeToneForStatus(status)} />
    </div>
  );
}

function VersionRow({
  label,
  version,
  sha,
  deploymentId,
  target,
  detail,
  health,
}: {
  label: string;
  version: string | null;
  sha: string | null;
  deploymentId: string | null;
  target: string | null;
  detail: string;
  health: 'healthy' | 'degraded' | 'unknown';
}) {
  return (
    <div className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-[var(--vt-text-1)]">{label}</p>
        <OpsBadge
          label={health === 'healthy' ? 'healthy' : health === 'degraded' ? 'degraded' : 'unknown'}
          tone={health === 'healthy' ? 'success' : health === 'degraded' ? 'warning' : 'neutral'}
        />
      </div>
      <div className="mt-2 space-y-1 text-xs text-[var(--vt-text-3)]">
        <p>Version {version ?? 'unknown'}</p>
        <p>SHA {shortSha(sha)}</p>
        <p>Deploy {deploymentId ?? 'unavailable'}</p>
        <p>Target {target ?? 'unknown'}</p>
        <p>{detail}</p>
      </div>
    </div>
  );
}

export function LaunchReadinessPanel({
  compact = false,
}: {
  compact?: boolean;
}) {
  const launch = useLaunchReadiness(compact ? 90_000 : 60_000);

  if (launch.error && !launch.data) {
    return (
      <SurfaceErrorState
        title="Launch truth unavailable"
        description={launch.error}
        onRetry={launch.refresh}
      />
    );
  }

  if (!launch.data) {
    return (
      <OpsCard className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Launch Truth</p>
            <p className="mt-1 text-sm text-[var(--vt-text-2)]">Collecting route health, live counts, and release markers.</p>
          </div>
          <RefreshCw className="h-4 w-4 animate-spin text-[var(--vt-text-3)]" />
        </div>
      </OpsCard>
    );
  }

  const summaryTone = readinessTone(launch.data.summary.status);
  const visibleAlerts = compact ? launch.data.alerts.slice(0, 3) : launch.data.alerts;
  const visibleRoutes = compact ? launch.data.routeChecks.slice(0, 5) : launch.data.routeChecks;
  const visibleLoops = compact ? launch.data.loopChecks.slice(0, 4) : launch.data.loopChecks;

  return (
    <OpsCard className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Launch Truth</p>
          <p className="mt-1 text-lg font-semibold text-[var(--vt-text-1)]">{launch.data.summary.label}</p>
          <p className="mt-1 text-sm text-[var(--vt-text-2)]">{launch.data.summary.detail}</p>
        </div>
        <div className="space-y-2 text-right">
          <OpsBadge label={launch.data.summary.status} tone={badgeToneForLaunchTone(summaryTone)} />
          <button
            type="button"
            onClick={launch.refresh}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--vt-text-2)] transition hover:text-[var(--vt-text-1)]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      <div className={`grid gap-3 ${compact ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-2 xl:grid-cols-5'}`}>
        <MetricTile
          label="Providers"
          value={String(launch.data.counts.providers)}
          detail={`${launch.data.counts.storylines} storylines`}
        />
        <MetricTile
          label="Findings"
          value={String(launch.data.counts.findings)}
          detail={`${launch.data.counts.actions} actions`}
        />
        <MetricTile
          label="Graph"
          value={`${launch.data.counts.graphNodes}N`}
          detail={`${launch.data.counts.graphEdges}E live`}
        />
        <MetricTile
          label="Opportunities"
          value={String(launch.data.counts.opportunities)}
          detail={`${launch.data.counts.employers} employers`}
        />
        {!compact ? (
          <MetricTile
            label="Applications"
            value={formatNullableCount(launch.data.counts.applications)}
            detail="Operator session if available"
          />
        ) : null}
      </div>

      <div className={`grid gap-3 ${compact ? 'lg:grid-cols-2' : 'xl:grid-cols-2'}`}>
        <VersionRow
          label="Frontend"
          version={launch.data.versions.frontend.version}
          sha={launch.data.versions.frontend.sha}
          deploymentId={launch.data.versions.frontend.deploymentId}
          target={launch.data.versions.frontend.target}
          detail={launch.data.versions.frontend.detail}
          health={launch.data.versions.frontend.health}
        />
        <VersionRow
          label="Backend"
          version={launch.data.versions.backend.version}
          sha={launch.data.versions.backend.sha}
          deploymentId={launch.data.versions.backend.deploymentId}
          target={launch.data.versions.backend.target}
          detail={launch.data.versions.backend.detail}
          health={launch.data.versions.backend.health}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--vt-text-3)]">Core Loops</p>
          <p
            className="text-[11px] text-[var(--vt-text-3)]"
            title={formatAbsoluteTime(launch.data.generatedAt)}
          >
            {formatRelativeTime(launch.data.generatedAt)}
          </p>
        </div>
        <div className="space-y-2">
          {visibleLoops.map((check) => (
            <StatusRow
              key={check.id}
              label={check.label}
              status={check.status}
              detail={check.detail}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--vt-text-3)]">Route Checks</p>
        <div className="space-y-2">
          {visibleRoutes.map((route) => (
            <StatusRow
              key={route.id}
              label={route.label}
              status={route.status}
              detail={`${route.detail} ${route.httpStatus ? `(${route.httpStatus})` : ''}`.trim()}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--vt-text-3)]">Alerts</p>
        {visibleAlerts.length > 0 ? (
          <div className="space-y-2">
            {visibleAlerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[var(--vt-text-1)]">{alert.title}</p>
                  <OpsBadge label={alert.tone} tone={badgeToneForLaunchTone(alert.tone)} />
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--vt-text-3)]">{alert.detail}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-3 text-sm text-[var(--vt-text-2)]">
            No launch contradictions are currently surfaced.
          </p>
        )}
      </div>
    </OpsCard>
  );
}
