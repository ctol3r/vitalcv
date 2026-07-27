#!/usr/bin/env node
/**
 * deploy-smoke.mjs — secretless production smoke test (Wave 0.3).
 *
 * External, cache-busted verification that the deployed site is the site we
 * think it is. Needs NO secrets, so the release-verify workflow runs it on
 * every deploy even when the signed-in monitor is not wired.
 *
 *   node scripts/deploy-smoke.mjs [--base https://vitalcv.com] [--sha <expected>]
 *                                 [--wait-for-sha <seconds>]
 *                                 [--allow-missing-auth-health]
 *                                 [--allow-missing-db-health] [--json]
 *
 * Checks:
 *  - /api/version: service=web, platform=railway, environment=production,
 *    branch=main, commit matches --sha when given
 *  - source-lane parity: every lane in /api/status agrees with the lanes
 *    rendered on BOTH /status and /status/technical about whether it is
 *    available (W0.5)
 *  - /api/health/auth: HTTP 200 + status "ok" (fail-closed auth config;
 *    --allow-missing-auth-health tolerates 404 until Wave 0.1 is deployed)
 *  - /api/health/db: HTTP 200 + db "ok" (web→database connectivity — the
 *    2026-07-17 placeholder-DATABASE_URL incident was invisible because the
 *    web Prisma product routes are fail-open; retried so one transient blip
 *    cannot paint a healthy deploy red; --allow-missing-db-health tolerates
 *    404 until the endpoint is deployed)
 *  - / : current-release homepage marker (data-home-hero), bounded
 *    shared cache (s-maxage ≤ 300)
 *  - /onboarding: HTTP 200 AND private/no-store with no s-maxage (Wave 0.2)
 *  - /employers /trust /status: HTTP 200
 *
 * Every request carries a unique cache-buster query + `Cache-Control:
 * no-cache`, so a stale shared cache cannot fake a pass.
 */

import { compareLaneParity, parseApiLanes, parseRenderedLanes } from './lib/lane-parity.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = (opt('--base', process.env.RELEASE_PROBE_BASE || 'https://vitalcv.com')).replace(/\/$/, '');
const EXPECTED_SHA = opt('--sha', process.env.EXPECTED_SHA || '').toLowerCase();
/**
 * Seconds to wait for the expected SHA to start being served before judging
 * anything (W0.5). Railway auto-deploys on push and a merge→live cycle was
 * measured at ~4.5 min, so a deploy job that probes immediately would always
 * see the previous release. 0 disables waiting (the old behaviour).
 */
