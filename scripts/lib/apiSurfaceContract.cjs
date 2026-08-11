/**
 * The API service's declared anonymous surface — one source of truth, read by
 * both the production probe and the CI test that proves it.
 *
 * WHY THIS FILE EXISTS
 * `apps/api/backend/src/app.ts` mounts `requireTenantContextOrReadAccess`
 * globally at line ~3574, BEFORE every route registration. So "what can an
 * anonymous caller read from the API?" is not answered by reading route
 * handlers — it is answered by the guard's skip list, and nothing anywhere
 * wrote that answer down.
 *
 * The previous attempt (`scripts/verifyProduction.ts`, removed by #1362) got
 * this backwards: it asserted HTTP 200 on eleven routes that the guard makes
 * unreachable, so it could only ever fail, and it was wired into no workflow.
 * Its premise was "the API's routes answer". The real premise is "the API's
 * anonymous surface is exactly this set, and that set must not grow."
 *
 * THE TWO CONSUMERS, AND WHY THEY DIFFER
 *  - `apps/api/backend/src/routes/__tests__/apiSurfaceContract.test.ts` boots
 *    the real app and sweeps EVERY parameterless skip-listed GET route. It is
 *    exhaustive because it is free — no network, no deploy, runs on every PR.
 *    That is where the census below is enforced.
 *  - `scripts/api-surface-probe.mjs` runs against the deployed container. It
 *    checks a curated subset, because a post-deploy probe should be fast and
 *    because its job is different: it catches what only differs between the
 *    artifact CI built and the container Railway is running — wrong SHA, a
 *    dead database, a flipped env flag, a proxy rewriting responses.
 *
 * WHY .cjs WHEN ITS SIBLINGS ARE .mjs
 * `cachePolicy.mjs` and `lane-parity.mjs` are consumed by ESM scripts and by
 * apps/web's vitest, which loads ESM natively. This file's second consumer is
 * the BACKEND jest suite, which is CommonJS (`"type": "commonjs"`, ts-jest
 * emitting CJS) and cannot parse an ESM `export` — a `.mjs` here fails with
 * `SyntaxError: Unexpected token 'export'` before a single assertion runs.
 * CommonJS is the format both sides can read: Node's cjs-module-lexer resolves
 * the named exports below for `import { … } from './lib/apiSurfaceContract.cjs'`
 * in the ESM probe, and jest requires it directly. Duplicating the contract per
 * runtime was the alternative, and a contract that exists twice is a contract
 * that will disagree with itself.
 *
 * MEASURED, NOT ASSUMED. Every status in this file was observed by booting the
 * real app (2026-08-11, origin/main @ 37b3918bb) and issuing anonymous
 * requests, and the production readings were taken from the deployed container
 * at the same commit. Nothing here is inferred from reading the skip list.
 */

/** The tenant guard's rejection body. The one status that means "the guard answered". */
const TENANT_GUARD_ERROR = 'organization_context_required';

/**
 * Curated public surface, probed against production on every API deploy.
 *
 * `expect` lists every status the DEPLOYED app may legitimately return — which
 * is not always just 200. `/readyz` reports 503 when the database is
 * unreachable, and that is a true answer, not a probe failure; the probe
 * records which one it saw. Asserting a single status here is precisely the
 * mistake that made verifyProduction.ts unrunnable.
 */
