#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildRuntimeBanner, getRuntimeContext } from '../runtime/runtime-banner.ts';

type Verdict = 'PASS' | 'FAIL';

type Check = {
  name: string;
  status: Verdict;
  detail: string;
};

type HttpProbe = {
  status: number;
  ok: boolean;
  headers: Headers;
  text: string;
  json: Record<string, unknown> | null;
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CANONICAL_PORT = Number(process.env.VITALCV_CANONICAL_PORT ?? '3030');
const BASE_URL = (
  process.env.RELEASE_BASE_URL ||
  process.env.VERIFY_BASE_URL ||
  `http://127.0.0.1:${CANONICAL_PORT}`
).replace(/\/$/, '');
const RECEIPT_ID =
  process.env.RELEASE_RECEIPT_ID ||
  process.env.VERIFY_RECEIPT_ID ||
  `rcpt_1003000126_${Date.now()}`;

function pass(name: string, detail: string): Check {
  return { name, status: 'PASS', detail };
}

function fail(name: string, detail: string): Check {
  return { name, status: 'FAIL', detail };
}

function renderMatrix(checks: Check[]): void {
  process.stdout.write('\nPASS / FAIL MATRIX\n');
  process.stdout.write('| Check | Result | Detail |\n');
  process.stdout.write('|---|---|---|\n');
  for (const check of checks) {
    process.stdout.write(`| ${check.name} | ${check.status} | ${check.detail.replace(/\|/g, '\\|')} |\n`);
  }
}

function verdict(checks: Check[]): Verdict {
  return checks.every((check) => check.status === 'PASS') ? 'PASS' : 'FAIL';
}

function runInherit(label: string, command: string, args: string[], cwd = ROOT): Check {
  process.stdout.write(`\n[release-readiness] ${label}\n`);
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd,
    env: {
      ...process.env,
    },
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024,
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
    if (!result.stdout.endsWith('\n')) {
      process.stdout.write('\n');
    }
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
    if (!result.stderr.endsWith('\n')) {
      process.stderr.write('\n');
    }
  }

  const elapsed = Date.now() - startedAt;
  if (result.error) {
    return fail(label, `${result.error.message} (${elapsed}ms)`);
  }

  if (result.status !== 0) {
    const signal = result.signal ? ` signal=${result.signal}` : '';
    return fail(label, `exit ${result.status}${signal} (${elapsed}ms)`);
  }

  return pass(label, `exit 0 (${elapsed}ms)`);
}

function runCapture(command: string, args: string[], env: Record<string, string | undefined> = {}): {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env: {
      ...process.env,
      ...env,
    },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024,
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
    if (!result.stdout.endsWith('\n')) {
      process.stdout.write('\n');
    }
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
    if (!result.stderr.endsWith('\n')) {
      process.stderr.write('\n');
    }
  }

  return {
    code: result.status,
    signal: result.signal,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 7000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function probeJson(url: string): Promise<HttpProbe> {
  try {
    const response = await fetchWithTimeout(url, {
      headers: { accept: 'application/json,text/html;q=0.8,*/*;q=0.5' },
    });
    const text = await response.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      json = null;
    }
    return { status: response.status, ok: response.ok, headers: response.headers, text, json };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      headers: new Headers(),
      text: error instanceof Error ? error.message : String(error),
      json: null,
    };
  }
}

async function probeText(url: string): Promise<HttpProbe> {
  try {
    const response = await fetchWithTimeout(url, {
      headers: { accept: 'text/html,text/plain;q=0.9,*/*;q=0.5' },
    });
    return {
      status: response.status,
      ok: response.ok,
      headers: response.headers,
      text: await response.text(),
      json: null,
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      headers: new Headers(),
      text: error instanceof Error ? error.message : String(error),
      json: null,
    };
  }
}

function relativeFile(filePath: string): string {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function listFiles(dir: string, out: string[] = []): string[] {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        listFiles(full, out);
      } else {
        out.push(full);
      }
    }
  } catch {
    // ignore missing directories
  }
  return out;
}

