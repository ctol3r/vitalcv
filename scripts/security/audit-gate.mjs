#!/usr/bin/env node
/**
 * SCA gate — Software Composition Analysis for the production dependency tree.
 * Enterprise-map B1 / ASVS G8.
 *
 * Policy: FAIL ONLY ON CRITICAL.
 *   - critical > 0  → exit 1 (blocks merge). A critical advisory in a shipped
 *                     dependency is never acceptable; fix with an upgrade or a
 *                     pnpm.overrides entry.
 *   - high/moderate/low → reported, non-blocking. The repo carries a large
 *                     pre-existing high backlog (tracked + burned down in
 *                     docs/security/dependency-remediation.md); a high/moderate
 *                     bar would be permanently red and train everyone to ignore it.
 *
 * Accepted-risk exceptions: `pnpm.auditConfig.ignoreGhsas` in the root
 * package.json suppresses a specific advisory that (a) reaches only a
 * build-time / non-deploy-path surface and (b) cannot be safely remediated by
 * an upgrade or override. Each entry MUST be justified in
 * docs/security/dependency-remediation.md with an owner sign-off. The blocking
 * critical count below is read from the (ignore-aware) advisory list — pnpm
 * drops ignored advisories from `data.advisories` but does NOT decrement
 * `data.metadata.vulnerabilities`, so counting metadata would never honour a
 * documented ignore.
 *
 * Fails CLOSED: if the audit can't run or its output can't be parsed, exit 2
 * (a gate that cannot evaluate must not report "clean").
 *
 * Usage:
 *   node scripts/security/audit-gate.mjs                 # runs `pnpm audit --prod --json`
 *   AUDIT_JSON_FILE=audit.json node scripts/security/audit-gate.mjs   # parse a captured file
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

function runAudit() {
  try {
    // `pnpm audit` exits non-zero whenever advisories exist — that's expected.
    // We want its stdout regardless of exit code, so capture and fall through.
    return execFileSync('pnpm', ['audit', '--prod', '--json'], {
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024,
    });
  } catch (err) {
    if (err && err.stdout) return err.stdout.toString();
    console.error('SCA gate: `pnpm audit --prod --json` could not run.');
    console.error(String((err && err.message) || err));
    process.exit(2);
  }
}

const raw = process.env.AUDIT_JSON_FILE
  ? fs.readFileSync(process.env.AUDIT_JSON_FILE, 'utf8')
  : runAudit();

let data;
try {
  data = JSON.parse(raw);
} catch {
  console.error('SCA gate: could not parse audit JSON (fail-closed).');
  console.error(raw.slice(0, 800));
  process.exit(2);
}

const v = data?.metadata?.vulnerabilities ?? {};

// The BLOCKING critical count is derived from `data.advisories` (which honours
// `pnpm.auditConfig.ignoreGhsas`), not from `data.metadata.vulnerabilities`
// (which does not). Fail CLOSED: if the advisory list is missing or not an
// object, fall back to the metadata critical count so a malformed audit can
// never slip past as "clean". high/moderate/low remain metadata-sourced —
// they are non-blocking reporting only.
const advisoryList =
  data && typeof data.advisories === 'object' && data.advisories !== null
    ? Object.values(data.advisories)
    : null;
const metaCritical = v.critical ?? 0;
const activeCritical = advisoryList
  ? advisoryList.filter((a) => a && a.severity === 'critical').length
  : metaCritical;
const suppressedCritical = Math.max(0, metaCritical - activeCritical);

const counts = {
  critical: activeCritical,
  high: v.high ?? 0,
  moderate: v.moderate ?? 0,
  low: v.low ?? 0,
  info: v.info ?? 0,
};
const total = counts.critical + counts.high + counts.moderate + counts.low + counts.info;

console.log(
  `\nProduction dependency advisories → ` +
    `critical=${counts.critical}  high=${counts.high}  ` +
    `moderate=${counts.moderate}  low=${counts.low}  (total ${total})\n`
);
if (suppressedCritical > 0) {
  console.log(
    `  Note: ${suppressedCritical} critical advisory(ies) suppressed via ` +
      `pnpm.auditConfig.ignoreGhsas (accepted risk — see docs/security/dependency-remediation.md).\n`
  );
}

// GitHub Actions step summary (markdown) when available.
const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (summaryPath) {
  const md = [
    '## SCA — production dependency audit',
    '',
    '| Severity | Count | Gate |',
    '|---|---:|---|',
    `| 🔴 Critical | ${counts.critical} | ${counts.critical > 0 ? '**❌ blocks merge**' : '✅ clean'} |`,
    `| 🟠 High | ${counts.high} | ⚠️ non-blocking — see \`docs/security/dependency-remediation.md\` |`,
    `| 🟡 Moderate | ${counts.moderate} | non-blocking |`,
    `| ⚪ Low | ${counts.low} | non-blocking |`,
    '',
    counts.critical > 0
      ? '**A critical advisory is present in the production dependency tree. This is blocked until it is remediated (upgrade the package or add a `pnpm.overrides` entry).**'
      : '_No critical advisories. The high-severity backlog is tracked separately and burned down over time._',
    suppressedCritical > 0
      ? `> ℹ️ ${suppressedCritical} critical advisory(ies) suppressed via \`pnpm.auditConfig.ignoreGhsas\` (accepted risk — see \`docs/security/dependency-remediation.md\`).`
      : '',
    '',
  ].join('\n');
  try {
    fs.appendFileSync(summaryPath, md + '\n');
  } catch {
    /* summary is best-effort */
  }
}

if (counts.critical > 0) {
  console.error(
    `✖ ${counts.critical} CRITICAL advisory(ies) in the production dependency tree — failing the SCA gate.`
  );
  console.error(
    '  Remediate with a version upgrade or a pnpm.overrides entry in the root package.json, then re-run.'
  );
  console.error(
    '  If (and only if) it reaches a build-time / non-deploy-path surface and cannot be safely'
  );
  console.error(
    '  upgraded, a documented pnpm.auditConfig.ignoreGhsas entry (owner sign-off + a row in'
  );
  console.error('  docs/security/dependency-remediation.md) is the accepted-risk escape hatch.');
  console.error('  Details: pnpm audit --prod');
  process.exit(1);
}

console.log('✓ No critical advisories in the production dependency tree.');
if (counts.high > 0) {
  console.log(
    `  (${counts.high} high advisories are non-blocking; see docs/security/dependency-remediation.md)`
  );
}
process.exit(0);