const PROBE_PUBLIC = [
  {
    path: '/',
    expect: [200],
    keys: ['name', 'version'],
    note: 'Service identity. Two literals, no request input.',
  },
  {
    path: '/health',
    expect: [200],
    keys: ['status', 'metrics', 'git_branch', 'git_sha', 'node_version'],
    note: 'The deploy gate reads git_sha from here. Also the only published reading of the container Node version.',
  },
  {
    path: '/readyz',
    // 503 is `status: not_ready` — the handler's own answer when `SELECT 1`
    // fails. A probe that demanded 200 would be asserting database uptime as a
    // deploy contract; what is actually asserted is that the route answers and
    // that the guard did not eat it. The reading is reported either way.
    expect: [200, 503],
    keys: ['status', 'service', 'git_branch', 'git_sha'],
    note: 'API-container database reachability. Nothing else in CI checks this — the web smoke checks the WEB container /api/health/db.',
  },
  {
    path: '/verifier',
    expect: [200],
    keys: ['route', 'status'],
    note: 'Two literals. One of only two routes the deleted script correctly expected to answer.',
  },
  {
    path: '/metrics/public',
    expect: [200],
    keys: ['status', 'generated_at'],
    note: 'Liveness. services/integrity/systemSweep.ts consumes it as a reachability check.',
  },
  {
    path: '/openapi.json',
    expect: [200],
    keys: ['openapi', 'info', 'paths'],
    note: 'Published API description.',
  },
  {
    path: '/api/version',
    expect: [200],
    keys: ['buildVersion', 'commitHash', 'nodeVersion', 'prismaVersion'],
    note: 'Public since #1360. Four process constants; versionReachability.test.ts pins that nothing tenant-scoped joins them.',
  },
  {
    path: '/api/system/source-runtime',
    // 503 when the runtime cannot be computed. Mirrors the tolerance
    // sourceRuntimePublic.test.ts already sets for this route rather than
    // inventing a narrower one here.
    expect: [200, 404, 503],
    note: 'E0 source-runtime transparency. Pinned public by sourceRuntimePublic.test.ts.',
  },
  {
    path: '/api/credentials/status-list',
    expect: [200],
    note: 'W3C Bitstring Status List. Its entire audience is unauthenticated verifiers dereferencing an embedded URL.',
  },
];

/**
 * Routes that MUST answer 401 `organization_context_required` to an anonymous
 * caller. This is the tripwire, and it is the half of the contract the deleted
 * script had inverted — it demanded 200 from the first three of these.
 *
 * Every entry here is closed by the tenant guard ALONE, or is closed by the
 * guard first with a second control behind it. A non-401 answer means the
 * global guard stopped covering the path: either someone widened the skip
 * list, or the mount order at app.ts changed.
 *
 * `alsoDeniedBy` records a second, independent control. Where it is set, a 4xx
 * is still a closed door (defence in depth held) — so the probe reports it as a
 * CHANGED CONTRACT rather than an exposure, and only a 2xx is an exposure.
 * Where it is null, the guard is the only thing standing there and 401 is the
 * whole contract.
 */
const PROBE_GUARDED = [
  {
    path: '/api/compliance/summary',
    alsoDeniedBy: null,
    note: 'Serves hardcoded self-graded compliance claims (COMPLIANCE_SUMMARY). Publishing those anonymously is a decision nobody has made.',
  },
  {
    path: '/api/security/posture',
    alsoDeniedBy: null,
    note: 'Serves hardcoded self-graded security claims (SECURITY_POSTURE). Same reasoning.',
  },
  {
    path: '/api/internal/health',
    alsoDeniedBy: 'requireInternalSecret',
    note: 'Double-guarded: tenant guard answers first, shared secret behind it.',
  },
  {
    path: '/api/internal/system-status',
    alsoDeniedBy: 'requireInternalSecret',
    note: 'Double-guarded. Reports uptime, DB and ledger state.',
  },
  {
    path: '/api/internal/source-health',
    alsoDeniedBy: 'requireInternalSecret',
    note: 'Double-guarded. scripts/deploy-health-probe.sh is the authenticated reader.',
  },
  {
    path: '/api/npi/1234567890',
    alsoDeniedBy: null,
    note: 'Representative tenant-scoped read. 1234567890 fails the NPI check digit, so no real clinician is named — and the guard answers before the handler either way.',
  },
  {
    path: '/api/trust/1234567890',
    alsoDeniedBy: null,
    note: 'Representative tenant-scoped read. Same synthetic NPI.',
  },
  {
    path: '/clinician',
    alsoDeniedBy: null,
    note: 'Representative non-/api route, proving the guard is not /api-scoped.',
  },
  {
    path: '/api/directory/publish',
    alsoDeniedBy: null,
    note: 'On NEVER_SKIP_TENANT_CONTEXT. Mints an integrity-hashed federation snapshot and was once reachable unauthenticated; the deny rule that closed it runs before every allow rule.',
  },
  {
    path: '/api/versions',
    alsoDeniedBy: null,
    note: 'Unrouted near-miss. Proves any /api/version exemption stays an exact match rather than a prefix.',
  },
];

