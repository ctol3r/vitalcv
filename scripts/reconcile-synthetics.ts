/**
 * Reconciliation sweep runner — reaps leaked release-monitor synthetic
 * identities from Clerk.
 *
 * The backstop the release monitor's own cleanup cannot provide: a SIGKILL, a
 * transient Clerk DELETE failure, or the gap before a created id is reported
 * all leak an identity whose ids no longer exist in any process. This finds
 * them by shape and deletes them. See `apps/web/lib/release-monitor/
 * reconcileSynthetics.ts` for the safety invariants — read them before
 * changing anything here.
 *
 * Usage:
 *   CLERK_SECRET_KEY=… pnpm reconcile:synthetics            # delete
 *   CLERK_SECRET_KEY=… pnpm reconcile:synthetics --dry-run  # report only
 *
 * Flags:
 *   --dry-run          enumerate and classify; delete nothing
 *   --min-age-hours N  age grace (default 2) — never reaps a live run
 *   --max-deletes N    per-run blast-radius cap (default 25)
 *   --out PATH         write the JSON report here
 *
 * Exit codes: 0 clean, 1 the sweep itself failed (list/delete errors, or an
 * unset key). Finding and deleting strays is a SUCCESS — the sweep doing its
 * job is not an error condition, so a positive `deletedUsers` still exits 0.
 * The count is what the operator watches: a persistently non-zero sweep means
 * the monitor's inline cleanup is failing and deserves investigation.
 */

import { writeFileSync } from 'node:fs';

import { reconcileSynthetics } from '../apps/web/lib/release-monitor/reconcileSynthetics.ts';

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function value(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function numeric(name: string, fallback: number): number {
  const raw = value(name);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    console.error(`::error::--${name} must be a non-negative number, got ${JSON.stringify(raw)}`);
    process.exit(1);
  }
  return n;
}

const dryRun = flag('dry-run');
const minAgeHours = numeric('min-age-hours', 2);
const maxDeletes = numeric('max-deletes', 25);
const out = value('out');

const report = await reconcileSynthetics({
  clerkSecretKey: process.env.CLERK_SECRET_KEY ?? '',
  clerkApiBase: process.env.CLERK_API_BASE,
  dryRun,
  minAgeMs: minAgeHours * 60 * 60 * 1000,
  maxDeletes,
  log: (line) => console.log(`  ${line}`),
});

console.log(
  [
    '',
    `mode           ${report.dryRun ? 'DRY RUN (nothing deleted)' : 'live'}`,
    `scanned        ${report.scannedUsers} users, ${report.scannedOrgs} orgs`,
    `stale (>${minAgeHours}h)   ${report.staleUsers} users, ${report.staleOrgs} orgs`,
    `deleted        ${report.deletedUsers} users, ${report.deletedOrgs} orgs`,
    report.skippedForCap ? `capped         ${report.skippedForCap} left for the next run (--max-deletes ${maxDeletes})` : '',
    report.truncated ? 'truncated      pagination cap hit — scan was NOT exhaustive' : '',
    report.problems.length ? `problems       ${report.problems.join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n'),
);

if (out) {
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`\nreport → ${out}`);
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    `## Synthetic reconciliation: ${report.ok ? 'ok' : 'problems'}`,
    '',
    `- Mode: ${report.dryRun ? 'dry run' : 'live'}`,
    `- Scanned: ${report.scannedUsers} users, ${report.scannedOrgs} orgs`,
    `- Stale (older than ${minAgeHours}h): ${report.staleUsers} users, ${report.staleOrgs} orgs`,
    `- Deleted: ${report.deletedUsers} users, ${report.deletedOrgs} orgs`,
  ];
  if (report.skippedForCap) lines.push(`- Left for next run (cap): ${report.skippedForCap}`);
  if (report.truncated) lines.push('- **Scan truncated** — pagination cap hit, not exhaustive.');
  if (report.problems.length) lines.push(`- Problems: ${report.problems.join('; ')}`);
  if (report.deletedUsers > 0 || report.deletedOrgs > 0) {
    lines.push('');
    lines.push(
      '> A non-zero reap means the release monitor\'s inline cleanup did not complete on some run. ' +
        'Occasional strays are the expected hard-kill case; a persistent count is a defect worth chasing.',
    );
  }
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, { flag: 'a' });
}

process.exit(report.ok ? 0 : 1);
