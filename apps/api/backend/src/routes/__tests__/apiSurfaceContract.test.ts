/**
 * The API's anonymous surface is exactly what `scripts/lib/apiSurfaceContract.mjs`
 * declares — enforced against the REAL app, on every PR.
 *
 * WHY THIS FILE AND NOT JUST THE PROBE. `scripts/api-surface-probe.mjs` runs
 * post-deploy against production, so no PR check executes it. On this repo that
 * is a known way to ship something broken with a green board: PR #832 landed
 * `scripts/deploy-health-probe.sh` at 5/5 green while the script could not run
 * at all. A probe whose expectations nothing verifies is the same class of
 * artifact as the script it replaces. This test verifies them, by booting the
 * app the way `sourceRuntimePublic.test.ts` and `versionReachability.test.ts`
 * do — the standard route-test idiom (mount a router on a bare `express()`) is
 * structurally blind to the globally-mounted tenant guard, which is the only
 * thing that decides any of this.
 *
 * WHAT IT ASSERTS
 *  1. Every route the probe calls PUBLIC is reachable anonymously.
 *  2. Every route the probe calls GUARDED answers 401 organization_context_required.
 *  3. THE CENSUS — no parameterless GET route answers 200 to an anonymous
 *     caller unless it is written down in the contract. This is the closure:
 *     `shouldSkipTenantContext` is a list of prefixes, so a two-line diff can
 *     open a dozen routes at once, and nothing before this noticed.
 *
 * OUTCOME, NOT MECHANISM. Nothing here names the skip list. The assertions are
 * about what a caller receives, so they keep holding if the guard is
 * reimplemented, re-ordered, or replaced — and go red only if the surface
 * actually moves. The one exception is the route ENUMERATION, which must read
 * Express internals because there is no other way to ask "what is mounted".
 */
import request from 'supertest';

import app from '../../app';
import { shouldSkipTenantContext } from '../../middleware/tenantGuard';
import {
  ANONYMOUS_CENSUS,
  PROBE_GUARDED,
  PROBE_PUBLIC,
  TENANT_GUARD_ERROR,
  settledCensusPaths,
  transitionalCensusEntries,
  // Authored as CommonJS so this suite and the ESM probe read the SAME file
  // rather than two copies that will eventually disagree. See its header.
} from '../../../../../../scripts/lib/apiSurfaceContract.cjs';

// Module init (trust-list ingestion, detail-agent setup) dominates; the ~130
// requests themselves were measured at ~2.5s in total.
jest.setTimeout(300_000);

/**
 * Every parameterless GET path Express has actually mounted.
 *
 * Reads the router stack rather than grepping app.ts: routes arrive through
 * ~60 `registerXRoutes` helpers plus nested `express.Router()` mounts, and a
 * grep would miss whichever one is added next — which is exactly the route
 * this test needs to catch.
 */
