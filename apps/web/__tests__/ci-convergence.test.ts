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

describe('wallet-sdk repair', () => {
  it('source no longer references the orphan ./interoperability re-export', () => {
    const src = read('packages/wallet-sdk/src/index.ts');
    expect(src).not.toMatch(/^export \* from ['"]\.\/interoperability['"]/m);
  });

  it('the repair comment is present (so future readers see why it was removed)', () => {
    const src = read('packages/wallet-sdk/src/index.ts');
    expect(src).toMatch(/`\.\/interoperability` re-export referenced a file/);
  });

  it('version + diagnostics re-exports are preserved', () => {
    const src = read('packages/wallet-sdk/src/index.ts');
    expect(src).toMatch(/export \* from ['"]\.\/version['"]/);
    expect(src).toMatch(/export \* from ['"]\.\/diagnostics['"]/);
  });

  it('wallet-sdk builds clean to dist/', () => {
    execSync('pnpm --filter @vitalcv/wallet-sdk build', {
      cwd: REPO_ROOT,
      stdio: 'ignore',
    });
    for (const artifact of ['dist/index.js', 'dist/index.mjs', 'dist/index.d.ts']) {
      expect(
        existsSync(resolve(REPO_ROOT, 'packages/wallet-sdk', artifact)),
      ).toBe(true);
    }
  });
});

describe('verify-ci-convergence script', () => {
  it('exits 0 in full mode on a clean worktree', () => {
    // build first so dist/* artifact warnings don't matter
    execSync('pnpm --filter @vitalcv/wallet-sdk build', {
      cwd: REPO_ROOT,
      stdio: 'ignore',
    });
    const out = execSync(
      'node --experimental-strip-types scripts/verify-ci-convergence.ts full',
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    expect(out).toContain('verify-ci-convergence');
    expect(out).toContain('ci-convergence passed');
  });

  it('wallet-sdk sub-mode reports artifact presence', () => {
    const out = execSync(
      'node --experimental-strip-types scripts/verify-ci-convergence.ts wallet-sdk',
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    expect(out).toContain('wallet-sdk artifact present: dist/index.js');
    expect(out).toContain('wallet-sdk artifact present: dist/index.mjs');
    expect(out).toContain('wallet-sdk artifact present: dist/index.d.ts');
  });

  it('workspace-exports sub-mode classifies pending dist artifacts as WARN, not FAIL', () => {
    const out = execSync(
      'node --experimental-strip-types scripts/verify-ci-convergence.ts workspace-exports',
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    // No hard FAIL rows expected -- only OK / WARN / NOTE classifications.
    const lines = out.split('\n');
    const failLines = lines.filter((l) => l.startsWith('[FAIL'));
    expect(failLines, `unexpected FAIL rows:\n${failLines.join('\n')}`).toEqual([]);
  });
});

describe('docs presence', () => {
  it.each([
    'docs/ops/wallet-sdk-archaeology.md',
    'docs/ops/convergence-dependency-map.md',
  ])('%s exists', (rel) => {
    expect(existsSync(resolve(REPO_ROOT, rel))).toBe(true);
  });

  it('archaeology doc names the exact root cause', () => {
    const md = read('docs/ops/wallet-sdk-archaeology.md');
    expect(md).toContain("export * from './interoperability'");
    expect(md).toContain('Could not resolve "./interoperability"');
  });

  it('dependency map names the post-repair unblocked PR set', () => {
    const md = read('docs/ops/convergence-dependency-map.md');
    expect(md).toMatch(/All 17 session-created PRs/i);
    expect(md).toMatch(/inherit the wallet-sdk/i);
  });
});

describe('truth contract · no CI-restored marketing claims', () => {
  const banned = [
    'fully restored',
    'production-ready ci',
    'guaranteed convergence',
    'magical fix',
    'instant ci',
  ];

  it.each([
    'docs/ops/wallet-sdk-archaeology.md',
    'docs/ops/convergence-dependency-map.md',
  ])('%s avoids marketing claim phrases', (rel) => {
    const md = read(rel).toLowerCase();
    for (const phrase of banned) {
      expect(md.includes(phrase), `should not contain "${phrase}"`).toBe(false);
    }
  });
});
