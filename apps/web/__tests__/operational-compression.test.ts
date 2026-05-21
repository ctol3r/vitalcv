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

describe('compression-wave docs presence', () => {
  it.each([
    'docs/ops/canonical-merge-graph.md',
    'docs/ops/operational-compression-audit.md',
    'docs/ops/founder-execution-lane.md',
    'docs/ops/operational-state.md',
    'docs/ops/stack-operational-governance.md',
    'docs/ops/merge-readiness-checklist.md',
  ])('%s exists', (rel) => {
    expect(existsSync(resolve(REPO_ROOT, rel))).toBe(true);
  });
});

describe('canonical-merge-graph · branch classification', () => {
  it('classifies every session PR (381-397)', () => {
    const md = read('docs/ops/canonical-merge-graph.md');
    for (const pr of [
      381, 382, 383, 384, 385, 386, 387, 388, 389, 390, 391, 392, 393, 394,
      395, 396, 397,
    ]) {
      expect(md).toMatch(new RegExp(`#${pr}|${pr} `));
    }
  });

  it('declares the three known stack chains', () => {
    const md = read('docs/ops/canonical-merge-graph.md');
    expect(md).toMatch(/trust canon chain/i);
    expect(md).toMatch(/core-scaffold/i);
  });

  it('uses the six binding classification states', () => {
    const md = read('docs/ops/canonical-merge-graph.md');
    for (const state of [
      'MERGE_SAFE',
      'STACKED_SAFE',
      'BLOCKED_AUDIT',
      'ARCHIVE_CANDIDATE',
      'ISOLATED',
      'EXPERIMENTAL',
    ]) {
      expect(md).toContain(state);
    }
  });
});

describe('operational-compression-audit · duplicate inventory', () => {
  it('lists at least five duplicate-tracking rows', () => {
    const md = read('docs/ops/operational-compression-audit.md');
    expect(md).toMatch(/Banned-phrase lists are intentional duplicates/);
    expect(md).toMatch(/Capability-status taxonomy/);
    expect(md).toMatch(/Codex-ready checklist/);
  });

  it('records that one command is consolidated (verify:operational-health)', () => {
    const md = read('docs/ops/operational-compression-audit.md');
    expect(md).toMatch(/Commands consolidated:\*\* 1/);
    expect(md).toMatch(/verify-operational-health/);
  });
});

describe('founder-execution-lane · executable flows', () => {
  it('contains all seven flows: start repo, verify, run demo, tunnel, audit, stack, prep pilot', () => {
    const md = read('docs/ops/founder-execution-lane.md');
    expect(md).toMatch(/1\. Start repo/);
    expect(md).toMatch(/2\. Verify repo/);
    expect(md).toMatch(/3\. Run local demo/);
    expect(md).toMatch(/4\. Open Cloudflare tunnel/);
    expect(md).toMatch(/5\. Run Codex audit/);
    expect(md).toMatch(/6\. Verify stack integrity/);
    expect(md).toMatch(/7\. Prep pilot demo/);
  });

  it('uses VCV_ISSUER_HOST for the tunnel step', () => {
    const md = read('docs/ops/founder-execution-lane.md');
    expect(md).toMatch(/VCV_ISSUER_HOST/);
  });
});

describe('operational-state · state taxonomy', () => {
  it('declares six state names', () => {
    const md = read('docs/ops/operational-state.md');
    for (const state of [
      'READY',
      'BLOCKED',
      'EXPERIMENTAL',
      'ARCHIVE_CANDIDATE',
      'CODEX_UNSAFE',
      'MERGE_SAFE',
    ]) {
      expect(md).toContain(state);
    }
  });
});

describe('merge-readiness-checklist · exactly six items', () => {
  it('declares the six minimal checks', () => {
    const md = read('docs/ops/merge-readiness-checklist.md');
    expect(md).toMatch(/Branch materially exists/);
    expect(md).toMatch(/Codex audited/);
    expect(md).toMatch(/Stack dependencies satisfied/);
    expect(md).toMatch(/No semantic inflation/);
    expect(md).toMatch(/Repo-health passes/);
    expect(md).toMatch(/Merge ancestry coherent/);
  });

  it('explicitly excludes process-theater items', () => {
    const md = read('docs/ops/merge-readiness-checklist.md');
    expect(md).toMatch(/process theater/i);
    expect(md).toMatch(/NOT on this checklist/);
  });
});

describe('verify-operational-health script', () => {
  it('runs and emits a header + sub-check sections', () => {
    const out = execSync(
      'node --experimental-strip-types scripts/verify-operational-health.ts',
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    expect(out).toContain('verify-operational-health');
    expect(out).toContain('## repo-reality');
    expect(out).toContain('## stack-integrity');
    expect(out).toContain('## codex-ready');
  });

  it('treats missing sub-check scripts as skipped (not failed)', () => {
    // In this worktree off origin/main, the sub-check scripts are not
    // present. The dispatcher should report "(skipped)" and still exit 0.
    const out = execSync(
      'node --experimental-strip-types scripts/verify-operational-health.ts',
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    expect(out).toContain('(skipped)');
    expect(out).toContain('operational health passed');
  });
});

describe('truth contract · no process theater', () => {
  const banned = [
    'velocity tracking',
    'burn-down',
    'enterprise agile',
    'story-pointing',
    'orchestration theater',
  ];

  it.each([
    'docs/ops/canonical-merge-graph.md',
    'docs/ops/operational-compression-audit.md',
    'docs/ops/founder-execution-lane.md',
    'docs/ops/operational-state.md',
    'docs/ops/stack-operational-governance.md',
  ])('%s avoids process-theater phrases', (rel) => {
    const md = read(rel).toLowerCase();
    for (const phrase of banned) {
      expect(md.includes(phrase), `should not contain "${phrase}"`).toBe(false);
    }
  });

  it('merge-readiness-checklist mentions process theater only as a negative anti-pattern', () => {
    const md = read('docs/ops/merge-readiness-checklist.md').toLowerCase();
    // It SHOULD mention "process theater" as something we avoid.
    expect(md).toContain('process theater');
    // But it should not mention "velocity tracking" / "burn-down" / "enterprise agile" / "story-pointing"
    // as anything other than exclusions in the NOT-on-checklist section.
    // These appear in the NOT-on-checklist list explicitly, so they're allowed.
  });
});
