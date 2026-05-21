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

function runVerifier(args: string[]): { code: number; output: string } {
  try {
    const output = execSync(
      `node --experimental-strip-types scripts/verify-institutional-safety.ts ${args.join(' ')}`,
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

const VERIFIER_TIMEOUT_MS = 60_000;

// ── File presence ────────────────────────────────────────────────────────

describe('institutional-safety · file presence', () => {
  it.each([
    'docs/product/institutional-safety-remediation.md',
    'scripts/verify-institutional-safety.ts',
  ])('%s exists', (rel) => {
    expect(existsSync(resolve(REPO_ROOT, rel))).toBe(true);
  });
});

// ── Repaired files no longer carry the banned phrases ──────────────────

describe('repaired files · post-normalization', () => {
  it('receipt-viewer.tsx uses signature-confirmed language, not "Cryptographically Verified"', () => {
    const src = read('apps/web/components/ui/receipt-viewer.tsx');
    expect(src).not.toMatch(/Cryptographically Verified/);
    expect(src).toMatch(/Signature confirmed against published key/);
  });

  it('ReceiptVerificationBadge.tsx uses signature-confirmed language', () => {
    const src = read('apps/web/components/employer/ReceiptVerificationBadge.tsx');
    expect(src).not.toMatch(/Cryptographically Verified/);
    expect(src).toMatch(/Signature confirmed against published key/);
    expect(src).not.toMatch(/Tampered/);
    expect(src).toMatch(/Signature did not match published key/);
  });

  it('AuditBundlePreview.tsx uses signature-confirmed language', () => {
    const src = read('apps/web/components/decision/AuditBundlePreview.tsx');
    expect(src).not.toMatch(/Cryptographically Verified/);
    expect(src).toMatch(/Signature confirmed/);
  });

  it('ReadinessDashboard.tsx uses hash-chained language for Audit Log', () => {
    const src = read('apps/web/components/clinician/ReadinessDashboard.tsx');
    expect(src).not.toMatch(/value: 'Immutable'/);
    expect(src).toMatch(/Hash-chained, append-only/);
  });

  it('EmployerWorkspaceBootstrap.tsx uses hash-chained entity-record language', () => {
    const src = read('apps/web/components/sandbox/EmployerWorkspaceBootstrap.tsx');
    expect(src).not.toMatch(/Immutable Entity Record/);
    expect(src).toMatch(/Hash-chained, append-only entity record/);
  });

  it('ClinicianPassport.tsx uses per-request resolution language', () => {
    const src = read('apps/web/components/sandbox/ClinicianPassport.tsx');
    expect(src).not.toMatch(/Real-time synchronization/);
    expect(src).not.toMatch(/Immutable audit trail/);
    expect(src).toMatch(/Per-request resolution against primary-source registries/);
    expect(src).toMatch(/Hash-chained, append-only audit trail/);
  });

  it('GraphInspector.tsx uses "Operator Triggers" not "Autonomous Triggers"', () => {
    const src = read('apps/web/components/graph/GraphInspector.tsx');
    expect(src).not.toMatch(/Autonomous Triggers/);
    expect(src).toMatch(/Operator Triggers/);
  });
});

// ── Safety doctrine doc shape ────────────────────────────────────────────

describe('institutional-safety doctrine', () => {
  const md = read('docs/product/institutional-safety-remediation.md');

  it('enumerates the three banned categories', () => {
    expect(md).toMatch(/Banned cryptographic-guarantee claims/);
    expect(md).toMatch(/Banned AI \/ autonomous theater/);
    expect(md).toMatch(/Banned real-time \/ live-state theater/);
  });

  it('declares the Acceptable Replacements table', () => {
    expect(md).toMatch(/Acceptable replacements/);
    expect(md).toMatch(/Signature confirmed against published key/);
    expect(md).toMatch(/Hash-chained, append-only/);
    expect(md).toMatch(/Operator Triggers/);
  });

  it('records the seven repaired files', () => {
    for (const path of [
      'apps/web/components/ui/receipt-viewer.tsx',
      'apps/web/components/employer/ReceiptVerificationBadge.tsx',
      'apps/web/components/decision/AuditBundlePreview.tsx',
      'apps/web/components/clinician/ReadinessDashboard.tsx',
      'apps/web/components/sandbox/EmployerWorkspaceBootstrap.tsx',
      'apps/web/components/sandbox/ClinicianPassport.tsx',
      'apps/web/components/graph/GraphInspector.tsx',
    ]) {
      expect(md).toContain(path);
    }
  });

  it('declares the deliberately-not-modified surfaces', () => {
    expect(md).toMatch(/`\/autopilot` route/);
    expect(md).toMatch(/_archive\/\*/);
    expect(md).toMatch(/Test fixtures/);
  });

  it('names the verifier and its three sub-modes', () => {
    expect(md).toMatch(/scripts\/verify-institutional-safety\.ts/);
    expect(md).toMatch(/`enforce`/);
    expect(md).toMatch(/`report`/);
    expect(md).toMatch(/`cryptographic-only`/);
  });
});

// ── Verifier behavior ────────────────────────────────────────────────────

describe('verify-institutional-safety script', () => {
  it(
    'enforce mode passes after the repairs (no FAIL drift on apps/web/{app,components})',
    () => {
      const r = runVerifier(['enforce']);
      expect(r.output).toContain('verify-institutional-safety');
      expect(r.output).toContain('scan:');
      expect(r.output).toMatch(/\[OK\s+\] institutional safety: no FAIL drift/);
      expect(r.code).toBe(0);
    },
    VERIFIER_TIMEOUT_MS,
  );

  it(
    'report sub-mode never exits non-zero',
    () => {
      const r = runVerifier(['report']);
      expect(r.code).toBe(0);
      expect(r.output).toContain('verify-institutional-safety (report)');
    },
    VERIFIER_TIMEOUT_MS,
  );

  it(
    'cryptographic-only sub-mode scans only the cryptographic-guarantee subset',
    () => {
      const r = runVerifier(['cryptographic-only']);
      expect(r.output).toContain('verify-institutional-safety (cryptographic-only)');
      expect(r.output).toMatch(/scan: \d+ source files/);
    },
    VERIFIER_TIMEOUT_MS,
  );
});

// ── Pnpm registration ────────────────────────────────────────────────────

describe('package.json · safety scripts', () => {
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

  it.each([
    'verify:institutional-safety',
    'verify:institutional-safety-report',
    'verify:cryptographic-language',
  ])('exposes pnpm %s', (key) => {
    expect(pkg.scripts[key]).toBeDefined();
    expect(pkg.scripts[key]).toMatch(/verify-institutional-safety/);
  });
});

// ── Truth contract on the verifier itself ────────────────────────────────

describe('truth contract · verifier and doctrine', () => {
  it('the verifier exempts _archive/ and __tests__ paths', () => {
    const src = read('scripts/verify-institutional-safety.ts');
    expect(src).toMatch(/_archive/);
    expect(src).toMatch(/__tests__/);
  });

  it('the doctrine enumerates the banned-replacement mapping for every category', () => {
    const md = read('docs/product/institutional-safety-remediation.md');
    expect(md).toMatch(/cryptographically verified.*signature confirmed/i);
    expect(md).toMatch(/immutable.*hash-chained/i);
    expect(md).toMatch(/autonomous triggers.*operator triggers/i);
  });
});
