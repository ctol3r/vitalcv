#!/usr/bin/env tsx
/**
 * openclaw-risk-check.ts
 *
 * Standalone risk check for a list of files or a PR diff.
 * Returns a classification table and overall risk level.
 *
 * Usage:
 *   pnpm exec tsx scripts/openclaw-risk-check.ts --pr 243
 *   pnpm exec tsx scripts/openclaw-risk-check.ts --files "apps/web/middleware.ts,packages/crs/CrsEngine.ts"
 *   pnpm exec tsx scripts/openclaw-risk-check.ts --staged
 *
 * Authority: docs/ops/openclaw-risk-classification.md
 */

import { execSync } from 'node:child_process';
import { relative, resolve } from 'node:path';

type RiskLevel = 'SAFE' | 'GUARDED' | 'HIGH_RISK' | 'FOUNDER_REQUIRED' | 'HARD_BLOCK';

interface FileRisk {
  file: string;
  level: RiskLevel;
  reason: string;
}

// ─── File → Risk mapping ──────────────────────────────────────────────────────

const RISK_RULES: Array<{ pattern: RegExp; level: RiskLevel; reason: string }> = [
  // HARD_BLOCK
  { pattern: /^CLAUDE\.md$/, level: 'HARD_BLOCK', reason: 'Truth doctrine — founder only' },
  { pattern: /^MASTER_PROMPT\.md$/, level: 'HARD_BLOCK', reason: 'Operating doctrine — founder only' },

  // FOUNDER_REQUIRED
  { pattern: /prisma\/schema\.prisma$/, level: 'FOUNDER_REQUIRED', reason: 'Prisma schema = migration risk' },
  { pattern: /docs\/migrations\/.*\.sql$/, level: 'FOUNDER_REQUIRED', reason: 'Migration SQL — explicit founder approval required' },
  { pattern: /banned-strings-gate\.yml$/, level: 'FOUNDER_REQUIRED', reason: 'CI gate — must not be weakened' },

  // HIGH_RISK — scoring and trust
  { pattern: /packages\/crs\//, level: 'HIGH_RISK', reason: 'CRS scoring engine' },
  { pattern: /packages\/trust-state\//, level: 'HIGH_RISK', reason: '9 canonical coverage states' },
  { pattern: /packages\/source-adapters\/src\/adapters\//, level: 'HIGH_RISK', reason: 'Source adapter confidence semantics' },
  { pattern: /packages\/source-adapters\/src\/types\.ts$/, level: 'HIGH_RISK', reason: 'Adapter type contracts' },
  { pattern: /packages\/psv\//, level: 'HIGH_RISK', reason: 'PSV receipt store and validation' },
  { pattern: /packages\/domain-common\/psvPolicy\.ts$/, level: 'HIGH_RISK', reason: 'PSV policy — frozen' },

  // HIGH_RISK — auth and security
  { pattern: /apps\/web\/middleware\.ts$/, level: 'HIGH_RISK', reason: 'Auth middleware — all routes' },
  { pattern: /apps\/web\/lib\/auth\//, level: 'HIGH_RISK', reason: 'RBAC and auth logic' },
  { pattern: /apps\/web\/next\.config\.mjs$/, level: 'HIGH_RISK', reason: 'CSP and security headers' },

  // HIGH_RISK — issuer trust chain
  { pattern: /lib\/issuer-verification\/receiptCandidate\.ts$/, level: 'HIGH_RISK', reason: 'Frozen literals: decisionGrade:false, proofTier' },
  { pattern: /lib\/issuer-verification\/policyReview\.ts$/, level: 'HIGH_RISK', reason: 'Frozen 5-gate policy review flow' },
  { pattern: /lib\/issuer-verification\/psvReceiptReuse\.ts$/, level: 'HIGH_RISK', reason: 'Cross-tenant reuse boundary' },
  { pattern: /lib\/issuer-verification\//, level: 'HIGH_RISK', reason: 'Issuer verification trust chain' },
  { pattern: /lib\/audit\//, level: 'HIGH_RISK', reason: 'Audit event persistence boundary' },

  // HIGH_RISK — employer acceptance
  { pattern: /app\/api\/employer-review\//, level: 'HIGH_RISK', reason: 'Acceptance + AuditEvent write path' },
  { pattern: /app\/api\/verifier\//, level: 'HIGH_RISK', reason: 'RBAC-gated verifier routes' },

  // GUARDED — product surfaces
  { pattern: /app\/passport\//, level: 'GUARDED', reason: 'Primary trust surface — employer-visible' },
  { pattern: /app\/review\//, level: 'GUARDED', reason: 'Employer decision surface' },
  { pattern: /app\/clinician\//, level: 'GUARDED', reason: 'Clinician product surfaces' },
  { pattern: /app\/employer\//, level: 'GUARDED', reason: 'Employer product surfaces' },
  { pattern: /app\/issuer\//, level: 'GUARDED', reason: 'Issuer surfaces (demo-only, demo markers must be preserved)' },
  { pattern: /app\/api\//, level: 'GUARDED', reason: 'API route handlers' },

  // GUARDED — data and config
  { pattern: /lib\/demo\//, level: 'GUARDED', reason: 'Demo fixtures — must not leak to production' },
  { pattern: /lib\/env\.ts$/, level: 'GUARDED', reason: 'Env validation — adding/removing vars' },
  { pattern: /\.github\/workflows\//, level: 'GUARDED', reason: 'CI workflows' },
  { pattern: /^scripts\//, level: 'GUARDED', reason: 'Production scripts' },
  { pattern: /PassportEntityClient\.tsx$/, level: 'GUARDED', reason: 'High-visibility trust surface' },
];

function classifyFile(filePath: string): FileRisk {
  const rel = relative(process.cwd(), resolve(filePath)).replace(/\\/g, '/');

  for (const rule of RISK_RULES) {
    if (rule.pattern.test(rel)) {
      return { file: rel, level: rule.level, reason: rule.reason };
    }
  }

  return { file: rel, level: 'SAFE', reason: 'No high-risk patterns matched' };
}

function riskOrder(level: RiskLevel): number {
  return { SAFE: 0, GUARDED: 1, HIGH_RISK: 2, FOUNDER_REQUIRED: 3, HARD_BLOCK: 4 }[level];
}

function getFilesForPR(prNumber: string): string[] {
  try {
    const output = execSync(`gh pr diff ${prNumber} --name-only`, { encoding: 'utf8' });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    console.error(`Failed to fetch PR #${prNumber}. Is gh CLI authenticated?`);
    return [];
  }
}

function getStagedFiles(): string[] {
  try {
    const output = execSync('git diff --staged --name-only', { encoding: 'utf8' });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function main() {
  const args = process.argv.slice(2);

  let files: string[] = [];
  let source = '';

  if (args.includes('--staged')) {
    files = getStagedFiles();
    source = 'staged diff';
  } else if (args.includes('--pr')) {
    const prIdx = args.indexOf('--pr');
    const prNumber = args[prIdx + 1];
    files = getFilesForPR(prNumber);
    source = `PR #${prNumber}`;
  } else if (args.includes('--files')) {
    const filesIdx = args.indexOf('--files');
    files = (args[filesIdx + 1] ?? '').split(',').map(f => f.trim()).filter(Boolean);
    source = 'file list';
  } else {
    console.log('Usage:');
    console.log('  pnpm exec tsx scripts/openclaw-risk-check.ts --pr 243');
    console.log('  pnpm exec tsx scripts/openclaw-risk-check.ts --files "file1,file2"');
    console.log('  pnpm exec tsx scripts/openclaw-risk-check.ts --staged');
    process.exit(0);
  }

  if (files.length === 0) {
    console.log('No files to classify.');
    process.exit(0);
  }

  const results = files.map(classifyFile);
  const overallLevel = results.reduce<RiskLevel>(
    (max, r) => riskOrder(r.level) > riskOrder(max) ? r.level : max,
    'SAFE'
  );

  const ICONS: Record<RiskLevel, string> = {
    SAFE: '🟢',
    GUARDED: '🟡',
    HIGH_RISK: '🟠',
    FOUNDER_REQUIRED: '🔴',
    HARD_BLOCK: '⛔',
  };

  console.log(`\nRisk check for: ${source}`);
  console.log(`${'─'.repeat(60)}`);

  // Group by level
  const byLevel: Partial<Record<RiskLevel, FileRisk[]>> = {};
  for (const r of results) {
    (byLevel[r.level] ??= []).push(r);
  }

  const levelOrder: RiskLevel[] = ['HARD_BLOCK', 'FOUNDER_REQUIRED', 'HIGH_RISK', 'GUARDED', 'SAFE'];
  for (const level of levelOrder) {
    const group = byLevel[level];
    if (!group?.length) continue;
    console.log(`\n${ICONS[level]} ${level} (${group.length} file${group.length > 1 ? 's' : ''})`);
    for (const r of group) {
      console.log(`   ${r.file}`);
      console.log(`   └─ ${r.reason}`);
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`${ICONS[overallLevel]} OVERALL: ${overallLevel}`);

  const ACTIONS: Record<RiskLevel, string> = {
    SAFE: 'Proceed to task generation. Standard Codex audit.',
    GUARDED: 'Write scope lock before task generation. Confirm exact files and adjacent sensitive files.',
    HIGH_RISK: 'Write architectural justification. Claude Desktop review recommended before task generation.',
    FOUNDER_REQUIRED: 'STOP. Surface to founder. Explicit approval required before task generation.',
    HARD_BLOCK: 'STOP IMMEDIATELY. Hard-blocked file or truth violation detected. Do not proceed.',
  };

  console.log(`Action: ${ACTIONS[overallLevel]}\n`);

  const exitCodes: Record<RiskLevel, number> = {
    SAFE: 0, GUARDED: 1, HIGH_RISK: 2, FOUNDER_REQUIRED: 3, HARD_BLOCK: 4,
  };
  process.exit(exitCodes[overallLevel]);
}

main();
