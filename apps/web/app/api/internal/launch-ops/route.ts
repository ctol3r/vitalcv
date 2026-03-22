import { type NextRequest, NextResponse } from 'next/server';
import type { LaunchReadinessPayload } from '@/lib/launch/readiness';
import type {
  LaunchOps24HourReport,
  LaunchOpsIssue,
  LaunchOpsKnownIssue,
  LaunchOpsSanityCheck,
  LaunchOpsSnapshot,
  LaunchOpsSupportItem,
  PilotQueueItem,
} from '@/lib/pilot-ops/types';
import { fetchPilotProofSnapshot } from '@/lib/server/pilot-proof';
import { fetchPilotOpsSummary, requireAdminPilotSession } from '@/lib/server/pilot-ops';

export const runtime = 'nodejs';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function detailsRecord(details: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!details) {
    return null;
  }

  const nested = asRecord(details.details);
  if (!nested) {
    return details;
  }

  return {
    ...details,
    nested,
  };
}

function readIssueKey(item: PilotQueueItem): string | null {
  const details = detailsRecord(item.details);
  return asString(details?.issueKey)
    ?? asString(asRecord(details?.nested)?.issueKey);
}

function routeForItem(item: Pick<PilotQueueItem, 'route'>): string {
  return item.route && item.route.trim().length > 0 ? item.route : '/internal/pilot-ops';
}

function reproduceHref(route: string, details: Record<string, unknown> | null | undefined): string | null {
  const detailRoute = asString(details?.path)
    ?? asString(asRecord(details?.nested)?.path)
    ?? asString(details?.route)
    ?? asString(asRecord(details?.nested)?.route);

  const resolved = detailRoute ?? route;
  return resolved.startsWith('/') && !resolved.startsWith('/api/') ? resolved : null;
}

function buildQueueIssue(item: PilotQueueItem): LaunchOpsIssue {
  const details = detailsRecord(item.details);
  const route = routeForItem(item);

  return {
    id: `queue:${item.id}`,
    title: item.title,
    message: item.message,
    source: item.source,
    route,
    userRole: item.role,
    severity: item.severity,
    timestamp: item.updatedAt,
    status: item.status,
    owner: item.owner,
    queueItemId: item.id,
    blocking: item.blocking,
    entity: item.entity,
    details,
    lastAction: item.lastAction,
    reproduceHref: reproduceHref(route, details),
  };
}

function buildSupportItem(item: PilotQueueItem): LaunchOpsSupportItem {
  const details = detailsRecord(item.details);
  const route = routeForItem(item);

  return {
    id: item.id,
    title: item.title,
    route,
    source: item.source === 'support' ? 'support' : 'feedback',
    severity: item.severity,
    timestamp: item.updatedAt,
    userRole: item.role,
    email: item.email,
    context: details,
    entity: item.entity,
    lastAction: item.lastAction,
    reproduceHref: reproduceHref(route, details),
  };
}

function buildKnownIssue(item: PilotQueueItem): LaunchOpsKnownIssue {
  const details = detailsRecord(item.details);
  const nested = asRecord(details?.nested);
  const affectedFlow = reproduceHref(routeForItem(item), details) ?? routeForItem(item);

  return {
    id: item.id,
    title: item.title,
    severity: item.severity,
    affectedFlow,
    workaround: item.lastAction?.note ?? asString(details?.workaround) ?? asString(nested?.workaround),
    status: item.status as LaunchOpsKnownIssue['status'],
    owner: item.owner,
    updatedAt: item.updatedAt,
  };
}

