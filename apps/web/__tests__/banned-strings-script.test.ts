import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * banned-strings-script.test.ts
 *
 * Behavioural test for `scripts/check-banned-strings.sh`. Each test
 * builds a tiny fixture file with a single banned phrase or a single
 * known-safe compound, pipes the absolute path to the scanner via
 * stdin (the same way the CI workflow does), and asserts the right
 * exit code + path:line output.
 *
 * The scanner is bash-only at runtime; vitest is just the orchestrator
 * + reporter. Adding a new banned phrase: extend the list file AND
 * append the literal phrase to the CANONICAL_PHRASES or
 * RISKY_PHRASES array below.
 */

const REPO_ROOT = resolve(__dirname, '../../..');
const SCRIPT = resolve(REPO_ROOT, 'scripts/check-banned-strings.sh');

/** Run the scanner with the given file paths as a stdin file list. */
function runScannerStdin(filePaths: string[]): { status: number; stdout: string; stderr: string } {
  const child = spawnSync('bash', [SCRIPT], {
    // Always include the trailing newline so the bash `read` loop
    // captures the last path even on a single-line input.
    input: filePaths.join('\n') + '\n',
    env: { ...process.env, BANNED_STRINGS_DIFF_BASE: '', GITHUB_BASE_REF: '' },
    encoding: 'utf8',
  });
  return {
    status: typeof child.status === 'number' ? child.status : 1,
    stdout: child.stdout ?? '',
    stderr: child.stderr ?? '',
  };
}

function runScannerArg(filePath: string): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync('bash', [SCRIPT, filePath], {
      env: { ...process.env, BANNED_STRINGS_DIFF_BASE: '', GITHUB_BASE_REF: '' },
      encoding: 'utf8',
    });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    const e = err as { status?: number; stdout?: string | Buffer; stderr?: string | Buffer };
    return {
      status: typeof e.status === 'number' ? e.status : 1,
      stdout: typeof e.stdout === 'string' ? e.stdout : (e.stdout?.toString('utf8') ?? ''),
      stderr: typeof e.stderr === 'string' ? e.stderr : (e.stderr?.toString('utf8') ?? ''),
    };
  }
}

let TMP_DIR: string;

beforeEach(() => {
  TMP_DIR = mkdtempSync(join(tmpdir(), 'vitalcv-bs-script-'));
});

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

function write(rel: string, content: string): string {
  const full = join(TMP_DIR, rel);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content, 'utf8');
  return full;
}

/** Phrases from CLAUDE.md — the canonical truth-contract bans. */
const CANONICAL_PHRASES = [
  'automatically verified',
  'guaranteed verification',
  'complete credentialing',
  'instant credentialing',
  'legally accepted',
  'risk transferred',
  'final verification without review',
  'source confirmed before response',
  'certified compliant',
  'HIPAA compliant',
  'SOC2 certified',
  'SOC 2 certified',
  'NCQA certified',
] as const;

/** Additional risky phrases enumerated in the gate spec. */
const RISKY_PHRASES = [
  'instantly verified',
  'real-time verification',
  'real-time check',
  'guaranteed compliant',
  'always up to date',
  'eliminates credentialing',
  'replaces credentialing',
  'fully verified',
  'accepted everywhere',
  'single source accepted by all hospitals',
  'solves burnout',
  'solves diversity attrition',
] as const;

describe('check-banned-strings.sh — canonical phrases', () => {
  for (const phrase of CANONICAL_PHRASES) {
    it(`FAILS on canonical phrase "${phrase}"`, () => {
      const slug = phrase.replace(/[^a-z0-9]+/gi, '-');
      const file = write(`canonical-${slug}.tsx`,
        `export const c = "This product is ${phrase} for clinicians.";\n`);
      const { status, stdout } = runScannerStdin([file]);
      expect(status, `${phrase} should fail (stdout: ${stdout})`).toBe(1);
      expect(stdout.toLowerCase()).toContain(phrase.toLowerCase());
    });
  }
});

describe('check-banned-strings.sh — additional risky phrases', () => {
  for (const phrase of RISKY_PHRASES) {
    it(`FAILS on risky phrase "${phrase}"`, () => {
      const slug = phrase.replace(/[^a-z0-9]+/gi, '-');
      const file = write(`risky-${slug}.tsx`,
        `export const c = "Our product ${phrase} when integrated correctly.";\n`);
      const { status, stdout } = runScannerStdin([file]);
      expect(status, `${phrase} should fail (stdout: ${stdout})`).toBe(1);
      expect(stdout.toLowerCase()).toContain(phrase.toLowerCase());
    });
  }
});