function registeredParameterlessGetPaths(): string[] {
  const paths = new Set<string>();
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const walk = (stack: any[], prefix: string): void => {
    for (const layer of stack ?? []) {
      if (layer.route?.path) {
        if (!layer.route.methods?.get) continue;
        const list = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
        for (const one of list) paths.add(`${prefix}${one}`);
      } else if (layer.name === 'router' && layer.handle?.stack) {
        const source = layer.regexp?.source ?? '';
        const mount = /^\^\\\/(.*?)\\\/\?\(\?=\\\/\|\$\)$/.exec(source);
        walk(layer.handle.stack, `${prefix}${mount ? `/${mount[1].replace(/\\\//g, '/')}` : ''}`);
      }
    }
  };
  walk((app as any)._router?.stack ?? [], '');
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return [...paths].filter((p) => !p.includes(':') && !p.includes('*')).sort();
}

type PublicEntry = { path: string; expect: number[]; keys?: string[] };

const PUBLIC_ENTRIES: Array<[string, PublicEntry]> = (PROBE_PUBLIC as PublicEntry[]).map((entry) => [
  entry.path,
  entry,
]);
const PUBLIC_WITH_KEYS = PUBLIC_ENTRIES.filter(([, entry]) => Boolean(entry.keys));

describe('the routes the production probe calls PUBLIC are reachable anonymously', () => {
  it.each(PUBLIC_ENTRIES)('%s answers without an organization', async (path, entry) => {
    const res = await request(app).get(path);

    // Named separately from the status assertion because the diagnosis is
    // different: a 401 here means the skip list lost an entry, and the
    // handler — which will look perfectly healthy — is the wrong place to
    // start reading.
    expect(res.body?.error).not.toBe(TENANT_GUARD_ERROR);
    expect(entry.expect).toContain(res.status);
  });

  it.each(PUBLIC_WITH_KEYS)('%s publishes the payload keys the probe asserts', async (path, entry) => {
    const res = await request(app).get(path);

    // Keeps the probe's shape assertions honest: if a payload key is renamed,
    // this goes red on the PR instead of the probe going red post-deploy,
    // where it reads as an outage.
    for (const key of entry.keys ?? []) {
      expect(res.body).toHaveProperty(key);
    }
  });
});

describe('the routes the production probe calls GUARDED refuse anonymously', () => {
  it.each(PROBE_GUARDED.map((entry: { path: string }) => entry.path))(
    '%s answers 401 organization_context_required',
    async (path: string) => {
      const res = await request(app).get(path);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe(TENANT_GUARD_ERROR);
    },
  );
});

describe('the anonymous census is an upper bound on what the API publishes', () => {
  /**
   * The closure. Anything answering 200 anonymously must be written down.
   *
   * Upper bound, deliberately: a declared route that has since CLOSED does not
   * fail here. Closing a route is the safe direction, and a test that punished
   * it would quietly pressure the next person to reopen one to get green.
   * Stale entries are swept by the `settled` test below instead.
   */
  it('publishes no parameterless GET route that the contract has not declared', async () => {
    const declared = new Set<string>(ANONYMOUS_CENSUS.map((entry: { path: string }) => entry.path));
    const candidates = registeredParameterlessGetPaths().filter((path) =>
      shouldSkipTenantContext(path),
    );

    const undeclared: string[] = [];
    for (const path of candidates) {
      if (declared.has(path)) continue;
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).get(path);
      if (res.status === 200) undeclared.push(path);
    }

    expect({
      undeclared,
      hint:
        undeclared.length === 0
          ? 'ok'
          : 'These answer 200 to an anonymous caller and are not in ANONYMOUS_CENSUS. '
            + 'If that is intended, add them to scripts/lib/apiSurfaceContract.cjs so the exposure is '
            + 'reviewable in the diff. If it is not, the tenant-guard skip list was widened further '
            + 'than intended — narrow the prefix rather than adding entries here.',
    }).toEqual({ undeclared: [], hint: 'ok' });
  });

  it('sweeps a surface large enough for that bound to mean something', () => {
    // A guard that silently stopped enumerating would pass the test above with
    // an empty candidate list. 119 skip-listed parameterless GET routes were
    // measured on 2026-08-11; the floor is deliberately loose because routes
    // come and go, and tight enough that "found nothing" cannot pass.
    const candidates = registeredParameterlessGetPaths().filter((path) =>
      shouldSkipTenantContext(path),
    );
    expect(candidates.length).toBeGreaterThan(80);
  });

  it('carries no stale census entries — every settled path still answers 200', async () => {
    const stale: string[] = [];
    for (const path of settledCensusPaths()) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).get(path);
      if (res.status !== 200) stale.push(`${path} → ${res.status}`);
    }

    // Keeps the upper bound from rotting into a wishlist. A route that closed
    // on purpose should be DELETED from the census in the same PR that closed
    // it, so the file keeps describing the surface rather than its history.
    expect(stale).toEqual([]);
  });

  it('holds at most one transitional entry, and it names the PR that closes it', () => {
    // Annotated rather than inferred: with the slot empty, TypeScript narrows
    // the census to `{ path: string }[]` and `transitional` stops existing as
    // a property — so this test would fail to COMPILE the moment it is
    // actually needed, which is the one moment it must work.
    const transitional: Array<{ path: string; transitional?: string }> =
      transitionalCensusEntries();

    // `transitional` is a declared exposure that has not landed yet — a claim
    // with an expiry, not a quarantine slot. The web app's STALE list is what
    // happens when a tolerance list has no ceiling; the backend jest
    // quarantine has one only because a doc tracks every entry. One is enough
    // for the single in-flight case (#1360) and low enough that a second
    // forces a conversation.
    expect(transitional.length).toBeLessThanOrEqual(1);
    for (const entry of transitional) {
      expect(entry.transitional).toMatch(/^#\d+$/);
    }
  });
});

describe('the census excludes what it cannot honestly sweep', () => {
  it('states its own limit: parameterized routes are not covered', () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const all = new Set<string>();
    const walk = (stack: any[], prefix: string): void => {
      for (const layer of stack ?? []) {
        if (layer.route?.path) {
          if (!layer.route.methods?.get) continue;
          const list = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
          for (const one of list) all.add(`${prefix}${one}`);
        } else if (layer.name === 'router' && layer.handle?.stack) {
          const source = layer.regexp?.source ?? '';
          const mount = /^\^\\\/(.*?)\\\/\?\(\?=\\\/\|\$\)$/.exec(source);
          walk(layer.handle.stack, `${prefix}${mount ? `/${mount[1].replace(/\\\//g, '/')}` : ''}`);
        }
      }
    };
    walk((app as any)._router?.stack ?? [], '');
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const parameterized = [...all].filter((p) => p.includes(':') || p.includes('*'));

    // Not a passing grade — a receipt. Their status depends on seeded data, so
    // sweeping them would make this test data-dependent and flaky. They are
    // the larger untested surface (`/api/passport/:npi/export` lives here),
    // and this assertion exists so the number is printed in the run rather
    // than the gap being silently absent. A silent cap reads as coverage.
    expect(parameterized.length).toBeGreaterThan(0);
  });
});
