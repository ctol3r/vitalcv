import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const VERIFIER_TIMEOUT_MS = 60_000;

const REPO_ROOT = execSync('git rev-parse --show-toplevel', {
  encoding: 'utf8',
}).trim();

function read(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), 'utf8');
}

function runVerifier(args: string[]): { code: number; output: string } {
  try {
    const output = execSync(
      `node --experimental-strip-types scripts/verify-materialization-enforcement.ts ${args.join(' ')}`,
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

// ── Doc + script presence ─────────────────────────────────────────────────

describe('materialization-enforcement · file presence', () => {
  it.each([
    'docs/ops/repo-reality-state.md',
    'docs/ops/materialization-enforcement-contract.md',
    'docs/ops/reality-boundaries.md',
    'scripts/verify-materialization-enforcement.ts',
  ])('%s exists', (rel) => {
    expect(existsSync(resolve(REPO_ROOT, rel))).toBe(true);
  });
});

// ── repo-reality-state ledger shape ───────────────────────────────────────

describe('repo-reality-state ledger · shape', () => {
  const md = read('docs/ops/repo-reality-state.md');

  it('enumerates the seven lifecycle states', () => {
    for (const state of [
      '`conceptual`',
      '`local-only`',
      '`committed`',
      '`PR-open`',
      '`audited`',
      '`merged`',
      '`archived`',
    ]) {
      expect(md).toContain(state);
    }
  });

  it('declares the W22 / W23 / W24 / W25 / W26 session rows', () => {
    for (const id of ['W22', 'W23', 'W24', 'W25', 'W26']) {
      expect(md).toMatch(new RegExp(`\\|\\s*${id}\\s*\\|`));
    }
  });

  it('contains the open-PR coverage table from #375 onward', () => {
    for (const n of [375, 380, 385, 390, 395, 401]) {
      expect(md).toMatch(new RegExp(`\\|\\s*${n}\\s*\\|`));
    }
  });

  it('declares an empty conceptual table at steady state', () => {
    expect(md).toMatch(/\(none currently\)/);
  });
});

// ── materialization-enforcement contract ──────────────────────────────────

describe('materialization-enforcement contract', () => {
  const md = read('docs/ops/materialization-enforcement-contract.md');

  it('names the four allowed reference states', () => {
    expect(md).toContain('`committed`');
    expect(md).toContain('`materialized`');
    expect(md).toContain('`topology-real`');
    expect(md).toContain('`auditable`');
  });

  it('declares the three sub-modes', () => {
    expect(md).toMatch(/`enforce`/);
    expect(md).toMatch(/`detect-speculative`/);
    expect(md).toMatch(/`status`/);
  });

  it('intentionally does not introduce new CI/governance flow', () => {
    expect(md).toMatch(/does NOT/);
    expect(md).toMatch(/limit the size of waves/);
    expect(md).toMatch(/approval flow/i);
  });
});

// ── reality-boundaries doctrine ───────────────────────────────────────────

describe('reality-boundaries doctrine', () => {
  const md = read('docs/ops/reality-boundaries.md');

  it('names the three binding rules', () => {
    expect(md).toMatch(/Rule R1/);
    expect(md).toMatch(/Rule R2/);
    expect(md).toMatch(/Rule R3/);
    expect(md).toMatch(/No future-wave references before materialization/i);
    expect(md).toMatch(/No audit requests without payload/i);
    expect(md).toMatch(/No topology references without routes/i);
  });

  it('declares stacked waves are supported', () => {
    expect(md).toMatch(/Stacked waves are explicitly supported/i);
  });
});

// ── Verifier behavior ─────────────────────────────────────────────────────

describe('verify-materialization-enforcement script', () => {
  it(
    'enforce mode parses the ledger and reports per-row entries',
    () => {
      const r = runVerifier(['enforce', '--skip-gh']);
      expect(r.output).toContain('verify-materialization-enforcement');
      expect(r.output).toContain('rows parsed');
      for (const id of ['[W22]', '[W23]', '[W24]', '[W25]', '[W26]']) {
        expect(r.output).toContain(id);
      }
    },
    VERIFIER_TIMEOUT_MS,
  );

  it(
    'status sub-mode emits per-state counts',
    () => {
      const r = runVerifier(['status', '--skip-gh']);
      expect(r.output).toContain('verify-materialization-enforcement (status)');
      for (const s of [
        'conceptual',
        'local-only',
        'committed',
        'PR-open',
        'audited',
        'merged',
        'archived',
      ]) {
        expect(r.output).toContain(`state ${s}:`);
      }
    },
    VERIFIER_TIMEOUT_MS,
  );

  it(
    'wave-state sub-mode behaves like enforce',
    () => {
      const r = runVerifier(['wave-state', '--skip-gh']);
      expect(r.output).toContain('verify-materialization-enforcement (wave-state)');
      expect(r.output).toContain('[W22]');
    },
    VERIFIER_TIMEOUT_MS,
  );

  it(
    'default enforce mode passes when no rows claim more than reality supports',
    () => {
      const r = runVerifier(['enforce', '--skip-gh']);
      expect(r.code).toBe(0);
    },
    VERIFIER_TIMEOUT_MS,
  );

  it(
    '--detect-speculative emits the scan-summary NOTE line',
    () => {
      const r = runVerifier(['enforce', '--skip-gh', '--detect-speculative']);
      expect(r.output).toMatch(/speculative scan: \d+ doc/);
    },
    VERIFIER_TIMEOUT_MS,
  );

  it(
    'reports OK at the bottom when no FAILs are present',
    () => {
      const r = runVerifier(['enforce', '--skip-gh']);
      expect(r.output).toMatch(
        /\[OK\s+\] materialization enforcement: no drift detected/,
      );
    },
    VERIFIER_TIMEOUT_MS,
  );

  it(
    '--check-empty-diff exercises the commits-ahead path without crashing',
    () => {
      const r = runVerifier(['enforce', '--check-empty-diff', '--skip-gh']);
      expect(r.output).toContain('verify-materialization-enforcement');
      expect(r.output).toContain('rows parsed');
      // commits-ahead lines appear for at least one committed/PR-open row
      expect(r.output).toMatch(/has \d+ commit\(s\) ahead/);
    },
    VERIFIER_TIMEOUT_MS,
  );
});

// ── Pnpm script registration ──────────────────────────────────────────────

describe('package.json · enforcement scripts', () => {
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

  it.each([
    'verify:materialization-enforcement',
    'verify:repo-reality',
    'verify:wave-state',
  ])('exposes pnpm %s', (key) => {
    expect(pkg.scripts[key]).toBeDefined();
    expect(pkg.scripts[key]).toMatch(/verify-materialization-enforcement/);
  });
});

// ── Truth contract ────────────────────────────────────────────────────────

describe('truth contract · enforcement surface', () => {
  // The contract + boundaries docs intentionally enumerate speculative
  // phrases as REJECTED forms. The ledger and the script must never
  // use those phrases in positive form. We check the ledger and the
  // script only; the contract + boundaries docs are exempted because
  // they ARE the rejection list.
  const POSITIVE_USE_FILES = [
    'docs/ops/repo-reality-state.md',
    'scripts/verify-materialization-enforcement.ts',
  ];

  const BANNED_IN_POSITIVE_USE = [
    'imaginary branch',
    'fake materialization',
    'phantom route',
    'guaranteed materialization',
    'pretend the branch exists',
    'roadmap pr',
  ];

  it.each(POSITIVE_USE_FILES)('%s avoids positive use of banned jargon', (rel) => {
    const src = read(rel).toLowerCase();
    for (const phrase of BANNED_IN_POSITIVE_USE) {
      expect(
        src.includes(phrase),
        `should not contain "${phrase}"`,
      ).toBe(false);
    }
  });

  it('contract doc names its truth-contract rejection list explicitly', () => {
    const md = read('docs/ops/materialization-enforcement-contract.md');
    expect(md).toMatch(/speculative pr/i);
    expect(md).toMatch(/phantom route/i);
    expect(md).toMatch(/fake materialization/i);
  });

  it('boundaries doc names the three rules and the rejection symptoms table', () => {
    const md = read('docs/ops/reality-boundaries.md');
    expect(md).toMatch(/Rule R1/);
    expect(md).toMatch(/Rule R2/);
    expect(md).toMatch(/Rule R3/);
    expect(md).toMatch(/phantom reference/i);
  });

  it('contract and ledger cross-reference each other', () => {
    const contract = read('docs/ops/materialization-enforcement-contract.md');
    const ledger = read('docs/ops/repo-reality-state.md');
    expect(contract).toMatch(/docs\/ops\/repo-reality-state\.md/);
    expect(ledger).toMatch(/scripts\/verify-materialization-enforcement\.ts/);
  });
});
