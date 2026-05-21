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
      `node --experimental-strip-types scripts/verify-operational-convergence.ts ${args.join(' ')}`,
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

// ── Doc + script presence ─────────────────────────────────────────────

describe('operational-convergence · file presence', () => {
  it.each([
    'docs/product/canonical-operational-language.md',
    'docs/ops/operational-convergence-audit.md',
    'scripts/verify-operational-convergence.ts',
  ])('%s exists', (rel) => {
    expect(existsSync(resolve(REPO_ROOT, rel))).toBe(true);
  });
});

// ── Canonical language doc shape ──────────────────────────────────────

describe('canonical operational language · five axes', () => {
  const md = read('docs/product/canonical-operational-language.md');

  it.each([
    'Axis 1 · Continuity',
    'Axis 2 · Readiness',
    'Axis 3 · Interruption',
    'Axis 4 · Review ownership',
    'Axis 5 · Deployment progression',
  ])('declares %s', (axis) => {
    expect(md).toContain(axis);
  });

  it('declares all four continuity states', () => {
    for (const s of [
      '`source_confirmed`',
      '`evidence_pending`',
      '`continuity_restored`',
      '`continuity_interrupted`',
    ]) {
      expect(md).toContain(s);
    }
  });

  it('declares all four readiness states', () => {
    for (const s of [
      '`ready_for_review`',
      '`pending_review`',
      '`recently_reviewed`',
      '`requires_followup`',
    ]) {
      expect(md).toContain(s);
    }
  });

  it('declares all four interruption states', () => {
    for (const s of [
      '`none`',
      '`present`',
      '`operator_acknowledged`',
      '`institution_dispositioned`',
    ]) {
      expect(md).toContain(s);
    }
  });

  it('declares all four review-ownership states', () => {
    for (const s of [
      '`queued`',
      '`in_review`',
      '`returned_to_operator`',
      '`institution_owned`',
    ]) {
      expect(md).toContain(s);
    }
  });

  it('declares all four deployment-progression states', () => {
    for (const s of [
      '`not_started`',
      '`preparing`',
      '`awaiting_institution`',
      '`deployment_ready`',
    ]) {
      expect(md).toContain(s);
    }
  });

  it('contains reconciliation tables for the open session waves', () => {
    expect(md).toMatch(/Wave 22.*\/demo\/waste/);
    expect(md).toMatch(/Wave 23.*\/ops.*\/holder/);
    expect(md).toMatch(/Wave 24/);
    expect(md).toMatch(/Wave 27.*\/operator/);
  });

  it('declares the cross-axis rules including the "institution-owned" requirement', () => {
    expect(md).toMatch(/institution-owned/i);
    expect(md).toMatch(/load-bearing/i);
    expect(md).toMatch(/Trustless \/ blockchain semantics are banned/i);
  });
});

// ── Audit doc ────────────────────────────────────────────────────────

describe('operational-convergence audit', () => {
  const md = read('docs/ops/operational-convergence-audit.md');

  it('records the per-wave findings', () => {
    expect(md).toMatch(/F1.*Attention needed/i);
    expect(md).toMatch(/F2.*continuity vocabulary/i);
    expect(md).toMatch(/F3.*Five-state vs six-state/i);
    expect(md).toMatch(/F4.*Verified/i);
    expect(md).toMatch(/F5.*Substrate jargon containment/i);
    expect(md).toMatch(/F6.*continuity primitives/i);
  });

  it('notes the deferred unification across Confirmed / Complete / Source-confirmed', () => {
    expect(md).toMatch(/Confirmed/);
    expect(md).toMatch(/Complete/);
    expect(md).toMatch(/Source-confirmed/);
  });
});

// ── Verifier behavior ─────────────────────────────────────────────────

describe('verify-operational-convergence script', () => {
  it(
    'full mode passes on the current branch (canonical doc + audit present; no banned phrases on origin/main app)',
    () => {
      const r = runVerifier(['full']);
      expect(r.output).toContain('verify-operational-convergence');
      expect(r.output).toMatch(/\[OK\s+\] operational convergence: no drift detected/);
      expect(r.code).toBe(0);
    },
    VERIFIER_TIMEOUT_MS,
  );

  it(
    'canonical-language sub-mode validates all five axes',
    () => {
      const r = runVerifier(['canonical-language']);
      for (const axis of [
        'Axis 1 · Continuity',
        'Axis 2 · Readiness',
        'Axis 3 · Interruption',
        'Axis 4 · Review ownership',
        'Axis 5 · Deployment progression',
      ]) {
        expect(r.output).toContain(`canonical doc declares ${axis}`);
      }
    },
    VERIFIER_TIMEOUT_MS,
  );

  it(
    'semantic-integrity sub-mode scans and reports per-file hits',
    () => {
      const r = runVerifier(['semantic-integrity']);
      expect(r.output).toMatch(/banned-phrase scan: \d+ files/);
      expect(r.output).toMatch(/bare-Verified scan: \d+ file/);
    },
    VERIFIER_TIMEOUT_MS,
  );
});

// ── Pnpm script registration ──────────────────────────────────────────

describe('package.json · convergence scripts', () => {
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

  it.each([
    'verify:operational-convergence',
    'verify:semantic-integrity',
    'verify:canonical-language',
  ])('exposes pnpm %s', (key) => {
    expect(pkg.scripts[key]).toBeDefined();
    expect(pkg.scripts[key]).toMatch(/verify-operational-convergence/);
  });
});

// ── Truth contract ────────────────────────────────────────────────────

describe('truth contract · convergence surface', () => {
  // The canonical doc and the audit doc legitimately enumerate banned
  // phrases as REJECTED forms. The script must never use them in
  // positive form.
  const POSITIVE_USE_FILES = [
    'scripts/verify-operational-convergence.ts',
  ];

  const BANNED_IN_POSITIVE_USE = [
    'trustless protocol',
    'permissionless platform',
    'web3 credentialing',
    'on-chain verification',
    'magical onboarding',
  ];

  it.each(POSITIVE_USE_FILES)('%s avoids positive use of banned jargon', (rel) => {
    const src = read(rel).toLowerCase();
    for (const phrase of BANNED_IN_POSITIVE_USE) {
      expect(src.includes(phrase), `should not contain "${phrase}"`).toBe(false);
    }
  });

  it('canonical doc names the banned-phrase categories', () => {
    const md = read('docs/product/canonical-operational-language.md');
    expect(md).toMatch(/trustless/i);
    expect(md).toMatch(/decentralized/i);
    expect(md).toMatch(/web3/i);
  });
});
