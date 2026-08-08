#!/usr/bin/env node
/**
 * npi-smoke.mjs — post-deploy functional smoke for the NPI career loop (W1078).
 *
 * `deploy-smoke.mjs` proves the right container is serving and that the routes
 * answer. It never enters an NPI. But the NPI resolution IS the product's first
 * proof of work — the one moment the acquisition path depends on — and nothing
 * exercised it after a deploy. A release could serve the intended SHA, pass
 * every route check, and still resolve no clinician at all.
 *
 * This runs the real loop the homepage runs:
 *   /api/identity/bootstrap/[npi] → /api/trust-state/[npi] → /api/matcha/opportunities/[npi]
 *
 *   node scripts/npi-smoke.mjs [--base https://vitalcv.com]
 *                              [--npi 1407202518] [--absent-npi 1999999992]
 *                              [--json]
 *
 * Two NPIs, because a resolver that fabricates passes a positive test:
 *
 *  - PRESENT (default 1407202518) — a real Type 1 NPI in NPPES. Must come back
 *    attributed to NPPES with a name. Proves the live source path works.
 *  - ABSENT (default 1999999992) — passes the CMS check digit but is not in
 *    NPPES. Must come back UNAVAILABLE/UNKNOWN with no name and no affirmative
 *    status. This is the assertion that matters: a non-existent NPI once
 *    rendered as source-backed, and "checked" must never be recorded as
 *    "affirmed". Not-found is a finding, not missing evidence.
 *
 * The licensure assertion reads the lane lifecycle from /api/status rather than
 * hardcoding "unknown", so it keeps testing the right thing the day a real
 * licensure source connects instead of failing as a stale expectation.
 *
 * Exits non-zero on any FAIL. Read-only: every request is a GET, and no request
 * claims, mutates, or shares anything.
 */

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = opt('--base', process.env.RELEASE_PROBE_BASE || 'https://vitalcv.com').replace(/\/$/, '');
const PRESENT_NPI = opt('--npi', process.env.SMOKE_NPI || '1407202518');
const ABSENT_NPI = opt('--absent-npi', process.env.SMOKE_ABSENT_NPI || '1999999992');
const AS_JSON = flag('--json');

/** Status values that assert a credential is affirmatively good. */
const AFFIRMATIVE = new Set(['active', 'verified', 'valid', 'clear', 'current', 'confirmed']);

