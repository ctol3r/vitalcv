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

describe('stack governance docs', () => {
  it('stack-topology.md ships at the canonical path', () => {
    expect(existsSync(resolve(REPO_ROOT, 'docs/ops/stack-topology.md'))).toBe(true);
  });

  it('stack-topology lists every session PR', () => {
    const md = read('docs/ops/stack-topology.md');
    for (const pr of [381, 382, 383, 384, 385, 386, 387, 388, 389, 390, 391, 392, 393, 394, 395, 396]) {
      expect(md).toMatch(new RegExp(`#${pr}`));
    }
  });

  it('semantic-inheritance-boundaries.md ships', () => {
    expect(
      existsSync(resolve(REPO_ROOT, 'docs/ops/semantic-inheritance-boundaries.md')),
    ).toBe(true);
  });

  it('stack-aware-truth-contract.md ships with banned cross-stack list', () => {
    const md = read('docs/ops/stack-aware-truth-contract.md');
    expect(md).toMatch(/did:web discovery implemented/);
    expect(md).toMatch(/hash-chained audit events/);
    expect(md).toMatch(/interoperability rehearsal/);
  });
});

describe('verify-stack-integrity script', () => {
  it('runs and exits 0 when all session branches present', () => {
    const out = execSync(
      'node --experimental-strip-types scripts/verify-stack-integrity.ts',
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    expect(out).toContain('verify-stack-integrity');
    expect(out).toContain('docs/ops/stack-topology.md present');
  });

  it('output contains a header line + at least one OK row', () => {
    const out = execSync(
      'node --experimental-strip-types scripts/verify-stack-integrity.ts',
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    const lines = out.split('\n');
    expect(lines[0]).toMatch(/^# verify-stack-integrity/);
    expect(lines.some((l) => l.includes('[OK'))).toBe(true);
  });
});

describe('generate-codex-context script', () => {
  it('emits ancestry + inherited + added + absent sections for a known branch', () => {
    const out = execSync(
      'node --experimental-strip-types scripts/generate-codex-context.ts fix/protocol-integrity-hardening',
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    expect(out).toContain('# Codex context · PR #393');
    expect(out).toContain('## Ancestry chain');
    expect(out).toContain('## Capabilities INHERITED from ancestry');
    expect(out).toContain('## Capabilities ADDED in this branch');
    expect(out).toContain('## Intentionally ABSENT from this branch');
  });

  it('exits non-zero for an unknown branch', () => {
    let exited = 0;
    try {
      execSync(
        'node --experimental-strip-types scripts/generate-codex-context.ts not-a-branch',
        { cwd: REPO_ROOT, encoding: 'utf8' },
      );
    } catch (err) {
      const e = err as { status?: number };
      exited = e.status ?? 1;
    }
    expect(exited).toBe(2);
  });
});

describe('generate-claude-context script', () => {
  it('emits anti-hallucination packet with DO NOT assume + MAY assume sections', () => {
    const out = execSync(
      'node --experimental-strip-types scripts/generate-claude-context.ts feat/interoperability-rehearsal-infrastructure',
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    expect(out).toContain('# Claude execution context');
    expect(out).toContain('DO NOT assume');
    expect(out).toContain('You MAY assume');
    expect(out).toContain('This branch adds');
  });
});

describe('truth contract · governance docs', () => {
  it('no banned cross-stack claim appears in stack-topology unless documenting bans', () => {
    const md = read('docs/ops/stack-topology.md');
    // Cross-stack-banned phrases from stack-aware-truth-contract.md may
    // appear in the topology doc ONLY as table headers / row references.
    // Spot-check that the doc is not making unqualified claims.
    expect(md).not.toMatch(/automatic acceptance/i);
    expect(md).not.toMatch(/fully verified/i);
    expect(md).not.toMatch(/universally accepted/i);
  });
});
