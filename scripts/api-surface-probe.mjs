#!/usr/bin/env node
/**
 * api-surface-probe.mjs — secretless production probe for the API SERVICE.
 *
 * THE GAP THIS CLOSES. Before this, the API service had exactly one production
 * assertion: `deploy-api.yml` polled `/health` until `git_sha` matched. One
 * route. Everything else that looks like API coverage is the WEB container —
 * `scripts/deploy-smoke.mjs` and `prod-auth-health.yml` both read
 * `vitalcv.com/api/version`, which is a Next route on a different service and
 * says nothing about this one. `scripts/deploy-health-probe.sh` reads only
 * `/api/internal/source-health/*` and needs a secret.
 *
 * WHAT IT ASSERTS, AND WHY THAT SHAPE.
 * `requireTenantContextOrReadAccess` is mounted globally before every route, so
 * an external prober cannot exercise the API's authenticated surface at all
 * without credentials this script deliberately does not have. Rather than fake
 * that, the probe asserts the two things an anonymous caller CAN prove:
 *
 *   1. The declared public surface still answers  (it did not silently close)
 *   2. The guarded surface still refuses          (it did not silently OPEN)
 *
 * (2) is the half that matters most and the half the deleted
 * `scripts/verifyProduction.ts` had backwards: it demanded HTTP 200 from
 * `/api/compliance/summary`, `/api/security/posture` and `/api/version`, which
 * the guard makes unreachable, so it could only ever fail. This script asserts
 * the 401 as the contract. If someone widens the tenant-guard skip list and
 * ships it, this goes red against production.
 *
 * NOT A SECURITY PROBE. Every request is a plain anonymous GET. No forged
 * headers, no credentials, no POST, nothing that mutates. (verifyProduction.ts
 * POSTed a real monitoring sweep and asserted rows were written to the
 * production database, while calling itself a "dry run".) Widening coverage by
 * handing CI a production DATABASE_URL or MONITORING_SECRET is not on the
 * table — the point of a secretless probe is that it can run on every deploy.
 *
 * WHAT IT CANNOT TELL YOU. That the API works. Nothing here exercises an
 * authenticated read, a write, or any tenant-scoped behaviour, and no
 * post-deploy probe of a guarded service can. Green here means "the deployed
 * container is the commit we built, its database answers, and its public
 * boundary is where we left it" — no more.
 *
 *   node scripts/api-surface-probe.mjs [--base https://api.vitalcv.com]
 *                                      [--sha <expected>] [--json]
 *                                      [--receipt <path>]
 */

import {
  EXPECTED_NODE_MAJOR,
  PROBE_GUARDED,
  PROBE_PUBLIC,
  TENANT_GUARD_ERROR,
  isTenantGuardRejection,
  // CommonJS on purpose — the backend jest suite reads the same file and
  // cannot parse ESM. See the header of apiSurfaceContract.cjs.
} from './lib/apiSurfaceContract.cjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = opt('--base', process.env.API_PROBE_BASE || 'https://api.vitalcv.com').replace(/\/$/, '');
const EXPECTED_SHA = opt('--sha', process.env.EXPECTED_SHA || '').toLowerCase();

const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

/**
 * Unique per request. A shared cache in front of the API could otherwise
 * answer a guarded path from a warm entry and make an exposure look closed —
 * or serve the previous release's /health and make a failed deploy look
 * landed. Same reasoning as deploy-smoke.mjs.
 */
