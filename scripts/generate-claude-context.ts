#!/usr/bin/env node
/**
 * scripts/generate-claude-context.ts
 *
 * Emits a Claude-ready context packet for a branch. Same data as
 * `generate-codex-context.ts` but framed as anti-hallucination
 * instructions: what the branch ACTUALLY contains, what the branch
 * does NOT contain, and what is explicitly out of scope.
 *
 * Usage:
 *   pnpm generate:claude-context <branch>
 *
 * Paste the output into a Claude session as the initial context so
 * the agent does not assume features from parallel branches.
 */

import { execSync } from 'node:child_process';

const REPO_ROOT = (() => {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
})();

function git(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf8', cwd: REPO_ROOT }).trim();
  } catch {
    return '';
  }
}

// Re-uses the same STACK declarations as generate-codex-context.ts.
// Kept as a separate copy here so the script is standalone-runnable;
// when the two scripts share a declaration table in a follow-up wave,
// move it to a shared module.

interface StackBranch {
  pr: number;
  branch: string;
  declaredBase: string;
  capabilities: readonly string[];
  cherryPicks?: readonly string[];
}

const STACK: readonly StackBranch[] = [
  { pr: 381, branch: 'fix/prisma-contract-fragmentation', declaredBase: 'origin/main', capabilities: ['prisma namespace contract fix'] },
  { pr: 382, branch: 'feat/institutional-trust-primitives', declaredBase: 'origin/main', capabilities: ['canonical trust primitives', 'replay grammar', 'institutional language', 'failure taxonomy'] },
  { pr: 383, branch: 'feat/trust-integration-coherence', declaredBase: 'feat/institutional-trust-primitives', capabilities: ['LineageHeader strip wired into receipt/verify/dossier'] },
  { pr: 384, branch: 'fix/well-known-dynamic-host', declaredBase: 'origin/main', capabilities: ['lib/discovery/issuerHost.ts v1'] },
  { pr: 385, branch: 'feat/matuschak-provenance-panes', declaredBase: 'origin/main', capabilities: ['StackedPaneLayout', 'LineageBacklinks', 'pane URL contract'] },
  { pr: 386, branch: 'feat/canonical-provenance-navigation', declaredBase: 'feat/trust-integration-coherence', cherryPicks: ['feat/matuschak-provenance-panes'], capabilities: ['provenance navigation primitives', 'navigation-contract.ts (MAX_PANE_DEPTH, safePush, cycle detection)'] },
  { pr: 387, branch: 'feat/pilot-deployment-kit', declaredBase: 'origin/main', capabilities: ['/pilot/deployment-kit/[clientSlug] print-ready route'] },
  { pr: 388, branch: 'feat/doximity-hook-and-roi-math', declaredBase: 'origin/main', capabilities: ['@vitalcv/core scaffold', 'roiCalculator', '/api/resolve-npi'] },
  { pr: 389, branch: 'feat/openevidence-risk-engine-and-matuschak-api', declaredBase: 'origin/main', capabilities: ['riskEngine', '/api/employer-pipeline marketRisk', '/api/audit/[eventId]/graph'] },
  { pr: 390, branch: 'feat/antigravity-router-and-durable-chain', declaredBase: 'origin/main', capabilities: ['antigravity middleware', 'HashChainService', 'createAuditEventWithChain', 'AuditEvent.lineageKey/priorRunId schema'] },
  { pr: 391, branch: 'fix/truth-constrained-operationalization', declaredBase: 'origin/main', capabilities: ['operational-status taxonomy', 'assertOperationalClaimEvidence', 'rendered-route truth-audit gate'] },
  { pr: 392, branch: 'feat/live-npi-resolver-and-openmythos-compliance', declaredBase: 'origin/main', capabilities: ['nppesResolver', 'direct .well-known routes', 'ed25519IssuerKey'] },
  { pr: 393, branch: 'fix/protocol-integrity-hardening', declaredBase: 'feat/live-npi-resolver-and-openmythos-compliance', capabilities: ['protocolIntegrity helpers', 'canonical JSON + ETag + 304', 'host hardening'] },
  { pr: 394, branch: 'fix/repository-reality-alignment', declaredBase: 'origin/main', capabilities: ['verify-repo-reality.ts', 'verify:reality/worktrees/codex-ready commands'] },
  { pr: 395, branch: 'feat/interoperability-rehearsal-infrastructure', declaredBase: 'feat/canonical-provenance-navigation', capabilities: ['/interoperability/exchange/[exchangeId] route', 'ReplayBundleEnvelope + ExchangeReadinessState'] },
  { pr: 396, branch: 'fix/stacked-infrastructure-governance', declaredBase: 'origin/main', capabilities: ['stack topology + semantic inheritance + truth contract docs', 'verify-stack-integrity', 'generate-codex/claude-context'] },
];

