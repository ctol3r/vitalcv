'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  type LaunchOpsIssue,
  type LaunchOpsSanityCheck,
  type LaunchOpsSnapshot,
  type LaunchOpsSupportItem,
  type PilotQueueStatus,
  type PilotSurfaceControl,
  type PilotSurfaceMode,
  PILOT_QUEUE_STATUSES,
} from '@/lib/pilot-ops/types';

function formatWhen(value: string | null | undefined): string {
  if (!value) {
    return 'Unavailable';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function severityClasses(value: LaunchOpsIssue['severity']): string {
  switch (value) {
    case 'critical':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'high':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'low':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

function statusClasses(value: string): string {
  switch (value) {
    case 'pass':
    case 'RESOLVED':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'warn':
    case 'MITIGATED':
    case 'HOTFIX_QUEUED':
    case 'KNOWN_ISSUE':
    case 'INVESTIGATING':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'fail':
    case 'OPEN':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'ACKNOWLEDGED':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

function sanityClasses(value: LaunchOpsSanityCheck['status']): string {
  switch (value) {
    case 'fail':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'warn':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    default:
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
}

function surfaceModeClasses(value: PilotSurfaceMode): string {
  switch (value) {
    case 'disabled':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'hidden':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'degraded':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    default:
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
}

function sortValues(values: Iterable<string | null | undefined>): string[] {
  return [...new Set([...values].filter((value): value is string => Boolean(value && value.trim().length > 0)))]
    .sort((left, right) => left.localeCompare(right));
}

function summarizeContext(context: Record<string, unknown> | null): Array<{ label: string; value: string }> {
  if (!context) {
    return [];
  }

  const nested = (
    context.nested
    && typeof context.nested === 'object'
    && !Array.isArray(context.nested)
      ? context.nested as Record<string, unknown>
      : null
  );

  const valueOf = (key: string): string | null => {
    const top = context[key];
    if (typeof top === 'string' && top.length > 0) {
      return top;
    }

    const nestedValue = nested?.[key];
    return typeof nestedValue === 'string' && nestedValue.length > 0 ? nestedValue : null;
  };

  const entries: Array<{ label: string; value: string | null }> = [
    { label: 'Kind', value: valueOf('kind') },
    { label: 'Feedback type', value: valueOf('feedbackType') },
    { label: 'Path', value: valueOf('path') },
    { label: 'Opportunity', value: valueOf('selectedOpportunityId') },
    { label: 'Provider', value: valueOf('selectedProviderNpi') },
    { label: 'Storyline', value: valueOf('selectedStorylineId') },
    { label: 'Finding', value: valueOf('selectedFindingId') },
    { label: 'Case', value: valueOf('selectedCaseId') },
    { label: 'Org', value: valueOf('organizationSlug') },
    { label: 'App version', value: valueOf('appVersion') },
  ];

  return entries
    .filter((entry): entry is { label: string; value: string } => Boolean(entry.value))
    .slice(0, 6);
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border border-neutral-200 bg-white p-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-neutral-950">{value}</p>
      <p className="mt-1 text-xs text-neutral-600">{detail}</p>
    </article>
  );
}

function formatSigned(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }
  return String(value);
}

function TriageIssueRow({
  issue,
  onUpdateQueue,
  onQueueHotfix,
}: {
  issue: LaunchOpsIssue;
  onUpdateQueue: (next: { itemId: string; status: PilotQueueStatus; owner: string; note: string }) => Promise<void>;
  onQueueHotfix: (next: { issue: LaunchOpsIssue; owner: string; note: string }) => Promise<void>;
}) {
  const [status, setStatus] = useState<PilotQueueStatus>(
    (issue.status === 'OPEN' ? 'HOTFIX_QUEUED' : issue.status) as PilotQueueStatus,
  );
  const [owner, setOwner] = useState(issue.owner ?? '');
  const [note, setNote] = useState(issue.lastAction?.note ?? '');
  const [isPending, startTransition] = useTransition();

  const canSaveQueueItem = Boolean(issue.queueItemId);
  const canQueueHotfix = !issue.queueItemId && (issue.source === 'runtime' || issue.source === 'metric');

  return (
    <article className="rounded-3xl border border-neutral-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-neutral-950">{issue.title}</h3>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${severityClasses(issue.severity)}`}>
              {issue.severity}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClasses(issue.status)}`}>
              {issue.status}
            </span>
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-semibold text-neutral-700">
              {issue.source}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-neutral-700">{issue.message}</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          {formatWhen(issue.timestamp)}
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-neutral-700 md:grid-cols-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">Route</p>
          <p className="mt-1 break-all font-mono text-xs text-neutral-900">{issue.route}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">Role</p>
          <p className="mt-1 text-neutral-900">{issue.userRole ?? 'Unknown'}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">Owner</p>
          <p className="mt-1 text-neutral-900">{issue.owner ?? 'Unassigned'}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">Reproduce</p>
          {issue.reproduceHref ? (
            <a href={issue.reproduceHref} className="mt-1 inline-block text-sm font-medium text-sky-700 underline underline-offset-4">
              Open route
            </a>
          ) : (
            <p className="mt-1 text-neutral-500">Context only</p>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[12rem_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <label className="space-y-2 text-sm">
          <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as PilotQueueStatus)}
            disabled={!canSaveQueueItem}
            className="w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 disabled:bg-neutral-50"
          >
            {PILOT_QUEUE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">Owner</span>
          <input
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            placeholder="ops@vitalcv.com"
            className="w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">Note or workaround</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Known issue, workaround, or hotfix note"
            className="w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
          />
        </label>

        {canSaveQueueItem ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              startTransition(() => {
                void onUpdateQueue({
                  itemId: issue.queueItemId as string,
                  status,
                  owner,
                  note,
                });
              });
            }}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? 'Saving...' : 'Save'}
          </button>
        ) : canQueueHotfix ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              startTransition(() => {
                void onQueueHotfix({
                  issue,
                  owner,
                  note,
                });
              });
            }}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-violet-700 px-4 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? 'Queueing...' : 'Queue hotfix'}
          </button>
        ) : (
          <div className="flex items-center text-xs text-neutral-500">Telemetry only</div>
        )}
      </div>
    </article>
  );
}

