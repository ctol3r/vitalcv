import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * banned-strings-gate.test.ts
 *
 * Behavioural test for scripts/check-banned-strings.sh. Builds a
 * temporary fixture tree, points the scanner at it via positional
 * args, and asserts the scanner detects, ignores, or fails as
 * required by the truth contract.
 *
 * The scanner is bash-only (no Node dependency at runtime) so the
 * test merely shells out; vitest is just our orchestrator + reporter.
 */

const REPO_ROOT = resolve(__dirname, '../../..');
const SCRIPT = resolve(REPO_ROOT, 'scripts/check-banned-strings.sh');

function runScanner(args: string[]): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync('bash', [SCRIPT, ...args], {
      env: { ...process.env, BANNED_STRINGS_DIFF_BASE: '' },
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
  TMP_DIR = mkdtempSync(join(tmpdir(), 'vitalcv-banned-fixture-'));
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

describe('check-banned-strings scanner', () => {
  it('FAILS on every CLAUDE.md banned phrase', () => {
    const phrases = [
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
    ];
    for (const phrase of phrases) {
      const file = write(`fixture-${phrase.replace(/\W+/g, '-')}.tsx`,
        `export const c = "${phrase} for clinicians.";\n`);
      const { status, stdout } = runScanner([file]);
      expect(status, `${phrase} should fail`).toBe(1);
      expect(stdout.toLowerCase()).toContain(phrase.toLowerCase());
    }
  });

  it('FAILS on bare JSX >Verified< tag content', () => {
    const file = write('VerifiedTag.tsx',
      'export const X = () => <span className="badge">Verified</span>;\n');
    const { status, stdout } = runScanner([file]);
    expect(status).toBe(1);
    expect(stdout).toContain('VerifiedTag.tsx');
  });

  it('FAILS on label: "Verified" and status: "Verified" attribute values', () => {
    const file = write('labels.ts',
      [
        "const a = { label: 'Verified' };",
        'const b = { status: "Verified" };',
        '',
      ].join('\n'),
    );
    const { status, stdout } = runScanner([file]);
    expect(status).toBe(1);
    expect(stdout).toContain('label');
    expect(stdout).toContain('status');
  });

  it('FAILS on smart-quoted "Verified" label values', () => {
    const file = write('smart-quotes.ts',
      'const a = { status: “Verified” };\n');
    const { status, stdout } = runScanner([file]);
    expect(status).toBe(1);
    expect(stdout).toContain('smart-quotes.ts');
  });

  it('PASSES on benign phrases that share keywords with the contract', () => {
    const file = write('benign.tsx',
      [
        '// verification request flow — submit and route to operator review',
        'export const labels = {',
        "  status: 'Source-verified',",
        "  source: 'Source-confirmed lane',",
        "  registry: 'NPPES-confirmed identity record',",
        "  issuer: 'issuer-confirmed credential',",
        '};',
        'export const copy = "Our source-backed evidence flow lets the operator request a verification.";',
        '',
      ].join('\n'),
    );
    const { status } = runScanner([file]);
    expect(status).toBe(0);
  });

  it('PASSES on a clean tree and reports CLEAN', () => {
    const file = write('clean.tsx',
      'export const ok = "Source-backed readiness preview.";\n');
    const { status, stdout } = runScanner([file]);
    expect(status).toBe(0);
    expect(stdout).toContain('CLEAN');
  });

  it('emits actionable path:line: <pattern> output on a hit', () => {
    const file = write('hit.tsx',
      [
        '// line 1',
        'export const x = "This product is HIPAA compliant."',
        '',
      ].join('\n'),
    );
    const { stdout } = runScanner([file]);
    // The script prints repo-relative paths; absolute fixture paths
    // appear here because the scope arg is an absolute file. Either
    // shape is fine — what matters is the line number and the matched
    // pattern marker.
    expect(stdout).toMatch(/hit\.tsx:\d+:\s*HIPAA compliant/);
    expect(stdout).toContain('HIPAA compliant');
  });

  it('honours the allowlist substrings — __tests__/banned- files are skipped', () => {
    const file = write('apps/web/__tests__/banned-fixture.test.ts',
      'expect("HIPAA compliant").toBeTruthy();\n');
    const { status } = runScanner([file]);
    expect(status).toBe(0);
  });

  it('runs the full repo scan and reports CLEAN on origin/main HEAD', () => {
    // No args = full default-scope scan against the real repo.
    const { status, stdout } = runScanner([]);
    expect(status, `scanner output:\n${stdout}`).toBe(0);
    expect(stdout).toContain('CLEAN');
  });
});
