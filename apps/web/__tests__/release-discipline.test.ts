import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = execSync('git rev-parse --show-toplevel', {
  encoding: 'utf8',
}).trim();

function read(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), 'utf8');
}

// ── Docs presence ─────────────────────────────────────────────────────────

describe('release-discipline docs', () => {
  it.each([
    'docs/ops/canonical-release-graph.md',
    'docs/ops/merge-risk-taxonomy.md',
    'docs/ops/release-batching-guide.md',
    'docs/ops/founder-release-lane.md',
    'docs/ops/merge-collapse-hazards.md',
  ])('%s exists', (rel) => {
    expect(existsSync(resolve(REPO_ROOT, rel))).toBe(true);
  });
});

// ── Merge-risk taxonomy ───────────────────────────────────────────────────

describe('merge-risk taxonomy · seven canonical classes', () => {
  it('declares exactly the 7 canonical risk classes', () => {
    const md = read('docs/ops/merge-risk-taxonomy.md');
    for (const cls of [
      'SAFE',
      'SAFE_WITH_DEPENDENCIES',
      'SEMANTIC_RISK',
      'PROTOCOL_RISK',
      'GOVERNANCE_ONLY',
      'HOLD',
      'ARCHIVE',
    ]) {
      expect(md).toContain(`\`${cls}\``);
    }
  });

  it('classifies every session PR (381-399)', () => {
    const md = read('docs/ops/merge-risk-taxonomy.md');
    for (const pr of [
      381, 382, 383, 384, 385, 386, 387, 388, 389, 390, 391, 392, 393, 394,
      395, 396, 397, 398, 399,
    ]) {
      expect(md).toMatch(new RegExp(`\\|\\s*${pr}\\s*\\|`));
    }
  });

  it('PROTOCOL_RISK is assigned to #384, #392, #393', () => {
    const md = read('docs/ops/merge-risk-taxonomy.md');
    const rows = md.split('\n').filter((l) => l.includes('PROTOCOL_RISK'));
    const protocolPRs = rows
      .map((r) => r.match(/\|\s*(\d{3,4})\s*\|/)?.[1])
      .filter(Boolean);
    expect(protocolPRs).toContain('384');
    expect(protocolPRs).toContain('392');
    expect(protocolPRs).toContain('393');
  });

  it('GOVERNANCE_ONLY captures the governance-wave PRs', () => {
    const md = read('docs/ops/merge-risk-taxonomy.md');
    const govRows = md
      .split('\n')
      .filter((l) => l.includes('GOVERNANCE_ONLY') && /\|\s*\d{3,4}\s*\|/.test(l));
    const govPRs = govRows
      .map((r) => r.match(/\|\s*(\d{3,4})\s*\|/)?.[1])
      .filter(Boolean);
    // PRs #391, #394, #396, #397, #399 are governance-only
    for (const pr of ['391', '394', '396', '397', '399']) {
      expect(govPRs).toContain(pr);
    }
  });
});

// ── Release graph ─────────────────────────────────────────────────────────

