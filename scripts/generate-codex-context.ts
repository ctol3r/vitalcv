#!/usr/bin/env node
/**
 * scripts/generate-codex-context.ts
 *
 * Emits a Codex-ready context packet for a single branch. Reads the
 * canonical stack topology declarations from
 * `scripts/verify-stack-integrity.ts` (single source of truth) and
 * outputs:
 *
 *   - branch name + HEAD SHA
 *   - declared ancestry chain
 *   - capabilities inherited from each ancestor
 *   - capabilities added in this branch
 *   - intentionally absent layers
 *   - semantic-risk notes (banned cross-stack claims)
 *
 * Usage:
 *   pnpm generate:codex-context <branch>
 *   pnpm generate:codex-context fix/protocol-integrity-hardening
 *
 * The packet is markdown so an operator can paste it directly into a
 * Codex audit prompt.
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

interface StackBranch {
  pr: number;
  branch: string;
  declaredBase: string;
  capabilities: readonly string[];
  cherryPicks?: readonly string[];
}

/**
 * Capabilities by PR -- one source of truth. Keep in sync with
 * `docs/ops/stack-topology.md`.
 */
const STACK: readonly StackBranch[] = [
  {
    pr: 381,
    branch: 'fix/prisma-contract-fragmentation',
    declaredBase: 'origin/main',
    capabilities: ['prisma namespace contract fix (auditEvent JSON casts)'],
  },
  {
    pr: 382,
    branch: 'feat/institutional-trust-primitives',
    declaredBase: 'origin/main',
    capabilities: [
      'canonical trust primitives (LineageHeader, OwnershipStateBadge, TierBadge, CheckedAtStamp, ReplayTimeline, FailureTaxonomyBadge, DegradedStatePanel, HumanReviewLane, RevocationStateBanner, LineageRow, TrustReceipt)',
      'replay grammar (composeLineage, LineageSlots, six-cell binding reading order)',
      'institutional language (INSTITUTIONAL_PHRASES, READING_ORDER_LABELS, BANNED_INSTITUTIONAL_PHRASES)',
      'failure taxonomy (DegradationState, FailureMode, visualForDegradation)',
    ],
  },
  {
    pr: 383,
    branch: 'feat/trust-integration-coherence',
    declaredBase: 'feat/institutional-trust-primitives',
    capabilities: [
      'canonical LineageHeader strip wired into /receipt, /verify/receipt, /dossier',
      'rename of route-local LineageHeader in /verify/receipt to ReplayInspectionHeader (collision resolution)',
    ],
  },
  {
    pr: 384,
    branch: 'fix/well-known-dynamic-host',
    declaredBase: 'origin/main',
    capabilities: [
      'lib/discovery/issuerHost.ts v1 (per-request host resolution)',
      'dynamic host injection into existing api/.well-known/{did.json,openid-credential-issuer}',
    ],
  },
  {
    pr: 385,
    branch: 'feat/matuschak-provenance-panes',
    declaredBase: 'origin/main',
    capabilities: [
      'Stacked Provenance Ledger (URL contract ?panes=...)',
      'StackedPaneLayout + LineageBacklinks components',
      'PANE_KINDS taxonomy (receipt|audit|claim|lineage|entity)',
      '/trust/panes/[receiptId] demo route',
    ],
  },
  {
    pr: 386,
    branch: 'feat/canonical-provenance-navigation',
    declaredBase: 'feat/trust-integration-coherence',
    cherryPicks: ['feat/matuschak-provenance-panes'],
    capabilities: [
      'canonical provenance navigation primitives (ProvenancePaneHeader, ProvenancePaneMeta, ProvenanceChronology, ProvenanceBinding, ProvenanceTrail, ReplayRunStamp, EntityBindingSummary)',
      'navigation-contract.ts (MAX_PANE_DEPTH=7, safePush, cycle detection, BINDING_RATIONALES)',
      'docs/design/provenance-navigation-boundaries.md',
    ],
  },
  {
    pr: 387,
    branch: 'feat/pilot-deployment-kit',
    declaredBase: 'origin/main',
    capabilities: [
      '/pilot/deployment-kit/[clientSlug] print-ready document route',
      'Cedar Q2-2026 cohort fixture',
    ],
  },
  {
    pr: 388,
    branch: 'feat/doximity-hook-and-roi-math',
    declaredBase: 'origin/main',
    capabilities: [
      '@vitalcv/core workspace scaffold (first lander)',
      'roiCalculator.ts (taxonomy → daily-bleed → opportunity-cost)',
      '/api/resolve-npi (Luhn + NPPES live + in-memory cache + IP rate-limit)',
      'lib/rate-limit/ipBucket.ts',
    ],
  },
  {
    pr: 389,
    branch: 'feat/openevidence-risk-engine-and-matuschak-api',
    declaredBase: 'origin/main',
    capabilities: [
      'packages/core riskEngine.ts (taxonomy + rural/urban → multiplier + replacementCost)',
      '/api/employer-pipeline with marketRisk per clinician',
      '/api/audit/[eventId]/graph (bi-directional lineage)',
      'lib/audit/demoEvents.ts + lineageGraph.ts',
    ],
  },
  {
    pr: 390,
    branch: 'feat/antigravity-router-and-durable-chain',
    declaredBase: 'origin/main',
    capabilities: [
      'lib/auth/antigravity.ts + middleware hook (verifier route-lock)',
      'packages/core HashChainService.ts (SHA-256 chain) + createAuditEventWithChain wrapper',
      'AuditEvent.lineageKey + .priorRunId schema columns (nullable; non-breaking)',
    ],
  },
  {
    pr: 391,
    branch: 'fix/truth-constrained-operationalization',
    declaredBase: 'origin/main',
    capabilities: [
      'lib/trust/operational-status.ts (6-state taxonomy)',
      'lib/trust/assertOperationalClaimEvidence.ts (evidence-bound claims)',
      'docs/ops/operational-capability-boundaries.md',
      'rendered-route truth-audit test gate',
    ],
  },
  {
    pr: 392,
    branch: 'feat/live-npi-resolver-and-openmythos-compliance',
    declaredBase: 'origin/main',
    capabilities: [
      'packages/core nppesResolver.ts (typed outcome envelope + DTO projection)',
      'direct app/.well-known/did.json + openid-credential-issuer routes',
      'lib/crypto/ed25519IssuerKey.ts (Ed25519 identity key surface)',
      'lib/discovery/issuerHost.ts v2 + lib/protocol/protocolIntegrity.ts',
    ],
  },
  {
    pr: 393,
    branch: 'fix/protocol-integrity-hardening',
    declaredBase: 'feat/live-npi-resolver-and-openmythos-compliance',
    capabilities: [
      'lib/protocol/protocolIntegrity.ts (canonicalSerialize, computeETag, canonicalizeHost, buildCanonicalJsonResponse)',
      'host hardening (port range, Unicode rejection, control chars)',
      'ETag + 304 + Vary on did.json and openid-credential-issuer',
      'docs/protocol/protocol-surface-integrity-audit.md + protocol-capability-boundaries.md',
    ],
  },
  {
    pr: 394,
    branch: 'fix/repository-reality-alignment',
    declaredBase: 'origin/main',
    capabilities: [
      'scripts/verify-repo-reality.ts',
      'pnpm verify:reality / verify:worktrees / verify:codex-ready',
      'apps/web typecheck script',
      'docs/ops/{repository-reality-audit,worktree-governance,implementation-reality-contract,codex-ready-checklist}.md',
    ],
  },
  {
    pr: 395,
    branch: 'feat/interoperability-rehearsal-infrastructure',
    declaredBase: 'feat/canonical-provenance-navigation',
    capabilities: [
      '/interoperability/exchange/[exchangeId] route',
      'ReplayBundleEnvelope + ExchangeReadinessState (7 closed states)',
      'IndependentCrossCheckPanel + TrustExchangeTimeline + EvidenceReusePanel + ExportVerificationExchangeButton',
      'docs/protocol/interoperability-rehearsal-boundaries.md',
    ],
  },
  {
    pr: 396,
    branch: 'fix/stacked-infrastructure-governance',
    declaredBase: 'origin/main',
    capabilities: [
      'docs/ops/{stack-topology,semantic-inheritance-boundaries,stack-aware-truth-contract}.md',
      'scripts/verify-stack-integrity.ts',
      'scripts/generate-codex-context.ts + generate-claude-context.ts',
      'pnpm verify:stack / verify:semantic-lineage / generate:codex-context / generate:claude-context',
    ],
  },
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

function describeAbsentLayers(target: StackBranch): readonly string[] {
  const inherited = new Set<string>();
  for (const link of ancestryChain(target.branch)) {
    for (const cap of link.capabilities) inherited.add(cap);
  }
  for (const cp of target.cherryPicks ?? []) {
    const cherry = STACK.find((s) => s.branch === cp);
    if (cherry) for (const cap of cherry.capabilities) inherited.add(cap);
  }
  const absent: string[] = [];
  for (const entry of STACK) {
    if (entry.branch === target.branch) continue;
    if (ancestryChain(target.branch).some((a) => a.branch === entry.branch)) continue;
    if (target.cherryPicks?.includes(entry.branch)) continue;
    for (const cap of entry.capabilities) {
      if (!inherited.has(cap)) absent.push(`${cap} (lives in PR #${entry.pr})`);
    }
  }
  return absent;
}

function main(): void {
  const branchArg = process.argv[2] ?? git('git rev-parse --abbrev-ref HEAD');
  const entry = STACK.find((s) => s.branch === branchArg);
  if (!entry) {
    console.error(
      `# generate-codex-context\nbranch "${branchArg}" is not declared in the canonical stack topology. Add a row to docs/ops/stack-topology.md and update scripts/generate-codex-context.ts.`,
    );
    process.exit(2);
  }
  const head = git(`git rev-parse ${entry.branch}`);
  const chain = ancestryChain(entry.branch);
  const absent = describeAbsentLayers(entry);

  console.log(`# Codex context · PR #${entry.pr} · ${entry.branch}`);
  console.log('');
  console.log(`- HEAD: \`${head}\``);
  console.log(`- declared base: \`${entry.declaredBase}\``);
  if (entry.cherryPicks?.length) {
    console.log(`- cherry-picks: ${entry.cherryPicks.map((c) => `\`${c}\``).join(', ')}`);
  }
  console.log('');
  console.log('## Ancestry chain (oldest → this branch)');
  console.log('');
  for (const link of chain) {
    console.log(`- PR #${link.pr} · \`${link.branch}\``);
  }
  console.log('');
  console.log('## Capabilities INHERITED from ancestry');
  console.log('');
  const inheritedCaps = chain
    .filter((c) => c.branch !== entry.branch)
    .flatMap((c) => c.capabilities.map((cap) => `(PR #${c.pr}) ${cap}`));
  if (inheritedCaps.length === 0) {
    console.log('- (none beyond origin/main)');
  } else {
    for (const cap of inheritedCaps) console.log(`- ${cap}`);
  }
  console.log('');
  console.log('## Capabilities ADDED in this branch');
  console.log('');
  for (const cap of entry.capabilities) console.log(`- ${cap}`);
  console.log('');
  console.log('## Intentionally ABSENT from this branch');
  console.log('');
  if (absent.length === 0) {
    console.log('- (every other session-PR capability is in this ancestry)');
  } else {
    for (const cap of absent) console.log(`- ${cap}`);
  }
  console.log('');
  console.log('## Codex audit reminders');
  console.log('');
  console.log('- Do NOT mark SAFE if the PR body claims a capability listed under "ABSENT".');
  console.log('- Cross-check evidence references in the PR body against the diff.');
  console.log('- Verify the stacking note in the PR body matches the ancestry chain above.');
  console.log('- Run `pnpm verify:stack` before issuing the SAFE verdict.');
}

main();
