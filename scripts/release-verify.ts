/**
 * release-verify — external post-deploy verification runner (`pnpm verify:release`).
 *
 * Runs on a GitHub Actions runner (an EXTERNAL vantage — never inside the web
 * container it tests, since the P0 root cause was an in-container hairpin
 * self-fetch). Wires real network I/O into the tested release-monitor libs,
 * runs `pnpm check:deploy`, prints a report, writes JSON (`--out`/RELEASE_REPORT_OUT),
 * and exits 0 (pass) / 1 (fail). Infra-agnostic — no GitHub token needed, so it
 * also runs locally against prod.
 *
 * Invoked via the package script with the TS resolve hook:
 *   node --experimental-strip-types --import ./scripts/release-monitor/register-ts-resolver.mjs scripts/release-verify.ts
 *
 * Env:
 *   RELEASE_PROBE_BASE   deployed web origin (default https://vitalcv.com)
 *   RELEASE_TARGET_SHA   deploy commit from the webhook client_payload (optional;
 *                        when set, the SHA check is critical + we poll longer)
 *   CLERK_SECRET_KEY     Clerk Backend API secret (required to mint a clinician)
 *   CLERK_FAPI_URL       Clerk Frontend API base (default https://clerk.vitalcv.com)
 *   RAILWAY_API_TOKEN    consumed by the check:deploy subprocess (GraphQL fallback)
 *   RELEASE_SHA_WAIT_MS  SHA-poll budget override
 *   RELEASE_REPORT_OUT   report output path (or pass --out <path>)
 */
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

import { fetchGithubMainSha } from '../apps/web/lib/platform/deployment-integrity.ts';
import { runReleaseVerification } from '../apps/web/lib/release-monitor/verify.ts';
import {
  cleanupClinician,
  mintClinicianSession,
  reachRoute,
  refreshSessionToken,
  warmUpClinicianSession,
  type ClinicianSession,
  type SyntheticClinicianDeps,
} from '../apps/web/lib/release-monitor/syntheticClinician.ts';

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function probeVersionCommit(base: string): Promise<string | null> {
  try {
    const res = await fetch(`${base}/api/version`, {
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { commit?: unknown };
    return typeof body.commit === 'string' && body.commit ? body.commit : null;
  } catch {
    return null;
  }
}

/** Poll /api/version until the container serves `target`, or the budget elapses. */
async function pollContainerSha(
  base: string,
  target: string | null,
  budgetMs: number,
  intervalMs: number,
): Promise<string | null> {
  const deadline = Date.now() + budgetMs;
  let last: string | null = null;
  for (;;) {
    last = await probeVersionCommit(base);
    if (target && last && last.toLowerCase() === target.toLowerCase()) return last;
    if (Date.now() >= deadline) return last;
    await sleep(intervalMs);
  }
}

async function probeResolving(base: string): Promise<{ status: number }> {
  try {
    const res = await fetch(`${base}/auth/resolving`, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
    return { status: res.status };
  } catch {
    return { status: 0 };
  }
}

function runDeployCheck(): Promise<{ ok: boolean; detail: string }> {
  const tailOf = (s: string) => s.trim().split('\n').slice(-3).join(' | ').slice(0, 400);
  try {
    const out = execSync('pnpm check:deploy', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return Promise.resolve({ ok: true, detail: `check:deploy exit 0 — ${tailOf(out)}` });
  } catch (err) {
    const e = err as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string };
    const out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    return Promise.resolve({ ok: false, detail: `check:deploy exit ${e.status ?? '?'} — ${tailOf(out) || 'no output'}` });
  }
}

function icon(ok: boolean): string {
  return ok ? '🟢' : '🔴';
}

async function main(): Promise<void> {
  const base = (process.env.RELEASE_PROBE_BASE || 'https://vitalcv.com').replace(/\/+$/, '');
  const outPath = argValue('--out') ?? process.env.RELEASE_REPORT_OUT;
  const targetSha = process.env.RELEASE_TARGET_SHA?.trim() || null;
  const clerkSecretKey = process.env.CLERK_SECRET_KEY || '';
  const fapiBase = process.env.CLERK_FAPI_URL || 'https://clerk.vitalcv.com';
  const runId = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;

  const mainSha = await fetchGithubMainSha();
  const effectiveTarget = targetSha ?? mainSha;
  const waitMs = Number(process.env.RELEASE_SHA_WAIT_MS ?? (targetSha ? 300_000 : 20_000));

  console.log(`\n  Release Verification`);
  console.log('  ────────────────────');
  console.log(`  base:   ${base}`);
  console.log(`  target: ${effectiveTarget?.slice(0, 9) ?? 'unknown'} (${targetSha ? 'deploy commit' : 'main HEAD'})`);
  console.log(`  waiting up to ${Math.round(waitMs / 1000)}s for the container to serve it...\n`);

  const containerSha = await pollContainerSha(base, effectiveTarget, waitMs, 10_000);

  const scDeps: SyntheticClinicianDeps = { fetchImpl: fetch, clerkSecretKey, fapiBase, appBase: base, runId };

  // Best-effort cleanup if the process is hard-killed (e.g. a GitHub step
  // timeout) before the normal finally runs — otherwise a hung run leaks a
  // synthetic identity. The reconciliation sweep (see the doc) is the
  // guaranteed backstop; this narrows the window.
  let liveCreated: { userId: string | null; orgId: string | null } = { userId: null, orgId: null };
  let cleaningOnSignal = false;
  const onSignal = (sig: string) => {
    if (cleaningOnSignal) return;
    cleaningOnSignal = true;
    console.error(`\n  received ${sig} — attempting synthetic-identity cleanup before exit`);
    void cleanupClinician(scDeps, liveCreated).finally(() => process.exit(1));
  };
  process.once('SIGTERM', () => onSignal('SIGTERM'));
  process.once('SIGINT', () => onSignal('SIGINT'));

  const report = await runReleaseVerification({
    base,
    containerSha,
    mainSha,
    targetSha,
    onCreated: (created) => {
      liveCreated = created;
    },
    probeResolving: () => probeResolving(base),
    mint: () => mintClinicianSession(scDeps),
    warmUp: (s: ClinicianSession) => warmUpClinicianSession(scDeps, s),
    refresh: (s: ClinicianSession) => refreshSessionToken(scDeps, s),
    reach: (s: ClinicianSession, p: string) => reachRoute(scDeps, s, p),
    runDeployCheck,
    cleanup: (created) => cleanupClinician(scDeps, created),
  });

  for (const c of report.checks) {
    console.log(`  ${icon(c.ok)} ${c.name.padEnd(26)} ${c.critical ? '' : '(reported) '}${c.detail}`);
  }
  console.log(`\n  cleanup: ${report.cleanup.attempted ? (report.cleanup.ok ? 'ok' : `ISSUE — ${report.cleanup.detail}`) : 'n/a'}`);
  console.log(`\n  OVERALL: ${report.overall.toUpperCase()}${report.failedChecks.length ? ` (failed: ${report.failedChecks.join(', ')})` : ''}\n`);

  if (outPath) {
    writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`  report written to ${outPath}\n`);
  }

  process.exit(report.overall === 'pass' ? 0 : 1);
}

void main();
