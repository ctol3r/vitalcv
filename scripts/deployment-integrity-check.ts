/**
 * deployment-integrity-check — CI/cron/local runner for the Deployment
 * Integrity Check. Gathers live Railway state (via the linked CLI), GitHub main
 * HEAD, and service health, then reports any drift. Exit 1 on a drift incident,
 * 0 when the platform agrees.
 *
 *   pnpm check:deploy
 *
 * Detect-only: it never modifies infrastructure.
 */
import { execSync } from 'node:child_process';
import {
  parseRailwayStatus,
  evaluateIntegrity,
  fetchGithubMainSha,
  probeHealth,
  EXPECTED_SERVICES,
} from '../apps/web/lib/platform/deployment-integrity.ts';

function railwayStatusJson(): unknown | null {
  // Prefer an API token (CI), else the linked CLI (local).
  try {
    const raw = execSync('railway status --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function main() {
  const project = railwayStatusJson();
  if (!project) {
    console.error('deployment-integrity: could not read `railway status --json` (is the Railway CLI linked? `railway link`).');
    process.exit(2);
  }

  const states = parseRailwayStatus(project);
  const githubMainSha = await fetchGithubMainSha();

  const health: Record<string, 'ok' | 'degraded' | 'unreachable'> = {};
  await Promise.all(
    EXPECTED_SERVICES.filter((s) => s.healthUrl).map(async (s) => {
      health[s.name] = await probeHealth(s.healthUrl!);
    }),
  );

  const report = evaluateIntegrity({ states, githubMainSha, health, railwayReachable: true, nowMs: Date.now() });

  const icon = (ok: boolean) => (ok ? '🟢' : '🔴');
  console.log('\n  Deployment Integrity Check');
  console.log('  ──────────────────────────');
  console.log(`  expected: repo=${report.expected.repo} branch=${report.expected.branch} env=${report.expected.environment}`);
  console.log(`  github main HEAD: ${report.githubMainSha?.slice(0, 9) ?? 'unknown'}   overall: ${report.overall.toUpperCase()}\n`);
  for (const s of report.services) {
    const age = s.ageHours == null ? '—' : s.ageHours > 48 ? `${Math.round(s.ageHours / 24)}d` : `${Math.round(s.ageHours)}h`;
    console.log(`  ${icon(s.ok)} ${s.name.padEnd(20)} branch=${(s.branch ?? '—').padEnd(20)} commit=${(s.commitShort ?? '—').padEnd(10)} status=${(s.deployStatus ?? '—').padEnd(8)} age=${age.padEnd(5)} health=${s.healthStatus}`);
  }
  if (report.incidents.length) {
    console.log('\n  Incidents:');
    for (const i of report.incidents) {
      const tag = i.severity === 'incident' ? 'INCIDENT' : 'warning ';
      console.log(`   [${tag}] ${i.service} · ${i.field}: expected ${i.expected}, got ${i.actual}`);
      console.log(`              ${i.detail}`);
    }
  } else {
    console.log('\n  No drift — every production service agrees.');
  }
  console.log('');

  process.exit(report.overall === 'drift' ? 1 : 0);
}

void main();