describe('check-banned-strings.sh — bare-Verified markers', () => {
  it('FAILS on bare JSX >Verified< tag content', () => {
    const file = write('VerifiedTag.tsx',
      'export const X = () => <span className="badge">Verified</span>;\n');
    const { status, stdout } = runScannerStdin([file]);
    expect(status).toBe(1);
    expect(stdout).toContain('VerifiedTag.tsx');
  });

  it('FAILS on "Verified" double-quoted string literal', () => {
    const file = write('double-quote.ts', 'const s = "Verified";\n');
    const { status, stdout } = runScannerStdin([file]);
    expect(status).toBe(1);
    expect(stdout).toContain('double-quote.ts');
  });

  it("FAILS on 'Verified' single-quoted string literal", () => {
    const file = write('single-quote.ts', "const s = 'Verified';\n");
    const { status, stdout } = runScannerStdin([file]);
    expect(status).toBe(1);
    expect(stdout).toContain('single-quote.ts');
  });

  it('FAILS on `Verified` backtick template literal', () => {
    const file = write('backtick.ts', 'const s = `Verified`;\n');
    const { status, stdout } = runScannerStdin([file]);
    expect(status).toBe(1);
    expect(stdout).toContain('backtick.ts');
  });

  it('FAILS on label: "Verified" and status: "Verified" attribute values', () => {
    const file = write('attrs.ts',
      [
        "const a = { label: 'Verified' };",
        'const b = { status: "Verified" };',
        '',
      ].join('\n'),
    );
    const { status } = runScannerStdin([file]);
    expect(status).toBe(1);
  });

  it('FAILS on smart-quoted "automatically verified" (curly quotes)', () => {
    const file = write('smart.ts',
      'const s = “automatically verified”;\n');
    const { status, stdout } = runScannerStdin([file]);
    expect(status, `smart-quote case should fail (stdout: ${stdout})`).toBe(1);
    expect(stdout.toLowerCase()).toContain('automatically verified');
  });

  it('FAILS on smart-quoted “Verified” bare label', () => {
    const file = write('smart-verified.ts', 'const s = “Verified”;\n');
    const { status, stdout } = runScannerStdin([file]);
    expect(status, `smart-quote bare Verified should fail (stdout: ${stdout})`).toBe(1);
  });

  it('FAILS on "Verified provider" and "Verified source" compound phrases', () => {
    const a = write('compound-provider.md', '# Trusted directory\nVerified provider listings for hospitals.\n');
    const b = write('compound-source.md', '# Source list\nVerified source registry for credential checks.\n');
    for (const file of [a, b]) {
      const { status } = runScannerStdin([file]);
      expect(status).toBe(1);
    }
  });
});

describe('check-banned-strings.sh — safe compounds and benign keywords', () => {
  it('PASSES on safe compounds: verification, source-verified, NPPES-verified, …', () => {
    const file = write('benign.tsx',
      [
        '// verification request flow — submit, then route to operator review',
        "export const labels = {",
        "  identity: 'Source-verified',",
        "  registry: 'NPPES-verified',",
        "  source: 'Source-confirmed',",
        "  audit: 'Source-checked',",
        "  badge: 'issuer-confirmed',",
        "  posture: 'HIPAA-aware',",
        '};',
        "export const help = 'Request a verification — verified by NPPES once the probe succeeds.';",
        '',
      ].join('\n'),
    );
    const { status, stdout } = runScannerStdin([file]);
    expect(status, `benign compound input should pass (stdout: ${stdout})`).toBe(0);
  });

  it('PASSES on the internal lowercase enum value `verified`', () => {
    // The codebase uses `'verified'` (lowercase) as a canonical state
    // name in the trust-state machine. The bare-Verified ban is
    // case-sensitive precisely so this enum is not a false positive.
    const file = write('enum.ts',
      [
        "export type Tier = 'verified' | 'inferred' | 'unknown';",
        "export function isVerified(t: Tier): boolean { return t === 'verified'; }",
        '',
      ].join('\n'),
    );
    const { status } = runScannerStdin([file]);
    expect(status).toBe(0);
  });

  it('PASSES on the canonical state constant VERIFIED (all caps)', () => {
    const file = write('const.ts', "export const CANONICAL = ['VERIFIED', 'CLEAR'];\n");
    const { status } = runScannerStdin([file]);
    expect(status).toBe(0);
  });

  it('PASSES on a clean tree and reports CLEAN', () => {
    const file = write('clean.tsx',
      'export const ok = "Source-backed readiness preview.";\n');
    const { status, stdout } = runScannerStdin([file]);
    expect(status).toBe(0);
    expect(stdout).toContain('CLEAN');
  });
});

describe('check-banned-strings.sh — script ergonomics', () => {
  it('emits actionable path:line: <pattern> — <line> output on a hit', () => {
    const file = write('actionable.tsx',
      [
        '// line 1',
        'export const x = "This product is HIPAA compliant."',
        '',
      ].join('\n'),
    );
    const { stdout } = runScannerStdin([file]);
    expect(stdout).toMatch(/actionable\.tsx:\d+:\s*HIPAA compliant\s*—/);
  });

  it('honours the policy/test allowlist — __tests__/* paths are skipped', () => {
    const file = write('apps/web/__tests__/banned-asserts.test.ts',
      'expect("HIPAA compliant").toBeTruthy();\n');
    const { status } = runScannerStdin([file]);
    expect(status).toBe(0);
  });

  it('positional file args still work alongside stdin mode', () => {
    const hit = write('argmode.tsx', 'export const x = "guaranteed verification";\n');
    const { status, stdout } = runScannerArg(hit);
    expect(status).toBe(1);
    expect(stdout).toContain('argmode.tsx');
  });

  // The full-repo CLEAN smoke check is intentionally not run from
  // vitest — the CI workflow exercises that path on every PR via the
  // diff-mode scan, and including it here adds ~3s of overhead to the
  // unit-test run for no additional coverage.
});