const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail: detail ?? null });
  if (!AS_JSON) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const bust = (path) => `${BASE}${path}${path.includes('?') ? '&' : '?'}smoke=${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function getJson(path) {
  const response = await fetch(bust(path), {
    headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'vitalcv-npi-smoke' },
    redirect: 'manual',
  });
  const body = await response.text();
  let json = null;
  try { json = JSON.parse(body); } catch { /* reported by the caller's status check */ }
  return { status: response.status, json, body };
}

try {
  // ---------------------------------------------------------------- present
  // A real NPI must resolve against the live registry and be attributed to it.
  const present = await getJson(`/api/identity/bootstrap/${PRESENT_NPI}`);
  record('present: bootstrap HTTP 200 + JSON', present.status === 200 && Boolean(present.json), `HTTP ${present.status}`);

  const p = present.json ?? {};
  record('present: resolved as Type 1', p.npiType === 'TYPE_1', String(p.npiType));
  record('present: attributed to NPPES', p.identitySource === 'NPPES_API', String(p.identitySource));
  record('present: carries a registry name', Boolean(p.firstName && p.lastName), p.firstName ? `${p.firstName} ${p.lastName}` : 'no name returned');

  const presentTrust = await getJson(`/api/trust-state/${PRESENT_NPI}`);
  const pt = presentTrust.json ?? {};
  record('present: trust-state HTTP 200 + JSON', presentTrust.status === 200 && Boolean(presentTrust.json), `HTTP ${presentTrust.status}`);
  record('present: identity verified', pt.identityVerified === true, `identityVerified=${pt.identityVerified}`);

  // Source coverage must name the source it actually checked, with a timestamp.
  const coverage = Array.isArray(pt.sourceCoverage) ? pt.sourceCoverage : [];
  const nppesLane = coverage.find((lane) => lane?.sourceId === 'NPPES_API');
  record(
    'present: NPPES coverage is attributed and timestamped',
    Boolean(nppesLane && nppesLane.state === 'checked' && nppesLane.checkedAt),
    nppesLane ? `state=${nppesLane.state} checkedAt=${nppesLane.checkedAt}` : 'no NPPES lane in sourceCoverage',
  );

  // ------------------------------------------------------- licensure honesty
  // Cross-check the claim against the lane that would have to be connected to
  // license it. While state_license is not live, no NPI may read affirmative.
  const status = await getJson('/api/status');
  const licenseLane = status.json?.source_lanes?.state_license ?? {};
  const licenseLive = licenseLane.lifecycle === 'active';
  const licensure = String(pt.licensureStatus ?? '').toLowerCase();
  record(
    licenseLive
      ? 'licensure: lane is live, status may be affirmative'
      : 'licensure: lane not connected, status is not affirmative',
    licenseLive || !AFFIRMATIVE.has(licensure),
    `lane lifecycle=${licenseLane.lifecycle ?? 'unknown'} licensureStatus=${licensure || 'absent'}`,
  );

  // ----------------------------------------------------------------- absent
  // The load-bearing case. A well-formed NPI that is not in NPPES must never
  // acquire a person, a source attribution, or an affirmative status.
  const absent = await getJson(`/api/identity/bootstrap/${ABSENT_NPI}`);
  const a = absent.json ?? {};
  record('absent: bootstrap answers 200 (degraded, not an error)', absent.status === 200 && Boolean(absent.json), `HTTP ${absent.status}`);
  record('absent: identity source is UNAVAILABLE', a.identitySource === 'UNAVAILABLE', String(a.identitySource));
  record('absent: persona is UNKNOWN', a.inferredPersona === 'UNKNOWN', String(a.inferredPersona));
  record(
    'absent: no name is invented',
    !a.firstName && !a.lastName,
    a.firstName || a.lastName ? `FABRICATED: ${a.firstName ?? ''} ${a.lastName ?? ''}`.trim() : 'no name returned',
  );
  record('absent: not reported as registered', a.alreadyRegistered === false, `alreadyRegistered=${a.alreadyRegistered}`);

  const absentTrust = await getJson(`/api/trust-state/${ABSENT_NPI}`);
  const at = absentTrust.json ?? {};
  record('absent: trust-state HTTP 200 + JSON', absentTrust.status === 200 && Boolean(absentTrust.json), `HTTP ${absentTrust.status}`);
  record('absent: identity is not verified', at.identityVerified === false, `identityVerified=${at.identityVerified}`);
  record(
    'absent: exclusion screening is not claimed clear',
    at.exclusionClear === false && !AFFIRMATIVE.has(String(at.exclusionStatus ?? '').toLowerCase()),
    `exclusionClear=${at.exclusionClear} exclusionStatus=${at.exclusionStatus}`,
  );
  record(
    'absent: unverified identity is stated as a blocker',
    Array.isArray(at.blockers) && at.blockers.length > 0,
    `blockers=${JSON.stringify(at.blockers ?? null)}`,
  );

  // ----------------------------------------------------------------- matcha
  // Opportunity matching must answer, and must not overstate what an anonymous
  // caller's public signal supports.
  const matcha = await getJson(`/api/matcha/opportunities/${PRESENT_NPI}`);
  const m = matcha.json ?? {};
  record('matcha: HTTP 200 + JSON', matcha.status === 200 && Boolean(matcha.json), `HTTP ${matcha.status}`);
  record('matcha: anonymous caller is scoped public', m.visibility === 'public', String(m.visibility));

  const matches = Array.isArray(m.matches) ? m.matches : [];
  record(
    'matcha: every match carries a fit indication',
    matches.every((match) => Boolean(match?.fitIndication)),
    `${matches.length} match(es)`,
  );
} catch (error) {
  record('npi-smoke: completed without a transport error', false, error instanceof Error ? error.message : String(error));
}

const failed = results.filter((r) => !r.ok);

if (AS_JSON) {
  console.log(JSON.stringify({
    base: BASE,
    presentNpi: PRESENT_NPI,
    absentNpi: ABSENT_NPI,
    ok: failed.length === 0,
    checks: results,
  }, null, 2));
} else {
  console.log('');
  console.log(failed.length === 0
    ? `NPI SMOKE PASS — ${BASE} (${results.length} checks)`
    : `NPI SMOKE FAIL — ${BASE} (${failed.length}/${results.length} failed)`);
}

process.exit(failed.length === 0 ? 0 : 1);
