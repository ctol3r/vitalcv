import fs from 'node:fs/promises';
import path from 'node:path';
import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import type {
  LaunchReadinessAlert,
  LaunchReadinessLoopCheck,
  LaunchReadinessPayload,
  LaunchReadinessRouteCheck,
  LaunchReadinessStatus,
} from '@/lib/launch/readiness';
import {
  buildMarketplaceHeaders,
  MARKETPLACE_BACKEND,
} from '@/lib/server/marketplace-proxy';
import { getBackendBase } from '@/lib/api';

export const runtime = 'nodejs';

const ROUTE_TARGETS: Array<{ id: string; label: string; href: string }> = [
  { id: 'home', label: '/', href: '/' },
  { id: 'explore', label: '/explore', href: '/explore' },
  { id: 'employers', label: '/employers', href: '/employers' },
  { id: 'developers', label: '/developers', href: '/developers' },
  { id: 'demo', label: '/demo', href: '/demo' },
  { id: 'intelligence', label: '/intelligence?view=dashboard', href: '/intelligence?view=dashboard' },
  { id: 'findings', label: '/intelligence?view=findings', href: '/intelligence?view=findings' },
  { id: 'providers', label: '/intelligence?view=providers', href: '/intelligence?view=providers' },
  { id: 'storylines', label: '/intelligence?view=storylines', href: '/intelligence?view=storylines' },
  { id: 'actions', label: '/intelligence?view=actions', href: '/intelligence?view=actions' },
  { id: 'investigations', label: '/intelligence?view=investigations', href: '/intelligence?view=investigations' },
  { id: 'graph', label: '/intelligence?view=graph', href: '/intelligence?view=graph' },
  { id: 'system-health', label: '/intelligence?view=system-health', href: '/intelligence?view=system-health' },
  { id: 'calibration', label: '/intelligence?view=calibration', href: '/intelligence?view=calibration' },
];

interface JsonResult<T> {
  ok: boolean;
  status: number | null;
  data: T | null;
  error: string | null;
}

interface ProvidersPayload {
  total?: number;
  providers?: Array<{ npi?: string }>;
}

interface FindingsPayload {
  total?: number;
  findings?: Array<{ id?: string; providerNpi?: string | null; evidence?: unknown[] }>;
}

interface StorylinesPayload {
  total?: number;
}

interface ActionsPayload {
  total?: number;
}

interface GraphPayload {
  stats?: {
    totalNodes?: number;
    totalEdges?: number;
  };
  nodes?: unknown[];
  edges?: unknown[];
}

interface EmployersPayload {
  total?: number;
}

interface OpportunitiesPayload {
  total?: number;
}

interface BackendVersionPayload {
  buildVersion?: string;
  commitHash?: string;
}

interface SystemStatusPayload {
  overall?: string;
}

interface SystemHealthPayload {
  status?: string;
  overall?: string;
  headline?: string;
}