const WAIT_FOR_SHA_SECONDS = Number(opt('--wait-for-sha', process.env.WAIT_FOR_SHA || '0')) || 0;
const ALLOW_MISSING_AUTH_HEALTH = flag('--allow-missing-auth-health');
const ALLOW_MISSING_DB_HEALTH = flag('--allow-missing-db-health');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const bust = (path) => `${BASE}${path}${path.includes('?') ? '&' : '?'}smoke=${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function get(path) {
  const response = await fetch(bust(path), {
    headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'vitalcv-deploy-smoke' },
    redirect: 'manual',
  });
  const body = await response.text();
  return { status: response.status, headers: response.headers, body };
}

/** True when the container is already serving `EXPECTED_SHA`. */
async function servingExpectedSha() {
  try {
    const res = await get('/api/version');
    const commit = String(JSON.parse(res.body).commit || '').toLowerCase();
    if (!commit) return false;
    return commit.startsWith(EXPECTED_SHA) || EXPECTED_SHA.startsWith(commit.slice(0, 7));
  } catch {
    return false;
  }
}

try {
  // 0. Wait for the expected release to actually be serving before judging it.
  //    Without this a post-deploy job probes the PREVIOUS container and passes
  //    — which is exactly why the old /api/health-only smoke could not detect
  //    a deploy that never landed.
  if (EXPECTED_SHA && WAIT_FOR_SHA_SECONDS > 0) {
    const deadline = Date.now() + WAIT_FOR_SHA_SECONDS * 1000;
    let arrived = await servingExpectedSha();
    while (!arrived && Date.now() < deadline) {
      await sleep(10_000);
      arrived = await servingExpectedSha();
    }
    record(
      `version: ${EXPECTED_SHA.slice(0, 12)} began serving within ${WAIT_FOR_SHA_SECONDS}s`,
      arrived,
      arrived ? 'deploy landed' : 'timed out waiting for the deploy',
    );
  }

  // 1. /api/version — platform / environment / branch / SHA.
  const version = await get('/api/version');
  let versionInfo = {};
  try { versionInfo = JSON.parse(version.body); } catch { /* handled below */ }
  record('version: HTTP 200 + JSON', version.status === 200 && Boolean(versionInfo.commit), `HTTP ${version.status}`);
  record('version: platform=railway', versionInfo.platform === 'railway', String(versionInfo.platform));
  record('version: environment=production', versionInfo.environment === 'production', String(versionInfo.environment));
  record('version: branch=main', versionInfo.branch === 'main', String(versionInfo.branch));
  if (EXPECTED_SHA) {
    const commit = String(versionInfo.commit || '').toLowerCase();
    const ok = commit.startsWith(EXPECTED_SHA) || EXPECTED_SHA.startsWith(commit.slice(0, 7));
    record('version: expected SHA deployed', ok, `serving ${commit.slice(0, 12) || 'unknown'} vs expected ${EXPECTED_SHA.slice(0, 12)}`);
  }

  // 2. /api/health/auth — fail-closed auth configuration (Wave 0.1).
  const authHealth = await get('/api/health/auth');
  if (authHealth.status === 404 && ALLOW_MISSING_AUTH_HEALTH) {
    record('auth-health: endpoint present', true, 'missing but tolerated (pre-Wave-0.1 deploy)');
  } else {
    let authInfo = {};
    try { authInfo = JSON.parse(authHealth.body); } catch { /* handled below */ }
    record('auth-health: HTTP 200 + status ok', authHealth.status === 200 && authInfo.status === 'ok', `HTTP ${authHealth.status} status=${authInfo.status ?? 'unparseable'}`);
  }

  // 2b. /api/health/db — web→database connectivity. The 2026-07-17
  // placeholder-DATABASE_URL incident was invisible from outside: every web
  // Prisma product route is fail-open by design, so a dead DB degrades
  // silently. This is the one check that turns that state red. Retried (3
  // attempts, 5 s apart) so a single transient blip cannot fail a healthy
  // deploy; a placeholder/unreachable DATABASE_URL fails every attempt.
  const parseDb = (body) => {
    try { return JSON.parse(body).db; } catch { return undefined; }
  };
  const firstDbHealth = await get('/api/health/db');
  if (firstDbHealth.status === 404 && ALLOW_MISSING_DB_HEALTH) {
    record('db-health: endpoint present', true, 'missing but tolerated (pre-db-health deploy)');
  } else {
    let dbStatus = firstDbHealth.status;
    let db = parseDb(firstDbHealth.body);
    for (let attempt = 1; attempt < 3 && !(dbStatus === 200 && db === 'ok'); attempt += 1) {
      await sleep(5000);
      const retry = await get('/api/health/db');
      dbStatus = retry.status;
      db = parseDb(retry.body);
    }
    record('db-health: HTTP 200 + db ok', dbStatus === 200 && db === 'ok', `HTTP ${dbStatus} db=${db ?? 'unparseable'}`);
  }

  // 3. Homepage — release marker + bounded shared caching.
  const home = await get('/');
  record('home: HTTP 200', home.status === 200, `HTTP ${home.status}`);
  record('home: current release marker', home.body.includes('data-home-hero'), 'data-home-hero');
  const homeCache = (home.headers.get('cache-control') || '').toLowerCase();
  const maxAge = homeCache.match(/s-maxage=(\d+)/);
  record('home: bounded shared cache', Boolean(maxAge) && Number(maxAge[1]) <= 300, homeCache || 'no cache-control');

  // 4. /onboarding — reachable AND never shared-cacheable (Wave 0.2).
  const onboarding = await get('/onboarding');
  const onboardingCache = (onboarding.headers.get('cache-control') || '').toLowerCase();
  record('onboarding: HTTP 200', onboarding.status === 200, `HTTP ${onboarding.status}`);
  record(
    'onboarding: private + no-store, no s-maxage',
    onboardingCache.includes('no-store') && !onboardingCache.includes('s-maxage'),
    onboardingCache || 'no cache-control',
  );

  // 5. Core public routes exist.
  for (const path of ['/employers', '/trust', '/status']) {
    const page = await get(path);
    record(`${path}: HTTP 200`, page.status === 200, `HTTP ${page.status}`);
  }

  // 6. Source-lane parity between /status and /api/status (W0.5).
  //    Both derive from lib/trust/sourceLanes.ts, so they agree at build time.
  //    This asserts the DEPLOYED surfaces still agree — the case a unit test
  //    cannot reach, e.g. a half-deployed release serving one new surface and
  //    one stale one.
  const [statusPage, statusApi] = await Promise.all([get('/status'), get('/api/status')]);
  let apiPayload = null;
  try { apiPayload = JSON.parse(statusApi.body); } catch { /* reported below */ }
  record('api-status: HTTP 200 + JSON', statusApi.status === 200 && apiPayload !== null, `HTTP ${statusApi.status}`);

  const apiLanes = parseApiLanes(apiPayload);
  const parity = compareLaneParity(parseRenderedLanes(statusPage.body), apiLanes);
  record(
    'source lanes: /status agrees with /api/status',
    parity.ok,
    parity.ok
      ? `${parity.checked} lanes agree`
      : parity.problems.join('; '),
  );

  // 6b. /status/technical publishes the SAME lanes to a technical buyer, from
  //     a different component. It is where the drift actually survived: it
  //     rendered OIG and PECOS as "PENDING INTEGRATION" while the registry,
  //     /api/status and /status all had them operational, plus a seventh
  //     `dea_registration` lane that existed nowhere else (fixed in #917).
  //     Checking only /status would have missed every bit of that.
  const technicalPage = await get('/status/technical');
  record('/status/technical: HTTP 200', technicalPage.status === 200, `HTTP ${technicalPage.status}`);
  const technicalParity = compareLaneParity(
    parseRenderedLanes(technicalPage.body),
    apiLanes,
    '/status/technical',
  );
  record(
    'source lanes: /status/technical agrees with /api/status',
    technicalParity.ok,
    technicalParity.ok
      ? `${technicalParity.checked} lanes agree`
      : technicalParity.problems.join('; '),
  );
} catch (error) {
  record('smoke: network', false, String(error && error.message ? error.message : error));
}

const failed = results.filter((r) => !r.ok);
const receipt = {
  base: BASE,
  expectedSha: EXPECTED_SHA || null,
  checkedAt: new Date().toISOString(),
  overall: failed.length === 0 ? 'pass' : 'fail',
  results,
};
if (flag('--json')) {
  console.log(JSON.stringify(receipt, null, 2));
}
// Deploy receipt (W0.5): a durable artifact the release can be judged on, so
// "it deployed fine" is a file someone can read rather than a recollection.
const receiptPath = opt('--receipt', process.env.DEPLOY_RECEIPT_OUT || '');
if (receiptPath) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`receipt → ${receiptPath}`);
}
console.log(`\n${failed.length === 0 ? 'SMOKE PASS' : `SMOKE FAIL (${failed.length}/${results.length} checks failed)`} — ${BASE}`);
process.exit(failed.length === 0 ? 0 : 1);
