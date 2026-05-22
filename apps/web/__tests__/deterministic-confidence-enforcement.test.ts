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

function readStripped(rel: string): string {
  const raw = read(rel);
  return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function runVerifier(args: string[]): { code: number; output: string } {
  try {
    const output = execSync(
      `node --experimental-strip-types scripts/verify-deterministic-confidence.ts ${args.join(' ')}`,
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

const VERIFIER_TIMEOUT_MS = 30_000;
const CONSOLE_WRAPPER = 'apps/web/app/review/[entityId]/ConsoleWrapper.tsx';
const EMPLOYER_DECISION_CONSOLE = 'apps/web/components/review/EmployerDecisionConsole.tsx';
const DOCTRINE = 'docs/product/deterministic-confidence-enforcement.md';

// ── File presence ────────────────────────────────────────────────────────

describe('deterministic-confidence-enforcement · file presence', () => {
  it.each([
    'docs/product/deterministic-confidence-enforcement.md',
    'scripts/verify-deterministic-confidence.ts',
    CONSOLE_WRAPPER,
    EMPLOYER_DECISION_CONSOLE,
  ])('%s exists', (rel) => {
    expect(existsSync(resolve(REPO_ROOT, rel))).toBe(true);
  });
});

// ── Manifest-tier bypass removed ─────────────────────────────────────────

describe('ConsoleWrapper · no manifest-tier short-circuit', () => {
  const stripped = readStripped(CONSOLE_WRAPPER);

  it('does NOT short-circuit posture on manifest.tier', () => {
    expect(stripped).not.toMatch(/manifest\?\.tier\s*===\s*['"]decision_grade['"]/);
    expect(stripped).not.toMatch(/manifest\.tier\s*===\s*['"]decision_grade['"]/);
  });

  it('calls derivePosture(lanes) instead', () => {
    expect(stripped).toMatch(/derivePosture\(lanes\)/);
  });
});

// ── Required-lane constant ───────────────────────────────────────────────

describe('ConsoleWrapper · required-lane completeness', () => {
  const src = read(CONSOLE_WRAPPER);

  it('declares REQUIRED_LANES_FOR_DECISION_GRADE', () => {
    expect(src).toMatch(/REQUIRED_LANES_FOR_DECISION_GRADE/);
    expect(src).toMatch(/readonly string\[\]/);
  });

  it.each([
    'nppes_identity',
    'oig_exclusions',
    'state_license',
    'employment_history',
  ])('REQUIRED_LANES_FOR_DECISION_GRADE includes %s', (lane) => {
    expect(src).toMatch(new RegExp(`['"]${lane}['"]`));
  });

  it('derivePosture only emits decision_grade when ALL required lanes are verified', () => {
    expect(src).toMatch(/REQUIRED_LANES_FOR_DECISION_GRADE\.every/);
    expect(src).toMatch(/lane\?\.status === 'verified'/);
  });
});

// ── deriveNextAction copy ────────────────────────────────────────────────

describe('ConsoleWrapper · deterministic next-action copy', () => {
  const stripped = readStripped(CONSOLE_WRAPPER);

  it('does NOT contain "Clear to proceed"', () => {
    expect(stripped).not.toMatch(/Clear to proceed\./);
  });

  it('does NOT contain "Credentials verified"', () => {
    expect(stripped).not.toMatch(/Credentials verified\./);
  });

  it('does NOT contain "proceed with a head start"', () => {
    expect(stripped).not.toMatch(/proceed with a head start/);
  });

  it('every blocker branch names the specific lane', () => {
    expect(stripped).toMatch(/Additional evidence required: \$\{topBlocker\.displayName\}/);
    expect(stripped).toMatch(/Source unavailable: \$\{topBlocker\.displayName\}/);
    expect(stripped).toMatch(/Stale evidence: \$\{topBlocker\.displayName\}/);
    expect(stripped).toMatch(/Review incomplete: \$\{topBlocker\.displayName\}/);
  });

  it('every branch ends with institution review requirement', () => {
    const fn = stripped.slice(stripped.indexOf('function deriveNextAction'));
    expect(fn).toMatch(/Institution review required/i);
    expect(fn).toMatch(/Institution review still required/i);
  });
});

// ── EmployerDecisionConsole bounded labels ───────────────────────────────

describe('EmployerDecisionConsole · bounded decision labels', () => {
  const stripped = readStripped(EMPLOYER_DECISION_CONSOLE);

  it('does NOT use "READY TO PROCEED"', () => {
    expect(stripped).not.toMatch(/label:\s*['"]READY TO PROCEED['"]/);
  });

  it('does NOT use "PROCEED WITH REVIEW"', () => {
    expect(stripped).not.toMatch(/label:\s*['"]PROCEED WITH REVIEW['"]/);
  });

  it('does NOT use bare "BLOCKED" or "NEEDS MORE DATA"', () => {
    expect(stripped).not.toMatch(/label:\s*['"]BLOCKED['"]/);
    expect(stripped).not.toMatch(/label:\s*['"]NEEDS MORE DATA['"]/);
  });

  it('uses LANE EVIDENCE COMPLETED / ADDITIONAL EVIDENCE REQUIRED labels', () => {
    expect(stripped).toMatch(/LANE EVIDENCE COMPLETED · INSTITUTION REVIEW REQUIRED/);
    expect(stripped).toMatch(/ADDITIONAL EVIDENCE REQUIRED/);
    expect(stripped).toMatch(/BLOCKED · INSTITUTION REVIEW REQUIRED/);
    expect(stripped).toMatch(/REVIEW INCOMPLETE/);
  });
});

// ── Doctrine doc shape ───────────────────────────────────────────────────

describe('deterministic-confidence doctrine doc', () => {
  const md = read(DOCTRINE);

  it('declares the four required lanes', () => {
    for (const lane of [
      'nppes_identity',
      'oig_exclusions',
      'state_license',
      'employment_history',
    ]) {
      expect(md).toContain(`\`${lane}\``);
    }
  });

  it('declares the bounded progression states', () => {
    expect(md).toMatch(/LANE EVIDENCE COMPLETED · INSTITUTION REVIEW REQUIRED/);
    expect(md).toMatch(/ADDITIONAL EVIDENCE REQUIRED/);
    expect(md).toMatch(/REVIEW INCOMPLETE/);
  });

  it('declares the no-shortcut posture rule', () => {
    expect(md).toMatch(/manifest-tier-priority bypass/i);
    expect(md).toMatch(/(never|intentionally NOT|no longer used)/i);
  });

  it('declares the degraded-state visibility requirement', () => {
    expect(md).toMatch(/access_required/);
    expect(md).toMatch(/unavailable/);
    expect(md).toMatch(/stale/);
    expect(md).toMatch(/not_checked/);
  });

  it('declares the no-new-features posture', () => {
    expect(md).toMatch(/Does NOT remove `manifest\.tier`/i);
    expect(md).toMatch(/Does NOT touch API route source code/i);
  });
});

// ── Verifier behavior ────────────────────────────────────────────────────

describe('verify-deterministic-confidence script', () => {
  it(
    'enforce mode passes on the repaired state',
    () => {
      const r = runVerifier(['enforce']);
      expect(r.output).toContain('verify-deterministic-confidence');
      expect(r.output).toMatch(/\[OK\s+\] deterministic confidence: no FAIL drift/);
      expect(r.code).toBe(0);
    },
    VERIFIER_TIMEOUT_MS,
  );

  it(
    'required-lanes-only sub-mode validates the constant + doctrine list',
    () => {
      const r = runVerifier(['required-lanes-only']);
      expect(r.output).toContain('REQUIRED_LANES_FOR_DECISION_GRADE declared');
      for (const lane of ['nppes_identity', 'oig_exclusions', 'state_license', 'employment_history']) {
        // The verifier accepts either "missing lane" FAIL or OK; under
        // healthy state we just check that the doctrine doc resolved
        // and no FAIL line referenced these lane ids.
        expect(r.output).not.toMatch(new RegExp(`missing lane "${lane}"`));
      }
      expect(r.code).toBe(0);
    },
    VERIFIER_TIMEOUT_MS,
  );

  it(
    'report sub-mode never exits non-zero',
    () => {
      const r = runVerifier(['report']);
      expect(r.code).toBe(0);
    },
    VERIFIER_TIMEOUT_MS,
  );
});

// ── Pnpm registration ────────────────────────────────────────────────────

describe('package.json · deterministic-confidence scripts', () => {
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

  it.each([
    'verify:deterministic-confidence',
    'verify:deterministic-confidence-report',
    'verify:required-lanes',
  ])('exposes pnpm %s', (key) => {
    expect(pkg.scripts[key]).toBeDefined();
    expect(pkg.scripts[key]).toMatch(/verify-deterministic-confidence/);
  });
});
