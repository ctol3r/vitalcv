/**
 * ONE interpretation of "fresh enough" for a public route.
 *
 * Wave 1075 made `/` force-dynamic so the homepage rollback is a redeploy
 * rather than a rebuild. The route began answering
 *
 *   private, no-cache, no-store, max-age=0, must-revalidate
 *
 * which is ZERO staleness — strictly fresher than the 300s it replaced. Three
 * separate assertions called that a regression, because each had grown its own
 * idea of the contract and all three demanded the literal token `s-maxage`:
 * the vitest cache contract, the e2e header spec, and the deploy smoke test
 * that gates `vitalcv/web-deploy-converged` and `vitalcv/release-verified`.
 *
 * The contract is a bound on how long a SHARED cache may serve a stale copy.
 * Two shapes satisfy it and everything else fails:
 *
 *   bounded         — a finite shared lifetime within the documented maximum
 *   zero-staleness  — no-store, so no shared cache retains it at all
 *
 * This module is the single definition. It is `.mjs` so `deploy-smoke.mjs`
 * (plain node) and the TypeScript suites (allowJs) import the SAME code —
 * a second copy is how the three definitions diverged in the first place.
 */

/** The documented ceiling for shared staleness on a public route. */
export const MAX_SHARED_STALENESS_SECONDS = 300;

/**
 * @typedef {'bounded' | 'zero-staleness' | 'unsafe'} CacheVerdict
 * @typedef {object} CachePolicyResult
 * @property {CacheVerdict} verdict
 * @property {boolean} ok            true for bounded and zero-staleness
 * @property {number} sharedStalenessSeconds  Infinity when unbounded
 * @property {string} reason         one line, safe to print in CI output
 * @property {string} raw            the header as received
 */

/** Split a Cache-Control value into a directive map. */
function parseDirectives(raw) {
  /** @type {Map<string, string|true>} */
  const map = new Map();
  for (const part of String(raw).toLowerCase().split(',')) {
    const token = part.trim();
    if (!token) continue;
    const eq = token.indexOf('=');
    if (eq === -1) map.set(token, true);
    else map.set(token.slice(0, eq).trim(), token.slice(eq + 1).trim().replace(/^"|"$/g, ''));
  }
  return map;
}

function numeric(value) {
  if (value === undefined || value === true) return null;
  if (!/^\d+$/.test(value)) return null;
  return Number(value);
}

/**
 * Classify a Cache-Control header.
 *
 * @param {string | null | undefined} raw
 * @param {{ maxSharedSeconds?: number, personalized?: boolean }} [opts]
 *   `personalized` marks a response whose body varies per session. Such a
 *   response may never be held by a shared cache at all, however short the
 *   lifetime — a bounded-but-public session page is a cross-user leak, not a
 *   freshness question.
 * @returns {CachePolicyResult}
 */
export function classifyCachePolicy(raw, opts = {}) {
  const maxShared = opts.maxSharedSeconds ?? MAX_SHARED_STALENESS_SECONDS;
  const personalized = opts.personalized === true;
  const header = typeof raw === 'string' ? raw.trim() : '';

  const fail = (reason, staleness = Number.POSITIVE_INFINITY) => ({
    verdict: /** @type {CacheVerdict} */ ('unsafe'),
    ok: false,
    sharedStalenessSeconds: staleness,
    reason,
    raw: header,
  });

  if (!header) {
    return fail('no Cache-Control header — the caching contract is undeclared');
  }

  const d = parseDirectives(header);
  const noStore = d.has('no-store');
  const isPublic = d.has('public');
  const isPrivate = d.has('private');
  const sMaxAge = numeric(d.get('s-maxage'));
  const maxAge = numeric(d.get('max-age'));

  // An unparseable lifetime is not a lifetime.
  if (d.has('s-maxage') && sMaxAge === null) {
    return fail(`s-maxage is not a number: "${header}"`);
  }
  if (d.has('max-age') && maxAge === null) {
    return fail(`max-age is not a number: "${header}"`);
  }

  // Contradictions first — a response cannot both refuse storage and offer a
  // shared lifetime. Whichever a given cache honours, the author did not say.
  if (noStore && sMaxAge !== null && sMaxAge > 0) {
    return fail(`contradictory: no-store with s-maxage=${sMaxAge}`);
  }
  if (noStore && isPublic) {
    return fail('contradictory: no-store with public');
  }
  if (isPublic && isPrivate) {
    return fail('contradictory: public with private');
  }

  if (personalized) {
    // The only safe answer for a per-session body.
    if (noStore && !isPublic && (sMaxAge === null || sMaxAge === 0)) {
      return {
        verdict: 'zero-staleness',
        ok: true,
        sharedStalenessSeconds: 0,
        reason: 'personalized response is never stored by a shared cache',
        raw: header,
      };
    }
    return fail(
      `personalized response must be no-store and never public: "${header}"`,
      sMaxAge ?? maxAge ?? Number.POSITIVE_INFINITY,
    );
  }

  if (noStore) {
    return {
      verdict: 'zero-staleness',
      ok: true,
      sharedStalenessSeconds: 0,
      reason: 'no-store — no shared cache retains this response',
      raw: header,
    };
  }

  /*
   * With no s-maxage, max-age governs shared caches too. A response that is
   * explicitly `public` with NO lifetime at all is the unbounded case this
   * exists to catch.
   */
  const shared = sMaxAge ?? maxAge;

  if (shared === null) {
    return fail(
      isPublic
        ? 'public with no lifetime — shared staleness is unbounded'
        : `no shared lifetime and no no-store: "${header}"`,
    );
  }

  if (shared > maxShared) {
    return fail(`shared staleness ${shared}s exceeds the ${maxShared}s maximum`, shared);
  }

  return {
    verdict: 'bounded',
    ok: true,
    sharedStalenessSeconds: shared,
    reason: `bounded shared staleness of ${shared}s (max ${maxShared}s)`,
    raw: header,
  };
}

/**
 * Convenience for callers that only need the boolean.
 * @param {string | null | undefined} raw
 * @param {{ maxSharedSeconds?: number, personalized?: boolean }} [opts]
 */
export function isAcceptableCachePolicy(raw, opts) {
  return classifyCachePolicy(raw, opts).ok;
}
