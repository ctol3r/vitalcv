import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  AdpProfileSyncService,
  OracleIdentityProvisioner,
  UkgShiftEligibilitySync,
  WorkdayOnboardingConnectorV2,
  buildHrisAuditSummary,
  listHrisSyncLogs,
  normalizeVendorType,
} from '../../services/hris';
import type { HrisConnectionRecord, HrisConnectorTestResult } from '../../services/hris/types';

const router = Router();
const prisma = new PrismaClient();

router.get('/api/employer/hris-test', async (req: Request, res: Response) => {
  const orgId = typeof req.query.orgId === 'string' ? req.query.orgId : undefined;

  const connections = await prisma.hRISConnection.findMany({
    where: orgId ? { orgId } : undefined,
  });

  if (connections.length === 0) {
    return res.json(buildFallbackTestResponse());
  }

  const tests = await Promise.allSettled(
    connections.map((connection) => runConnectorTest(toRecord(connection))),
  );

  const runs: HrisConnectorTestResult[] = tests.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    const connection = connections[index]!;
    return {
      connectionId: connection.id,
      orgId: connection.orgId,
      vendor: normalizeVendorType(connection.type),
      status: 'fail',
      latencyMs: 0,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      message: result.reason instanceof Error ? result.reason.message : String(result.reason),
      steps: [],
    };
  });

  const summary = summarizeTests(runs);
  return res.json({
    runs,
    summary,
    generatedAt: new Date().toISOString(),
  });
});

router.post('/api/hris/connections/:connectionId/test', async (req: Request, res: Response) => {
  const record = await prisma.hRISConnection.findUnique({
    where: { id: req.params.connectionId },
  });

  if (!record) {
    return res.status(404).json({
      error: 'hris_connection_not_found',
      message: `Connection ${req.params.connectionId} not found`,
    });
  }

  try {
    const run = await runConnectorTest(toRecord(record));
    return res.json(run);
  } catch (error) {
    return res.status(500).json({
      error: 'hris_test_failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/api/employer/hris-audit', (req: Request, res: Response) => {
  const orgId = typeof req.query.orgId === 'string' ? req.query.orgId : undefined;
  const vendor = typeof req.query.vendor === 'string' ? req.query.vendor : undefined;
  const limit =
    typeof req.query.limit === 'string' && !Number.isNaN(Number(req.query.limit))
      ? Number(req.query.limit)
      : 100;

  const logs = listHrisSyncLogs({
    orgId,
    vendor,
    limit,
  });
  const summary = buildHrisAuditSummary(logs);

  return res.json({
    logs,
    summary,
    generatedAt: new Date().toISOString(),
  });
});

function toRecord(connection: {
  id: string;
  orgId: string;
  type: string;
  endpoint: string;
  secret: string;
}): HrisConnectionRecord {
  return {
    id: connection.id,
    orgId: connection.orgId,
    type: normalizeVendorType(connection.type),
    endpoint: connection.endpoint,
    secret: connection.secret,
  };
}

async function runConnectorTest(connection: HrisConnectionRecord): Promise<HrisConnectorTestResult> {
  switch (normalizeVendorType(connection.type)) {
    case 'workday':
      return new WorkdayOnboardingConnectorV2(connection).testConnection();
    case 'ukg':
      return new UkgShiftEligibilitySync(connection).testConnection();
    case 'adp':
      return new AdpProfileSyncService(connection).testConnection();
    case 'oracle':
      return new OracleIdentityProvisioner(connection).testConnection();
    default:
      return {
        connectionId: connection.id,
        orgId: connection.orgId,
        vendor: connection.type,
        status: 'warn',
        latencyMs: 0,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        message: 'Unsupported HRIS connector',
        steps: [],
      };
  }
}

function summarizeTests(runs: HrisConnectorTestResult[]) {
  if (runs.length === 0) {
    return { total: 0, passing: 0, failing: 0, warning: 0, avgLatency: 0 };
  }
  const passing = runs.filter((run) => run.status === 'pass').length;
  const warning = runs.filter((run) => run.status === 'warn').length;
  const failing = runs.filter((run) => run.status === 'fail').length;
  const latencies = runs.map((run) => run.latencyMs).filter((value) => value > 0);
  const avgLatency =
    latencies.length === 0
      ? 0
      : latencies.reduce((sum, value) => sum + value, 0) / latencies.length;
  return {
    total: runs.length,
    passing,
    failing,
    warning,
    avgLatency,
  };
}

function buildFallbackTestResponse() {
  const now = Date.now();
  const runs: HrisConnectorTestResult[] = [
    {
      connectionId: 'workday-demo',
      orgId: 'org-demo',
      vendor: 'workday',
      status: 'pass',
      latencyMs: 640,
      startedAt: new Date(now - 5_000).toISOString(),
      completedAt: new Date(now - 4_360).toISOString(),
      region: 'primary',
      message: 'Synthetic health check',
      steps: [
        { name: 'Metadata ping', status: 'pass', detail: 'ok', durationMs: 620 },
      ],
    },
    {
      connectionId: 'ukg-demo',
      orgId: 'org-demo',
      vendor: 'ukg',
      status: 'warn',
      latencyMs: 0,
      startedAt: new Date(now - 7_000).toISOString(),
      completedAt: new Date(now - 6_400).toISOString(),
      message: 'Unable to reach UKG sandbox — using cached eligibility',
      steps: [],
    },
  ];
  return {
    runs,
    summary: summarizeTests(runs),
    generatedAt: new Date().toISOString(),
  };
}

export default router;