function ancestryChain(target: string): readonly StackBranch[] {
  const chain: StackBranch[] = [];
  let cursor: string | null = target;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const entry = STACK.find((s) => s.branch === cursor);
    if (!entry) break;
    chain.unshift(entry);
    cursor = entry.declaredBase === 'origin/main' ? null : entry.declaredBase;
  }
  return chain;
}

function main(): void {
  const branchArg = process.argv[2] ?? git('git rev-parse --abbrev-ref HEAD');
  const entry = STACK.find((s) => s.branch === branchArg);
  if (!entry) {
    console.error(
      `# generate-claude-context\nbranch "${branchArg}" not declared in scripts/generate-claude-context.ts STACK. Update the table when opening a new wave.`,
    );
    process.exit(2);
  }
  const head = git(`git rev-parse ${entry.branch}`);
  const chain = ancestryChain(entry.branch);
  const inSelfBranchCaps = new Set(entry.capabilities);
  const inheritedCaps = chain
    .filter((c) => c.branch !== entry.branch)
    .flatMap((c) => c.capabilities.map((cap) => ({ pr: c.pr, cap })));
  const absent = STACK
    .filter((s) => s.branch !== entry.branch && !chain.includes(s) && !entry.cherryPicks?.includes(s.branch))
    .flatMap((s) => s.capabilities.map((cap) => ({ pr: s.pr, cap })))
    .filter((x) => !inSelfBranchCaps.has(x.cap));

  console.log('# Claude execution context (anti-hallucination packet)');
  console.log('');
  console.log(`You are working on branch \`${entry.branch}\` (PR #${entry.pr}). HEAD = \`${head}\`.`);
  console.log(`Declared base: \`${entry.declaredBase}\`.`);
  console.log('');
  console.log('## DO NOT assume the following capabilities are available');
  console.log('');
  console.log('These exist in parallel branches that are NOT in this branch\'s ancestry. If your work requires any of them, the correct response is to (a) note the dependency in the PR body and request a rebase, or (b) implement the capability directly in this branch with a fresh evidence reference.');
  console.log('');
  if (absent.length === 0) {
    console.log('- (every other session-PR capability is reachable via ancestry; this branch is at the top of the stack)');
  } else {
    for (const a of absent) console.log(`- PR #${a.pr}: ${a.cap}`);
  }
  console.log('');
  console.log('## You MAY assume the following capabilities (they are in ancestry)');
  console.log('');
  if (inheritedCaps.length === 0) {
    console.log('- (only what is on `origin/main`)');
  } else {
    for (const i of inheritedCaps) console.log(`- PR #${i.pr}: ${i.cap}`);
  }
  console.log('');
  console.log('## This branch adds');
  console.log('');
  for (const c of entry.capabilities) console.log(`- ${c}`);
  console.log('');
  console.log('## Truth-contract reminder');
  console.log('');
  console.log('- Never describe a parallel-branch capability as "shipped" in this PR.');
  console.log('- Every implementation claim in this PR\'s body must trace to a file in the diff or in the merge-base tree.');
  console.log('- Banned cross-stack claims are listed in `docs/ops/stack-aware-truth-contract.md`.');
  console.log('- Run `pnpm verify:semantic-lineage` before requesting Codex audit.');
}

main();