function isWriteRouteFile(filePath: string, source: string): boolean {
  return (
    /\.(ts|tsx)$/.test(filePath) &&
    (
      /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/.test(source) ||
      /\b(?:router|app)\.(?:post|put|patch|delete)\s*\(/.test(source)
    )
  );
}

function scanAnonymousWriteLeakage(): Check {
  const roots = [
    path.join(ROOT, 'apps/web/app/api'),
    path.join(ROOT, 'apps/api/backend/src/routes'),
  ];

  const violations: string[] = [];
  for (const root of roots) {
    for (const file of listFiles(root)) {
      let source: string;
      try {
        source = readFileSync(file, 'utf8');
      } catch {
        continue;
      }

      if (!isWriteRouteFile(file, source)) {
        continue;
      }

      if (/\banonymous\b/i.test(source) || /\banon\b/i.test(source)) {
        violations.push(relativeFile(file));
      }
    }
  }

  if (violations.length > 0) {
    return fail('no anonymous write leakage', `anonymous terms present in write routes: ${violations.join(', ')}`);
  }

  return pass('no anonymous write leakage', 'no anonymous terms found in write routes');
}

function scanReadableStates(): Check {
  const targets = [
    path.join(ROOT, 'apps/web/app/verify/receipt/[receiptId]/page.tsx'),
    path.join(ROOT, 'apps/web/lib/replay/getReplayInspection.ts'),
    path.join(ROOT, 'apps/web/components/trust/TrustStateRegister.tsx'),
  ];
  const requiredPhrases = [
    'Replay Inspection',
    'No continuity gaps',
    'Anonymous Preview',
    'Stale Data',
    'Unknown State',
    'Trust State Register',
  ];

  const source = targets
    .map((file) => {
      try {
        return readFileSync(file, 'utf8');
      } catch {
        return '';
      }
    })
    .join('\n');

  const missing = requiredPhrases.filter((phrase) => !source.includes(phrase));
  if (missing.length > 0) {
    return fail('degraded states readable', `missing required surface labels: ${missing.join(', ')}`);
  }

  return pass('degraded states readable', `labels present: ${requiredPhrases.join(', ')}`);
}

async function probeVerifierContinuity(): Promise<Check> {
  const rootJwks = await probeJson(`${BASE_URL}/.well-known/jwks.json`);
  const apiJwks = await probeJson(`${BASE_URL}/api/.well-known/jwks.json`);
  const rootDid = await probeJson(`${BASE_URL}/.well-known/did.json`);
  const apiDid = await probeJson(`${BASE_URL}/api/.well-known/did.json`);
  const rootOid = await probeJson(`${BASE_URL}/.well-known/openid-credential-issuer`);
  const apiOid = await probeJson(`${BASE_URL}/api/.well-known/openid-credential-issuer`);
  const rootTrust = await probeJson(`${BASE_URL}/.well-known/trust.json`);
  const apiTrust = await probeJson(`${BASE_URL}/api/.well-known/trust.json`);
  const verifyPage = await probeText(`${BASE_URL}/verify`);
  const trustPage = await probeText(`${BASE_URL}/trust`);
  const receiptRoute = await probeJson(`${BASE_URL}/api/receipt/${encodeURIComponent(RECEIPT_ID)}`);

  const rootChecks = [
    rootJwks.ok && Array.isArray(rootJwks.json?.keys) && (rootJwks.json?.keys as unknown[]).length > 0,
    rootDid.ok && (rootDid.json?.id === 'did:web:vitalcv.com'),
    rootOid.ok && rootOid.json?.issuer === 'https://vitalcv.com' && rootOid.json?.credential_issuer === 'https://vitalcv.com',
    rootTrust.ok && rootTrust.json?.issuer === 'did:web:vitalcv.com',
    verifyPage.ok && verifyPage.text.includes('Credential Verifier'),
    trustPage.ok && trustPage.text.includes('Trust State Register'),
    receiptRoute.status === 200 || receiptRoute.status === 404,
  ];

  const rootPass = rootChecks.every(Boolean);
  const routeSkew =
    (!rootJwks.ok && apiJwks.ok) ||
    (!rootDid.ok && apiDid.ok) ||
    (!rootOid.ok && apiOid.ok) ||
    (!rootTrust.ok && apiTrust.ok);

  if (!rootPass) {
    const detailParts = [
      `jwks root=${rootJwks.status} api=${apiJwks.status}`,
      `did root=${rootDid.status} api=${apiDid.status}`,
      `oid4vci root=${rootOid.status} api=${apiOid.status}`,
      `trust root=${rootTrust.status} api=${apiTrust.status}`,
      `/verify=${verifyPage.status}`,
      `/trust=${trustPage.status}`,
      `/api/receipt/${RECEIPT_ID}=${receiptRoute.status}`,
    ];
    if (routeSkew) {
      detailParts.push('route skew detected between root and /api/.well-known surfaces');
    }
    return fail('verifier continuity mounted', detailParts.join('; '));
  }

  return pass(
    'verifier continuity mounted',
    [
      `jwks=${rootJwks.status}`,
      `did=${rootDid.status}`,
      `oid4vci=${rootOid.status}`,
      `trust=${rootTrust.status}`,
      `/verify=${verifyPage.status}`,
      `/trust=${trustPage.status}`,
      `/api/receipt/${RECEIPT_ID}=${receiptRoute.status}`,
    ].join('; '),
  );
}

async function probeReplayLineage(): Promise<Check> {
  const response = await probeText(`${BASE_URL}/verify/receipt/${encodeURIComponent(RECEIPT_ID)}`);
  const lineageVisible = /Replay Chain|Continuity Gaps|No continuity gaps|Replay Inspection/i.test(response.text);

  if (!response.ok || !lineageVisible) {
    return fail(
      'replay lineage visible',
      `HTTP ${response.status}; visible=${lineageVisible ? 'yes' : 'no'}`,
    );
  }

  return pass('replay lineage visible', `HTTP ${response.status}; replay chain rendered`);
}

function parseRuntimeReport(output: string): { checks: Check[]; activeProcessCount: number } {
  const checks: Check[] = [];
  const activeLines = output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('[canonical-runtime]   pid='));

  const bannerChecks = [
    ['git SHA', /git SHA:\s+[0-9a-f]{7,}/i],
    ['branch', /branch:\s+.+/i],
    ['worktree', new RegExp(`worktree:\\s+${ROOT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)],
    ['runtime role', /runtime role:\s+[A-Za-z0-9_-]+/i],
    ['deployment mode', /deployment mode:\s+[A-Za-z0-9_-]+/i],
    ['env label', /env label:\s+[A-Za-z0-9_-]+/i],
    ['port', new RegExp(`port:\\s+${CANONICAL_PORT}`)],
    ['doctrine version', /doctrine version:\s+.+/i],
  ] as const;

  const missingBannerFields = bannerChecks
    .filter(([, pattern]) => !pattern.test(output))
    .map(([label]) => label);

  if (missingBannerFields.length > 0) {
    checks.push(fail('runtime coherence stable', `missing banner fields: ${missingBannerFields.join(', ')}`));
  } else if (activeLines.length === 0) {
    checks.push(fail('runtime coherence stable', 'no active next-server process found'));
  } else {
    checks.push(pass('runtime coherence stable', `banner fields present; active next-server count=${activeLines.length}`));
  }

  if (activeLines.length !== 1) {
    checks.push(fail('canonical runtime enforced', `expected exactly one active next-server, found ${activeLines.length}`));
  } else {
    const line = activeLines[0] ?? '';
    const portOk = line.includes(`port=${CANONICAL_PORT}`) || line.includes(`port=${CANONICAL_PORT},`);
    const cwdOk = line.includes(`cwd=${path.join(ROOT, 'apps/web')}`);
    if (!portOk || !cwdOk) {
      checks.push(
        fail(
          'canonical runtime enforced',
          `unexpected runtime line: ${line}`,
        ),
      );
    } else {
      checks.push(pass('canonical runtime enforced', line));
    }
  }

  return { checks, activeProcessCount: activeLines.length };
}

async function run(): Promise<void> {
  const checks: Check[] = [];
  const runtimeContext = getRuntimeContext();

  process.stdout.write(buildRuntimeBanner(runtimeContext));
  process.stdout.write('\n');
  process.stdout.write(`[release-readiness] base url: ${BASE_URL}\n`);
  process.stdout.write(`[release-readiness] receipt id: ${RECEIPT_ID}\n`);

  checks.push(runInherit('tests green', 'pnpm', ['test']));
  checks.push(runInherit('turbo build green', 'pnpm', ['build']));
  checks.push(runInherit('truth scan clean', 'node', ['--experimental-strip-types', 'scripts/canon-guard.js']));

  const runtimeReport = runCapture('node', ['--experimental-strip-types', 'scripts/runtime/assert-canonical-runtime.ts', '--report-only']);
  const runtimeChecks = parseRuntimeReport(`${runtimeReport.stdout}\n${runtimeReport.stderr}`);
  checks.push(...runtimeChecks.checks);

  checks.push(await probeVerifierContinuity());
  checks.push(await probeReplayLineage());
  checks.push(
    runInherit(
      'signed receipt validatable',
      'pnpm',
      ['--filter', '@vitalcv/web', 'exec', 'vitest', 'run', '__tests__/es256-receipt-engine.test.ts'],
    ),
  );
  checks.push(scanReadableStates());
  checks.push(scanAnonymousWriteLeakage());

  renderMatrix(checks);

  const overall = verdict(checks);
  process.stdout.write(`\nRELEASE VERDICT: ${overall}\n`);
  process.exitCode = overall === 'PASS' ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('/release-readiness.ts')) {
  run().catch((error) => {
    process.stderr.write(
      `${JSON.stringify(
        {
          name: 'release-readiness',
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