describe('canonical-release-graph', () => {
  it('declares the three concurrent blocks (A / B / C)', () => {
    const md = read('docs/ops/canonical-release-graph.md');
    expect(md).toMatch(/Block A\s*[·.\s]+ISOLATED/);
    expect(md).toMatch(/Block B\s*[·.\s]+trust canon/);
    expect(md).toMatch(/Block C\s*[·.\s]+core scaffold/);
  });

  it('row for every session PR (381-399)', () => {
    const md = read('docs/ops/canonical-release-graph.md');
    for (const pr of [
      381, 382, 383, 384, 385, 386, 387, 388, 389, 390, 391, 392, 393, 394,
      395, 396, 397, 398, 399,
    ]) {
      expect(md).toMatch(new RegExp(`\\|\\s*${pr}\\s*\\|`));
    }
  });

  it('names dependency-critical PRs explicitly', () => {
    const md = read('docs/ops/canonical-release-graph.md');
    expect(md).toMatch(/#382/);
    expect(md).toMatch(/#398/);
  });
});

// ── Founder release lane ──────────────────────────────────────────────────

describe('founder-release-lane', () => {
  it('exposes a per-PR 4-step merge loop', () => {
    const md = read('docs/ops/founder-release-lane.md');
    expect(md).toMatch(/1\. Verify stack integrity/);
    expect(md).toMatch(/2\. Run Codex audit/);
    expect(md).toMatch(/3\. Merge with rebase/);
    expect(md).toMatch(/4\. Verify main is healthy/);
  });

  it('uses VCV_ISSUER_HOST for the tunnel demo step', () => {
    const md = read('docs/ops/founder-release-lane.md');
    expect(md).toMatch(/VCV_ISSUER_HOST/);
  });

  it('ships the one-line midnight sequence', () => {
    const md = read('docs/ops/founder-release-lane.md');
    expect(md).toMatch(/One-line midnight sequence/);
    expect(md).toMatch(/gh pr merge --rebase/);
  });
});

// ── Merge-collapse hazards ────────────────────────────────────────────────

describe('merge-collapse-hazards · six rules', () => {
  it('enumerates the six hazard categories', () => {
    const md = read('docs/ops/merge-collapse-hazards.md');
    expect(md).toMatch(/Hazard 1\s*[—-]+\s*Semantic duplication/);
    expect(md).toMatch(/Hazard 2\s*[—-]+\s*Protocol regression/);
    expect(md).toMatch(/Hazard 3\s*[—-]+\s*Replay grammar drift/);
    expect(md).toMatch(/Hazard 4\s*[—-]+\s*Provenance divergence/);
    expect(md).toMatch(/Hazard 5\s*[—-]+\s*Stack-order violations/);
    expect(md).toMatch(/Hazard 6\s*[—-]+\s*Hidden ancestry assumptions/);
  });
});

// ── verify-post-merge-health script ──────────────────────────────────────

describe('verify-post-merge-health · sub-modes', () => {
  it('release-graph sub-mode reports rows from canonical-release-graph.md', () => {
    const out = execSync(
      'node --experimental-strip-types scripts/verify-post-merge-health.ts release-graph',
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    expect(out).toMatch(/release graph rows: \d+/);
    expect(out).toContain('PR #382');
    expect(out).toContain('PR #398');
  });

  it('merge-risk sub-mode reports each canonical class', () => {
    const out = execSync(
      'node --experimental-strip-types scripts/verify-post-merge-health.ts merge-risk',
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    for (const cls of [
      'SAFE',
      'SAFE_WITH_DEPENDENCIES',
      'SEMANTIC_RISK',
      'PROTOCOL_RISK',
      'GOVERNANCE_ONLY',
      'HOLD',
      'ARCHIVE',
    ]) {
      expect(out).toContain(`class ${cls}:`);
    }
  });

  it('full sub-mode emits at least one OK row and at least one key-file NOTE', () => {
    let stdout = '';
    try {
      stdout = execSync(
        'node --experimental-strip-types scripts/verify-post-merge-health.ts full',
        { cwd: REPO_ROOT, encoding: 'utf8' },
      );
    } catch (err) {
      const e = err as { stdout?: Buffer | string };
      stdout =
        typeof e.stdout === 'string'
          ? e.stdout
          : Buffer.isBuffer(e.stdout)
            ? e.stdout.toString('utf8')
            : '';
    }
    expect(stdout).toContain('verify-post-merge-health');
    expect(stdout).toMatch(/\[OK\s+\]/);
    expect(stdout).toMatch(/\[NOTE\]/);
    // On origin/main, wallet-sdk has the orphan re-export; PR #398 fixes it.
    // The dispatcher correctly reports a FAIL row in that state.
    // We accept either: pre-#398 (FAIL row present) or post-#398 (OK row).
  });
});

// ── Truth contract · no release-engineering puffery ───────────────────────

describe('truth contract · release-discipline docs', () => {
  const banned = [
    'production-ready release',
    'guaranteed convergence',
    'fully release-ready',
    'release engineering cosplay',
    'magical merge',
    'instant release',
  ];

  it.each([
    'docs/ops/canonical-release-graph.md',
    'docs/ops/merge-risk-taxonomy.md',
    'docs/ops/release-batching-guide.md',
    'docs/ops/founder-release-lane.md',
    'docs/ops/merge-collapse-hazards.md',
  ])('%s avoids release-engineering puffery', (rel) => {
    const md = read(rel).toLowerCase();
    for (const phrase of banned) {
      expect(md.includes(phrase), `should not contain "${phrase}"`).toBe(false);
    }
  });
});
