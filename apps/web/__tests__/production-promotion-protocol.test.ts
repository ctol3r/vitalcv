/**
 * Production promotion protocol accuracy lockdown.
 *
 * Pins every artifact reference in the protocol doc against actual
 * source. If a referenced file moves or disappears, this test fails —
 * preventing the protocol from going stale.
 *
 * The protocol doc is the operational answer to the recurring
 * "verify production" brief pattern. Keeping it accurate is the
 * difference between an authoritative reference and a stale checklist.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '../../..');
const DOC = readFileSync(
  resolve(REPO_ROOT, 'docs/ops/production-promotion-protocol.md'),
  'utf8',
);

const REFERENCED_FILES = [
  'apps/web/lib/env.ts',
  'apps/web/lib/auth/clerkConfig.ts',
  'apps/web/middleware.ts',
  'apps/web/app/api/.well-known/jwks.json/route.ts',
  'apps/web/app/api/receipts/verify/route.ts',
  'apps/api/backend/prisma/schema.prisma',
] as const;

describe('production-promotion-protocol — referenced files exist on origin/main', () => {
  it.each(REFERENCED_FILES)('source exists: %s', (path) => {
    expect(existsSync(resolve(REPO_ROOT, path))).toBe(true);
  });
});

describe('production-promotion-protocol — every shipped PR is referenced by number', () => {
  // Every PR from #305-#337 is part of the operational answer. The
  // doc must reference each by number so operators can find the
  // artifact via the GitHub UI.
  const PR_NUMBERS = [
    305, 306, 307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317,
    318, 319, 320, 321, 322, 323, 324, 325, 326, 327, 328, 329, 330,
    332, 333, 334, 335, 336, 337,
  ];

  it.each(PR_NUMBERS)('protocol references PR #%i', (n) => {
    expect(DOC).toContain(`#${n}`);
  });
});

describe('production-promotion-protocol — the 7 gates are all documented', () => {
  const GATE_HEADINGS = [
    '### Step 1 — Required env vars present',
    '### Step 2 — Runtime channel matches target',
    '### Step 3 — Clerk auth operational',
    '### Step 4 — Trust endpoints reachable',
    '### Step 5 — Replay attribution wired',
    '### Step 6 — Audit durability operational',
    '### Step 7 — Codex SAFE verdicts',
  ];

  it.each(GATE_HEADINGS)('contains gate heading: %s', (heading) => {
    expect(DOC).toContain(heading);
  });

  it('TL;DR table contains all 7 gates', () => {
    for (let i = 1; i <= 7; i++) {
      expect(DOC).toMatch(new RegExp(`\\|\\s*${i}\\s*\\|`, 'm'));
    }
  });
});

describe('production-promotion-protocol — 4-phase merge order documented', () => {
  it('contains all 4 phases', () => {
    expect(DOC).toContain('### Phase 1 — Foundations');
    expect(DOC).toContain('### Phase 2 — Schemas, primitives, design tokens');
    expect(DOC).toContain('### Phase 3 — Stacked surfaces + wiring');
    expect(DOC).toContain('### Phase 4 — Live wiring (DB-dependent)');
  });

  it('Phase 4 explicitly names the DB dependency', () => {
    expect(DOC).toContain('prisma migrate dev');
    expect(DOC).toContain('#319');
  });

  it('Phase 4 names the 5 wiring follow-up PRs', () => {
    expect(DOC).toContain('W3-PR213A-live');
    expect(DOC).toContain('EXPORT-PERSIST-WIRE');
    expect(DOC).toContain('STATUS-PERSIST-WIRE');
    expect(DOC).toContain('AUTH-1 PR268A');
    expect(DOC).toContain('CRYPTO-1 PR316A');
  });
});

describe('production-promotion-protocol — required env vars table', () => {
  const REQUIRED_VARS = [
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'CLERK_SECRET_KEY',
    'DATABASE_URL',
    'VITALCV_SIGNING_PUBLIC_JWK',
    'VITALCV_SIGNING_PRIVATE_KEY_JWK',
    'VITALCV_SIGNING_KEY_ID',
    'VITALCV_RUNTIME_CHANNEL',
    'ALLOWED_CORS_ORIGINS',
    'BACKEND_URL',
    'PUBLIC_STATUS_URL',
  ];

  it.each(REQUIRED_VARS)('env var %s appears in the table', (v) => {
    expect(DOC).toContain(v);
  });

  it('the 4 runtime channels are present as table columns', () => {
    expect(DOC).toContain('local_dev');
    expect(DOC).toContain('operator_preview');
    expect(DOC).toContain('staging');
    expect(DOC).toContain('production');
  });
});

describe('production-promotion-protocol — verification commands are concrete', () => {
  it('includes /api/health curl', () => {
    expect(DOC).toMatch(/curl[^`]*\/api\/health/);
  });

  it('includes /.well-known/jwks.json curl', () => {
    expect(DOC).toContain('/.well-known/jwks.json');
  });

  it('includes /api/receipts/verify curl', () => {
    expect(DOC).toContain('/api/receipts/verify');
  });

  it('includes pg_dump invocation', () => {
    expect(DOC).toContain('./scripts/backups/pg_dump.sh');
  });

  it('includes generate-signing-keypair.mjs', () => {
    expect(DOC).toContain('scripts/generate-signing-keypair.mjs');
  });

  it('includes the readiness checker', () => {
    expect(DOC).toContain('check-onboarding-readiness.sh');
  });
});

describe('production-promotion-protocol — closing-pattern + rollback', () => {
  it('contains the closing-rephrase-pattern section', () => {
    expect(DOC).toContain('Closing the rephrasing pattern');
    expect(DOC).toContain('point at this doc');
  });

  it('contains a rollback path section', () => {
    expect(DOC).toContain('## Rollback path');
    expect(DOC).toContain('Vercel rollback');
  });

  it('warns against bypassing Codex SAFE with --admin', () => {
    expect(DOC).toContain('Codex SAFE');
    expect(DOC).toContain('--admin');
  });
});

describe('production-promotion-protocol — banned-strings scan', () => {
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
  it.each(BANNED)('protocol does not contain banned phrase: %s', (phrase) => {
    expect(DOC).not.toContain(phrase);
  });
});
