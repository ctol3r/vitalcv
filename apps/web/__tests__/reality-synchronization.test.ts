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

// ── Doc + script presence ─────────────────────────────────────────────────

describe('reality-synchronization · file presence', () => {
  it.each([
    'docs/ops/canonical-wave-registry.md',
    'docs/ops/reality-synchronization-audit.md',
    'docs/ops/materialization-boundaries.md',
    'scripts/verify-wave-materialization.ts',
  ])('%s exists', (rel) => {
    expect(existsSync(resolve(REPO_ROOT, rel))).toBe(true);
  });
});

// ── Wave registry shape ──────────────────────────────────────────────────

describe('canonical wave registry · shape', () => {
  it('enumerates the six lifecycle states', () => {
    const md = read('docs/ops/canonical-wave-registry.md');
    for (const state of [
      '`conceptualized`',
      '`implemented`',
      '`pr_opened`',
      '`audited`',
      '`merged`',
      '`archived`',
    ]) {
      expect(md).toContain(state);
    }
  });

  it('declares the five reality columns', () => {
    const md = read('docs/ops/canonical-wave-registry.md');
    for (const col of [
      '`branch`',
      '`pr`',
      '`audit_target`',
      '`route`',
      '`tests`',
    ]) {
      expect(md).toContain(col);
    }
  });

  it('contains rows for W22, W23, W24, and W25 with the expected branches', () => {
    const md = read('docs/ops/canonical-wave-registry.md');
    expect(md).toMatch(/\|\s*W22\s*\|[^|]*\|\s*`feat\/operational-waste-visibility`/);
    expect(md).toMatch(/\|\s*W23\s*\|[^|]*\|\s*`feat\/operational-signal-hierarchy`/);
    expect(md).toMatch(/\|\s*W24\s*\|[^|]*\|\s*`feat\/institutional-path-completion`/);
    expect(md).toMatch(/\|\s*W25\s*\|[^|]*\|\s*`fix\/reality-synchronization`/);
  });

  it('contains a prior-session table that includes PR #375 through PR #401', () => {
    const md = read('docs/ops/canonical-wave-registry.md');
    for (const n of [375, 380, 385, 390, 395, 401]) {
      expect(md).toMatch(new RegExp(`\\|\\s*${n}\\s*\\|`));
    }
  });
});

// ── Materialization-boundary doctrine ─────────────────────────────────────

describe('materialization-boundaries doctrine', () => {
  const md = read('docs/ops/materialization-boundaries.md');

  it('names the three allowed reference states', () => {
    expect(md).toContain('`materialized`');
    expect(md).toContain('`auditable`');
    expect(md).toContain('`topology-real`');
  });

  it('forbids conceptual-only references on origin/main', () => {
    expect(md).toMatch(/conceptual-only/i);
    expect(md).toMatch(/MUST NOT appear on `origin\/main`/i);
  });

  it('opens an escape hatch via the canonical registry', () => {
    expect(md).toMatch(/canonical-wave-registry\.md/);
    expect(md).toMatch(/conceptualized/);
  });

  it('does not introduce new governance flows', () => {
    expect(md).toMatch(/does NOT/i);
    expect(md).toMatch(/CI gate|approval flow|protocol/i);
  });
});

// ── Verifier script behavior ──────────────────────────────────────────────

describe('verify-wave-materialization script', () => {
  function runVerifier(mode: 'full' | 'materialization' | 'audit-targets'): {
    code: number;
    output: string;
  } {
    try {
      const output = execSync(
        `node --experimental-strip-types scripts/verify-wave-materialization.ts ${mode} --skip-gh`,
        { cwd: REPO_ROOT, encoding: 'utf8' },
      );
      return { code: 0, output };
    } catch (err) {
      const e = err as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string };
      const stdout =
        typeof e.stdout === 'string'
          ? e.stdout
          : Buffer.isBuffer(e.stdout)
            ? e.stdout.toString('utf8')
            : '';
      const stderr =
        typeof e.stderr === 'string'
          ? e.stderr
          : Buffer.isBuffer(e.stderr)
            ? e.stderr.toString('utf8')
            : '';
      return { code: e.status ?? 1, output: stdout + stderr };
    }
  }

  it('full mode reports the registry header line', () => {
    const r = runVerifier('full');
    expect(r.output).toContain('verify-wave-materialization');
    expect(r.output).toContain('registry rows parsed');
  });

  it('audit-targets sub-mode emits at least one OK entry for an existing target', () => {
    const r = runVerifier('audit-targets');
    expect(r.output).toContain('verify-wave-materialization');
    expect(r.output).toMatch(/\[(OK|FAIL)\s+\]/);
  });

  it('materialization sub-mode emits per-row entries for session waves', () => {
    const r = runVerifier('materialization');
    for (const id of ['[W22]', '[W23]', '[W24]', '[W25]']) {
      expect(r.output).toContain(id);
    }
  });
});

// ── Pnpm script registration ──────────────────────────────────────────────

describe('package.json · verify scripts', () => {
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

  it.each([
    'verify:wave-reality',
    'verify:materialization',
    'verify:audit-targets',
  ])('exposes pnpm %s', (key) => {
    expect(pkg.scripts[key]).toBeDefined();
    expect(pkg.scripts[key]).toMatch(/verify-wave-materialization/);
  });
});

// ── Truth contract ────────────────────────────────────────────────────────

describe('truth contract · reality-synchronization surface', () => {
  function stripComments(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
  }

  const TOUCHED_FILES = [
    'docs/ops/canonical-wave-registry.md',
    'docs/ops/reality-synchronization-audit.md',
    'docs/ops/materialization-boundaries.md',
    'scripts/verify-wave-materialization.ts',
  ];

  const BANNED = [
    'magically materializes',
    'fake materialization',
    'speculative pr',
    'imaginary branch',
    'conceptual-only reference allowed',
    'guaranteed materialization',
    'auto-resolves',
  ];

  it.each(TOUCHED_FILES)('%s carries no speculative jargon', (rel) => {
    const src = read(rel);
    const lower = stripComments(src).toLowerCase();
    for (const phrase of BANNED) {
      expect(
        lower.includes(phrase),
        `should not contain "${phrase}"`,
      ).toBe(false);
    }
  });

  it('audit doc declares drift-free posture and the verifier mechanism', () => {
    const md = read('docs/ops/reality-synchronization-audit.md');
    expect(md).toMatch(/drift-free/i);
    expect(md).toMatch(/scripts\/verify-wave-materialization\.ts/);
  });

  it('audit doc cross-references the registry + materialization boundaries', () => {
    const md = read('docs/ops/reality-synchronization-audit.md');
    expect(md).toMatch(/canonical-wave-registry\.md/);
    expect(md).toMatch(/materialization-boundaries\.md/);
  });
});