/**
 * THE CENSUS — every parameterless GET route that answers 200 to a fully
 * anonymous caller, enforced as an UPPER BOUND by the CI test.
 *
 * WHAT THIS IS FOR. A route joins this list by someone adding a prefix to
 * `shouldSkipTenantContext`, which is a two-line diff that opens every route
 * under it at once. This list makes that diff impossible to land quietly: open
 * a new route to the world and the test names it and fails until it is written
 * down here, in a diff a reviewer can see and argue with.
 *
 * UPPER BOUND, deliberately. An undeclared 200 fails. A declared entry that has
 * since closed does NOT fail — closing a route is the safe direction, and a
 * test that punished it would quietly pressure the next person to reopen one to
 * get green. Stale entries are swept by a separate assertion instead.
 *
 * THIS IS NOT AN ENDORSEMENT. Several of these publish more than their name
 * suggests — `/api/audit/events`, `/api/directory/csv`, `/api/pilot/report`,
 * the `/api/intelligence/*` block. They are here because they ARE reachable
 * today, which is the only thing this file claims. Whether they SHOULD be is a
 * security question this file exists to make askable; it is not answered here,
 * and nothing about listing them settles it.
 *
 * STATED LIMITS — this census does NOT cover:
 *  - parameterized routes (`/api/passport/:npi/export` and 243 others). Their
 *    status depends on seeded data, so sweeping them would make the test
 *    data-dependent and flaky. They are the larger untested surface.
 *  - non-GET methods.
 *  - routes reachable only with a header (`x-clerk-user-id` scoped reads).
 * Naming the gap beats a silent cap that reads as full coverage.
 */
const ANONYMOUS_CENSUS = [
  { path: '/' },
  { path: '/.well-known/openid-federation' },
  { path: '/.well-known/vitalcv-trust' },
  { path: '/api/agents' },
  { path: '/api/agents/insights' },
  { path: '/api/agents/reports' },
  { path: '/api/agents/schedule' },
  { path: '/api/audit/anomalies' },
  { path: '/api/audit/baseline' },
  { path: '/api/audit/events' },
  { path: '/api/audit/health' },
  { path: '/api/audit/receipts' },
  { path: '/api/audit/receipts/stats' },
  { path: '/api/audit/stream' },
  { path: '/api/credentials/status-list' },
  { path: '/api/directory' },
  { path: '/api/directory/csv' },
  { path: '/api/directory/fhir' },
  { path: '/api/directory/signed' },
  { path: '/api/directory/snapshots' },
  { path: '/api/employers/' },
  { path: '/api/findings' },
  { path: '/api/findings/feedback/history' },
  { path: '/api/findings/stats' },
  { path: '/api/graph/diagnostics' },
  { path: '/api/graph/global' },
  { path: '/api/graph/groups' },
  { path: '/api/graph/investigation' },
  { path: '/api/graph/network' },
  { path: '/api/graph/presets' },
  { path: '/api/graph/search' },
  { path: '/api/identity/governance' },
  { path: '/api/identity/governance/build-order' },
  { path: '/api/identity/governance/caution-map' },
  { path: '/api/identity/sources' },
  { path: '/api/identity/watchlists' },
  { path: '/api/intelligence/bottlenecks' },
  { path: '/api/intelligence/cache/stats' },
  { path: '/api/intelligence/confidence' },
  { path: '/api/intelligence/correlations' },
  { path: '/api/intelligence/deployment' },
  { path: '/api/intelligence/events' },
  { path: '/api/intelligence/export' },
  { path: '/api/intelligence/feed' },
  { path: '/api/intelligence/graph' },
  { path: '/api/intelligence/insights' },
  { path: '/api/intelligence/insights/graph' },
  { path: '/api/intelligence/learning' },
  { path: '/api/intelligence/mobility' },
  { path: '/api/intelligence/network-changes' },
  { path: '/api/intelligence/public/findings' },
  { path: '/api/intelligence/public/graph' },
  { path: '/api/intelligence/public/investigation-workbench' },
  { path: '/api/intelligence/public/providers' },
  { path: '/api/intelligence/public/storylines' },
  { path: '/api/intelligence/scarcity' },
  { path: '/api/intelligence/status' },
  { path: '/api/intelligence/summary' },
  { path: '/api/investigations/feed' },
  { path: '/api/investigators' },
  { path: '/api/investigators/findings' },
  { path: '/api/matcha/analytics' },
  { path: '/api/matcha/opportunities' },
  { path: '/api/metrics/yc' },
  { path: '/api/opportunities' },
  { path: '/api/pilot/dashboard' },
  { path: '/api/pilot/report' },
  { path: '/api/providers' },
  { path: '/api/providers/health' },
  { path: '/api/providers/health/alerts' },
  { path: '/api/providers/health/diagnostics' },
  { path: '/api/providers/provenance/health' },
  { path: '/api/search/index-status' },
  { path: '/api/storylines' },
  { path: '/api/storylines/stats' },
  { path: '/api/system-health' },
  { path: '/api/system/source-runtime' },
  { path: '/api/trust-state/cache/stats' },
  { path: '/api/watch' },
  { path: '/api/watchtower/mobile/subscriptions' },
  { path: '/demo/sample-npis' },
  { path: '/demo/status' },
  { path: '/health' },
  { path: '/health/' },
  { path: '/metrics/public' },
  { path: '/openapi.json' },
  { path: '/readyz' },
  { path: '/verifier' },
  // Public since #1360, which landed and deployed mid-authoring of this file.
  // It was carried here for one commit as the `transitional` entry described
  // below, and settled the moment production served it.
  { path: '/api/version' },
];

