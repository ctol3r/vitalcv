/**
 * W3-PR209A — passport runtime truth-honest defaults lockdown.
 *
 * Pins the truth-contract observations from the W3-PR209A audit so
 * the honest defaults cannot drift silently. Specifically:
 *   - createInitialIngestStreamState() emits no synthetic readiness
 *   - the public PassportData type exposes UNCHECKED / UNKNOWN states
 *     for fields whose ambiguity is the entire point (exclusion, PECOS)
 *   - the proxy route file fail-closes on invalid upstream payloads
 *     via the `invalid_upstream_payload` discriminator
 *
 * If you are tempted to change one of these assertions, read
 * docs/ops/passport-runtime-audit-w3-pr209a.md first.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createInitialIngestStreamState } from '../hooks/ingestStreamState';

const PROXY_ROUTE_SRC = readFileSync(
  resolve(__dirname, '../app/api/passport/[npi]/route.ts'),
  'utf8',
);
const CONTRACT_SRC = readFileSync(
  resolve(__dirname, '../lib/trust/passport-contract.ts'),
  'utf8',
);

describe('W3-PR209A — createInitialIngestStreamState: no synthetic readiness', () => {
  const init = createInitialIngestStreamState();

  it('phase is "idle" (not a synthetic ready state)', () => {
    expect(init.phase).toBe('idle');
  });

  it('readiness is an empty object — no synthetic score / level / status', () => {
    expect(init.readiness).toEqual({});
  });

  it('identity is not asserted authoritative until proven', () => {
    expect(init.identity.authoritative).toBe(false);
  });

  it('standing has no synthetic exclusion or enrollment certainty', () => {
    expect(init.standing.exclusionChecked).toBe(false);
    expect(init.standing.enrollmentChecked).toBe(false);
  });

  it('every source starts as pending — not "verified", not "ok"', () => {
    expect(init.sources.nppes).toBe('pending');
    expect(init.sources.oig).toBe('pending');
    expect(init.sources.pecos).toBe('pending');
  });

  it('isUsable defaults to false (passport not yet usable on first paint)', () => {
    expect(init.isUsable).toBe(false);
  });

  it('events array starts empty (no synthesized history)', () => {
    expect(init.events).toEqual([]);
  });

  it('disconnected defaults to false (no synthetic offline assumption)', () => {
    expect(init.disconnected).toBe(false);
  });
});

describe('W3-PR209A — PassportData type surface preserves ambiguity', () => {
  it('standing.exclusionStatus enum includes UNCHECKED and UNKNOWN', () => {
    // Type-source assertion: the literal union must contain both
    // unchecked and unknown states. We grep the source rather than
    // exercising the type system at runtime.
    expect(CONTRACT_SRC).toContain("'UNCHECKED'");
    expect(CONTRACT_SRC).toContain("'UNKNOWN'");
  });

  it('standing.pecosEnrollmentStatus enum includes UNKNOWN and UNCHECKED', () => {
    expect(CONTRACT_SRC).toMatch(/pecosEnrollmentStatus:\s*'ENROLLED'\s*\|\s*'NOT_FOUND'\s*\|\s*'UNKNOWN'\s*\|\s*'UNCHECKED'\s*\|\s*'OPTED_OUT'/);
  });

  it('standing.licensureStatus enum includes pending and unknown', () => {
    expect(CONTRACT_SRC).toMatch(/licensureStatus:\s*'verified'\s*\|\s*'pending'\s*\|\s*'expired'\s*\|\s*'unknown'/);
  });

  it('authority credential `stale` field is required (no optional staleness)', () => {
    // Required: `stale: boolean;` — NOT `stale?: boolean;`.
    expect(CONTRACT_SRC).toMatch(/\n\s+stale:\s+boolean;/);
    expect(CONTRACT_SRC).not.toMatch(/\n\s+stale\?:\s+boolean;/);
  });
});

describe('W3-PR209A — /api/passport/[npi] proxy route is fail-closed', () => {
  it('emits the invalid_upstream_payload discriminator on shape failure', () => {
    expect(PROXY_ROUTE_SRC).toContain("'invalid_upstream_payload'");
  });

  it('uses assertPassportData (not a silent normalize) at the boundary', () => {
    expect(PROXY_ROUTE_SRC).toContain('assertPassportData');
  });

  it('returns 503 with Passport unavailable on upstream timeout/error', () => {
    expect(PROXY_ROUTE_SRC).toContain("'Passport unavailable'");
    expect(PROXY_ROUTE_SRC).toContain('503');
  });

  it('uses no-store cache directive (no stale-passport leakage)', () => {
    expect(PROXY_ROUTE_SRC).toContain("cache: 'no-store'");
  });

  it('enforces an 8000ms upstream timeout', () => {
    expect(PROXY_ROUTE_SRC).toContain('AbortSignal.timeout(8000)');
  });
});

describe('W3-PR209A — banned-string scan on touched audit artifacts', () => {
  const auditMd = readFileSync(
    resolve(__dirname, '../../../docs/ops/passport-runtime-audit-w3-pr209a.md'),
    'utf8',
  );

  // Split-join sentinels so this file does not match itself.
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

  it.each(BANNED)('audit doc does not contain banned phrase: %s', (phrase) => {
    expect(auditMd).not.toContain(phrase);
  });
});
