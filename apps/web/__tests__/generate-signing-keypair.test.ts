/**
 * generate-signing-keypair.mjs safety contract lockdown.
 *
 * Pins the script's truth contract:
 *   - Private JWK NEVER printed to stdout.
 *   - Private JWK file written with 0600 permissions.
 *   - kid is deterministic (canonical-JSON + SHA-256 + prefix).
 *   - Refuses to overwrite existing key files unless FORCE=1.
 *   - .gitignore excludes the generated key files so an accidental
 *     `git add` cannot commit them.
 *
 * This test does NOT run the script. Running the script generates
 * real key material — that is operator work in their own terminal.
 * This test only validates the script TEXT and the .gitignore.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '../../..');
const SCRIPT = readFileSync(
  resolve(REPO_ROOT, 'scripts/generate-signing-keypair.mjs'),
  'utf8',
);
const GITIGNORE = readFileSync(resolve(REPO_ROOT, '.gitignore'), 'utf8');

describe('generate-signing-keypair — private material never printed', () => {
  it('script does NOT console.log the private JWK', () => {
    // Find every console.log call and assert none reference privateJwk.
    const logs = SCRIPT.match(/console\.(log|error|warn|info)\([^)]*\)/g) ?? [];
    const logsThatPrintPrivate = logs.filter((l) => /privateJwk(?!.*\/\/.*safe)/.test(l));
    expect(logsThatPrintPrivate).toEqual([]);
  });

  it('script does NOT JSON.stringify privateJwk into stdout-bound code', () => {
    // JSON.stringify(privateJwk) is only acceptable when written via
    // writeFileSync to PRIVATE_PATH. Reject any pattern that puts
    // JSON.stringify(privateJwk) into console.log.
    const badPattern = /console\.(log|error|warn|info)\([^)]*JSON\.stringify\(\s*privateJwk/;
    expect(SCRIPT).not.toMatch(badPattern);
  });

  it('only writes privateJwk via writeFileSync to PRIVATE_PATH', () => {
    expect(SCRIPT).toMatch(/writeFileSync\(\s*PRIVATE_PATH\s*,\s*JSON\.stringify\(\s*privateJwk/);
  });
});

describe('generate-signing-keypair — file permissions', () => {
  it('private key file is written with 0600 mode', () => {
    expect(SCRIPT).toMatch(/mode:\s*0o600/);
  });

  it('chmod 0600 is also applied (belt + suspenders)', () => {
    expect(SCRIPT).toMatch(/chmodSync\(\s*PRIVATE_PATH\s*,\s*0o600\s*\)/);
  });

  it('public key file uses 0644 (world-readable, but only owner writes)', () => {
    expect(SCRIPT).toMatch(/mode:\s*0o644/);
  });
});

describe('generate-signing-keypair — kid derivation is deterministic', () => {
  it('kid is derived from SHA-256 of canonical-JSON of the public JWK', () => {
    expect(SCRIPT).toContain("createHash('sha256')");
    expect(SCRIPT).toMatch(/Object\.keys\(publicJwk\)\.sort\(\)/);
  });

  it('kid has a date-band prefix (YYYY-MM) for visual rotation tracking', () => {
    expect(SCRIPT).toMatch(/new Date\(\)\.toISOString\(\)\.slice\(0,\s*7\)/);
    expect(SCRIPT).toMatch(/`vcv-\$\{band\}-\$\{hash\}`/);
  });
});

describe('generate-signing-keypair — refuses silent rotation', () => {
  it('refuses to overwrite existing key files unless FORCE=1 is set', () => {
    expect(SCRIPT).toContain("FORCE === '1'");
    expect(SCRIPT).toMatch(/already exists/);
    expect(SCRIPT).toContain('exit(77)');
  });

  it('warns about rotation invalidating cached signatures', () => {
    expect(SCRIPT).toMatch(/invalidates/);
    expect(SCRIPT).toMatch(/deliberate act/);
  });
});

describe('generate-signing-keypair — outputs guide the user without leaking', () => {
  it('prints the kid', () => {
    expect(SCRIPT).toContain('Key ID (kid):');
  });

  it('prints the public JWK', () => {
    expect(SCRIPT).toMatch(/console\.log\([^)]*publicJwk/);
  });

  it('prints the private file PATH but explicitly warns against sharing', () => {
    expect(SCRIPT).toContain('NEVER share, NEVER paste into chat');
    expect(SCRIPT).toMatch(/console\.log\([^)]*cat[^)]*PRIVATE_PATH/);
  });

  it('points user at .env.local + Vercel env for env-var placement', () => {
    expect(SCRIPT).toContain('VITALCV_SIGNING_PUBLIC_JWK');
    expect(SCRIPT).toContain('VITALCV_SIGNING_PRIVATE_KEY_JWK');
    expect(SCRIPT).toContain('VITALCV_SIGNING_KEY_ID');
  });

  it('script does not contain banned strings', () => {
    const BANNED = [
      ['automatically', 'verified'].join(' '),
      ['guaranteed', 'verification'].join(' '),
      ['HIPAA', 'compliant'].join(' '),
      ['SOC2', 'certified'].join(' '),
      ['certified', 'compliant'].join(' '),
    ];
    for (const phrase of BANNED) {
      expect(SCRIPT).not.toContain(phrase);
    }
  });
});

describe('generate-signing-keypair — .gitignore prevents accidental commit', () => {
  it('keys/ directory is in .gitignore', () => {
    expect(GITIGNORE).toMatch(/^keys\/?$/m);
  });

  it('*.jwk pattern is in .gitignore', () => {
    expect(GITIGNORE).toContain('*.jwk');
  });

  it('Postgres backup outputs (from #320) are also gitignored', () => {
    expect(GITIGNORE).toContain('backups/');
    expect(GITIGNORE).toContain('*.dump');
  });

  it('explains why keys/ is excluded (PII / secret material)', () => {
    expect(GITIGNORE).toMatch(/private material/);
    expect(GITIGNORE).toMatch(/NEVER be committed/);
  });
});
