import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_MIN_AGE_MS,
  isOlderThan,
  isSyntheticOrg,
  isSyntheticUser,
  reconcileSynthetics,
  SYNTHETIC_EMAIL_RE,
  type ClerkUserLike,
} from '../lib/release-monitor/reconcileSynthetics';

/**
 * This suite guards a sweep that DELETES USERS FROM PRODUCTION CLERK. The
 * tests that matter most are the refusals, not the reaps.
 */

const HOUR = 60 * 60 * 1000;
const NOW = 1_800_000_000_000;
const OLD = NOW - 5 * HOUR;

function syntheticUser(over: Partial<ClerkUserLike> = {}): ClerkUserLike {
  return {
    id: 'user_synth',
    created_at: OLD,
    email_addresses: [{ email_address: 'svc-monitor+run123@vitalcv.com' }],
    public_metadata: { synthetic: true, purpose: 'release-monitor' },
    ...over,
  };
}

describe('isSyntheticUser — the predicate that authorises a production delete', () => {
  it('accepts the exact shape mintClinicianSession writes', () => {
    expect(isSyntheticUser(syntheticUser())).toBe(true);
  });

  // Each of these is a real user that a sloppier (disjunctive) predicate would delete.
  it.each([
    ['a real user with no metadata', { public_metadata: null }],
    ['a real user with an empty metadata object', { public_metadata: {} }],
    ['synthetic:true but wrong purpose', { public_metadata: { synthetic: true, purpose: 'load-test' } }],
    ['right purpose but synthetic not true', { public_metadata: { synthetic: 'yes', purpose: 'release-monitor' } }],
    ['synthetic metadata but a REAL email', {
      email_addresses: [{ email_address: 'chris@vitalcv.com' }],
    }],
    ['synthetic metadata but a lookalike email on another domain', {
      email_addresses: [{ email_address: 'svc-monitor+x@evil.com' }],
    }],
    ['synthetic metadata but no email at all', { email_addresses: [] }],
    ['a synthetic address PLUS a real one (account was reused)', {
      email_addresses: [
        { email_address: 'svc-monitor+run123@vitalcv.com' },
        { email_address: 'realperson@vitalcv.com' },
      ],
    }],
  ])('refuses %s', (_label, over) => {
    expect(isSyntheticUser(syntheticUser(over as Partial<ClerkUserLike>))).toBe(false);
  });

  it('does not match a plausible human address that merely contains the prefix', () => {
    expect(SYNTHETIC_EMAIL_RE.test('svc-monitor@vitalcv.com')).toBe(false); // no plus tag
    expect(SYNTHETIC_EMAIL_RE.test('not-svc-monitor+x@vitalcv.com')).toBe(false);
    expect(SYNTHETIC_EMAIL_RE.test('svc-monitor+x@vitalcv.com.attacker.net')).toBe(false);
  });
});

describe('isOlderThan — unknown age must never authorise a delete', () => {
  it.each([undefined, Number.NaN, Number.POSITIVE_INFINITY])('treats %s as not-old-enough', (v) => {
    expect(isOlderThan(v as number | undefined, NOW, DEFAULT_MIN_AGE_MS)).toBe(false);
  });

  it('protects an identity from a run happening right now', () => {
    expect(isOlderThan(NOW - 60_000, NOW, DEFAULT_MIN_AGE_MS)).toBe(false);
  });

  it('releases one comfortably past the grace window', () => {
    expect(isOlderThan(OLD, NOW, DEFAULT_MIN_AGE_MS)).toBe(true);
  });
});

describe('isSyntheticOrg', () => {
  it('matches the vcv-monitor- name the mint path writes', () => {
    expect(isSyntheticOrg({ id: 'o', name: 'vcv-monitor-abc' })).toBe(true);
  });
  it('refuses a real org and a non-string name', () => {
    expect(isSyntheticOrg({ id: 'o', name: 'Mercy General Hospital' })).toBe(false);
    expect(isSyntheticOrg({ id: 'o', name: 42 })).toBe(false);
  });
});

// ── the sweep itself ────────────────────────────────────────────────────────

function fetchStub(users: ClerkUserLike[], orgs: unknown[] = []) {
  const deleted: string[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? 'GET';
    if (method === 'DELETE') {
      deleted.push(u);
      return new Response('{}', { status: 200 });
    }
    if (u.includes('/v1/users')) {
      return new Response(JSON.stringify(u.includes('offset=0') ? users : []), { status: 200 });
    }
    return new Response(JSON.stringify(u.includes('offset=0') ? orgs : []), { status: 200 });
  });
  return { impl: impl as unknown as typeof fetch, deleted };
}