interface CopilotPayload {
  status?: string;
  title?: string;
  message?: string;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

async function readWebVersion(): Promise<string | null> {
  try {
    const packagePath = path.resolve(process.cwd(), 'apps/web/package.json');
    const raw = await fs.readFile(packagePath, 'utf8');
    const payload = JSON.parse(raw) as { version?: string };
    return asString(payload.version);
  } catch {
    return null;
  }
}

async function loadJson<T>(input: string | URL, init?: RequestInit): Promise<JsonResult<T>> {
  try {
    const response = await fetch(input, {
      cache: 'no-store',
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(12_000),
    });
    const data = await response.json().catch(() => null) as T | null;
    return {
      ok: response.ok,
      status: response.status,
      data,
      error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      data: null,
      error: error instanceof Error ? error.message : 'Request failed',
    };
  }
}

async function loadRouteCheck(origin: string, target: { id: string; label: string; href: string }): Promise<LaunchReadinessRouteCheck> {
  try {
    const response = await fetch(new URL(target.href, origin), {
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(12_000),
    });

    const status: LaunchReadinessStatus = response.status >= 200 && response.status < 300
      ? 'pass'
      : response.status >= 300 && response.status < 400
        ? 'warn'
        : 'fail';
    const location = response.headers.get('location');

    return {
      id: target.id,
      label: target.label,
      href: target.href,
      status,
      httpStatus: response.status,
      detail: status === 'pass'
        ? 'Rendered successfully.'
        : location
          ? `Returned ${response.status} redirect to ${location}.`
          : `Returned ${response.status}.`,
    };
  } catch (error) {
    return {
      id: target.id,
      label: target.label,
      href: target.href,
      status: 'fail',
      httpStatus: null,
      detail: error instanceof Error ? error.message : 'Route request failed.',
    };
  }
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const backendBase = getBackendBase();
  const session = await auth();
  const frontendVersion = await readWebVersion();
  const frontendSha =
    process.env.VERCEL_GIT_COMMIT_SHA
    ?? process.env.GITHUB_SHA
    ?? process.env.COMMIT_HASH
    ?? null;
  const frontendDeploymentId =
    process.env.VERCEL_DEPLOYMENT_ID
    ?? process.env.VERCEL_URL
    ?? null;
  const frontendTarget =
    process.env.VERCEL_ENV
    ?? process.env.NODE_ENV
    ?? 'unknown';

  const [
    webHealth,
    readyz,
    systemStatus,
    backendVersion,
    systemHealth,
    providers,
    findings,
    storylines,
    actions,
    graph,
    employers,
    opportunities,
    copilot,
    applications,
    routeChecks,
  ] = await Promise.all([
    loadJson<{ status?: string }>(new URL('/api/health', origin)),
    loadJson<{ status?: string }>(new URL('/api/readyz', origin)),
    loadJson<SystemStatusPayload>(new URL('/api/system/status', origin)),
    loadJson<BackendVersionPayload>(`${backendBase}/api/version`),
    loadJson<SystemHealthPayload>(new URL('/api/system-health', origin)),
    loadJson<ProvidersPayload>(new URL('/api/intelligence/providers?limit=1', origin)),
    loadJson<FindingsPayload>(new URL('/api/intelligence/findings?limit=1', origin)),
    loadJson<StorylinesPayload>(new URL('/api/intelligence/storylines?limit=1', origin)),
    loadJson<ActionsPayload>(new URL('/api/intelligence/actions?limit=1', origin)),
    loadJson<GraphPayload>(new URL('/api/intelligence/graph?limit=120', origin)),
    loadJson<EmployersPayload>(new URL('/api/employers?limit=1', origin)),
    loadJson<OpportunitiesPayload>(new URL('/api/opportunities?limit=1', origin)),
    loadJson<CopilotPayload>(new URL('/api/copilot/query', origin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'Summarize launch readiness.',
        context: {
          scope: 'global',
          recentFindings: [],
          evidenceSummary: [],
        },
      }),
    }),
    session.userId
      ? loadJson<unknown[]>(
          `${MARKETPLACE_BACKEND}/api/employer/applications`,
          {
            headers: buildMarketplaceHeaders(session),
          },
        )
      : Promise.resolve({
          ok: false,
          status: 401,
          data: null,
          error: 'Operator session required',
        } satisfies JsonResult<unknown[]>),
    Promise.all(ROUTE_TARGETS.map((target) => loadRouteCheck(origin, target))),
  ]);

  const providerCount = asNumber(providers.data?.total, providers.data?.providers?.length ?? 0);
  const findingCount = asNumber(findings.data?.total, findings.data?.findings?.length ?? 0);
  const storylineCount = asNumber(storylines.data?.total, 0);
  const actionCount = asNumber(actions.data?.total, 0);
  const employerCount = asNumber(employers.data?.total, 0);
  const opportunityCount = asNumber(opportunities.data?.total, 0);
  const graphNodeCount = asNumber(graph.data?.stats?.totalNodes, graph.data?.nodes?.length ?? 0);
  const graphEdgeCount = asNumber(graph.data?.stats?.totalEdges, graph.data?.edges?.length ?? 0);
  const applicationCount = Array.isArray(applications.data) ? applications.data.length : null;
  const firstFinding = findings.data?.findings?.[0] ?? null;

  const loopChecks: LaunchReadinessLoopCheck[] = [
    {
      id: 'onboarding',
      label: 'Onboarding',
      status: readyz.ok && webHealth.ok ? 'pass' : 'fail',
      detail: readyz.ok
        ? 'Web entry and readiness probes are responding.'
        : readyz.error ?? 'Web readiness probe failed.',
    },
    {
      id: 'apply',
      label: 'Apply',
      status: opportunityCount > 0 ? 'pass' : 'fail',
      detail: opportunityCount > 0
        ? `${opportunityCount} active opportunity records are available to apply against.`
        : 'No active opportunities are available for the apply flow.',
    },
    {
      id: 'employer-review',
      label: 'Employer review/action',
      status: applicationCount === null
        ? (actionCount > 0 ? 'warn' : 'fail')
        : (applicationCount > 0 || actionCount > 0 ? 'pass' : 'warn'),
      detail: applicationCount === null
        ? (actionCount > 0
            ? `${actionCount} operator action${actionCount === 1 ? '' : 's'} are live. Application counts require an operator session.`
            : 'No operator action queue is live, and application counts require an operator session.')
        : `${applicationCount} application${applicationCount === 1 ? '' : 's'} and ${actionCount} action${actionCount === 1 ? '' : 's'} are visible to the employer loop.`,
    },
    {
      id: 'graph-render',
      label: 'Graph render',
      status: graphNodeCount > 0 && graphEdgeCount > 0 ? 'pass' : graphNodeCount > 0 ? 'warn' : 'fail',
      detail: graphNodeCount > 0
        ? `${graphNodeCount} node${graphNodeCount === 1 ? '' : 's'} and ${graphEdgeCount} edge${graphEdgeCount === 1 ? '' : 's'} are available in the live graph slice.`
        : 'The live graph returned zero nodes.',
    },
    {
      id: 'copilot',
      label: 'Copilot truth state',
      status: copilot.data?.status === 'ok'
        ? 'pass'
        : copilot.ok
          ? 'warn'
          : 'fail',
      detail: copilot.data?.status === 'ok'
        ? 'Copilot returned a live response.'
        : copilot.ok
          ? (copilot.data?.message ?? 'Copilot is in limited fallback mode.')
          : (copilot.error ?? 'Copilot route failed.'),
    },
    {
      id: 'evidence',
      label: 'Evidence inspection',
      status: Array.isArray(firstFinding?.evidence) && firstFinding.evidence.length > 0
        ? 'pass'
        : findingCount > 0
          ? 'warn'
          : 'warn',
      detail: Array.isArray(firstFinding?.evidence) && firstFinding.evidence.length > 0
        ? `The lead finding exposes ${firstFinding.evidence.length} evidence item${firstFinding.evidence.length === 1 ? '' : 's'}.`
        : findingCount > 0
          ? 'Live findings are present, but the current lead finding has no evidence payload.'
          : 'No findings are live, so evidence inspection cannot be confirmed.',
    },
  ];

  const alerts: LaunchReadinessAlert[] = [];

  if (employerCount === 0) {
    alerts.push({
      id: 'zero-employers',
      tone: 'critical',
      title: 'No employers are visible',
      detail: 'The public employer directory returned zero rows.',
    });
  }

  if (opportunityCount === 0) {
    alerts.push({
      id: 'zero-opportunities',
      tone: 'critical',
      title: 'No opportunities are live',
      detail: 'The public explore/apply flow has no active opportunities to render.',
    });
  }

  if (providerCount === 0) {
    alerts.push({
      id: 'zero-providers',
      tone: 'critical',
      title: 'Provider index is empty',
      detail: 'The operator provider feed returned zero indexed providers.',
    });
  }

  if (findingCount === 0) {
    alerts.push({
      id: 'zero-findings',
      tone: 'warning',
      title: 'No findings are live',
      detail: 'The intelligence loop is quiet. Confirm this is intentional before launch.',
    });
  }

  if (storylineCount === 0) {
    alerts.push({
      id: 'zero-storylines',
      tone: 'warning',
      title: 'No storylines are live',
      detail: 'Storyline clustering returned zero active narratives.',
    });
  }

  if (graphNodeCount === 0) {
    alerts.push({
      id: 'graph-empty',
      tone: 'critical',
      title: 'Graph returned zero nodes',
      detail: 'Graph rendering cannot be trusted until a non-empty graph slice is available.',
    });
  } else if (graphEdgeCount === 0 && graphNodeCount > 1) {
    alerts.push({
      id: 'graph-edges-empty',
      tone: 'warning',
      title: 'Graph returned nodes without edges',
      detail: 'The graph slice is disconnected and should be reviewed before launch.',
    });
  }

  if ((findingCount > 0 || storylineCount > 0) && graphNodeCount === 0) {
    alerts.push({
      id: 'graph-contradiction',
      tone: 'critical',
      title: 'Graph contradiction detected',
      detail: `${findingCount} finding${findingCount === 1 ? '' : 's'} and ${storylineCount} storyline${storylineCount === 1 ? '' : 's'} are live, but the graph has no nodes.`,
    });
  }

  if (!webHealth.ok || !readyz.ok || !systemStatus.ok) {
    alerts.push({
      id: 'health-plane',
      tone: 'critical',
      title: 'Health plane degraded',
      detail: [
        webHealth.ok ? 'web ok' : `web ${webHealth.error ?? 'failed'}`,
        readyz.ok ? 'ready ok' : `ready ${readyz.error ?? 'failed'}`,
        systemStatus.ok ? `backend ${systemStatus.data?.overall ?? 'ok'}` : `backend ${systemStatus.error ?? 'failed'}`,
      ].join(' · '),
    });
  }

  const failedRoutes = routeChecks.filter((route) => route.status === 'fail');
  const warnedRoutes = routeChecks.filter((route) => route.status === 'warn');

  if (failedRoutes.length > 0) {
    alerts.push({
      id: 'route-failures',
      tone: 'critical',
      title: 'Required routes failed to render',
      detail: failedRoutes.map((route) => route.label).join(', '),
    });
  } else if (warnedRoutes.length > 0) {
    alerts.push({
      id: 'route-warnings',
      tone: 'warning',
      title: 'Required routes redirected or degraded',
      detail: warnedRoutes.map((route) => route.label).join(', '),
    });
  }

  if ((systemHealth.data?.overall ?? systemHealth.data?.status) && !['healthy', 'HEALTHY', 'OPERATIONAL'].includes(String(systemHealth.data?.overall ?? systemHealth.data?.status))) {
    alerts.push({
      id: 'system-health-warning',
      tone: 'warning',
      title: 'System health is not fully healthy',
      detail: systemHealth.data?.headline ?? 'The system health summary is reporting a degraded posture.',
    });
  }

  const hasFail = failedRoutes.length > 0
    || loopChecks.some((check) => check.status === 'fail')
    || alerts.some((alert) => alert.tone === 'critical');
  const hasWarn = !hasFail && (
    warnedRoutes.length > 0
    || loopChecks.some((check) => check.status === 'warn')
    || alerts.some((alert) => alert.tone === 'warning')
  );

  const payload: LaunchReadinessPayload = {
    generatedAt: new Date().toISOString(),
    environment: {
      target: frontendTarget,
      webOrigin: origin,
      backendBase,
    },
    summary: {
      status: hasFail ? 'fail' : hasWarn ? 'warn' : 'pass',
      label: hasFail ? 'Launch blocked' : hasWarn ? 'Launch attention' : 'Launch green',
      detail: hasFail
        ? 'One or more required launch surfaces or live-data checks are failing.'
        : hasWarn
          ? 'Launch surfaces are up, but non-zero-state or degradation checks still need review.'
          : 'Required launch routes, counts, and live operator loops are responding cleanly.',
    },
    versions: {
      frontend: {
        version: frontendVersion,
        sha: frontendSha,
        deploymentId: frontendDeploymentId,
        target: frontendTarget,
        health: webHealth.ok && readyz.ok ? 'healthy' : 'degraded',
        detail: webHealth.ok && readyz.ok
          ? 'Web health and readiness probes are passing.'
          : 'Web health or readiness probes are degraded.',
      },
      backend: {
        version: backendVersion.data?.buildVersion ?? null,
        sha: backendVersion.data?.commitHash ?? null,
        deploymentId: process.env.RAILWAY_DEPLOYMENT_ID ?? backendVersion.data?.commitHash ?? null,
        target: frontendTarget,
        health: systemStatus.ok ? 'healthy' : 'degraded',
        detail: systemStatus.ok
          ? `Backend status ${systemStatus.data?.overall ?? 'OPERATIONAL'}.`
          : systemStatus.error ?? 'Backend status is unavailable.',
      },
    },
    counts: {
      providers: providerCount,
      findings: findingCount,
      storylines: storylineCount,
      graphNodes: graphNodeCount,
      graphEdges: graphEdgeCount,
      actions: actionCount,
      employers: employerCount,
      opportunities: opportunityCount,
      applications: applicationCount,
    },
    routeChecks,
    loopChecks,
    alerts,
  };

  return NextResponse.json(payload);
}
