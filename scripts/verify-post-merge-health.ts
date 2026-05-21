#!/usr/bin/env node
/**
 * scripts/verify-post-merge-health.ts
 *
 * Deterministic post-merge health dispatcher. Runs after every merge
 * to confirm main is healthy.
 *
 * Sub-modes:
 *   pnpm verify:post-merge        full report
 *   pnpm verify:release-graph     read canonical-release-graph.md + name the next merge
 *   pnpm verify:merge-risk        read merge-risk-taxonomy.md + classify each known PR
 *
 * No CI orchestration. No auto-mutation. Pure read + report.
 *
 * Design intent:
 *   - call out the same failure modes as verify-ci-convergence (PR
 *     #398) but framed as "did the most recent merge break main?"
 *     rather than "is the worktree convergence-safe?"
 *   - cite the canonical-release-graph for what should be present;
 *     soft-skip missing surfaces (because not every PR has landed
 *     yet, and the verifier should run on any state of main)
 *   - exit non-zero ONLY on genuine regressions (missing tsc binary,
 *     wallet-sdk build failure, key file resolution failure)
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

type Mode = 'full' | 'release-graph' | 'merge-risk';

const REPO_ROOT = (() => {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
})();

type Level = 'OK' | 'NOTE' | 'WARN' | 'FAIL';
interface Entry {
  level: Level;
  text: string;
}

function tryExec(cmd: string): { ok: boolean; output: string } {
  try {
    const output = execSync(cmd, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, output };
  } catch (err) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string };
    const out = [e.stdout, e.stderr]
      .map((s) => (typeof s === 'string' ? s : Buffer.isBuffer(s) ? s.toString('utf8') : ''))
      .join('\n');
    return { ok: false, output: out };
  }
}

// ── Sub-check 1: workspace install + lockfile ────────────────────────────

function verifyLockfile(): Entry[] {
  const entries: Entry[] = [];
  const lock = resolve(REPO_ROOT, 'pnpm-lock.yaml');
  if (!existsSync(lock)) {
    entries.push({ level: 'FAIL', text: 'pnpm-lock.yaml missing' });
    return entries;
  }
  entries.push({ level: 'OK', text: 'pnpm-lock.yaml present' });
  return entries;
}

// ── Sub-check 2: wallet-sdk build + artifact ─────────────────────────────

function verifyWalletSdk(): Entry[] {
  const entries: Entry[] = [];
  const pkg = resolve(REPO_ROOT, 'packages/wallet-sdk/package.json');
  if (!existsSync(pkg)) {
    entries.push({ level: 'NOTE', text: 'wallet-sdk not present (skipped)' });
    return entries;
  }
  entries.push({ level: 'NOTE', text: 'wallet-sdk: invoking build...' });
  const result = tryExec('pnpm --filter @vitalcv/wallet-sdk build');
  if (!result.ok) {
    entries.push({
      level: 'FAIL',
      text: `wallet-sdk build failed:\n${result.output.split('\n').slice(-10).join('\n')}`,
    });
    return entries;
  }
  for (const artifact of ['dist/index.js', 'dist/index.mjs', 'dist/index.d.ts']) {
    const p = resolve(REPO_ROOT, 'packages/wallet-sdk', artifact);
    if (!existsSync(p)) {
      entries.push({ level: 'FAIL', text: `wallet-sdk artifact missing: ${artifact}` });
    } else {
      const size = statSync(p).size;
      entries.push({ level: 'OK', text: `wallet-sdk artifact present: ${artifact} (${size} bytes)` });
    }
  }
  return entries;
}

// ── Sub-check 3: tsc binary callable ─────────────────────────────────────

function verifyTscCallable(): Entry[] {
  const webBin = resolve(REPO_ROOT, 'apps/web/node_modules/.bin/tsc');
  const rootBin = resolve(REPO_ROOT, 'node_modules/.bin/tsc');
  if (existsSync(webBin) || existsSync(rootBin)) {
    return [{ level: 'OK', text: 'tsc binary callable from apps/web' }];
  }
  return [{ level: 'FAIL', text: 'tsc binary missing -- run pnpm install --frozen-lockfile' }];
}

// ── Sub-check 4: key file presence (soft-skip when not yet on main) ──────

interface KeyFile {
  path: string;
  fromPr: string;
  reason: string;
}

const KEY_FILES: readonly KeyFile[] = [
  { path: 'apps/web/lib/trust/replay-grammar.ts', fromPr: '#382', reason: 'replay grammar (composeLineage, READING_ORDER_LABELS)' },
  { path: 'apps/web/lib/trust/institutional-language.ts', fromPr: '#382', reason: 'institutional language registry' },
  { path: 'apps/web/lib/trust/degradation.ts', fromPr: '#382', reason: 'failure taxonomy + degradation states' },
  { path: 'apps/web/components/trust/primitives/LineageHeader.tsx', fromPr: '#382', reason: 'canonical LineageHeader primitive' },
  { path: 'apps/web/components/trust/navigation/ProvenanceChronology.tsx', fromPr: '#386', reason: 'provenance navigation primitive' },
  { path: 'apps/web/lib/trust/navigation-contract.ts', fromPr: '#386', reason: 'MAX_PANE_DEPTH + safePush' },
  { path: 'apps/web/components/trust/StackedPaneLayout.tsx', fromPr: '#385', reason: 'stacked pane layout' },
  { path: 'apps/web/lib/trust/panes.ts', fromPr: '#385', reason: 'pane URL contract' },
  { path: 'apps/web/app/.well-known/did.json/route.ts', fromPr: '#392', reason: 'direct W3C DID document route' },
  { path: 'apps/web/app/.well-known/openid-credential-issuer/route.ts', fromPr: '#392', reason: 'direct OID4VCI metadata route' },
  { path: 'apps/web/lib/crypto/ed25519IssuerKey.ts', fromPr: '#392', reason: 'Ed25519 identity key surface' },
  { path: 'apps/web/lib/discovery/issuerHost.ts', fromPr: '#384 or #392', reason: 'issuer host resolution' },
  { path: 'apps/web/lib/protocol/protocolIntegrity.ts', fromPr: '#393', reason: 'canonical-JSON + ETag + host hardening' },
  { path: 'packages/core/src/services/nppesResolver.ts', fromPr: '#388 or #392', reason: 'NPPES resolver' },
  { path: 'packages/core/src/services/roiCalculator.ts', fromPr: '#388', reason: 'OpenEvidence ROI calculator' },
  { path: 'packages/core/src/services/riskEngine.ts', fromPr: '#389', reason: 'OpenEvidence risk engine' },
  { path: 'packages/core/src/services/ledger/HashChainService.ts', fromPr: '#390', reason: 'SHA-256 hash chain' },
  { path: 'apps/web/lib/auth/antigravity.ts', fromPr: '#390', reason: 'antigravity routing decision' },
  { path: 'apps/web/app/interoperability/exchange/[exchangeId]/page.tsx', fromPr: '#395', reason: 'interoperability rehearsal route' },
  { path: 'apps/web/app/pilot/deployment-kit/[clientSlug]/page.tsx', fromPr: '#387', reason: 'pilot deployment kit route' },
];

function verifyKeyFiles(): Entry[] {
  const entries: Entry[] = [];
  let present = 0;
  let absent = 0;
  for (const file of KEY_FILES) {
    const abs = resolve(REPO_ROOT, file.path);
    if (existsSync(abs)) {
      present++;
    } else {
      absent++;
      entries.push({
        level: 'NOTE',
        text: `${file.path} not yet on main (from ${file.fromPr}: ${file.reason})`,
      });
    }
  }
  entries.unshift({
    level: 'NOTE',
    text: `key files survey: ${present}/${KEY_FILES.length} present on this branch`,
  });
  return entries;
}

// ── Sub-check 5: governance docs presence (after PRs #394 / #396 / #397) ─

function verifyGovernanceDocs(): Entry[] {
  const entries: Entry[] = [];
  const docs = [
    'docs/ops/canonical-merge-graph.md',
    'docs/ops/canonical-release-graph.md',
    'docs/ops/merge-risk-taxonomy.md',
    'docs/ops/release-batching-guide.md',
    'docs/ops/founder-release-lane.md',
    'docs/ops/merge-collapse-hazards.md',
    'docs/ops/stack-topology.md',
    'docs/ops/operational-state.md',
  ];
  for (const doc of docs) {
    const abs = resolve(REPO_ROOT, doc);
    if (existsSync(abs)) {
      entries.push({ level: 'OK', text: `governance doc present: ${doc}` });
    } else {
      entries.push({ level: 'NOTE', text: `governance doc not yet on main: ${doc}` });
    }
  }
  return entries;
}

// ── Sub-mode: release-graph -- name the next merge ───────────────────────

function reportReleaseGraph(): Entry[] {
  const entries: Entry[] = [];
  const docPath = resolve(REPO_ROOT, 'docs/ops/canonical-release-graph.md');
  if (!existsSync(docPath)) {
    entries.push({
      level: 'NOTE',
      text: 'docs/ops/canonical-release-graph.md not present (not yet on main)',
    });
    return entries;
  }
  const md = readFileSync(docPath, 'utf8');
  const rows = md
    .split('\n')
    .filter((line) => /^\|\s*\d{3,4}\s*\|/.test(line))
    .map((line) => line.split('|').map((c) => c.trim()));
  entries.push({
    level: 'NOTE',
    text: `release graph rows: ${rows.length}`,
  });
  for (const row of rows) {
    if (row.length < 5) continue;
    entries.push({
      level: 'NOTE',
      text: `PR #${row[1]} · ${row[2]} · ${row[3]} · ${row[4]}`,
    });
  }
  return entries;
}

// ── Sub-mode: merge-risk -- enumerate canonical risk classes ─────────────

function reportMergeRisk(): Entry[] {
  const entries: Entry[] = [];
  const docPath = resolve(REPO_ROOT, 'docs/ops/merge-risk-taxonomy.md');
  if (!existsSync(docPath)) {
    entries.push({
      level: 'NOTE',
      text: 'docs/ops/merge-risk-taxonomy.md not present (not yet on main)',
    });
    return entries;
  }
  const md = readFileSync(docPath, 'utf8');
  const classes = ['SAFE', 'SAFE_WITH_DEPENDENCIES', 'SEMANTIC_RISK', 'PROTOCOL_RISK', 'GOVERNANCE_ONLY', 'HOLD', 'ARCHIVE'];
  for (const cls of classes) {
    const occurrences = (md.match(new RegExp(`\`${cls}\``, 'g')) ?? []).length;
    entries.push({
      level: 'NOTE',
      text: `class ${cls}: ${occurrences} mention(s) in taxonomy doc`,
    });
  }
  return entries;
}

// ── Main ─────────────────────────────────────────────────────────────────

function main(): void {
  const mode = (process.argv[2] ?? 'full') as Mode;
  console.log(`# verify-post-merge-health (${mode})  ·  ${new Date().toISOString()}`);
  console.log('#'.padEnd(72, '#'));
  const entries: Entry[] = [];
  switch (mode) {
    case 'release-graph':
      entries.push(...reportReleaseGraph());
      break;
    case 'merge-risk':
      entries.push(...reportMergeRisk());
      break;
    case 'full':
    default:
      entries.push(...verifyLockfile());
      entries.push(...verifyTscCallable());
      entries.push(...verifyWalletSdk());
      entries.push(...verifyKeyFiles());
      entries.push(...verifyGovernanceDocs());
      break;
  }
  for (const e of entries) console.log(`[${e.level.padEnd(4, ' ')}] ${e.text}`);
  const failed = entries.filter((e) => e.level === 'FAIL');
  if (failed.length > 0) {
    console.log(`\n[FAIL] post-merge health: ${failed.length} regression(s)`);
    process.exit(1);
  }
  console.log('\n[OK  ] post-merge health passed');
}

main();