const bust = (path) =>
  `${BASE}${path}${path.includes('?') ? '&' : '?'}probe=${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function get(path) {
  const response = await fetch(bust(path), {
    // No auth headers, by design — see the header comment. The probe's whole
    // claim is about what an ANONYMOUS caller sees, so sending anything that
    // could be read as a credential would invalidate the result.
    headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'vitalcv-api-surface-probe' },
    redirect: 'manual',
  });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* non-JSON is a finding for the routes that must return JSON; reported below */
  }
  return { status: response.status, body, text };
}

try {
  // ---------------------------------------------------------------------
  // 1. Identity of the running container.
  // ---------------------------------------------------------------------
  const health = await get('/health');
  const healthOk = health.status === 200 && health.body?.status === 'ok';
  record('health: HTTP 200 + status ok', healthOk, `HTTP ${health.status}`);

  if (EXPECTED_SHA) {
    const served = String(health.body?.git_sha ?? '').toLowerCase();
    // deploy-api.yml has already waited for this SHA before this script runs,
    // so this is a cross-check rather than a race: it catches a container that
    // rolled back or restarted onto an older build between the wait and here.
    const ok = served === EXPECTED_SHA;
    record(
      'health: serving the expected commit',
      ok,
      `serving ${served.slice(0, 12) || '<none>'} vs expected ${EXPECTED_SHA.slice(0, 12)}`,
    );
  } else {
    record('health: git_sha published', Boolean(health.body?.git_sha), String(health.body?.git_sha ?? '<none>'));
  }

  // The container's Node major. nixpacks.toml documents an outage that turned
  // on this exact number and tells readers to trust this reading over its own
  // comment; until now nothing read it. Major only — see EXPECTED_NODE_MAJOR.
  const nodeVersion = String(health.body?.node_version ?? '');
  const nodeMajor = Number(/^v(\d+)\./.exec(nodeVersion)?.[1] ?? NaN);
  record(
    `health: Node major ${EXPECTED_NODE_MAJOR}`,
    nodeMajor === EXPECTED_NODE_MAJOR,
    `${nodeVersion || '<none>'} (a drop to 20 is the ERR_REQUIRE_ESM outage; a jump is an unreviewed toolchain change)`,
  );

  // ---------------------------------------------------------------------
  // 2. The declared public surface still answers.
  // ---------------------------------------------------------------------
  for (const entry of PROBE_PUBLIC) {
    const res = await get(entry.path);
    const statusOk = entry.expect.includes(res.status);
    // The specific failure worth naming: the guard ate a route that is
    // supposed to be public. "HTTP 401" alone sends people to read the
    // handler, which will be fine, and the skip list is where the bug is.
    const guardAte = isTenantGuardRejection(res.status, res.body);
    record(
      `public ${entry.path}`,
      statusOk,
      guardAte
        ? `HTTP 401 ${TENANT_GUARD_ERROR} — the tenant guard rejected a route declared public; check shouldSkipTenantContext, not the handler`
        : `HTTP ${res.status} (allowed: ${entry.expect.join('/')})`,
    );

    if (statusOk && entry.keys) {
      const missing = entry.keys.filter((key) => !(res.body && key in res.body));
      record(`public ${entry.path}: payload shape`, missing.length === 0, missing.length ? `missing ${missing.join(', ')}` : entry.keys.join(', '));
    }

    if (statusOk && entry.values) {
      const mismatched = Object.entries(entry.values).filter(
        ([key, expected]) => !res.body || !Object.is(res.body[key], expected),
      );
      record(
        `public ${entry.path}: payload values`,
        mismatched.length === 0,
        mismatched.length
          ? mismatched
              .map(([key, expected]) => `${key}=${JSON.stringify(res.body?.[key])} (expected ${JSON.stringify(expected)})`)
              .join(', ')
          : Object.entries(entry.values)
              .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
              .join(', '),
      );
    }
  }

  // ---------------------------------------------------------------------
  // 2b. The container agrees with itself about which commit it is.
  //
  // `/health` reads RAILWAY_GIT_COMMIT_SHA per request; `/api/version` reads a
  // five-deep fallback chain (COMMIT_HASH → GIT_COMMIT_HASH →
  // RAILWAY_GIT_COMMIT_SHA → GITHUB_SHA → VERCEL_GIT_COMMIT_SHA → 'unknown')
  // ONCE at module load. Two independent derivations of the same fact, so
  // disagreement is real information: an env var shadowing the Railway one, or
  // a build whose SHA never reached the container at all. `'unknown'` is the
  // silent case — the payload still looks well-formed and means nothing.
  // ---------------------------------------------------------------------
  const version = await get('/api/version');
  const commitHash = String(version.body?.commitHash ?? '').toLowerCase();
  const healthSha = String(health.body?.git_sha ?? '').toLowerCase();
  record(
    'version: commitHash is a real SHA',
    commitHash.length === 40 && commitHash !== 'unknown',
    commitHash || '<none>',
  );
  record(
    'version: commitHash agrees with /health git_sha',
    Boolean(commitHash) && commitHash === healthSha,
    `${commitHash.slice(0, 12) || '<none>'} vs ${healthSha.slice(0, 12) || '<none>'}`,
  );

  // ---------------------------------------------------------------------
  // 3. The guarded surface still refuses. This is the tripwire.
  // ---------------------------------------------------------------------
  for (const entry of PROBE_GUARDED) {
    const res = await get(entry.path);
    const guarded = isTenantGuardRejection(res.status, res.body);

    if (guarded) {
      record(`guarded ${entry.path}`, true, `HTTP 401 ${TENANT_GUARD_ERROR}`);
      continue;
    }

    // A second control caught it instead. The door is still shut, so this is
    // not an exposure — but the outer guard stopped covering the path, which
    // is a contract change someone should have to look at.
    if (entry.alsoDeniedBy && res.status >= 400 && res.status < 500) {
      record(
        `guarded ${entry.path}`,
        false,
        `HTTP ${res.status} — still denied, but by ${entry.alsoDeniedBy} rather than the tenant guard. Not an exposure; the outer guard no longer covers this path.`,
      );
      continue;
    }

    record(
      `guarded ${entry.path}`,
      false,
      res.status < 400
        ? `HTTP ${res.status} — ANONYMOUSLY READABLE. This route is declared guarded and is answering the public internet. ${entry.note}`
        : `HTTP ${res.status} error=${res.body?.error ?? '<none>'} — expected 401 ${TENANT_GUARD_ERROR}`,
    );
  }
} catch (error) {
  record('probe: network', false, String(error?.message ?? error));
}

const failed = results.filter((r) => !r.ok);
const receipt = {
  service: 'api',
  base: BASE,
  expectedSha: EXPECTED_SHA || null,
  checkedAt: new Date().toISOString(),
  overall: failed.length === 0 ? 'pass' : 'fail',
  results,
};
if (flag('--json')) {
  console.log(JSON.stringify(receipt, null, 2));
}
const receiptPath = opt('--receipt', process.env.API_PROBE_RECEIPT_OUT || '');
if (receiptPath) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`receipt → ${receiptPath}`);
}
console.log(
  `\n${failed.length === 0 ? 'API SURFACE PASS' : `API SURFACE FAIL (${failed.length}/${results.length} checks failed)`} — ${BASE}`,
);
process.exit(failed.length === 0 ? 0 : 1);
