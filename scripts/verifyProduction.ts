import { getProductionEnvCheck } from '../apps/api/backend/src/config/env';
import prisma from '../apps/api/backend/src/graphql/prisma_client';
import { validateTrustChain } from '../apps/api/backend/src/services/trustChain';

type CheckResult = {
  name: string;
  ok: boolean;
  details?: string;
  status?: number;
  error?: string;
};

type RouteVerification = {
  method: 'GET' | 'POST';
  path: string;
  expectedStatus: number[];
  headers?: Record<string, string>;
};

type MonitoringRunResult = {
  monitoringChecksRun: number;
  monitoringStatusChanges: number;
  results: Array<{
    npi: string;
    changed: boolean;
    trustState: string;
    monitoringEventId?: string | null;
  }>;
};

type TrustChainResult = {
  npi: string;
  valid: boolean;
  invalidTransitions: boolean;
  checksumMismatches: boolean;
  appendOnlyConfirmed: boolean;
  issues: string[];
};

const BASE_URL =
  process.env.VERIFY_BASE_URL ??
  process.env.API_BASE_URL ??
  process.env.BACKEND_URL ??
  'http://localhost:4000';
const ROUTE_DELAY_MS = 15;
const MONITORING_SECRET = process.env.MONITORING_SECRET?.trim() ?? '';
const TEST_NPI = process.env.VERIFY_NPI?.trim() ?? '1234567890';
const TRUST_CHAIN_NPI = process.env.TRUST_CHAIN_NPI?.trim() ?? TEST_NPI;