function SurfaceControlRow({
  control,
  onSave,
}: {
  control: PilotSurfaceControl;
  onSave: (next: { surfaceId: string; mode: PilotSurfaceMode; reason: string }) => Promise<void>;
}) {
  const [mode, setMode] = useState<PilotSurfaceMode>(control.mode);
  const [reason, setReason] = useState(control.reason ?? '');
  const [isPending, startTransition] = useTransition();

  return (
    <article className="rounded-3xl border border-neutral-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-neutral-950">{control.label}</h3>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${surfaceModeClasses(control.mode)}`}>
              {control.mode}
            </span>
          </div>
          <p className="mt-2 text-sm text-neutral-600">
            Affects {control.affectsRoutes.join(', ')}
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            Last updated {formatWhen(control.updatedAt)} by {control.updatedBy ?? 'system'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[12rem_minmax(0,1fr)_auto]">
        <label className="space-y-2 text-sm">
          <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">Mode</span>
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as PilotSurfaceMode)}
            className="w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
          >
            {(['enabled', 'degraded', 'disabled', 'hidden'] as const).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">Reason</span>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Temporary mitigation while hotfix ships"
            className="w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
          />
        </label>

        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(() => {
              void onSave({
                surfaceId: control.surfaceId,
                mode,
                reason,
              });
            });
          }}
          className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? 'Saving...' : 'Apply'}
        </button>
      </div>
    </article>
  );
}

export function InternalPilotOpsConsole({
  initialSnapshot = null,
  flags,
}: {
  initialSnapshot?: LaunchOpsSnapshot | null;
  flags: Array<{ key: string; enabled: boolean; description: string }>;
}) {
  const [snapshot, setSnapshot] = useState<LaunchOpsSnapshot | null>(initialSnapshot);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, startRefresh] = useTransition();
  const [unresolvedOnly, setUnresolvedOnly] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [routeFilter, setRouteFilter] = useState('all');

  async function refreshSnapshot() {
    setError(null);
    const response = await fetch('/api/internal/launch-ops', {
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => null) as LaunchOpsSnapshot | { error?: string } | null;
    if (!response.ok || !payload || 'error' in payload) {
      setError(payload && 'error' in payload ? payload.error ?? 'Unable to refresh launch ops.' : 'Unable to refresh launch ops.');
      return;
    }

    setSnapshot(payload as LaunchOpsSnapshot);
  }

  useEffect(() => {
    if (!snapshot) {
      void refreshSnapshot();
    }
  }, [snapshot]);

  async function saveQueueItem(next: {
    itemId: string;
    status: PilotQueueStatus;
    owner: string;
    note: string;
  }) {
    setError(null);
    const response = await fetch(`/api/internal/pilot-ops/queue/${encodeURIComponent(next.itemId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: next.status,
        owner: next.owner.trim() || null,
        note: next.note.trim() || null,
      }),
    });

    const payload = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) {
      setError(payload?.error ?? 'Unable to update queue item.');
      return;
    }

    await refreshSnapshot();
  }

  async function queueHotfix(next: {
    issue: LaunchOpsIssue;
    owner: string;
    note: string;
  }) {
    setError(null);
    const response = await fetch('/api/internal/pilot-ops/queue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: next.issue.source,
        title: next.issue.title,
        message: next.issue.message,
        route: next.issue.route,
        severity: next.issue.severity,
        owner: next.owner.trim() || null,
        status: 'HOTFIX_QUEUED',
        entity: next.issue.entity,
        details: {
          ...(next.issue.details ?? {}),
          issueKey: next.issue.id,
          workaround: next.note.trim() || null,
        },
        blocking: next.issue.blocking,
      }),
    });

    const payload = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) {
      setError(payload?.error ?? 'Unable to queue hotfix.');
      return;
    }

    await refreshSnapshot();
  }

  async function saveSurfaceControl(next: {
    surfaceId: string;
    mode: PilotSurfaceMode;
    reason: string;
  }) {
    setError(null);
    const response = await fetch(`/api/internal/pilot-ops/surfaces/${encodeURIComponent(next.surfaceId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: next.mode,
        reason: next.reason.trim() || null,
      }),
    });

    const payload = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) {
      setError(payload?.error ?? 'Unable to update surface control.');
      return;
    }

    await refreshSnapshot();
  }

  const roleOptions = useMemo(
    () => sortValues(snapshot?.triageIssues.map((issue) => issue.userRole) ?? []),
    [snapshot?.triageIssues],
  );
  const routeOptions = useMemo(
    () => sortValues(snapshot?.triageIssues.map((issue) => issue.route) ?? []),
    [snapshot?.triageIssues],
  );

  const filteredIssues = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return snapshot.triageIssues.filter((issue) => {
      if (unresolvedOnly && issue.status === 'RESOLVED') {
        return false;
      }
      if (severityFilter !== 'all' && issue.severity !== severityFilter) {
        return false;
      }
      if (roleFilter !== 'all' && issue.userRole !== roleFilter) {
        return false;
      }
      if (routeFilter !== 'all' && issue.route !== routeFilter) {
        return false;
      }
      return true;
    });
  }, [roleFilter, routeFilter, severityFilter, snapshot, unresolvedOnly]);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-16 text-neutral-950">
      <header className="flex flex-col gap-4 border-b border-neutral-200 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">Launch-day ops</p>
          <h1 className="mt-2 text-3xl font-semibold">Operator panel, triage board, and hotfix lane</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
            Watch launch health, triage first-user issues, hide unstable surfaces, and keep the first 24 hours explainable.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Snapshot</p>
          <p className="mt-2 text-sm font-medium text-neutral-900">
            {snapshot ? formatWhen(snapshot.generatedAt) : 'Loading...'}
          </p>
          <button
            type="button"
            disabled={isRefreshing}
            onClick={() => {
              startRefresh(() => {
                void refreshSnapshot();
              });
            }}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-2xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-900 transition hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </header>

      {error ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {!snapshot ? (
        <section className="mt-8 rounded-3xl border border-neutral-200 bg-white px-5 py-8 text-sm text-neutral-700">
          Loading launch ops snapshot...
        </section>
      ) : (
        <>
          <section className="mt-8 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
            <article className="rounded-3xl border border-neutral-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">Operator panel</p>
                  <h2 className="mt-2 text-2xl font-semibold text-neutral-950">{snapshot.operatorPanel.summaryLabel}</h2>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">{snapshot.operatorPanel.summaryDetail}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${statusClasses(snapshot.operatorPanel.summaryStatus)}`}>
                  {snapshot.operatorPanel.summaryStatus}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <MetricCard
                  label="Deploy"
                  value={snapshot.operatorPanel.deploy.frontendVersion ?? 'unknown'}
                  detail={`web ${snapshot.operatorPanel.deploy.frontendSha ?? 'unknown'} / api ${snapshot.operatorPanel.deploy.backendSha ?? 'unknown'}`}
                />
                <MetricCard
                  label="Route health"
                  value={`${snapshot.operatorPanel.routeHealth.failed} failed`}
                  detail={`${snapshot.operatorPanel.routeHealth.warned} warned, ${snapshot.operatorPanel.routeHealth.passing} passing`}
                />
                <MetricCard
                  label="Providers"
                  value={String(snapshot.operatorPanel.liveCounts.providers)}
                  detail={`${snapshot.operatorPanel.liveCounts.findings} findings / ${snapshot.operatorPanel.liveCounts.storylines} storylines`}
                />
                <MetricCard
                  label="Opportunities"
                  value={String(snapshot.operatorPanel.liveCounts.opportunities)}
                  detail={`${snapshot.operatorPanel.liveCounts.applications ?? 0} applications visible`}
                />
                <MetricCard
                  label="Auth failures"
                  value={String(snapshot.operatorPanel.liveCounts.authFailures)}
                  detail="Captured in pilot telemetry"
                />
                <MetricCard
                  label="Queue load"
                  value={String(snapshot.operatorPanel.liveCounts.issueQueue)}
                  detail={`${snapshot.operatorPanel.liveCounts.feedbackAndSupport} feedback/support items`}
                />
              </div>
            </article>

            <article className="rounded-3xl border border-neutral-200 bg-white p-5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">Current route health</p>
              <h2 className="mt-2 text-xl font-semibold text-neutral-950">Launch surfaces</h2>
              <div className="mt-5 space-y-3">
                {snapshot.launchReadiness.routeChecks.map((route) => (
                  <div key={route.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-neutral-950">{route.label}</p>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClasses(route.status)}`}>
                        {route.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-neutral-600">{route.detail}</p>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="mt-8">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">Metrics sanity</p>
                <h2 className="mt-2 text-xl font-semibold text-neutral-950">Launch-critical contradictions</h2>
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {snapshot.sanityChecks.map((check) => (
                <article key={check.id} className="rounded-3xl border border-neutral-200 bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-neutral-950">{check.title}</p>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${sanityClasses(check.status)}`}>
                      {check.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-neutral-600">{check.detail}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.14em] text-neutral-500">Current value</p>
                  <p className="mt-1 text-sm font-medium text-neutral-900">{check.value}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-8 rounded-3xl border border-neutral-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">Pilot proof</p>
                <h2 className="mt-2 text-xl font-semibold text-neutral-950">Measured value and current gaps</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
                  Internal truth only: onboarding, readiness movement, blocker resolution, application motion, trust changes, and surfaced review context.
                </p>
              </div>
              <a
                href="/api/internal/pilot-proof"
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-900 transition hover:border-neutral-400 hover:bg-neutral-50"
              >
                Export proof JSON
              </a>
            </div>

            {snapshot.pilotProof ? (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <MetricCard
                    label="Users onboarded"
                    value={String(snapshot.pilotProof.counts.usersOnboarded)}
                    detail={`${snapshot.pilotProof.onboardingCompletion.sampleSize} measured completion samples`}
                  />
                  <MetricCard
                    label="Readiness complete"
                    value={String(snapshot.pilotProof.counts.readinessCompleted)}
                    detail={`${snapshot.pilotProof.readinessProgress.improvedUsers} users improved over time`}
                  />
                  <MetricCard
                    label="Blockers resolved"
                    value={String(snapshot.pilotProof.counts.blockersResolved)}
                    detail={`${snapshot.pilotProof.counts.trustChangesSurfaced} trust changes surfaced`}
                  />
                  <MetricCard
                    label="Applications moving"
                    value={String(snapshot.pilotProof.counts.applicationsMoving)}
                    detail={`${snapshot.pilotProof.counts.applicationsSubmitted} submitted / ${snapshot.pilotProof.counts.employerReviews} reviewed`}
                  />
                  <MetricCard
                    label="Employer actions"
                    value={String(snapshot.pilotProof.counts.employerActionsGenerated)}
                    detail={`${snapshot.pilotProof.counts.findingsSurfaced} findings / ${snapshot.pilotProof.counts.storylinesSurfaced} storylines`}
                  />
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <article className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">Baseline vs current</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                        <p className="text-xs text-neutral-500">Applications</p>
                        <p className="mt-2 text-lg font-semibold text-neutral-950">
                          {snapshot.pilotProof.baselineComparison.current.applications}
                        </p>
                        <p className="mt-1 text-sm text-neutral-600">
                          {formatSigned(snapshot.pilotProof.baselineComparison.delta.applications)} from baseline
                        </p>
                      </div>
                      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                        <p className="text-xs text-neutral-500">Readiness completed</p>
                        <p className="mt-2 text-lg font-semibold text-neutral-950">
                          {snapshot.pilotProof.baselineComparison.current.readinessCompleted}
                        </p>
                        <p className="mt-1 text-sm text-neutral-600">
                          {formatSigned(snapshot.pilotProof.baselineComparison.delta.readinessCompleted)} from baseline
                        </p>
                      </div>
                      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                        <p className="text-xs text-neutral-500">Findings surfaced</p>
                        <p className="mt-2 text-lg font-semibold text-neutral-950">
                          {snapshot.pilotProof.baselineComparison.current.findings}
                        </p>
                        <p className="mt-1 text-sm text-neutral-600">
                          {formatSigned(snapshot.pilotProof.baselineComparison.delta.findings)} from baseline
                        </p>
                      </div>
                      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                        <p className="text-xs text-neutral-500">Storylines surfaced</p>
                        <p className="mt-2 text-lg font-semibold text-neutral-950">
                          {snapshot.pilotProof.baselineComparison.current.storylines}
                        </p>
                        <p className="mt-1 text-sm text-neutral-600">
                          {formatSigned(snapshot.pilotProof.baselineComparison.delta.storylines)} from baseline
                        </p>
                      </div>
                    </div>
                  </article>

                  <article className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">Drop-off still visible</p>
                    <div className="mt-4 space-y-3">
                      {snapshot.pilotProof.dropOff.map((entry) => (
                        <div key={entry.stage} className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-neutral-950">{entry.stage}</p>
                            <span className="text-sm font-semibold text-neutral-700">{entry.count}</span>
                          </div>
                          <p className="mt-2 text-sm text-neutral-600">{entry.detail}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr]">
                  <article className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">Recent progress</p>
                    <div className="mt-4 space-y-3">
                      {snapshot.pilotProof.recentProgress.length > 0 ? snapshot.pilotProof.recentProgress.slice(0, 5).map((change) => (
                        <div key={change.id} className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                          <p className="text-sm font-semibold text-neutral-950">{change.summary}</p>
                          <p className="mt-1 text-xs text-neutral-500">{formatWhen(change.occurredAt)}</p>
                        </div>
                      )) : (
                        <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-600">
                          No recent progress has been recorded in the current proof window.
                        </div>
                      )}
                    </div>
                  </article>

                  <article className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">Proof gaps</p>
                    <div className="mt-4 space-y-3">
                      {snapshot.pilotProof.topProofGaps.map((gap) => (
                        <div key={gap.id} className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                          <p className="text-sm font-semibold text-emerald-900">{gap.title}</p>
                          <p className="mt-1 text-sm text-emerald-800">{gap.detail}</p>
                        </div>
                      ))}
                      {snapshot.pilotProof.remainingGaps.map((gap) => (
                        <div key={gap.id} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                          <p className="text-sm font-semibold text-amber-900">{gap.title}</p>
                          <p className="mt-1 text-sm text-amber-800">{gap.detail}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>
              </>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-600">
                Pilot proof snapshot is unavailable right now.
              </div>
            )}
          </section>

          <section className="mt-8 rounded-3xl border border-neutral-200 bg-white p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">Triage board</p>
                <h2 className="mt-2 text-xl font-semibold text-neutral-950">First-user issue queue</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-2 rounded-2xl border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={unresolvedOnly}
                    onChange={(event) => setUnresolvedOnly(event.target.checked)}
                  />
                  Unresolved only
                </label>
                <select
                  value={severityFilter}
                  onChange={(event) => setSeverityFilter(event.target.value)}
                  className="rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                >
                  <option value="all">All severities</option>
                  {(['critical', 'high', 'medium', 'low'] as const).map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
                <select
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                  className="rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                >
                  <option value="all">All roles</option>
                  {roleOptions.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
                <select
                  value={routeFilter}
                  onChange={(event) => setRouteFilter(event.target.value)}
                  className="rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                >
                  <option value="all">All routes</option>
                  {routeOptions.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {filteredIssues.length > 0 ? (
                filteredIssues.map((issue) => (
                  <TriageIssueRow
                    key={issue.id}
                    issue={issue}
                    onUpdateQueue={saveQueueItem}
                    onQueueHotfix={queueHotfix}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-600">
                  No issues match the current filters.
                </div>
              )}
            </div>
          </section>

          <section className="mt-8">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">Hotfix lane</p>
                <h2 className="mt-2 text-xl font-semibold text-neutral-950">Surface controls and safe-hide switches</h2>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {snapshot.surfaceControls.map((control) => (
                <SurfaceControlRow
                  key={control.surfaceId}
                  control={control}
                  onSave={saveSurfaceControl}
                />
              ))}
            </div>
          </section>

          <section className="mt-8 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <article className="rounded-3xl border border-neutral-200 bg-white p-5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">Support loop</p>
              <h2 className="mt-2 text-xl font-semibold text-neutral-950">Feedback and support context</h2>
              <div className="mt-5 space-y-3">
                {snapshot.supportItems.length > 0 ? (
                  snapshot.supportItems.map((item: LaunchOpsSupportItem) => {
                    const contextRows = summarizeContext(item.context);
                    return (
                      <article key={item.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-neutral-950">{item.title}</p>
                              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${severityClasses(item.severity)}`}>
                                {item.severity}
                              </span>
                              <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700">
                                {item.source}
                              </span>
                            </div>
                            <p className="mt-2 break-all font-mono text-xs text-neutral-700">{item.route}</p>
                          </div>
                          <div className="text-right text-xs text-neutral-500">
                            <p>{formatWhen(item.timestamp)}</p>
                            <p>{item.userRole ?? 'Unknown role'}</p>
                          </div>
                        </div>

                        {contextRows.length > 0 ? (
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {contextRows.map((row) => (
                              <div key={`${item.id}-${row.label}`} className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
                                <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">{row.label}</p>
                                <p className="mt-1 text-sm text-neutral-900">{row.value}</p>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-neutral-700">
                          <span>Email: {item.email ?? 'not provided'}</span>
                          <span>Last action: {item.lastAction?.note ?? item.lastAction?.status ?? 'none yet'}</span>
                          {item.reproduceHref ? (
                            <a href={item.reproduceHref} className="font-medium text-sky-700 underline underline-offset-4">
                              Reproduce
                            </a>
                          ) : null}
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-600">
                    No feedback or support items are present in the current lookback window.
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-3xl border border-neutral-200 bg-white p-5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">Known issues</p>
              <h2 className="mt-2 text-xl font-semibold text-neutral-950">Operator registry</h2>
              <div className="mt-5 space-y-3">
                {snapshot.knownIssues.length > 0 ? (
                  snapshot.knownIssues.map((issue) => (
                    <article key={issue.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-neutral-950">{issue.title}</p>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClasses(issue.status)}`}>
                          {issue.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-neutral-700">Affected flow: {issue.affectedFlow}</p>
                      <p className="mt-1 text-sm text-neutral-700">Workaround: {issue.workaround ?? 'Not recorded yet'}</p>
                      <p className="mt-2 text-xs text-neutral-500">
                        {issue.owner ?? 'Unassigned'} · {formatWhen(issue.updatedAt)}
                      </p>
                    </article>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-600">
                    No known issues have been promoted yet.
                  </div>
                )}
              </div>
            </article>
          </section>

          <section className="mt-8 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <article className="rounded-3xl border border-neutral-200 bg-white p-5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">First 24 hours</p>
              <h2 className="mt-2 text-xl font-semibold text-neutral-950">Launch report inputs</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <MetricCard label="Sign-ins" value={String(snapshot.report24h.signIns)} detail="Pilot metric mirror" />
                <MetricCard label="Onboarding complete" value={String(snapshot.report24h.onboardingCompletion)} detail="Completion events in 24h" />
                <MetricCard label="Readiness views" value={String(snapshot.report24h.readinessViews)} detail="Readiness viewed events" />
                <MetricCard label="Blockers resolved" value={String(snapshot.report24h.blockersResolved)} detail="Queue resolution mirror" />
                <MetricCard label="Applications submitted" value={String(snapshot.report24h.applicationsSubmitted)} detail="Apply submit trail" />
                <MetricCard label="Support issues" value={String(snapshot.report24h.supportIssues)} detail="Feedback and support items" />
              </div>
            </article>

            <article className="rounded-3xl border border-neutral-200 bg-white p-5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">Route patterns</p>
              <h2 className="mt-2 text-xl font-semibold text-neutral-950">Where operators should look first</h2>
              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">Top failing routes</p>
                  <div className="mt-2 space-y-2">
                    {snapshot.report24h.topFailingRoutes.length > 0 ? snapshot.report24h.topFailingRoutes.map((entry) => (
                      <div key={`fail-${entry.route}`} className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
                        <span className="break-all font-mono text-xs text-neutral-900">{entry.route}</span>
                        <span className="font-semibold text-neutral-700">{entry.count}</span>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-neutral-300 px-3 py-4 text-sm text-neutral-600">
                        No failing routes were grouped from the current telemetry window.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-neutral-900">Top confusing surfaces</p>
                  <div className="mt-2 space-y-2">
                    {snapshot.report24h.topConfusingSurfaces.length > 0 ? snapshot.report24h.topConfusingSurfaces.map((entry) => (
                      <div key={`confusing-${entry.route}`} className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
                        <span className="break-all font-mono text-xs text-neutral-900">{entry.route}</span>
                        <span className="font-semibold text-neutral-700">{entry.count}</span>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-neutral-300 px-3 py-4 text-sm text-neutral-600">
                        No repeated confusing surfaces were grouped yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </article>
          </section>

          <section className="mt-8 rounded-3xl border border-neutral-200 bg-white p-5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">Static launch affordances</p>
            <h2 className="mt-2 text-xl font-semibold text-neutral-950">Existing pilot flags</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {flags.map((flag) => (
                <article key={flag.key} className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-neutral-950">{flag.key}</p>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${flag.enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                      {flag.enabled ? 'enabled' : 'hidden'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">{flag.description}</p>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