/**
 * `nixpacks.toml` pins `nixPkgs = ["nodejs_22"]`, and that channel resolves
 * BELOW 22.12 — production served v22.11.0 on 2026-08-11. So a `>= 22.12`
 * assertion would be red on a healthy deploy, which is the exact failure mode
 * of the script this work replaces. The real, stable contract is the MAJOR
 * version: dropping to Node 20 is the documented outage (#894 — every API
 * deploy failed for seven commits on ERR_REQUIRE_ESM) and jumping to 24 is an
 * unreviewed toolchain change. The probe reports the exact value either way,
 * because nixpacks.toml tells readers to trust this reading over its own
 * comment.
 */
const EXPECTED_NODE_MAJOR = 22;

/** Shared classifier so the probe and the test agree on what a guard answer is. */
function isTenantGuardRejection(status, body) {
  return status === 401 && body != null && body.error === TENANT_GUARD_ERROR;
}

/** Census paths that must currently answer 200 (i.e. everything not transitional). */
function settledCensusPaths() {
  return ANONYMOUS_CENSUS.filter((entry) => !entry.transitional).map((entry) => entry.path);
}

/**
 * Census entries carrying `transitional: '#<pr>'` — declared, but not yet
 * reachable on main because the PR that opens them is still in flight.
 *
 * This exists because it was needed. #1360, which puts `/api/version` on the
 * skip list, merged AND deployed while this file was being written. Without a
 * way to declare a not-yet-landed exposure, whichever of the two PRs merged
 * second would have gone red for a reason that had nothing to do with it —
 * main moves under you on this repo, and a contract file that cannot express
 * "coming in #N" makes that a merge conflict every time.
 *
 * It is a claim with an expiry, not a quarantine slot. The test enforces at
 * most ONE entry and requires the marker to name its PR, so this cannot drift
 * into the web app's STALE list — which is what a tolerance list with no
 * ceiling becomes. The slot is empty today.
 */
function transitionalCensusEntries() {
  return ANONYMOUS_CENSUS.filter((entry) => entry.transitional);
}

module.exports = {
  ANONYMOUS_CENSUS,
  EXPECTED_NODE_MAJOR,
  PROBE_GUARDED,
  PROBE_PUBLIC,
  TENANT_GUARD_ERROR,
  isTenantGuardRejection,
  settledCensusPaths,
  transitionalCensusEntries,
};
