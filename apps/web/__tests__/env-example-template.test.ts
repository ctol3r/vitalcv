/**
 * apps/web/.env.example template lockdown.
 *
 * Pins:
 *   - Every required env var per apps/web/lib/env.ts appears in the
 *     template (uncommented, with an empty value to fill in).
 *   - The template contains NO real-looking key material (no
 *     pk_live_ / sk_live_ / pk_test_ / sk_test_ followed by 8+ chars).
 *   - The template is committed (NOT gitignored).
 *   - The template references the relevant runbook + verifier PRs.
 *   - The template explicitly distinguishes REQUIRED from OPTIONAL.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '../../..');
const TEMPLATE_PATH = resolve(REPO_ROOT, 'apps/web/.env.example');
const ENV_SCHEMA = resolve(REPO_ROOT, 'apps/web/lib/env.ts');
const GITIGNORE = resolve(REPO_ROOT, '.gitignore');

const TEMPLATE = readFileSync(TEMPLATE_PATH, 'utf8');

describe('apps/web/.env.example — exists + committed', () => {
  it('template file exists', () => {
    expect(existsSync(TEMPLATE_PATH)).toBe(true);
  });

  it('is NOT matched by any .gitignore pattern', () => {
    // .gitignore excludes .env, .env.local, .env.*.local. The
    // .env.example name must not match any of those.
    const gi = readFileSync(GITIGNORE, 'utf8');
    // Defensive check: no line in .gitignore equals exactly
    // ".env.example" or "**/.env.example".
    const lines = gi
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    expect(lines).not.toContain('.env.example');
    expect(lines).not.toContain('**/.env.example');
    expect(lines).not.toContain('*.example');
  });
});

describe('apps/web/.env.example — required vars present', () => {
  const REQUIRED_FROM_SCHEMA = (() => {
    const schemaSrc = readFileSync(ENV_SCHEMA, 'utf8');
    const required: string[] = [];
    const blocks = schemaSrc.split(/\{/);
    for (const block of blocks) {
      const nameMatch = block.match(/name:\s*['"]([A-Z0-9_]+)['"]/);
      const kindMatch = block.match(/kind:\s*['"]required['"]/);
      if (nameMatch && kindMatch) {
        required.push(nameMatch[1]);
      }
    }
    return required;
  })();

  it('schema parser found at least 2 required vars (sanity check)', () => {
    expect(REQUIRED_FROM_SCHEMA.length).toBeGreaterThanOrEqual(2);
  });

  it.each(REQUIRED_FROM_SCHEMA)('required var %s appears in the template', (name) => {
    // Must appear at the start of a line, with an = sign (so it's
    // uncommented and ready to fill in).
    const pattern = new RegExp(`^${name}=`, 'm');
    expect(TEMPLATE).toMatch(pattern);
  });

  it('DATABASE_URL is present as an uncommented placeholder', () => {
    // DATABASE_URL is required by the Prisma layer (apps/api/backend +
    // apps/web's status route) even though it's not in env.ts's
    // current schema enumeration. Template documents it explicitly.
    expect(TEMPLATE).toMatch(/^DATABASE_URL=/m);
  });
});

describe('apps/web/.env.example — no real key material', () => {
  it('does NOT contain any real-looking pk_live_/sk_live_ values', () => {
    const liveKeys = TEMPLATE.match(/(?:pk|sk)_live_[A-Za-z0-9_-]{8,}/g) ?? [];
    expect(liveKeys).toEqual([]);
  });

  it('does NOT contain any real-looking pk_test_/sk_test_ values', () => {
    const testKeys = TEMPLATE.match(/(?:pk|sk)_test_[A-Za-z0-9_-]{8,}/g) ?? [];
    expect(testKeys).toEqual([]);
  });

  it('does NOT contain a real-looking private JWK `d` value', () => {
    // A real EC P-256 `d` is 32 bytes ≈ 43 base64url chars.
    const dValues = TEMPLATE.match(/"d"\s*:\s*"[A-Za-z0-9_-]{30,}"/g) ?? [];
    expect(dValues).toEqual([]);
  });

  it('does NOT contain a real-looking DATABASE_URL with embedded password', () => {
    // user:password@host shape. We exclude placeholder shapes that
    // contain `<` (angle-bracket placeholders like <pwd>).
    const dbPasswords = TEMPLATE.match(/postgresql?:\/\/[^:\s]+:[^@\s<>]{4,}@/g) ?? [];
    expect(dbPasswords).toEqual([]);
  });

  it('uses ellipsis or empty placeholders rather than dummy values', () => {
    // Public JWK example in the template uses … characters.
    expect(TEMPLATE).toContain('…');
  });
});

describe('apps/web/.env.example — docs + commentary', () => {
  it('explicitly marks REQUIRED sections', () => {
    expect(TEMPLATE).toMatch(/REQUIRED/);
  });

  it('explicitly marks OPTIONAL sections', () => {
    expect(TEMPLATE).toMatch(/OPTIONAL/);
  });

  it('references the canonical env schema location', () => {
    expect(TEMPLATE).toContain('apps/web/lib/env.ts');
  });

  it('references the Clerk OAuth runbook (#314)', () => {
    expect(TEMPLATE).toContain('docs/ops/clerk-google-oauth-runbook.md');
  });

  it('references the go-live checklist (#327)', () => {
    expect(TEMPLATE).toContain('docs/pilot/go-live-checklist.md');
  });

  it('references the readiness script (#328) or status route (#327)', () => {
    const referencesReadinessScript = TEMPLATE.includes('check-onboarding-readiness.sh');
    const referencesStatusRoute = TEMPLATE.includes('/api/status/health');
    expect(referencesReadinessScript || referencesStatusRoute).toBe(true);
  });

  it('warns against committing real secrets', () => {
    // The header comment must explicitly tell the operator to write
    // real values into .env.local (which IS gitignored), not into
    // .env.example itself.
    expect(TEMPLATE).toContain('.env.local');
    expect(TEMPLATE).toContain('gitignored');
  });

  it('does not contain banned strings', () => {
    const BANNED = [
      ['automatically', 'verified'].join(' '),
      ['guaranteed', 'verification'].join(' '),
      ['complete', 'credentialing'].join(' '),
      ['instant', 'credentialing'].join(' '),
      ['legally', 'accepted'].join(' '),
      ['risk', 'transferred'].join(' '),
      ['HIPAA', 'compliant'].join(' '),
      ['SOC2', 'certified'].join(' '),
      ['certified', 'compliant'].join(' '),
    ];
    for (const phrase of BANNED) {
      expect(TEMPLATE).not.toContain(phrase);
    }
  });
});
