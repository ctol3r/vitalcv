import type { Express } from 'express';
import http from 'node:http';
import openApiSpec from '../openapi';
import prisma from '../graphql/prisma_client';
import { OPENAPI_SPEC as docsOpenApiSpec } from '../routes/docs';
import { log } from '../obs/logger';
import { generateGlobalGraph } from '../services/network/globalGraph';
import { getGraphPerformance } from '../services/graph/graphScaling';
import { validateGraphIntegrity } from '../services/integrity/trustSpine';
import {
  buildEdgeCaseEndpoints,
  createQaFinding,
  extractDocumentedEndpoints,
  scanEndpointEdgeCases,
  testApiContracts,
  validateSchemaConsistency,
  checkGraphIntegrity,
  type EndpointDefinition,
  type EndpointProbeResult,
  type QaFinding,
  type QaRunSummary,
} from '../../../../../core/qa';
import { extractExpressRoutes, looksLikeApiRoute, type RuntimeRoute } from './routeInventory';
import { runDataSanityAgents } from './dataSanityAgents';
import { evaluatePerformanceWatchers } from './performanceWatchers';
import { runAutoFixUtilities } from './autoFixUtilities';
import { isAutomatedTestRuntime } from '../config/runtimeMode';

interface QaSweepOptions {
  trigger: 'build' | 'ingestion' | 'schedule' | 'manual';
  app?: Express;
  baseUrl?: string;
  targetNpi?: string;
  includeDynamicProbes?: boolean;
  allowAutoFix?: boolean;
}

type RuntimeState = {
  app: Express | null;
  baseUrl: string | null;
  timer: ReturnType<typeof setInterval> | null;
  debounceTimer: ReturnType<typeof setTimeout> | null;
  lastRuns: QaRunSummary[];
  pendingRequest: Pick<QaSweepOptions, 'trigger' | 'targetNpi'> | null;
};

const MAX_RUN_HISTORY = 12;
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;

const runtimeState: RuntimeState = {
  app: null,
  baseUrl: null,
  timer: null,
  debounceTimer: null,
  lastRuns: [],
  pendingRequest: null,
};

function rememberRun(run: QaRunSummary): void {
  runtimeState.lastRuns.unshift(run);
  if (runtimeState.lastRuns.length > MAX_RUN_HISTORY) {
    runtimeState.lastRuns.length = MAX_RUN_HISTORY;
  }
}

function probeTimeoutMs(endpoint: EndpointDefinition): number {
  if ((endpoint.probeMethod ?? endpoint.method) === 'HEAD') {
    return 1_500;
  }
  return 3_000;
}

async function readResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) {
    return null;
  }

  const contentType = response.headers.get('content-type');
  const text = await response.text();
  if (text.length === 0) {
    return null;
  }

  if (contentType?.toLowerCase().includes('application/json')) {
    return JSON.parse(text) as unknown;
  }

  return text.slice(0, 2_000);
}

function createFetchProbe(baseUrl: string) {
  return async (endpoint: EndpointDefinition): Promise<EndpointProbeResult> => {
    const startedAt = Date.now();
    const method = endpoint.probeMethod ?? endpoint.method;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(endpoint.headers ?? {}),
    };

    const init: RequestInit = {
      method,
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(probeTimeoutMs(endpoint)),
    };

    if (endpoint.body !== undefined && method !== 'GET' && method !== 'HEAD') {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(endpoint.body);
    }

    const response = await fetch(`${baseUrl}${endpoint.path}`, init);
    const body = await readResponseBody(response);

    return {
      statusCode: response.status,
      contentType: response.headers.get('content-type'),
      latencyMs: Date.now() - startedAt,
      body,
    };
  };
}

function runtimeApiRoutes(app?: Express): RuntimeRoute[] {
  if (!app) {
    return [];
  }

  return extractExpressRoutes(app).filter((route) => looksLikeApiRoute(route.path));
}

