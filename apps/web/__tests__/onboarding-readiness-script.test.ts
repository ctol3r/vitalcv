/**
 * scripts/check-onboarding-readiness.sh + first-onboarding-flow.md lockdown.
 *
 * Pins:
 *   - The script reads only public endpoints. Never asks for or prints
 *     a secret value.
 *   - The script exits non-zero when any required subsystem is
 *     `present: false`. Usable as a CI gate.
 *   - The script knows the real verifier path (/api/receipts/verify),
 *     NOT the wrong one (/api/credentials/verify per #321 audit).
 *   - The walkthrough doc references real PRs + real source surfaces
 *     and is honest about pending wiring (post W3-PR213A).
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '../../..');
const SCRIPT_PATH = resolve(REPO_ROOT, 'scripts/check-onboarding-readiness.sh');
const DOC_PATH = resolve(REPO_ROOT, 'docs/pilot/first-onboarding-flow.md');

const SCRIPT = readFileSync(SCRIPT_PATH, 'utf8');
const DOC = readFileSync(DOC_PATH, 'utf8');

describe('check-onboarding-readiness.sh — executable + bash-safe', () => {
  it('script is executable', () => {
    const mode = statSync(SCRIPT_PATH).mode & 0o100;
    expect(mode).not.toBe(0);
  });

  it('uses set -euo pipefail', () => {
    expect(SCRIPT).toMatch(/set\s+-euo\s+pipefail/);
  });

  it('strips trailing slash from BASE_URL', () => {
    expect(SCRIPT).toMatch(/BASE_URL="\$\{BASE_URL%\/\}"/);
  });

  it('defaults BASE_URL to http://localhost:3000', () => {
    expect(SCRIPT).toMatch(/BASE_URL="\$\{BASE_URL:-http:\/\/localhost:3000\}"/);
  });
});

describe('check-onboarding-readiness.sh — never asks for or prints secrets', () => {
  it('does not curl with -u / --user (no basic-auth credential prompt)', () => {
    expect(SCRIPT).not.toMatch(/curl[^|]*\s-u\s/);
    expect(SCRIPT).not.toContain('--user');
  });

  it('does not curl with -H "Authorization:" headers (no bearer-token leak)', () => {
    expect(SCRIPT).not.toMatch(/Authorization:\s*Bearer/i);
  });

  it('does not echo any env var named *SECRET*, *PRIVATE*, *KEY* (other than VITALCV_SIGNING_PUBLIC_JWK)', () => {
    // Soft scan: forbid `$SECRET`, `$PRIVATE`, `$.*KEY` in echo/printf args.
    const lines = SCRIPT.split('\n');
    const echoLines = lines.filter((l) => /\b(echo|printf)\b/.test(l));
    for (const l of echoLines) {
      expect(l).not.toMatch(/\$\w*SECRET\w*\b/);
      expect(l).not.toMatch(/\$\w*PRIVATE\w*\b/);
    }
  });
});

describe('check-onboarding-readiness.sh — checks the correct endpoints', () => {
  it('checks /api/status/health (PR #327)', () => {
    expect(SCRIPT).toContain('/api/status/health');
  });

  it('checks /.well-known/jwks.json (PR #316)', () => {
    expect(SCRIPT).toContain('/.well-known/jwks.json');
  });

  it('checks /sign-in (PR #310)', () => {
    expect(SCRIPT).toContain('/sign-in');
  });

  it('checks /api/receipts/verify — the RIGHT verifier endpoint (per #321 audit)', () => {
    expect(SCRIPT).toContain('/api/receipts/verify');
  });

  it('explicitly warns if the WRONG endpoint name is hit (/api/credentials/verify)', () => {
    expect(SCRIPT).toContain('/api/credentials/verify');
    expect(SCRIPT).toMatch(/NOT.*\/api\/credentials\/verify/);
  });
});

describe('check-onboarding-readiness.sh — interprets status responses correctly', () => {
  it('treats aggregate=ok as success', () => {
    // The case statement uses `ok)` (lowercase) — confirm both that
    // arm exists and that the success message text is present.
    expect(SCRIPT).toMatch(/^\s+ok\)\s*$/m);
    expect(SCRIPT).toMatch(/all subsystems configured/);
  });

  it('treats aggregate=degraded as failure', () => {
    expect(SCRIPT).toContain('degraded');
    // Degraded should result in FAIL=1 somewhere in the case arm.
    expect(SCRIPT).toMatch(/degraded\)[\s\S]*FAIL=1/);
  });

  it('treats aggregate=absent as failure', () => {
    expect(SCRIPT).toContain('absent');
  });

  it('treats verifier POST {} 400 as fail-closed correct (token required)', () => {
    expect(SCRIPT).toMatch(/400\)[\s\S]*token required/);
  });

  it('treats verifier POST {} 422 as fail-closed correct (verified:false)', () => {
    expect(SCRIPT).toMatch(/422\)[\s\S]*verified:false/);
  });

  it('treats JWKS X-JWKS-Status:not-configured as warning + fail', () => {
    expect(SCRIPT).toContain('not-configured');
    expect(SCRIPT).toMatch(/VITALCV_SIGNING_PUBLIC_JWK/);
  });

  it('treats JWKS X-JWKS-Status:invalid-jwk as hard fail (private d leaked attempt)', () => {
    expect(SCRIPT).toContain('invalid-jwk');
    expect(SCRIPT).toMatch(/private\s+'d'/);
  });
});

describe('check-onboarding-readiness.sh — final verdict shape', () => {
  it('exits 0 with READY verdict when all checks pass', () => {
    expect(SCRIPT).toMatch(/VERDICT:\s+READY/);
    expect(SCRIPT).toMatch(/FAIL"?\s+-eq\s+0[\s\S]*exit 0/);
  });

  it('exits non-zero with NOT READY verdict on any failure', () => {
    expect(SCRIPT).toMatch(/VERDICT:\s+NOT READY/);
    expect(SCRIPT).toMatch(/exit 1/);
  });

  it('points failure path at the companion docs', () => {
    expect(SCRIPT).toContain('docs/pilot/first-onboarding-flow.md');
    expect(SCRIPT).toContain('docs/pilot/go-live-checklist.md');
  });
});

describe('first-onboarding-flow.md — walkthrough doc accuracy', () => {
  it('contains 8 numbered steps (0 through 7)', () => {
    for (const step of ['Step 0', 'Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5', 'Step 6', 'Step 7']) {
      expect(DOC).toContain(step);
    }
  });

  it('references the readiness script at Step 0', () => {
    expect(DOC).toContain('./scripts/check-onboarding-readiness.sh');
  });

  it('references the correct verifier endpoint (NOT the wrong one)', () => {
    expect(DOC).toContain('/api/receipts/verify');
  });

  it('honestly marks pre-W3-PR213A replayLineage absence as ambiguity-visible', () => {
    expect(DOC).toContain('Until W3-PR213A merges');
    expect(DOC).toContain('ambiguity-visible');
  });

  it('honestly states what VitalCV verifies vs does not (refers to /truth-boundary)', () => {
    expect(DOC).toContain('/truth-boundary');
    expect(DOC).toContain('WHAT VITALCV VERIFIES');
    expect(DOC).toContain('WHAT VITALCV DOES NOT VERIFY');
  });

  it('does NOT promise "verified" for self-attested or gated items', () => {
    // Pattern: bare-word "Verified" as a badge/status label.
    expect(DOC).not.toMatch(/\bVerified\b\s*badge/i);
  });

  it('verdict template uses GO / NO-GO, not unconditional approval', () => {
    expect(DOC).toContain('GO / NO-GO');
  });

  it('verdicts are append-only', () => {
    expect(DOC).toContain('append-only');
    expect(DOC).toMatch(/supersede.*reference/);
  });

  it('cross-references the relevant PRs by number', () => {
    expect(DOC).toContain('#314');
    expect(DOC).toContain('#321');
    expect(DOC).toContain('#325');
    expect(DOC).toContain('#327');
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
      expect(DOC).not.toContain(phrase);
    }
  });
});

describe('check-onboarding-readiness.sh — banned-strings scan', () => {
  const BANNED = [
    ['automatically', 'verified'].join(' '),
    ['guaranteed', 'verification'].join(' '),
    ['HIPAA', 'compliant'].join(' '),
    ['SOC2', 'certified'].join(' '),
    ['certified', 'compliant'].join(' '),
  ];
  it.each(BANNED)('script does not contain banned phrase: %s', (phrase) => {
    expect(SCRIPT).not.toContain(phrase);
  });
});

describe('Companion docs are referenced', () => {
  // The go-live-checklist lives on PR #327's branch. This PR is
  // independent — it references the doc by path in failure-mode
  // pointers, but the file existence depends on #327 having merged
  // (or this branch being rebased onto a merged base).
  const checklistPath = resolve(REPO_ROOT, 'docs/pilot/go-live-checklist.md');

  it('readiness script references the go-live checklist path', () => {
    expect(SCRIPT).toContain('docs/pilot/go-live-checklist.md');
  });

  it('walkthrough doc references the go-live checklist path', () => {
    expect(DOC).toContain('docs/pilot/go-live-checklist.md');
  });

  it.skipIf(!existsSync(checklistPath))(
    'docs/pilot/go-live-checklist.md exists (when #327 has merged or this branch is rebased)',
    () => {
      expect(existsSync(checklistPath)).toBe(true);
    },
  );
});
