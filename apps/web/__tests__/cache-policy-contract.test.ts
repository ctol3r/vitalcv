/**
 * The ONE cache-policy interpretation — Wave 1076.
 *
 * Wave 1075 made `/` force-dynamic (so the homepage rollback is a redeploy
 * rather than a rebuild). The route began answering
 * `private, no-cache, no-store, max-age=0, must-revalidate` — zero staleness,
 * strictly fresher than the 300s it replaced — and three separate assertions
 * called it a regression, because each demanded the literal token `s-maxage`.
 * The deploy smoke test was one of them, so `vitalcv/web-deploy-converged`
 * went red on a deployment that had, in fact, converged.
 *
 * These pin the shared parser that all of them now use, including the two
 * shapes that pass and the five that must not.
 */

import { describe, expect, it } from 'vitest';

import {
  MAX_SHARED_STALENESS_SECONDS,
  classifyCachePolicy,
  isAcceptableCachePolicy,
} from '../../../scripts/lib/cachePolicy.mjs';

describe('accepted: bounded shared caching', () => {
  it('2. public, s-maxage=300 passes as bounded', () => {
    const r = classifyCachePolicy('public, s-maxage=300');
    expect(r.verdict).toBe('bounded');
    expect(r.ok).toBe(true);
    expect(r.sharedStalenessSeconds).toBe(300);
  });

  it('accepts anything under the documented maximum', () => {
    for (const seconds of [1, 60, 299, MAX_SHARED_STALENESS_SECONDS]) {
      expect(classifyCachePolicy(`public, s-maxage=${seconds}`).ok, `${seconds}s`).toBe(true);
    }
  });

  it('treats max-age as the shared lifetime when s-maxage is absent', () => {
    // HTTP-correct: with no s-maxage, shared caches honour max-age.
    expect(classifyCachePolicy('public, max-age=120').verdict).toBe('bounded');
    expect(classifyCachePolicy('public, max-age=86400').ok).toBe(false);
  });

  it('prefers s-maxage over max-age when both are present', () => {
    expect(classifyCachePolicy('public, max-age=86400, s-maxage=60').sharedStalenessSeconds).toBe(60);
    expect(classifyCachePolicy('public, max-age=60, s-maxage=86400').ok).toBe(false);
  });
});

describe('accepted: zero-staleness delivery', () => {
  it('1. the production homepage header passes', () => {
    // Exactly what `/` returns today.
    const r = classifyCachePolicy('private, no-cache, no-store, max-age=0, must-revalidate');
    expect(r.verdict).toBe('zero-staleness');
    expect(r.ok).toBe(true);
    expect(r.sharedStalenessSeconds).toBe(0);
  });

  it('accepts a bare no-store', () => {
    expect(classifyCachePolicy('no-store').verdict).toBe('zero-staleness');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(classifyCachePolicy('  NO-STORE ,  Private  ').ok).toBe(true);
    expect(classifyCachePolicy('PUBLIC, S-MAXAGE=300').verdict).toBe('bounded');
  });
});

describe('rejected: everything that is not one of those two shapes', () => {
  it('4. public with no lifetime fails', () => {
    const r = classifyCachePolicy('public');
    expect(r.ok).toBe(false);
    expect(r.sharedStalenessSeconds).toBe(Number.POSITIVE_INFINITY);
    expect(r.reason).toMatch(/unbounded/i);
  });

  it('3. an excessive s-maxage fails', () => {
    const r = classifyCachePolicy('public, s-maxage=86400');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/exceeds/i);
  });

  it('5. no-store together with public and s-maxage is contradictory', () => {
    const r = classifyCachePolicy('no-store, public, s-maxage=300');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/contradictor/i);
  });

  it('rejects each contradiction on its own', () => {
    expect(classifyCachePolicy('no-store, s-maxage=300').reason).toMatch(/contradictor/i);
    expect(classifyCachePolicy('no-store, public').reason).toMatch(/contradictor/i);
    expect(classifyCachePolicy('public, private, max-age=60').reason).toMatch(/contradictor/i);
  });

  it('6. a missing or empty header fails', () => {
    for (const absent of [undefined, null, '', '   ']) {
      const r = classifyCachePolicy(absent as string | undefined);
      expect(r.ok, JSON.stringify(absent)).toBe(false);
      expect(r.reason).toMatch(/undeclared|no Cache-Control/i);
    }
  });

  it('fails an uninterpretable lifetime rather than reading it as zero', () => {
    expect(classifyCachePolicy('public, s-maxage=abc').ok).toBe(false);
    expect(classifyCachePolicy('public, max-age=').ok).toBe(false);
    expect(classifyCachePolicy('gibberish').ok).toBe(false);
  });

  it('fails a lifetime-free private response — it declares nothing about sharing', () => {
    // `private` alone is a hint, not a contract: no directive forbids storage
    // and none bounds it.
    expect(classifyCachePolicy('private').ok).toBe(false);
  });
});

describe('7. a personalized response may never be publicly cached', () => {
  it('accepts private + no-store', () => {
    const r = classifyCachePolicy('private, no-cache, no-store, max-age=0, must-revalidate', {
      personalized: true,
    });
    expect(r.verdict).toBe('zero-staleness');
  });

  it('rejects a public bounded lifetime even though it would pass for a public route', () => {
    expect(classifyCachePolicy('public, s-maxage=300').ok).toBe(true);
    const r = classifyCachePolicy('public, s-maxage=300', { personalized: true });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/personalized/i);
  });

  it('rejects a short shared lifetime — brevity is not isolation', () => {
    expect(classifyCachePolicy('s-maxage=1', { personalized: true }).ok).toBe(false);
    expect(classifyCachePolicy('max-age=1', { personalized: true }).ok).toBe(false);
  });

  it('rejects a missing header', () => {
    expect(classifyCachePolicy(undefined, { personalized: true }).ok).toBe(false);
  });
});

describe('the maximum is configurable but defaults to the documented one', () => {
  it('defaults to 300s', () => {
    expect(MAX_SHARED_STALENESS_SECONDS).toBe(300);
    expect(classifyCachePolicy('public, s-maxage=301').ok).toBe(false);
  });

  it('honours an explicit ceiling', () => {
    expect(classifyCachePolicy('public, s-maxage=600', { maxSharedSeconds: 900 }).ok).toBe(true);
    expect(classifyCachePolicy('public, s-maxage=600', { maxSharedSeconds: 60 }).ok).toBe(false);
  });
});

describe('the boolean helper agrees with the classifier', () => {
  it('never disagrees', () => {
    for (const header of [
      'public, s-maxage=300', 'no-store', 'public', 'public, s-maxage=86400',
      'no-store, public, s-maxage=300', '', 'private',
    ]) {
      expect(isAcceptableCachePolicy(header)).toBe(classifyCachePolicy(header).ok);
    }
  });
});
