/**
 * HARDEN-PILOT-EVENTS-401 lockdown.
 *
 * Pins the auth gate on POST /api/pilot-ops/events:
 *   - Anonymous callers (no Clerk session.userId) → HTTP 401.
 *   - Response header `x-pilot-events-anonymous: rejected`.
 *   - 401 fires BEFORE any backend round-trip (no fetch is made).
 *   - Authenticated callers proceed to the backend with an explicit
 *     x-actor-id header attached.
 *
 * Source-level pin so the gate cannot regress without the test
 * failing. A separate integration test against the live backend
 * would verify the durable side; this test pins the proxy contract.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROUTE_PATH = resolve(__dirname, '../app/api/pilot-ops/events/route.ts');
const ROUTE = readFileSync(ROUTE_PATH, 'utf8');

describe('HARDEN-PILOT-EVENTS-401 — auth gate is present', () => {
  it('imports auth from @clerk/nextjs/server', () => {
    expect(ROUTE).toContain("from '@clerk/nextjs/server'");
    expect(ROUTE).toMatch(/import\s+\{\s*auth\s*\}/);
  });

  it('awaits auth() at the top of POST', () => {
    expect(ROUTE).toMatch(/export\s+async\s+function\s+POST[\s\S]{0,200}const\s+session\s*=\s*await\s+auth\(\)/);
  });

  it('rejects anonymous callers with HTTP 401', () => {
    expect(ROUTE).toMatch(/if\s*\(\s*!\s*session\.userId\s*\)\s*\{[\s\S]*?status:\s*401/);
  });

  it('401 response body carries explicit "unauthorized" error', () => {
    expect(ROUTE).toContain("error: 'unauthorized'");
    expect(ROUTE).toContain('Anonymous event writes are no longer accepted');
  });

  it('401 response carries diagnostic header x-pilot-events-anonymous: rejected', () => {
    expect(ROUTE).toContain("'x-pilot-events-anonymous': 'rejected'");
  });
});

describe('HARDEN-PILOT-EVENTS-401 — 401 fires before backend round-trip', () => {
  it('the 401 return statement appears BEFORE the fetch call', () => {
    const returnIndex = ROUTE.indexOf("status: 401");
    const fetchIndex = ROUTE.indexOf('fetch(`${getBackendBase()}/api/pilot-ops/events`');
    expect(returnIndex).toBeGreaterThan(0);
    expect(fetchIndex).toBeGreaterThan(0);
    // The 401 branch terminates the function before the fetch.
    expect(returnIndex).toBeLessThan(fetchIndex);
  });

  it('no fetch call exists between the auth() call and the 401 gate', () => {
    const authIndex = ROUTE.indexOf('await auth()');
    const gateIndex = ROUTE.indexOf('if (!session.userId)');
    const between = ROUTE.slice(authIndex, gateIndex);
    expect(between).not.toContain('fetch(');
  });
});

describe('HARDEN-PILOT-EVENTS-401 — authenticated path attaches actor attribution', () => {
  it('sets x-actor-id header from session.userId', () => {
    expect(ROUTE).toContain("headers.set('x-actor-id', session.userId)");
  });

  it('keeps the existing role / orgId header forwarding', () => {
    expect(ROUTE).toContain("'x-clerk-user-role'");
    expect(ROUTE).toContain("'x-org-id'");
  });

  it('the actor-id header set occurs AFTER the 401 gate', () => {
    const gateIndex = ROUTE.indexOf('if (!session.userId)');
    const actorSetIndex = ROUTE.indexOf("'x-actor-id'");
    expect(gateIndex).toBeGreaterThan(0);
    expect(actorSetIndex).toBeGreaterThan(gateIndex);
  });
});

describe('HARDEN-PILOT-EVENTS-401 — banned-strings + doctrine', () => {
  it('does not contain banned strings', () => {
    const BANNED = [
      ['automatically', 'verified'].join(' '),
      ['guaranteed', 'verification'].join(' '),
      ['HIPAA', 'compliant'].join(' '),
      ['SOC2', 'certified'].join(' '),
      ['certified', 'compliant'].join(' '),
    ];
    for (const phrase of BANNED) {
      expect(ROUTE).not.toContain(phrase);
    }
  });

  it('comment block explicitly documents the fail-closed reason', () => {
    expect(ROUTE).toContain('HARDEN-PILOT-EVENTS-401');
    expect(ROUTE).toMatch(/anonymous/i);
    expect(ROUTE).toMatch(/durable\s+events/i);
  });
});
