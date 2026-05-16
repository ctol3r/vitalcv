#!/usr/bin/env tsx
/**
 * openclaw-preflight.ts
 *
 * Deterministic preflight check for OpenClaw-generated task packages.
 * Run before generating any Claude Code Terminal implementation prompt.
 *
 * Usage:
 *   pnpm exec tsx scripts/openclaw-preflight.ts --files "path1,path2" --task "task description"
 *   pnpm exec tsx scripts/openclaw-preflight.ts --diff   # reads staged git diff
 *
 * Exit codes:
 *   0 = SAFE — proceed
 *   1 = GUARDED — proceed with scope lock
 *   2 = HIGH_RISK — require architectural justification
 *   3 = FOUNDER_REQUIRED — stop, surface to founder
 *   4 = HARD_BLOCK — stop immediately, task contains a violation
 *
 * Authority: docs/ops/openclaw-governance-hardening.md
 * Authority: docs/ops/openclaw-risk-classification.md
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = 'SAFE' | 'GUARDED' | 'HIGH_RISK' | 'FOUNDER_REQUIRED' | 'HARD_BLOCK';

interface Finding {
  level: RiskLevel;
  check: string;
  detail: string;
  file?: string;
}

interface PreflightResult {
  level: RiskLevel;
  findings: Finding[];
  exitCode: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BANNED_STRINGS = [
  'automatically verified',
  'guaranteed verification',
  'complete credentialing',
  'instant credentialing',
  'legally accepted',
  'risk transferred',
  'final verification without review',
  'source confirmed before response',
  'certified compliant',
  'HIPAA compliant',
  'SOC2 certified',
];

const UNSUPPORTED_VENDORS = ['NPDB', 'DEA integration', 'ABMS', 'SAM.gov', 'Doximity'];

const HARD_BLOCK_FILES = new Set([
  'CLAUDE.md',
  'MASTER_PROMPT.md',
]);

const FOUNDER_REQUIRED_FILES = [
  /apps\/web\/prisma\/schema\.prisma$/,
  /apps\/api\/backend\/prisma\/schema\.prisma$/,
  /docs\/migrations\/.*\.sql$/,
  /\.github\/workflows\/banned-strings-gate\.yml$/,
];

const HIGH_RISK_FILES = [
  /packages\/crs\//,
  /packages\/trust-state\//,
  /packages\/source-adapters\/src\/adapters\//,
  /packages\/psv\//,
  /apps\/web\/middleware\.ts$/,
  /apps\/web\/lib\/auth\//,
  /apps\/web\/lib\/issuer-verification\//,
  /apps\/web\/lib\/audit\//,
  /apps\/web\/app\/api\/employer-review\//,
  /apps\/web\/app\/api\/verifier\//,
  /apps\/web\/next\.config\.mjs$/,
  /packages\/domain-common\/psvPolicy\.ts$/,
];

const GUARDED_FILES = [
  /apps\/web\/app\/passport\//,
  /apps\/web\/app\/review\//,
  /apps\/web\/app\/clinician\//,
  /apps\/web\/app\/employer\//,
  /apps\/web\/app\/issuer\//,
  /apps\/web\/app\/api\//,
  /apps\/web\/lib\/demo\//,
  /apps\/web\/lib\/env\.ts$/,
  /\.github\/workflows\//,
  /scripts\//,
];

const FROZEN_LITERALS = [
  { pattern: /decisionGrade:\s*true/, message: 'decisionGrade must be literal false on receipt_candidate' },
  { pattern: /proofTier:\s*['"](?!receipt_candidate|psv_receipt_candidate)/, message: 'proofTier on receipt candidate must be receipt_candidate' },
];

const AUDIT_REMOVAL_PATTERNS = [
  /\/\/\s*(TODO|FIXME)?\s*remove.*audit/i,
  /auditEvent.*delete/i,
  /skip.*audit/i,
];

// ─── Utilities ────────────────────────────────────────────────────────────────

function classifyFile(filePath: string): RiskLevel {
  const rel = relative(process.cwd(), resolve(filePath)).replace(/\\/g, '/');

  // HARD_BLOCK
  if (HARD_BLOCK_FILES.has(rel)) return 'HARD_BLOCK';

  // FOUNDER_REQUIRED
  if (FOUNDER_REQUIRED_FILES.some(re => re.test(rel))) return 'FOUNDER_REQUIRED';

  // HIGH_RISK
  if (HIGH_RISK_FILES.some(re => re.test(rel))) return 'HIGH_RISK';

  // GUARDED
  if (GUARDED_FILES.some(re => re.test(rel))) return 'GUARDED';

  // SAFE by default
  return 'SAFE';
}

function riskOrder(level: RiskLevel): number {
  return { SAFE: 0, GUARDED: 1, HIGH_RISK: 2, FOUNDER_REQUIRED: 3, HARD_BLOCK: 4 }[level];
}

function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return riskOrder(a) >= riskOrder(b) ? a : b;
}

function scanTextForViolations(text: string, source: string): Finding[] {
  const findings: Finding[] = [];

  for (const banned of BANNED_STRINGS) {
    if (text.toLowerCase().includes(banned.toLowerCase())) {
      findings.push({
        level: 'HARD_BLOCK',
        check: 'banned-string',
        detail: `Banned string found: "${banned}"`,
        file: source,
      });
    }
  }

  for (const vendor of UNSUPPORTED_VENDORS) {
    if (text.includes(vendor)) {
      findings.push({
        level: 'HARD_BLOCK',
        check: 'unsupported-vendor',
        detail: `Unsupported vendor reference: "${vendor}"`,
        file: source,
      });
    }
  }

  for (const { pattern, message } of FROZEN_LITERALS) {
    if (pattern.test(text)) {
      findings.push({
        level: 'HARD_BLOCK',
        check: 'frozen-literal',
        detail: message,
        file: source,
      });
    }
  }

  for (const pattern of AUDIT_REMOVAL_PATTERNS) {
    if (pattern.test(text)) {
      findings.push({
        level: 'HARD_BLOCK',
        check: 'audit-removal',
        detail: 'Possible audit event removal detected',
        file: source,
      });
    }
  }

  return findings;
}

function getStagedFiles(): string[] {
  try {
    const output = execSync('git diff --staged --name-only', { encoding: 'utf8' });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function getStagedDiff(): string {
  try {
    return execSync('git diff --staged', { encoding: 'utf8' });
  } catch {
    return '';
  }
}

function countDomains(files: string[]): number {
  const domains = new Set<string>();
  for (const f of files) {
    if (/lib\/auth\//.test(f)) domains.add('auth');
    if (/packages\/crs\//.test(f)) domains.add('crs');
    if (/packages\/source-adapters\//.test(f)) domains.add('source-adapters');
    if (/lib\/issuer-verification\//.test(f)) domains.add('issuer');
    if (/app\/clinician\//.test(f)) domains.add('clinician');
    if (/app\/employer\//.test(f) || /app\/review\//.test(f)) domains.add('employer');
    if (/app\/api\//.test(f)) domains.add('api');
    if (/packages\/trust-state\//.test(f)) domains.add('trust-state');
    if (/\.github\/workflows\//.test(f)) domains.add('ci');
    if (/docs\//.test(f)) domains.add('docs');
  }
  return domains.size;
}

// ─── Main Preflight ───────────────────────────────────────────────────────────

function runPreflight(files: string[], taskText: string): PreflightResult {
  const findings: Finding[] = [];
  let overallLevel: RiskLevel = 'SAFE';

  // 1. Classify each file
  for (const f of files) {
    const level = classifyFile(f);
    if (level !== 'SAFE') {
      findings.push({
        level,
        check: 'file-classification',
        detail: `File classified as ${level}`,
        file: f,
      });
      overallLevel = maxRisk(overallLevel, level);
    }
  }

  // 2. Scan task text for violations
  const textFindings = scanTextForViolations(taskText, 'task-description');
  findings.push(...textFindings);
  for (const f of textFindings) overallLevel = maxRisk(overallLevel, f.level);

  // 3. Scan staged diff for violations
  const diff = getStagedDiff();
  if (diff) {
    const diffFindings = scanTextForViolations(diff, 'staged-diff');
    findings.push(...diffFindings);
    for (const f of diffFindings) overallLevel = maxRisk(overallLevel, f.level);
  }

  // 4. File count check
  if (files.length > 15) {
    findings.push({
      level: 'GUARDED',
      check: 'file-count',
      detail: `${files.length} files exceeds recommended maximum of 15. Consider splitting.`,
    });
    overallLevel = maxRisk(overallLevel, 'GUARDED');
  }

  // 5. Domain crossing check
  const domainCount = countDomains(files);
  if (domainCount > 2) {
    findings.push({
      level: 'GUARDED',
      check: 'domain-crossing',
      detail: `Task crosses ${domainCount} product domains. Maximum recommended: 2.`,
    });
    overallLevel = maxRisk(overallLevel, 'GUARDED');
  }

  // 6. Prisma migration detection
  const hasMigration = files.some(f => /migrations\/.*\.sql$/.test(f) || /schema\.prisma$/.test(f));
  if (hasMigration && !findings.some(f => f.check === 'file-classification' && f.level === 'FOUNDER_REQUIRED')) {
    findings.push({
      level: 'FOUNDER_REQUIRED',
      check: 'migration-detection',
      detail: 'Task includes Prisma schema or migration SQL. Requires explicit founder approval.',
    });
    overallLevel = maxRisk(overallLevel, 'FOUNDER_REQUIRED');
  }

  // 7. Deletion risk
  const hasDeletion = taskText.toLowerCase().includes('delete') ||
    taskText.toLowerCase().includes('remove') ||
    taskText.toLowerCase().includes('clean up');
  if (hasDeletion) {
    findings.push({
      level: 'GUARDED',
      check: 'deletion-risk',
      detail: 'Task may include file deletions. Confirm each deletion is intentional and not load-bearing.',
    });
    overallLevel = maxRisk(overallLevel, 'GUARDED');
  }

  const exitCodeMap: Record<RiskLevel, number> = {
    SAFE: 0,
    GUARDED: 1,
    HIGH_RISK: 2,
    FOUNDER_REQUIRED: 3,
    HARD_BLOCK: 4,
  };

  return { level: overallLevel, findings, exitCode: exitCodeMap[overallLevel] };
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const useDiff = args.includes('--diff');
  const filesArg = args.find((_, i) => args[i - 1] === '--files');
  const taskArg = args.find((_, i) => args[i - 1] === '--task') ?? '';

  let files: string[] = [];

  if (useDiff) {
    files = getStagedFiles();
  } else if (filesArg) {
    files = filesArg.split(',').map(f => f.trim()).filter(Boolean);
  }

  const result = runPreflight(files, taskArg);

  // Output
  const LEVEL_ICONS: Record<RiskLevel, string> = {
    SAFE: '🟢',
    GUARDED: '🟡',
    HIGH_RISK: '🟠',
    FOUNDER_REQUIRED: '🔴',
    HARD_BLOCK: '⛔',
  };

  console.log(`\n${LEVEL_ICONS[result.level]} PREFLIGHT RESULT: ${result.level}\n`);

  if (result.findings.length === 0) {
    console.log('No issues found. Task package generation may proceed.');
  } else {
    for (const f of result.findings) {
      const icon = LEVEL_ICONS[f.level];
      const loc = f.file ? ` [${f.file}]` : '';
      console.log(`${icon} [${f.level}] ${f.check}${loc}: ${f.detail}`);
    }
  }

  const NEXT_ACTION: Record<RiskLevel, string> = {
    SAFE: 'Proceed to task generation.',
    GUARDED: 'Write scope lock before task generation. Confirm exact files.',
    HIGH_RISK: 'Write architectural justification. Consider Claude Desktop review before task generation.',
    FOUNDER_REQUIRED: 'STOP. Surface to founder. Do not generate task without explicit approval.',
    HARD_BLOCK: 'STOP IMMEDIATELY. Task contains a violation. Rewrite or escalate before any action.',
  };

  console.log(`\nNext action: ${NEXT_ACTION[result.level]}\n`);
  process.exit(result.exitCode);
}

main();
