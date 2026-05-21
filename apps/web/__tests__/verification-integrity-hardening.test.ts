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
      `node --experimental-strip-types scripts/verify-verification-integrity.ts ${args.join(' ')}`,
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

describe('verification-integrity-hardening · file presence', () => {
  it.each([
    'docs/product/verification-integrity-hardening.md',
    'scripts/verify-verification-integrity.ts',
  ])('%s exists', (rel) => {
    expect(existsSync(resolve(REPO_ROOT, rel))).toBe(true);
  });
});

// ── Repaired files no longer carry the banned phrases ───────────────────

describe('repaired files · post-normalization', () => {
  it('review ConsoleWrapper uses lane-evidence + institution-review language', () => {
    const src = read('apps/web/app/review/[entityId]/ConsoleWrapper.tsx');
    expect(src).not.toMatch(/Credentials verified\.\s*Clear to proceed\./);
    expect(src).toMatch(/Lane evidence completed\. Institution review still required/);
    expect(src).not.toMatch(/Primary identity verified\./);
    expect(src).toMatch(/Identity lane source-confirmed/);
  });

  it('employer dashboard uses Marked Review-Complete / Not Eligible labels', () => {
    const src = read('apps/web/app/employer/dashboard/page.tsx');
    expect(src).not.toMatch(/>Approved</);
    expect(src).not.toMatch(/>Rejected</);
    expect(src).toMatch(/Marked Review-Complete/);
    expect(src).toMatch(/Not Eligible \(Institution-Owned\)/);
  });

  it('StartClinicianAction uses source-confirmed lane language', () => {
    const src = read('apps/web/components/employer/StartClinicianAction.tsx');
    expect(src).not.toMatch(/Superbrain clearance required/);
    expect(src).toMatch(/Lane evidence required/);
    expect(src).toMatch(/Source-confirmed/);
    expect(src).toMatch(/institution review remains required/i);
  });

  it('VerifierCommandCenter uses "Marked review-complete" aria-label', () => {
    const src = read('apps/web/components/employer/VerifierCommandCenter.tsx');
    expect(src).not.toMatch(/aria-label="Approved"/);
    expect(src).toMatch(/aria-label="Marked review-complete"/);
  });

  it('SandboxHero uses SOURCE-CONFIRMED and NO ADVERSE RECORDS', () => {
    const src = read('apps/web/components/hero/SandboxHero.tsx');
    expect(src).not.toMatch(/>VERIFIED</);
    expect(src).toMatch(/SOURCE-CONFIRMED/);
    expect(src).toMatch(/NO ADVERSE RECORDS/);
  });
});

// ── Doctrine doc shape ───────────────────────────────────────────────────

describe('verification-integrity doctrine', () => {
  const md = read('docs/product/verification-integrity-hardening.md');

  it('enumerates the six evidence-bounded states', () => {
    for (const state of [
      'Review completed',
      'Review pending',
      'Additional review required',
      'Source unavailable',
      'Verification incomplete',
      'Requires institution review',
    ]) {
      expect(md).toContain(state);
    }
  });

  it('enumerates the six degraded states', () => {
    for (const state of [
      'SOURCE_TIMEOUT',
      'SOURCE_UNAVAILABLE',
      'ACCESS_REQUIRED',
      'REVIEW_PENDING',
      'PARTIAL_COMPLETION',
      'CONTINUITY_INTERRUPTED',
    ]) {
      expect(md).toContain(state);
    }
  });

  it('declares the deterministic review posture rules', () => {
    expect(md).toMatch(/Completed lane evidence/);
    expect(md).toMatch(/Explicit institution review/);
    expect(md).toMatch(/Visible bounded certainty/);
    expect(md).toMatch(/Manifest-tier shortcuts/);
  });

  it('declares the banned-phrase rejection table', () => {
    expect(md).toMatch(/Credentials verified\. Clear to proceed\./);
    expect(md).toMatch(/Approved/);
    expect(md).toMatch(/Cleared/);
    expect(md).toMatch(/Clear to proceed/);
  });

  it('records the repaired files', () => {
    for (const path of [
      'apps/web/app/review/[entityId]/ConsoleWrapper.tsx',
      'apps/web/app/employer/dashboard/page.tsx',
      'apps/web/components/employer/StartClinicianAction.tsx',
      'apps/web/components/employer/VerifierCommandCenter.tsx',
      'apps/web/components/hero/SandboxHero.tsx',
    ]) {
      expect(md).toContain(path);
    }
  });

  it('names the deliberately-not-modified surfaces', () => {
    expect(md).toMatch(/_archive\/\*/);
    expect(md).toMatch(/__tests__/);
    expect(md).toMatch(/API route/i);
  });
});

// ── Verifier behavior ────────────────────────────────────────────────────

describe('verify-verification-integrity script', () => {
  it(
    'enforce mode passes after the repairs (no FAIL drift)',
    () => {
      const r = runVerifier(['enforce']);
      expect(r.output).toContain('verify-verification-integrity');
      expect(r.output).toMatch(/\[OK\s+\] verification integrity: no FAIL drift/);
      expect(r.code).toBe(0);
    },
    VERIFIER_TIMEOUT_MS,
  );

  it(
    'report sub-mode never exits non-zero',
    () => {
      const r = runVerifier(['report']);
      expect(r.code).toBe(0);
      expect(r.output).toContain('verify-verification-integrity (report)');
    },
    VERIFIER_TIMEOUT_MS,
  );

  it(
    'degraded-states-only sub-mode reports a scan summary',
    () => {
      const r = runVerifier(['degraded-states-only']);
      expect(r.code).toBe(0);
      expect(r.output).toMatch(/degraded-states scan: \d+ verification-related file/);
    },
    VERIFIER_TIMEOUT_MS,
  );
});

// ── Pnpm registration ────────────────────────────────────────────────────

describe('package.json · verification-integrity scripts', () => {
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

  it.each([
    'verify:verification-integrity',
    'verify:verification-integrity-report',
    'verify:degraded-state-visibility',
  ])('exposes pnpm %s', (key) => {
    expect(pkg.scripts[key]).toBeDefined();
    expect(pkg.scripts[key]).toMatch(/verify-verification-integrity/);
  });
});

// ── Truth contract ───────────────────────────────────────────────────────

describe('truth contract · verifier and doctrine', () => {
  it('verifier exempts _archive/, __tests__/, and *.test.* files', () => {
    const src = read('scripts/verify-verification-integrity.ts');
    expect(src).toMatch(/_archive/);
    expect(src).toMatch(/__tests__/);
    expect(src).toMatch(/\.test\./);
  });

  it('doctrine declares the no-manifest-tier-shortcut rule', () => {
    const md = read('docs/product/verification-integrity-hardening.md');
    expect(md).toMatch(/Manifest-tier shortcuts/i);
    expect(md).toMatch(/single "trust score"/i);
  });
});