function groupTopCounts(routes: string[], limit = 3): Array<{ route: string; count: number }> {
  const counts = new Map<string, number>();

  for (const route of routes) {
    if (!route || route === '/internal/pilot-ops') {
      continue;
    }
    counts.set(route, (counts.get(route) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([route, count]) => ({ route, count }));
}

export async function GET(req: NextRequest) {
  const admin = await requireAdminPilotSession();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const launchReadinessResponse = await fetch(new URL('/api/intelligence/launch-readiness', req.nextUrl.origin), {
    headers: req.headers.get('cookie')
      ? {
          cookie: req.headers.get('cookie') as string,
        }
      : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });

  const launchReadiness = await launchReadinessResponse.json().catch(() => null) as LaunchReadinessPayload | null;
  const [pilotOps, pilotOps24h, pilotProof] = await Promise.all([
    fetchPilotOpsSummary(),
    fetchPilotOpsSummary(24),
    fetchPilotProofSnapshot(),
  ]);

  if (!launchReadinessResponse.ok || !launchReadiness || !pilotOps || !pilotOps24h) {
    return NextResponse.json({
      error: 'Launch ops snapshot unavailable.',
    }, { status: 503 });
  }

  const promotedIssueKeys = new Set(
    pilotOps.queue
      .map((item) => readIssueKey(item))
      .filter((value): value is string => Boolean(value)),
  );

  const visibleApplications = launchReadiness.counts.applications ?? pilotOps.baseline.activeApplications;
  const sanityChecks: LaunchOpsSanityCheck[] = [
    {
      id: 'findings-zero',
      title: 'Findings are non-zero',
      detail: launchReadiness.counts.findings > 0
        ? 'The findings stream is populated.'
        : 'Launch-critical findings dropped to zero.',
      status: launchReadiness.counts.findings > 0 ? 'pass' : 'fail',
      value: String(launchReadiness.counts.findings),
    },
    {
      id: 'graph-nodes-zero',
      title: 'Graph nodes exist when findings exist',
      detail: launchReadiness.counts.findings > 0 && launchReadiness.counts.graphNodes === 0
        ? 'Findings exist, but the graph returned zero nodes.'
        : 'Graph shape is consistent with current findings volume.',
      status: launchReadiness.counts.findings > 0 && launchReadiness.counts.graphNodes === 0 ? 'fail' : 'pass',
      value: `${launchReadiness.counts.graphNodes} nodes`,
    },
    {
      id: 'opportunities-zero',
      title: 'Opportunity count remains visible',
      detail: launchReadiness.counts.opportunities === 0
        ? 'The explore/apply board returned zero opportunities.'
        : 'Live opportunities remain visible to launch users.',
      status: launchReadiness.counts.opportunities === 0 ? 'fail' : 'pass',
      value: String(launchReadiness.counts.opportunities),
    },
    {
      id: 'applications-visible',
      title: 'Submitted applications stay visible',
      detail: pilotOps24h.metrics.applySubmitted > 0 && visibleApplications === 0
        ? 'Applications were submitted, but no active applications are visible.'
        : 'Application visibility matches the submission trail.',
      status: pilotOps24h.metrics.applySubmitted > 0 && visibleApplications === 0 ? 'warn' : 'pass',
      value: `${pilotOps24h.metrics.applySubmitted} submitted / ${visibleApplications ?? 0} visible`,
    },
    {
      id: 'onboarding-completion-events',
      title: 'Onboarding completion trail exists',
      detail: pilotOps24h.metrics.onboardingStarted > 0 && pilotOps24h.metrics.onboardingCompleted === 0
        ? 'Onboarding started events exist, but no completion events were recorded.'
        : 'Onboarding completion telemetry is present or no onboarding has started yet.',
      status: pilotOps24h.metrics.onboardingStarted > 0 && pilotOps24h.metrics.onboardingCompleted === 0 ? 'warn' : 'pass',
      value: `${pilotOps24h.metrics.onboardingCompleted} completed`,
    },
    {
      id: 'apply-submission-trail',
      title: 'Apply started has a submission trail',
      detail: pilotOps24h.metrics.applyStarted > 0 && pilotOps24h.metrics.applySubmitted === 0
        ? 'Apply starts are present with no submit events in the last 24 hours.'
        : 'Apply start and submit events are consistent.',
      status: pilotOps24h.metrics.applyStarted > 0 && pilotOps24h.metrics.applySubmitted === 0 ? 'warn' : 'pass',
      value: `${pilotOps24h.metrics.applyStarted} started / ${pilotOps24h.metrics.applySubmitted} submitted`,
    },
  ];

  const runtimeIssues = launchReadiness.routeChecks
    .filter((route) => route.status !== 'pass')
    .map<LaunchOpsIssue>((route) => ({
      id: `runtime:route:${route.id}`,
      title: route.status === 'fail' ? `Route failed: ${route.label}` : `Route degraded: ${route.label}`,
      message: route.detail,
      source: 'runtime',
      route: route.href,
      userRole: 'ADMIN',
      severity: route.status === 'fail' ? 'critical' : 'medium',
      timestamp: launchReadiness.generatedAt,
      status: 'OPEN',
      owner: null,
      queueItemId: null,
      blocking: route.status === 'fail',
      entity: null,
      details: {
        httpStatus: route.httpStatus,
        issueKey: `runtime:route:${route.id}`,
      },
      lastAction: null,
      reproduceHref: route.href,
    }))
    .filter((issue) => !promotedIssueKeys.has(issue.id));

  const sanityIssueConfig: Record<string, { route: string; severity: 'high' | 'critical' }> = {
    'findings-zero': { route: '/intelligence?view=findings', severity: 'high' },
    'graph-nodes-zero': { route: '/intelligence?view=graph', severity: 'critical' },
    'opportunities-zero': { route: '/explore', severity: 'critical' },
    'applications-visible': { route: '/verifier/inbox', severity: 'high' },
    'onboarding-completion-events': { route: '/onboarding', severity: 'high' },
    'apply-submission-trail': { route: '/explore', severity: 'high' },
  };

  const metricIssues = sanityChecks
    .filter((check) => check.status !== 'pass')
    .map<LaunchOpsIssue>((check) => ({
      id: `metric:sanity:${check.id}`,
      title: check.title,
      message: check.detail,
      source: 'metric',
      route: sanityIssueConfig[check.id]?.route ?? '/internal/pilot-ops',
      userRole: 'ADMIN',
      severity: check.status === 'fail'
        ? 'critical'
        : (sanityIssueConfig[check.id]?.severity ?? 'high'),
      timestamp: pilotOps24h.generatedAt,
      status: 'OPEN',
      owner: null,
      queueItemId: null,
      blocking: check.status === 'fail',
      entity: null,
      details: {
        value: check.value,
        issueKey: `metric:sanity:${check.id}`,
      },
      lastAction: null,
      reproduceHref: sanityIssueConfig[check.id]?.route ?? null,
    }))
    .filter((issue) => !promotedIssueKeys.has(issue.id));

  const queueIssues = pilotOps.queue.map((item) => buildQueueIssue(item));
  const triageIssues = [...queueIssues, ...runtimeIssues, ...metricIssues]
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));

  const supportItems = pilotOps.queue
    .filter((item) => item.source === 'feedback' || item.source === 'support')
    .map((item) => buildSupportItem(item))
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));

  const knownIssues = pilotOps.queue
    .filter((item) => (
      item.status === 'KNOWN_ISSUE'
      || item.status === 'HOTFIX_QUEUED'
      || item.status === 'MITIGATED'
      || item.status === 'RESOLVED'
    ))
    .map((item) => buildKnownIssue(item))
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));

  const report24h: LaunchOps24HourReport = {
    signIns: pilotOps24h.metrics.signIns,
    onboardingCompletion: pilotOps24h.metrics.onboardingCompleted,
    readinessViews: pilotOps24h.metrics.readinessViewed,
    blockersResolved: pilotOps24h.metrics.blockerResolved,
    applicationsSubmitted: pilotOps24h.metrics.applySubmitted,
    supportIssues: pilotOps24h.queue.filter((item) => item.source === 'feedback' || item.source === 'support').length,
    topFailingRoutes: groupTopCounts([
      ...pilotOps24h.queue
        .filter((item) => item.source === 'runtime' || item.source === 'route_failure' || item.source === 'system_failure')
        .map((item) => routeForItem(item)),
      ...runtimeIssues.map((issue) => issue.route),
    ]),
    topConfusingSurfaces: groupTopCounts(
      pilotOps24h.queue
        .filter((item) => item.source === 'feedback' || item.source === 'support')
        .map((item) => routeForItem(item)),
    ),
  };

  const failedRoutes = launchReadiness.routeChecks.filter((route) => route.status === 'fail').length;
  const warnedRoutes = launchReadiness.routeChecks.filter((route) => route.status === 'warn').length;
  const unresolvedIssues = triageIssues.filter((issue) => issue.status !== 'RESOLVED');

  const snapshot: LaunchOpsSnapshot = {
    generatedAt: new Date().toISOString(),
    operatorPanel: {
      summaryStatus: launchReadiness.summary.status,
      summaryLabel: launchReadiness.summary.label,
      summaryDetail: launchReadiness.summary.detail,
      deploy: {
        frontendVersion: launchReadiness.versions.frontend.version,
        frontendSha: launchReadiness.versions.frontend.sha,
        backendVersion: launchReadiness.versions.backend.version,
        backendSha: launchReadiness.versions.backend.sha,
        deploymentId: launchReadiness.versions.frontend.deploymentId ?? launchReadiness.versions.backend.deploymentId,
        target: launchReadiness.versions.frontend.target ?? launchReadiness.versions.backend.target,
      },
      routeHealth: {
        passing: launchReadiness.routeChecks.length - failedRoutes - warnedRoutes,
        warned: warnedRoutes,
        failed: failedRoutes,
      },
      liveCounts: {
        providers: launchReadiness.counts.providers,
        findings: launchReadiness.counts.findings,
        storylines: launchReadiness.counts.storylines,
        opportunities: launchReadiness.counts.opportunities,
        applications: launchReadiness.counts.applications,
        authFailures: pilotOps.metrics.authFailures,
        feedbackAndSupport: supportItems.length,
        issueQueue: unresolvedIssues.length,
      },
    },
    launchReadiness,
    pilotOps,
    pilotProof,
    report24h,
    sanityChecks,
    triageIssues,
    supportItems,
    knownIssues,
    surfaceControls: pilotOps.surfaceControls,
  };

  return NextResponse.json(snapshot);
}