function routeUrl(path: string): string {
  return `${BASE_URL.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
}

async function requestJson<T extends Record<string, unknown> = Record<string, unknown>>(
  method: 'GET' | 'POST',
  path: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; payload: T | string }> {
  const response = await fetch(routeUrl(path), {
    method,
    headers: {
      accept: 'application/json',
      ...headers,
    },
  });

  const raw = await response.text();
  try {
    return {
      status: response.status,
      payload: raw ? (JSON.parse(raw) as T) : ({} as T),
    };
  } catch {
    return {
      status: response.status,
      payload: raw as unknown as T,
    };
  }
}

async function checkRoute(input: RouteVerification): Promise<CheckResult> {
  try {
    const result = await requestJson(input.method, input.path, input.headers);
    return {
      name: `${input.method} ${input.path}`,
      ok: input.expectedStatus.includes(result.status),
      status: result.status,
      details: JSON.stringify(result.payload),
    };
  } catch (error) {
    return {
      name: `${input.method} ${input.path}`,
      ok: false,
      error: error instanceof Error ? error.message : 'Request failed',
    };
  }
}

async function checkRateLimit(): Promise<CheckResult> {
  const failures: number[] = [];
  let firstStatus: number | null = null;
  let hitLimit = false;

  for (let i = 1; i <= 110; i += 1) {
    try {
      const result = await requestJson('GET', `/api/npi/${TEST_NPI}`);
      const status = result.status;
      firstStatus ??= status;
      if (status === 429) {
        hitLimit = true;
        break;
      }
      if (i > 100 && !hitLimit) {
        failures.push(status);
      }
    } catch {
      failures.push(0);
    }

    if (ROUTE_DELAY_MS > 0) {
      await new Promise((resolve) => setTimeout(resolve, ROUTE_DELAY_MS));
    }
  }

  return {
    name: 'Rate limit > 100 in 10 minutes',
    ok: hitLimit && firstStatus !== null,
    details: `first=${firstStatus}, codes=${failures.join(',') || 'none'}`,
  };
}

async function checkTrustChain(): Promise<CheckResult> {
  try {
    const result = (await validateTrustChain(TRUST_CHAIN_NPI)) as TrustChainResult;
    const ok = !result.invalidTransitions && !result.checksumMismatches && result.appendOnlyConfirmed;
    return {
      name: `validateTrustChain(${TRUST_CHAIN_NPI})`,
      ok,
      details: JSON.stringify({
        valid: result.valid,
        invalidTransitions: result.invalidTransitions,
        checksumMismatches: result.checksumMismatches,
        appendOnlyConfirmed: result.appendOnlyConfirmed,
        issueCount: result.issues.length,
      }),
    };
  } catch (error) {
    return {
      name: `validateTrustChain(${TRUST_CHAIN_NPI})`,
      ok: false,
      error: error instanceof Error ? error.message : 'Trust-chain validation failed',
    };
  }
}

function mapPayload(payload: unknown): MonitoringRunResult {
  const fallback: MonitoringRunResult = {
    monitoringChecksRun: 0,
    monitoringStatusChanges: 0,
    results: [],
  };

  if (!payload || typeof payload !== 'object') {
    return fallback;
  }
  const typed = payload as Record<string, unknown>;
  return {
    monitoringChecksRun: typeof typed.monitoringChecksRun === 'number' ? typed.monitoringChecksRun : 0,
    monitoringStatusChanges:
      typeof typed.monitoringStatusChanges === 'number' ? typed.monitoringStatusChanges : 0,
    results: Array.isArray(typed.results)
      ? typed.results.map((entry) => {
          const resultEntry = entry as Record<string, unknown>;
          return {
            npi: String(resultEntry.npi ?? ''),
            changed: Boolean(resultEntry.changed),
            trustState: String(resultEntry.trustState ?? 'unknown'),
            monitoringEventId:
              typeof resultEntry.monitoringEventId === 'string' && resultEntry.monitoringEventId.length > 0
                ? resultEntry.monitoringEventId
                : null,
          };
        })
      : [],
  };
}

async function checkMonitoringDryRun(): Promise<CheckResult> {
  if (!MONITORING_SECRET) {
    return {
      name: 'Monitoring dry run',
      ok: false,
      error: 'MONITORING_SECRET is required for internal dry run',
    };
  }

  try {
    const beforeCount = await prisma.monitoringEvent.count();
    const beforeLatest = await prisma.monitoringEvent.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    const result = await requestJson('POST', '/api/internal/monitoring/run', {
      'x-monitoring-secret': MONITORING_SECRET,
    });
    if (result.status !== 200) {
      return {
        name: 'Monitoring dry run',
        ok: false,
        status: result.status,
        error: 'monitoring run endpoint returned non-200',
      };
    }

    const payload = mapPayload(result.payload);
    const changedIds = payload.results
      .filter((entry) => entry.changed && entry.monitoringEventId)
      .map((entry) => entry.monitoringEventId as string);
    const uniqueChangedIds = new Set(changedIds);
    const expectedEventsWritten = payload.monitoringStatusChanges > 0;

    if (expectedEventsWritten && changedIds.length === 0) {
      return {
        name: 'Monitoring dry run',
        ok: false,
        details: JSON.stringify(payload),
        error: 'No monitoring event IDs returned for changed checks',
      };
    }

    const afterLatest = await prisma.monitoringEvent.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    const afterCount = await prisma.monitoringEvent.count();

    const recordsInDb = changedIds.length
      ? await prisma.monitoringEvent.findMany({
          where: { id: { in: changedIds } },
          select: { id: true },
        })
      : [];

    if (expectedEventsWritten && afterCount <= beforeCount) {
      return {
        name: 'Monitoring dry run',
        ok: false,
        details: JSON.stringify(payload),
        error: 'MonitoringEvent records were not written for changed checks',
      };
    }

    if (recordsInDb.length !== uniqueChangedIds.size) {
      return {
        name: 'Monitoring dry run',
        ok: false,
        details: JSON.stringify(payload),
        error: 'MonitoringEvent IDs returned by dry run are not unique or not persisted',
      };
    }

    for (const item of payload.results) {
      if (!item.changed) continue;
      const artifact = await prisma.verificationArtifact.findFirst({
        where: { npi: item.npi },
        orderBy: { createdAt: 'desc' },
        select: { trustState: true },
      });
      if (!artifact || artifact.trustState !== item.trustState) {
        return {
          name: 'Monitoring dry run',
          ok: false,
          details: JSON.stringify(payload),
          error: `Monitoring trustState mismatch for npi ${item.npi}`,
        };
      }
    }

    if (afterLatest && beforeLatest && afterLatest.id === beforeLatest.id && changedIds.length > 0) {
      return {
        name: 'Monitoring dry run',
        ok: false,
        details: JSON.stringify(payload),
        error: 'MonitoringEvent latest id unchanged after run',
      };
    }

    if (expectedEventsWritten) {
      return {
        name: 'Monitoring dry run',
        ok: true,
        details: JSON.stringify({
          monitoringChecksRun: payload.monitoringChecksRun,
          monitoringStatusChanges: payload.monitoringStatusChanges,
          monitoringEventsWritten: afterCount - beforeCount,
          changedChecksWithEventIds: changedIds.length,
        }),
      };
    }

    return {
      name: 'Monitoring dry run',
      ok: true,
      details: JSON.stringify({
        monitoringChecksRun: payload.monitoringChecksRun,
        monitoringStatusChanges: payload.monitoringStatusChanges,
        note: 'No status changes observed in dry run payload',
      }),
    };
  } catch (error) {
    return {
      name: 'Monitoring dry run',
      ok: false,
      error: error instanceof Error ? error.message : 'Monitoring dry run failed',
    };
  }
}

async function verifyEnvironment(): Promise<CheckResult> {
  const result = getProductionEnvCheck();
  if (!result.ok) {
    return {
      name: 'Production environment variables',
      ok: false,
      details: JSON.stringify(result.missing),
    };
  }

  return {
    name: 'Production environment variables',
    ok: true,
    details: 'required variables present',
  };
}

async function verifySystemStatus(): Promise<CheckResult> {
  try {
    const result = await requestJson('GET', '/api/internal/system-status', {
      'x-monitoring-secret': MONITORING_SECRET,
    });
    if (result.status !== 200) {
      return {
        name: 'System status shape',
        ok: false,
        status: result.status,
        error: 'system status endpoint returned non-200',
      };
    }

    if (typeof result.payload !== 'object' || result.payload === null) {
      return {
        name: 'System status shape',
        ok: false,
        error: 'system status payload is not an object',
      };
    }

    const payload = result.payload as Record<string, unknown>;
    const missing = [
      'version',
      'uptime',
      'dbConnected',
      'trustLedgerOperational',
      'monitoringOperational',
      'pilotMode',
      'enterpriseMode',
      'frozen',
    ].filter((field) => !(field in payload));

    if (missing.length > 0) {
      return {
        name: 'System status shape',
        ok: false,
        details: JSON.stringify({ missing }),
        error: 'system status payload missing required fields',
      };
    }

    return {
      name: 'System status shape',
      ok: true,
      details: JSON.stringify({
        version: payload.version,
        dbConnected: payload.dbConnected,
        trustLedgerOperational: payload.trustLedgerOperational,
        monitoringOperational: payload.monitoringOperational,
      }),
    };
  } catch (error) {
    return {
      name: 'System status shape',
      ok: false,
      error: error instanceof Error ? error.message : 'system status check failed',
    };
  }
}

async function verifyPilotChecklist(): Promise<CheckResult> {
  try {
    const result = await requestJson<Record<string, unknown>>('GET', '/api/internal/pilot-checklist', {
      'x-monitoring-secret': MONITORING_SECRET,
    });

    if (result.status !== 200) {
      return {
        name: 'Pilot readiness checklist',
        ok: false,
        status: result.status,
        error: 'pilot checklist endpoint returned non-200',
      };
    }

    const payload = result.payload;
    if (!payload || typeof payload !== 'object') {
      return {
        name: 'Pilot readiness checklist',
        ok: false,
        error: 'pilot checklist payload is not an object',
      };
    }

    const keys: Array<keyof typeof payload> = [
      'schemaStable',
      'monitoringActive',
      'trustLedgerDeterministic',
      'rateLimitingActive',
      'envValidated',
      'noDemoModeInProd',
      'readyForPilot',
    ];
    const missing = keys.filter((key) => !(key in payload));
    if (missing.length > 0) {
      return {
        name: 'Pilot readiness checklist',
        ok: false,
        details: JSON.stringify({ missing }),
        error: 'pilot checklist payload missing required fields',
      };
    }

    const schemaStable = Boolean(payload.schemaStable);
    const monitoringActive = Boolean(payload.monitoringActive);
    const trustLedgerDeterministic = Boolean(payload.trustLedgerDeterministic);
    const rateLimitingActive = Boolean(payload.rateLimitingActive);
    const envValidated = Boolean(payload.envValidated);
    const noDemoModeInProd = Boolean(payload.noDemoModeInProd);
    const readyForPilot = Boolean(payload.readyForPilot);
    const expected = Boolean(
      schemaStable && monitoringActive && trustLedgerDeterministic && rateLimitingActive && envValidated && noDemoModeInProd,
    );

    if (readyForPilot !== expected) {
      return {
        name: 'Pilot readiness checklist',
        ok: false,
        details: JSON.stringify({
          schemaStable,
          monitoringActive,
          trustLedgerDeterministic,
          rateLimitingActive,
          envValidated,
          noDemoModeInProd,
          readyForPilot,
          expected,
        }),
        error: 'readyForPilot is not deterministic across required fields',
      };
    }

    return {
      name: 'Pilot readiness checklist',
      ok: true,
      details: JSON.stringify({
        schemaStable,
        monitoringActive,
        trustLedgerDeterministic,
        rateLimitingActive,
        envValidated,
        noDemoModeInProd,
        readyForPilot,
      }),
    };
  } catch (error) {
    return {
      name: 'Pilot readiness checklist',
      ok: false,
      error: error instanceof Error ? error.message : 'pilot checklist check failed',
    };
  }
}

async function main(): Promise<void> {
  const routeChecks: RouteVerification[] = [
    { method: 'GET', path: '/', expectedStatus: [200] },
    { method: 'GET', path: '/verifier', expectedStatus: [200] },
    { method: 'GET', path: '/clinician?npi=1234567890', expectedStatus: [200, 404] },
    { method: 'GET', path: `/api/npi/${TEST_NPI}`, expectedStatus: [200, 404] },
    { method: 'GET', path: '/api/npi/abc', expectedStatus: [400] },
    { method: 'GET', path: `/api/trust/${TEST_NPI}`, expectedStatus: [200] },
    { method: 'GET', path: '/api/compliance/summary', expectedStatus: [200] },
    { method: 'GET', path: '/api/security/posture', expectedStatus: [200] },
    { method: 'GET', path: '/api/version', expectedStatus: [200] },
    {
      method: 'GET',
      path: '/api/internal/health',
      expectedStatus: [200],
      headers: {
        'x-monitoring-secret': MONITORING_SECRET,
      },
    },
    {
      method: 'GET',
      path: '/api/internal/system-status',
      expectedStatus: [200],
      headers: {
        'x-monitoring-secret': MONITORING_SECRET,
      },
    },
    {
      method: 'GET',
      path: '/api/internal/pilot-checklist',
      expectedStatus: [200],
      headers: {
        'x-monitoring-secret': MONITORING_SECRET,
      },
    },
  ];

  const checks: CheckResult[] = [];

  checks.push(await verifyEnvironment());

  for (const route of routeChecks) {
    checks.push(await checkRoute(route));
  }

  checks.push(await checkRateLimit());
  checks.push(await checkTrustChain());
  checks.push(await checkMonitoringDryRun());
  checks.push(await verifySystemStatus());
  checks.push(await verifyPilotChecklist());

  const failed = checks.filter((check) => !check.ok);
  const summary = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    ok: failed.length === 0,
    checks,
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

  process.exitCode = failed.length === 0 ? 0 : 1;
}

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({
      name: 'verifyProduction.ts',
      ok: false,
      error: error instanceof Error ? error.message : 'verification script failed',
    })}\n`,
  );
  process.exitCode = 1;
});
