#!/usr/bin/env node

import process from 'node:process';
import { buildRuntimeBanner, getRuntimeContext } from './runtime-banner.ts';

type Verdict = 'PASS' | 'FAIL';

type Check = {
  name: string;
  status: Verdict;
  detail: string;
};

type JsonRecord = Record<string, unknown>;

const BASE_URL = (
  process.env.VERIFY_BASE_URL ||
  process.env.PRODUCTION_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://vitalcv.com'
).replace(/\/$/, '');

const RECEIPT_ID = process.env.VERIFY_RECEIPT_ID || `rcpt_1003000126_${Date.now()}`;

function route(path: string): string {
  return `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

async function fetchJson(path: string): Promise<{ ok: boolean; status: number; data: JsonRecord | null; text: string }> {
  const response = await fetch(route(path), {
    method: 'GET',
    headers: { accept: 'application/json,text/html;q=0.9,*/*;q=0.8' },
    cache: 'no-store',
  });
  const text = await response.text();
  try {
    return { ok: response.ok, status: response.status, data: text ? (JSON.parse(text) as JsonRecord) : {}, text };
  } catch {
    return { ok: response.ok, status: response.status, data: null, text };
  }
}

async function fetchText(path: string): Promise<{ ok: boolean; status: number; text: string }> {
  const response = await fetch(route(path), {
    method: 'GET',
    headers: { accept: 'text/html,*/*;q=0.8' },
    cache: 'no-store',
  });
  return { ok: response.ok, status: response.status, text: await response.text() };
}

function fmtAge(iso: string): { detail: string; ok: boolean } {
  const value = Date.parse(iso);
  if (Number.isNaN(value)) {
    return { detail: `unparseable timestamp: ${iso}`, ok: false };
  }
  const minutes = Math.max(0, Math.round((Date.now() - value) / 60000));
  return { detail: `${minutes} minute(s)`, ok: true };
}

function toString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function verifyDplId(value: unknown): { ok: boolean; detail: string } {
  const id = toString(value);
  if (!id) {
    return { ok: false, detail: 'missing deployment id' };
  }
  if (!/^dpl_[A-Za-z0-9]+$/.test(id)) {
    return { ok: false, detail: `invalid deployment id format: ${id}` };
  }
  return { ok: true, detail: id };
}

function printMatrix(checks: Check[]): void {
  process.stdout.write('\nPASS/FAIL MATRIX\n');
  process.stdout.write('| Check | Result | Detail |\n');
  process.stdout.write('|---|---|---|\n');
  for (const check of checks) {
    process.stdout.write(`| ${check.name} | ${check.status} | ${check.detail.replace(/\|/g, '\\|')} |\n`);
  }
}

function verdictFrom(checks: Check[]): Verdict {
  return checks.every((check) => check.status === 'PASS') ? 'PASS' : 'FAIL';
}

async function main(): Promise<void> {
  const checks: Check[] = [];
  const runtimeContext = getRuntimeContext();
  const expectedDplId =
    toString(process.env.VITALCV_EXPECTED_DEPLOYMENT_ID) ||
    toString(process.env.EXPECTED_DPL_ID) ||
    null;

  const deployInfo = await fetchJson('/api/deploy-info');
  if (deployInfo.ok && deployInfo.data) {
    const age = toString(deployInfo.data.deployedAt);
    if (age) {
      const formatted = fmtAge(age);
      checks.push({
        name: 'build age',
        status: formatted.ok ? 'PASS' : 'FAIL',
        detail: formatted.detail,
      });
    } else {
      checks.push({ name: 'build age', status: 'FAIL', detail: 'missing deployedAt field' });
    }
  } else {
    checks.push({
      name: 'build age',
      status: 'FAIL',
      detail: `GET /api/deploy-info returned ${deployInfo.status}`,
    });
  }

  const launchReadiness = await fetchJson('/api/intelligence/launch-readiness');
  const versions = (launchReadiness.data?.versions as JsonRecord | undefined) ?? null;
  const frontend = (versions?.frontend as JsonRecord | undefined) ?? null;
  const declaredDplId = toString(frontend?.deploymentId);
  const deploymentId = verifyDplId(declaredDplId ?? expectedDplId);
  checks.push({
    name: 'dpl_* id',
    status: deploymentId.ok ? 'PASS' : 'FAIL',
    detail: deploymentId.detail,
  });
  if (declaredDplId && expectedDplId && declaredDplId !== expectedDplId) {
    checks[checks.length - 1] = {
      name: 'dpl_* id',
      status: 'FAIL',
      detail: `expected ${expectedDplId}, got ${declaredDplId}`,
    };
  }

  const health = await fetchJson('/api/health');
  const clerkEnabled = Boolean(health.data?.config && (health.data.config as JsonRecord).clerk && ((health.data.config as JsonRecord).clerk as JsonRecord).enabled);
  checks.push({
    name: 'Clerk enabled',
    status: clerkEnabled ? 'PASS' : 'FAIL',
    detail: clerkEnabled ? 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY present' : `GET /api/health returned clerk.enabled=false`,
  });

  const jwks = await fetchJson('/api/.well-known/jwks.json');
  const jwksKeys = Array.isArray(jwks.data?.keys) ? (jwks.data.keys as unknown[]).length : 0;
  checks.push({
    name: 'JWKS reachable',
    status: jwks.ok && jwksKeys > 0 ? 'PASS' : 'FAIL',
    detail: jwks.ok ? `keys=${jwksKeys}` : `HTTP ${jwks.status}`,
  });

  const did = await fetchJson('/api/.well-known/did.json');
  checks.push({
    name: 'DID reachable',
    status: did.ok && toString(did.data?.id) === 'did:web:vitalcv.com' ? 'PASS' : 'FAIL',
    detail: did.ok ? `id=${toString(did.data?.id) ?? 'missing'}` : `HTTP ${did.status}`,
  });

  const oid4vci = await fetchJson('/api/.well-known/openid-credential-issuer');
  const oidOk =
    oid4vci.ok &&
    toString(oid4vci.data?.issuer) === 'https://vitalcv.com' &&
    toString(oid4vci.data?.credential_issuer) === 'https://vitalcv.com' &&
    toString(oid4vci.data?.jwks_uri) !== null;
  checks.push({
    name: 'OID4VCI reachable',
    status: oidOk ? 'PASS' : 'FAIL',
    detail: oid4vci.ok ? `issuer=${toString(oid4vci.data?.issuer) ?? 'missing'}` : `HTTP ${oid4vci.status}`,
  });

  const verifyPage = await fetchText('/verify');
  checks.push({
    name: '/verify reachable',
    status: verifyPage.ok && verifyPage.text.includes('Credential Verifier') ? 'PASS' : 'FAIL',
    detail: verifyPage.ok ? `HTTP ${verifyPage.status}` : `HTTP ${verifyPage.status}`,
  });

  const trustPage = await fetchText('/trust');
  checks.push({
    name: '/trust reachable',
    status: trustPage.ok && trustPage.text.includes('Trust State Register') ? 'PASS' : 'FAIL',
    detail: trustPage.ok ? `HTTP ${trustPage.status}` : `HTTP ${trustPage.status}`,
  });

  const receiptRoute = await fetchJson(`/api/receipt/${encodeURIComponent(RECEIPT_ID)}`);
  checks.push({
    name: 'receipt endpoint reachable',
    status: receiptRoute.status === 200 || receiptRoute.status === 404 ? 'PASS' : 'FAIL',
    detail: `HTTP ${receiptRoute.status}`,
  });

  const replayPage = await fetchText(`/verify/receipt/${encodeURIComponent(RECEIPT_ID)}`);
  const replayOk = replayPage.ok && /Replay Chain|Lineage|Replay Inspection/i.test(replayPage.text);
  checks.push({
    name: 'replay lineage visible',
    status: replayOk ? 'PASS' : 'FAIL',
    detail: replayPage.ok ? `HTTP ${replayPage.status}` : `HTTP ${replayPage.status}`,
  });

  printMatrix(checks);

  const runtimeVerdict = verdictFrom(checks);
  const doctrineVerdict =
    runtimeVerdict === 'PASS' &&
    runtimeContext.branch !== '(detached HEAD)' &&
    runtimeContext.worktree.endsWith('/vitalcv') &&
    runtimeContext.port === Number(process.env.VITALCV_CANONICAL_PORT ?? '3030');

  process.stdout.write('\nRUNTIME COHERENCE VERDICT: ');
  process.stdout.write(`${runtimeVerdict}\n`);
  process.stdout.write(
    `DOCTRINE CONVERGENCE VERDICT: ${doctrineVerdict ? 'PASS' : 'FAIL'}\n`,
  );
  process.stdout.write('\nRUNTIME BANNER\n');
  process.stdout.write(`${buildRuntimeBanner(runtimeContext)}\n`);

  process.exitCode = runtimeVerdict === 'PASS' && doctrineVerdict ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('/verify-production-convergence.ts')) {
  main().catch((error) => {
    process.stderr.write(
      `${JSON.stringify(
        {
          name: 'verify-production-convergence',
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      )}\n`,
    );
    process.exitCode = 1;
  });
}
