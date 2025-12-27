import { Request, Response as ExpressResponse } from 'express';
import prisma from '../../graphql/prisma_client';
import { PolkadotService } from '../../blockchain/polkadot_service';

type OnState = 'SOFT_ON' | 'HARD_ON';

interface CheckResult {
  ok: boolean;
  reason?: string;
  details?: Record<string, unknown>;
}

interface OnStatusPayload {
  status: OnState;
  blockingReasons: string[];
  timestamp: string;
  checks: {
    backendBoot: CheckResult;
    noMockedEndpoints: CheckResult;
    publicVerifierLive: CheckResult;
    trustLedgerAnchoring: CheckResult;
  };
}

const DEFAULT_VERIFIER_TIMEOUT_MS = Number(process.env.ON_STATUS_VERIFIER_TIMEOUT_MS || 2000);
const DEFAULT_LEDGER_TIMEOUT_MS = Number(process.env.ON_STATUS_LEDGER_TIMEOUT_MS || 4000);
const DEFAULT_MAX_LAG_BLOCKS = Number(process.env.ON_STATUS_LEDGER_MAX_LAG_BLOCKS || 128);

function booleanFromEnv(value: string | undefined): boolean {
  return ['true', '1', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function activeMockFlags(): string[] {
  const entries = Object.entries(process.env || {});
  return entries
    .filter(([key, value]) => /mock/i.test(key) && booleanFromEnv(String(value)))
    .map(([key]) => key)
    .sort();
}

async function checkBackendBoot(): Promise<CheckResult> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, details: { uptimeSeconds: process.uptime() } };
  } catch (e) {
    return {
      ok: false,
      reason: `Database check failed: ${String(e instanceof Error ? e.message : e)}`,
    };
  }
}

function checkMocksDisabled(): CheckResult {
  const mockVars = activeMockFlags();
  if (mockVars.length === 0) return { ok: true };
  return {
    ok: false,
    reason: `Mock flags active: ${mockVars.join(', ')}`,
    details: { mockFlags: mockVars },
  };
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { method: 'GET', signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function checkVerifierLive(): Promise<CheckResult> {
  const baseUrl =
    String(process.env.PUBLIC_VERIFIER_URL || '').trim() ||
    String(process.env.VERIFIER_URL || '').trim() ||
    String(process.env.VERIFIER_API_URL || '').trim();

  if (!baseUrl) {
    return {
      ok: false,
      reason: 'Public verifier URL not configured (set PUBLIC_VERIFIER_URL or VERIFIER_URL)',
    };
  }

  const url = `${baseUrl.replace(/\/$/, '')}/health`;

  try {
    const resp = await fetchWithTimeout(url, DEFAULT_VERIFIER_TIMEOUT_MS);
    const body = await resp
      .json()
      .catch(() => ({ status: resp.statusText || 'unavailable', raw: 'non-json response' }));
    if (!resp.ok) {
      return {
        ok: false,
        reason: `Verifier health check failed (${resp.status})`,
        details: { url, body },
      };
    }
    return { ok: true, details: { url, body } };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: `Verifier unreachable: ${message}`, details: { url } };
  }
}

async function checkTrustLedgerAnchoring(): Promise<CheckResult> {
  const endpointsRaw = String(process.env.SUBSTRATE_WS || process.env.TRUST_LEDGER_WS || '').trim();
  const endpoints = endpointsRaw
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  if (endpoints.length === 0) {
    return { ok: false, reason: 'Trust ledger endpoint not configured (SUBSTRATE_WS missing)' };
  }

  const ledger = new PolkadotService(undefined, {
    endpoints,
    connectTimeoutMs: DEFAULT_LEDGER_TIMEOUT_MS,
    maxConnectAttempts: 1,
    retryBackoffMs: 0,
    maxAllowedLagBlocks: DEFAULT_MAX_LAG_BLOCKS,
  });

  try {
    await ledger.connect();
    const health = await ledger.getHealth();
    const lagOk = health.lagBlocks <= DEFAULT_MAX_LAG_BLOCKS;
    const syncingOk = !health.isSyncing;
    if (!lagOk || !syncingOk) {
      return {
        ok: false,
        reason: 'Trust ledger is connected but unhealthy (syncing or lagging)',
        details: { health },
      };
    }
    return { ok: true, details: { health } };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: `Trust ledger unreachable: ${message}`, details: { endpoints } };
  } finally {
    await ledger.disconnect().catch(() => undefined);
  }
}

export async function evaluateOnStatus(): Promise<OnStatusPayload> {
  const [backendBoot, noMockedEndpoints, publicVerifierLive, trustLedgerAnchoring] =
    await Promise.all([
      checkBackendBoot(),
      Promise.resolve(checkMocksDisabled()),
      checkVerifierLive(),
      checkTrustLedgerAnchoring(),
    ]);

  const checks = {
    backendBoot,
    noMockedEndpoints,
    publicVerifierLive,
    trustLedgerAnchoring,
  };

  const blockingReasons = Object.values(checks)
    .filter((c) => !c.ok)
    .map((c) => c.reason || 'Unknown failure');

  return {
    status: blockingReasons.length === 0 ? 'HARD_ON' : 'SOFT_ON',
    blockingReasons,
    timestamp: new Date().toISOString(),
    checks,
  };
}

export async function onStatusHandler(
  _req: Request,
  res: ExpressResponse,
): Promise<ExpressResponse> {
  try {
    const payload = await evaluateOnStatus();
    const httpStatus = payload.status === 'HARD_ON' ? 200 : 503;
    return res.status(httpStatus).json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({
      status: 'SOFT_ON',
      blockingReasons: [`On-status evaluation failed: ${message}`],
      timestamp: new Date().toISOString(),
    });
  }
}