async function buildQaFindings(options: QaSweepOptions): Promise<QaFinding[]> {
  const findings: QaFinding[] = [];
  const routes = runtimeApiRoutes(options.app);

  if (options.includeDynamicProbes !== false && options.baseUrl && routes.length > 0) {
    const edgeScan = await scanEndpointEdgeCases(
      buildEdgeCaseEndpoints(routes),
      createFetchProbe(options.baseUrl),
    );
    findings.push(...edgeScan.findings);
  }

  const contractResult = testApiContracts(
    routes,
    extractDocumentedEndpoints(openApiSpec),
    'apps/api/backend/src/openapi.ts',
  );
  findings.push(...contractResult.findings);

  const schemaResult = validateSchemaConsistency(
    'apps/api/backend/src/openapi.ts',
    openApiSpec,
    'apps/api/backend/src/routes/docs.ts',
    docsOpenApiSpec,
  );
  findings.push(...schemaResult.findings);

  try {
    const graphReport = await validateGraphIntegrity();
    if (graphReport.invalidEdges.length > 0) {
      findings.push(
        createQaFinding({
          code: 'runtime_graph_invalid_edges',
          severity: 'critical',
          component: 'graph-integrity-checker',
          summary: `Graph integrity report surfaced ${graphReport.invalidEdges.length} invalid edge(s).`,
          entityIds: graphReport.invalidEdges,
          repairable: true,
          suggestedFixes: ['REPAIR_BROKEN_EDGES', 'REBUILD_GRAPH_INDEXES'],
          metadata: {
            invalidEdgeIds: graphReport.invalidEdges,
          },
        }),
      );
    }
    if (graphReport.missingCapsuleEdges.length > 0) {
      findings.push(
        createQaFinding({
          code: 'runtime_graph_missing_capsule_edges',
          severity: 'critical',
          component: 'graph-integrity-checker',
          summary: `Graph integrity report surfaced ${graphReport.missingCapsuleEdges.length} missing capsule edge(s).`,
          entityIds: graphReport.missingCapsuleEdges,
          repairable: true,
          suggestedFixes: ['REPAIR_BROKEN_EDGES'],
          metadata: {
            capsuleIds: graphReport.missingCapsuleEdges,
          },
        }),
      );
    }
  } catch (error) {
    findings.push(
      createQaFinding({
        code: 'graph_integrity_report_failed',
        severity: 'warning',
        component: 'graph-integrity-checker',
        summary: 'Runtime graph integrity report could not be generated.',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      }),
    );
  }

  try {
    const globalGraph = await generateGlobalGraph();
    const graphCheck = checkGraphIntegrity(
      globalGraph.nodes.map((node) => ({
        id: node.id,
        group: node.group,
      })),
      globalGraph.edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
        label: edge.label,
      })),
      {
        allowOrphanedGroups: ['issuer', 'federated_issuer', 'oid_federation', 'degraded_federation', 'payer'],
      },
    );
    findings.push(...graphCheck.findings);
  } catch (error) {
    findings.push(
      createQaFinding({
        code: 'global_graph_generation_failed',
        severity: 'warning',
        component: 'graph-integrity-checker',
        summary: 'Global graph generation failed during QA sweep.',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      }),
    );
  }

  if (options.baseUrl) {
    try {
      const probe = createFetchProbe(options.baseUrl);
      const copilotResponse = await probe({
        method: 'POST',
        path: '/api/copilot/query',
        body: {
          query: 'cardiologists in texas with high trust score',
          limit: 3,
        },
        expectsJson: true,
      });

      if (copilotResponse.statusCode >= 500) {
        findings.push(
          createQaFinding({
            code: 'copilot_sample_probe_failed',
            severity: 'critical',
            component: 'copilot-response-validator',
            summary: `Sample Copilot query returned ${copilotResponse.statusCode}.`,
            method: 'POST',
            endpoint: '/api/copilot/query',
          }),
        );
      }
    } catch (error) {
      findings.push(
        createQaFinding({
          code: 'copilot_sample_probe_error',
          severity: 'warning',
          component: 'copilot-response-validator',
          summary: 'Sample Copilot QA probe failed to execute.',
          method: 'POST',
          endpoint: '/api/copilot/query',
          metadata: {
            error: error instanceof Error ? error.message : String(error),
          },
        }),
      );
    }
  }

  return findings;
}

