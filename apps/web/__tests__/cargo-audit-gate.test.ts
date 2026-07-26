/**
 * cargo-audit-gate.test.ts
 *
 * Guards the Rust SCA gate (scripts/security/cargo-audit-gate.mjs), the Cargo
 * counterpart to the pnpm gate. `pnpm audit` cannot see Rust dependencies, so
 * before this gate existed every Cargo.lock in the repo had zero SCA coverage.
 *
 * Truth contracts:
 *   - CVSS base scores are computed correctly (cargo-audit reports only the
 *     vector string, so the gate scores it; a drift here silently
 *     mis-classifies advisories)
 *   - Unscorable input yields null, never a number
 *   - The ignore file is valid, and every entry carries its justification
 *   - The workflow is wired to the gate and to Cargo.lock changes
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-expect-error -- plain .mjs script, no type declarations
import { cvssBaseScore } from '../../../scripts/security/cargo-audit-gate.mjs';

const ROOT = resolve(__dirname, '../../..');
const IGNORE_PATH = resolve(ROOT, 'scripts/security/cargo-audit-ignores.json');
const WORKFLOW_PATH = resolve(ROOT, '.github/workflows/cargo-audit.yml');

describe('cvssBaseScore', () => {
  it('scores RUSTSEC-2023-0090 / CVE-2023-26489 (wasmtime) as 9.9', () => {
    // The advisory that motivated this gate. GitHub publishes 9.9 critical;
    // if our arithmetic drifts, the gate stops treating it as critical.
    expect(cvssBaseScore('CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:H')).toBe(9.9);
  });

  it('scores a scope-unchanged full-impact network vector as 9.8', () => {
    expect(cvssBaseScore('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H')).toBe(9.8);
  });

  it('scores a local low-impact vector below the critical threshold', () => {
    const score = cvssBaseScore('CVSS:3.1/AV:L/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N');
    expect(score).toBeLessThan(9);
    expect(score).toBeGreaterThan(0);
  });

  it('returns 0 when every impact metric is None', () => {
    expect(cvssBaseScore('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N')).toBe(0);
  });

  it('accepts CVSS:3.0 vectors as well as 3.1', () => {
    expect(cvssBaseScore('CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H')).toBe(9.8);
  });

  // null means "unscored — report, do not block". A bogus 0 would hide a real
  // advisory instead of surfacing it for triage.
  it('returns null for missing, malformed, or non-CVSS3 input', () => {
    expect(cvssBaseScore(null)).toBeNull();
    expect(cvssBaseScore(undefined)).toBeNull();
    expect(cvssBaseScore('')).toBeNull();
    expect(cvssBaseScore('AV:N/AC:L/Au:N/C:P/I:P/A:P')).toBeNull(); // CVSS v2
    expect(cvssBaseScore('CVSS:3.1/AV:X/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H')).toBeNull();
    expect(cvssBaseScore('CVSS:3.1/AV:N')).toBeNull(); // truncated
  });
});

describe('cargo-audit ignore list', () => {
  const raw = JSON.parse(readFileSync(IGNORE_PATH, 'utf-8'));

  it('has an ignore array', () => {
    expect(Array.isArray(raw.ignore)).toBe(true);
  });

  // An ignore without a reason, owner, and revisit condition is how a
  // suppressed critical becomes permanent by accident.
  it('documents every entry with id, reason, owner, added date, and revisit condition', () => {
    for (const entry of raw.ignore) {
      expect(entry.id).toMatch(/^RUSTSEC-\d{4}-\d{4}$/);
      expect(entry.reason?.length ?? 0).toBeGreaterThan(20);
      expect(entry.owner?.length ?? 0).toBeGreaterThan(0);
      expect(entry.added).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.revisit?.length ?? 0).toBeGreaterThan(20);
    }
  });
});

describe('cargo-audit workflow', () => {
  const workflow = readFileSync(WORKFLOW_PATH, 'utf-8');

  it('runs the gate script', () => {
    expect(workflow).toContain('node scripts/security/cargo-audit-gate.mjs');
  });

  it('installs cargo-audit pinned with --locked', () => {
    expect(workflow).toContain('cargo install cargo-audit --locked');
  });

  // A path filter that misses Cargo.lock would let a vulnerable dependency
  // land without the gate ever running.
  it('triggers on Cargo.lock and on its own definition', () => {
    expect(workflow).toContain('Cargo.lock');
    expect(workflow).toContain('.github/workflows/cargo-audit.yml');
  });

  it('runs on pull requests to main, not only on a schedule', () => {
    expect(workflow).toMatch(/pull_request:/);
  });
});
