#!/usr/bin/env node
/**
 * deploy-smoke.mjs — secretless production smoke test (Wave 0.3).
 *
 * External, cache-busted verification that the deployed site is the site we
 * think it is. Needs NO secrets, so the release-verify workflow runs it on
 * every deploy even when the signed-in monitor is not wired.
 *
 *   node scripts/deploy-smoke.mjs [--base https://vitalcv.com] [--sha <expected>]
 *                                 [--allow-missing-auth-health] [--json]
 *
 * Checks:
 *  - /api/version: service=web, platform=railway, environment=production,
 *    branch=main, commit matches --sha when given
 *  - /api/health/auth: HTTP 200 + status "ok" (fail-closed auth config;
 *    --allow-missing-auth-health tolerates 404 until Wave 0.1 is deployed)
 *  - / : current-release homepage marker (data-narrative-words), bounded
 *    shared cache (s-maxage ≤ 300)
 *  - /onboarding: HTTP 200 AND private/no-store with no s-maxage (Wave 0.2)
 *  - /employers /trust /status: HTTP 200
 *
 * Every request carries a unique cache-buster query + `Cache-Control:
 * no-cache`, so a stale shared cache cannot fake a pass.
 */

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = (opt('--base', process.env.RELEASE_PROBE_BASE || 'https://vitalcv.com')).replace(/\/$/, '');
const EXPECTED_SHA = opt('--sha', process.env.EXPECTED_SHA || '').toLowerCase();
const ALLOW_MISSING_AUTH_HEALTH = flag('--allow-missing-auth-health');

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

try {
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

  // 3. Homepage — release marker + bounded shared caching.
  const home = await get('/');
  record('home: HTTP 200', home.status === 200, `HTTP ${home.status}`);
  record('home: current release marker', home.body.includes('data-narrative-words'), 'data-narrative-words');
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
} catch (error) {
  record('smoke: network', false, String(error && error.message ? error.message : error));
}

const failed = results.filter((r) => !r.ok);
if (flag('--json')) {
  console.log(JSON.stringify({ base: BASE, expectedSha: EXPECTED_SHA || null, overall: failed.length === 0 ? 'pass' : 'fail', results }, null, 2));
}
console.log(`\n${failed.length === 0 ? 'SMOKE PASS' : `SMOKE FAIL (${failed.length}/${results.length} checks failed)`} — ${BASE}`);
process.exit(failed.length === 0 ? 0 : 1);