async function databaseAvailable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function runQaSweep(options: QaSweepOptions): Promise<QaRunSummary> {
  const startedAt = new Date().toISOString();
  const dbAvailable = await databaseAvailable();
  const qaFindings = await buildQaFindings({
    ...options,
    includeDynamicProbes: dbAvailable ? options.includeDynamicProbes : false,
  });

  if (!dbAvailable) {
    qaFindings.push(
      createQaFinding({
        code: 'qa_database_unavailable',
        severity: 'warning',
        component: 'qa-runtime',
        summary: 'Database was unavailable during the QA sweep, so live data probes were skipped.',
      }),
    );
  }

  let dataSanityFindings = [] as Awaited<ReturnType<typeof runDataSanityAgents>>;
  if (dbAvailable) {
    try {
      dataSanityFindings = await runDataSanityAgents({
        targetNpi: options.targetNpi,
      });
    } catch (error) {
      qaFindings.push(
        createQaFinding({
          code: 'data_sanity_agent_failed',
          severity: 'warning',
          component: 'data-sanity',
          summary: 'Data sanity agents failed during the QA sweep.',
          metadata: {
            error: error instanceof Error ? error.message : String(error),
          },
        }),
      );
    }
  }

  let graphTelemetry:
    | {
        nodeCount: number;
        edgeCount: number;
        estimatedRenderMs: number;
        density: number;
        clusteringRecommended: boolean;
        recommendedNodeBudget: number;
      }
    | undefined;

  try {
    const telemetry = await getGraphPerformance();
    graphTelemetry = {
      nodeCount: telemetry.nodeCount,
      edgeCount: telemetry.edgeCount,
      estimatedRenderMs: telemetry.estimatedRenderMs,
      density: telemetry.density,
      clusteringRecommended: telemetry.clusteringRecommended,
      recommendedNodeBudget: telemetry.recommendedNodeBudget,
    };
  } catch (error) {
    qaFindings.push(
      createQaFinding({
        code: 'graph_performance_probe_failed',
        severity: 'warning',
        component: 'performance-watch',
        summary: 'Graph performance telemetry failed during QA sweep.',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      }),
    );
  }

  const performanceFindings = evaluatePerformanceWatchers({ graphTelemetry }).findings;
  const autoFixActions = dbAvailable && options.allowAutoFix
    ? await runAutoFixUtilities({
        qaFindings,
        dataSanityFindings,
        targetNpi: options.targetNpi,
      })
    : [];

  const completedAt = new Date().toISOString();
  const summary: QaRunSummary = {
    trigger: options.trigger,
    startedAt,
    completedAt,
    qaFindings,
    dataSanityFindings,
    performanceFindings,
    autoFixActions,
  };

  rememberRun(summary);

  log('info', 'qa_sweep_completed', {
    event: 'qa_sweep_completed',
    trigger: options.trigger,
    qaFindings: qaFindings.length,
    dataSanityFindings: dataSanityFindings.length,
    performanceFindings: performanceFindings.length,
    autoFixActions: autoFixActions.length,
  });

  return summary;
}

export function startQaAutomationRuntime(input: {
  app: Express;
  baseUrl: string;
  intervalMs?: number;
}): void {
  if (isAutomatedTestRuntime()) {
    return;
  }

  runtimeState.app = input.app;
  runtimeState.baseUrl = input.baseUrl;

  if (runtimeState.timer) {
    return;
  }

  const intervalMs = input.intervalMs ?? DEFAULT_INTERVAL_MS;
  runtimeState.timer = setInterval(() => {
    void runQaSweep({
      trigger: 'schedule',
      app: runtimeState.app ?? undefined,
      baseUrl: runtimeState.baseUrl ?? undefined,
      includeDynamicProbes: false,
      allowAutoFix: true,
    }).catch((error) => {
      log('error', 'qa_runtime_schedule_failed', {
        event: 'qa_runtime_schedule_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, intervalMs);

  if (runtimeState.timer.unref) {
    runtimeState.timer.unref();
  }
}

export function stopQaAutomationRuntime(): void {
  if (runtimeState.timer) {
    clearInterval(runtimeState.timer);
    runtimeState.timer = null;
  }

  if (runtimeState.debounceTimer) {
    clearTimeout(runtimeState.debounceTimer);
    runtimeState.debounceTimer = null;
  }
}

export function queueQaSweep(input: {
  trigger: 'ingestion' | 'manual';
  targetNpi?: string;
}): void {
  if (isAutomatedTestRuntime()) {
    return;
  }

  runtimeState.pendingRequest = input;

  if (runtimeState.debounceTimer) {
    return;
  }

  runtimeState.debounceTimer = setTimeout(() => {
    const pending = runtimeState.pendingRequest;
    runtimeState.pendingRequest = null;
    runtimeState.debounceTimer = null;

    if (!pending) {
      return;
    }

    void runQaSweep({
      trigger: pending.trigger,
      app: runtimeState.app ?? undefined,
      baseUrl: runtimeState.baseUrl ?? undefined,
      targetNpi: pending.targetNpi,
      includeDynamicProbes: false,
      allowAutoFix: true,
    }).catch((error) => {
      log('error', 'qa_runtime_queued_sweep_failed', {
        event: 'qa_runtime_queued_sweep_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, 250);

  if (runtimeState.debounceTimer.unref) {
    runtimeState.debounceTimer.unref();
  }
}

export function getRecentQaRuns(): readonly QaRunSummary[] {
  return runtimeState.lastRuns;
}

export async function withEphemeralQaServer<T>(
  app: Express,
  fn: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const server = http.createServer(app);

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  try {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('ephemeral QA server failed to bind a TCP port');
    }

    return await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