describe('reconcileSynthetics', () => {
  it('deletes a stale synthetic user and leaves every real user alone', async () => {
    const real = { id: 'user_real', created_at: OLD, email_addresses: [{ email_address: 'a@b.com' }], public_metadata: {} };
    const { impl, deleted } = fetchStub([syntheticUser(), real]);
    const r = await reconcileSynthetics({ clerkSecretKey: 'sk', fetchImpl: impl, now: () => NOW });

    expect(r.ok).toBe(true);
    expect(r.deletedUsers).toBe(1);
    expect(deleted).toHaveLength(1);
    expect(deleted[0]).toContain('user_synth');
    expect(deleted.join()).not.toContain('user_real');
  });

  it('never deletes an identity inside the age grace — the live-run guard', async () => {
    const { impl, deleted } = fetchStub([syntheticUser({ id: 'user_live', created_at: NOW - 60_000 })]);
    const r = await reconcileSynthetics({ clerkSecretKey: 'sk', fetchImpl: impl, now: () => NOW });

    expect(r.staleUsers).toBe(0);
    expect(r.deletedUsers).toBe(0);
    expect(deleted).toHaveLength(0);
  });

  it('dry run classifies without issuing a single DELETE', async () => {
    const { impl, deleted } = fetchStub([syntheticUser()]);
    const r = await reconcileSynthetics({ clerkSecretKey: 'sk', fetchImpl: impl, now: () => NOW, dryRun: true });

    expect(r.staleUsers).toBe(1);
    expect(r.deletedUsers).toBe(0);
    expect(deleted).toHaveLength(0);
  });

  it('caps deletions per run and reports the remainder instead of dropping it', async () => {
    const many = Array.from({ length: 5 }, (_, i) => syntheticUser({ id: `user_${i}` }));
    const { impl, deleted } = fetchStub(many);
    const r = await reconcileSynthetics({ clerkSecretKey: 'sk', fetchImpl: impl, now: () => NOW, maxDeletes: 2 });

    expect(r.deletedUsers).toBe(2);
    expect(deleted).toHaveLength(2);
    expect(r.skippedForCap).toBe(3);
  });

  it('reports a failure without throwing when Clerk rejects the list call', async () => {
    const impl = vi.fn(async () => new Response('nope', { status: 401 })) as unknown as typeof fetch;
    const r = await reconcileSynthetics({ clerkSecretKey: 'sk', fetchImpl: impl, now: () => NOW });

    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toContain('401');
    expect(r.deletedUsers).toBe(0);
  });

  it('refuses to run at all without a key, and issues no requests', async () => {
    const impl = vi.fn() as unknown as typeof fetch;
    const r = await reconcileSynthetics({ clerkSecretKey: '  ', fetchImpl: impl });

    expect(r.ok).toBe(false);
    expect(r.problems[0]).toContain('CLERK_SECRET_KEY');
    expect(impl).not.toHaveBeenCalled();
  });

  it('treats a 404 on delete as already-gone rather than a failure', async () => {
    const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'DELETE') return new Response('', { status: 404 });
      return new Response(JSON.stringify(String(url).includes('offset=0') && String(url).includes('/v1/users') ? [syntheticUser()] : []), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await reconcileSynthetics({ clerkSecretKey: 'sk', fetchImpl: impl, now: () => NOW });

    expect(r.ok).toBe(true);
    expect(r.deletedUsers).toBe(1);
  });
});

describe('the predicate is pinned to the mint path, not to prose', () => {
  /**
   * The whole reason this sweep did not exist for months is that the doc
   * described an email shape (`@vitalcv-monitor.local`) the code never wrote.
   * A sweep built from that doc silently matches nothing. This test reads the
   * actual writer and fails if the two drift apart again.
   */
  const mintSrc = fs.readFileSync(
    path.join(process.cwd(), 'lib/release-monitor/syntheticClinician.ts'),
    'utf8',
  );

  it('the email template the mint path writes satisfies SYNTHETIC_EMAIL_RE', () => {
    const m = mintSrc.match(/const email = `([^`]+)`/);
    expect(m, 'could not find the synthetic email template in syntheticClinician.ts').toBeTruthy();
    const concrete = m![1].replace(/\$\{[^}]+\}/g, 'run123');
    expect(SYNTHETIC_EMAIL_RE.test(concrete), `mint writes "${concrete}" which the sweep would NOT match`).toBe(true);
  });

  it('the mint path still stamps the metadata the predicate requires', () => {
    expect(mintSrc).toContain('synthetic: true');
    expect(mintSrc).toContain("purpose: 'release-monitor'");
  });

  it('the org name template the mint path writes is matched by isSyntheticOrg', () => {
    const m = mintSrc.match(/name: `(vcv-[^`]+)`/);
    expect(m, 'could not find the synthetic org name template').toBeTruthy();
    expect(isSyntheticOrg({ id: 'o', name: m![1].replace(/\$\{[^}]+\}/g, 'run123') })).toBe(true);
  });
});
