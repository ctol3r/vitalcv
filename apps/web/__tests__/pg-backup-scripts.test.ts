/**
 * OPERATE-1 PR364A/365A — backup + restore script lockdown.
 *
 * Pins truth-contract invariants on the shell scripts at
 * scripts/backups/. The actual `pg_dump` / `pg_restore` round-trip
 * requires a live DB and is exercised in ops, not here. This test
 * only validates the script TEXT — fail-closed semantics, no secret
 * leakage, executable bit, etc.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '../../..');
const DUMP_PATH = resolve(REPO_ROOT, 'scripts/backups/pg_dump.sh');
const RESTORE_PATH = resolve(REPO_ROOT, 'scripts/backups/pg_restore.sh');
const README_PATH = resolve(REPO_ROOT, 'scripts/backups/README.md');

const DUMP = readFileSync(DUMP_PATH, 'utf8');
const RESTORE = readFileSync(RESTORE_PATH, 'utf8');
const README = readFileSync(README_PATH, 'utf8');

describe('OPERATE-1 — backup scripts exist + are executable', () => {
  it('pg_dump.sh exists', () => {
    expect(existsSync(DUMP_PATH)).toBe(true);
  });
  it('pg_restore.sh exists', () => {
    expect(existsSync(RESTORE_PATH)).toBe(true);
  });
  it('README.md exists', () => {
    expect(existsSync(README_PATH)).toBe(true);
  });
  it('pg_dump.sh is executable', () => {
    // owner-exec bit set; 0o100 mask
    expect(statSync(DUMP_PATH).mode & 0o100).not.toBe(0);
  });
  it('pg_restore.sh is executable', () => {
    expect(statSync(RESTORE_PATH).mode & 0o100).not.toBe(0);
  });
});

describe('OPERATE-1 — pg_dump.sh truth contract', () => {
  it('uses set -euo pipefail (fail-closed on unset DATABASE_URL)', () => {
    expect(DUMP).toMatch(/set\s+-euo\s+pipefail/);
  });

  it('uses custom format (--format=custom)', () => {
    expect(DUMP).toContain('--format=custom');
  });

  it('writes to ./backups/ with a timestamped filename', () => {
    expect(DUMP).toContain('BACKUP_DIR="./backups"');
    expect(DUMP).toContain('mkdir -p "$BACKUP_DIR"');
    expect(DUMP).toMatch(/vitalcv_\$TIMESTAMP\.dump/);
  });

  it('never prints DATABASE_URL', () => {
    // The literal DATABASE_URL appears only as an env-var reference,
    // never inside echo / printf / cat statements.
    const lines = DUMP.split('\n');
    const echoLinesWithUrl = lines.filter(
      (l) => /\b(echo|printf)\b/.test(l) && /\$DATABASE_URL/.test(l),
    );
    expect(echoLinesWithUrl).toEqual([]);
  });

  it('passes DATABASE_URL to pg_dump as a positional arg, not via stdout', () => {
    expect(DUMP).toContain('pg_dump "$DATABASE_URL"');
  });
});

describe('OPERATE-1 — pg_restore.sh truth contract', () => {
  it('uses set -euo pipefail', () => {
    expect(RESTORE).toMatch(/set\s+-euo\s+pipefail/);
  });

  it('REQUIRES dump file as $1; no default', () => {
    expect(RESTORE).toMatch(/if\s+\[\s+"\$#"\s+-lt\s+1\s+\]/);
    expect(RESTORE).toContain('Usage:');
    expect(RESTORE).toContain('exit 64');
  });

  it('validates the dump file exists before invoking pg_restore', () => {
    expect(RESTORE).toMatch(/if\s+\[\s+!\s+-f\s+"\$DUMP_FILE"\s+\]/);
    expect(RESTORE).toContain('exit 66');
  });

  it('refuses production-shaped hosts without ALLOW_PROD_RESTORE=1', () => {
    expect(RESTORE).toContain('ALLOW_PROD_RESTORE');
    expect(RESTORE).toMatch(/\*prod\*\|\*production\*\|api\.vitalcv\.com\|\*\.vitalcv\.com/);
    expect(RESTORE).toContain('exit 77');
  });

  it('never prints DATABASE_URL (only host segment in warning)', () => {
    const lines = RESTORE.split('\n');
    const echoLinesWithUrl = lines.filter(
      (l) => /\b(echo|printf)\b/.test(l) && /\$DATABASE_URL\b/.test(l),
    );
    expect(echoLinesWithUrl).toEqual([]);
  });

  it('uses --clean --if-exists --no-owner --no-privileges', () => {
    expect(RESTORE).toContain('--clean');
    expect(RESTORE).toContain('--if-exists');
    expect(RESTORE).toContain('--no-owner');
    expect(RESTORE).toContain('--no-privileges');
  });
});

describe('OPERATE-1 — README documents the truth contract', () => {
  it('warns against printing DATABASE_URL', () => {
    expect(README).toContain('Never print');
    expect(README).toContain('DATABASE_URL');
  });

  it('documents the production-host guard', () => {
    expect(README).toContain('ALLOW_PROD_RESTORE');
    expect(README).toContain('irreversible');
  });

  it('references PR #319 (the durable schema PR this pairs with)', () => {
    expect(README).toContain('#319');
  });

  it('mentions backups/ should be gitignored (PII risk)', () => {
    expect(README).toContain('.gitignore');
    expect(README).toContain('PII');
  });

  it('does not contain banned strings', () => {
    const BANNED = [
      ['automatically', 'verified'].join(' '),
      ['guaranteed', 'verification'].join(' '),
      ['HIPAA', 'compliant'].join(' '),
      ['SOC2', 'certified'].join(' '),
      ['certified', 'compliant'].join(' '),
    ];
    for (const phrase of BANNED) {
      expect(README).not.toContain(phrase);
    }
  });
});
