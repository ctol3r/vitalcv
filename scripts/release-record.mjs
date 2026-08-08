#!/usr/bin/env node
/**
 * release-record.mjs — machine-readable proof of what is actually live (W1078).
 *
 * The question this answers is not "did the deploy succeed" but "is the commit
 * a founder approved the commit a visitor receives". Those come apart quietly:
 * Railway rebuilds on every push to main, while the deploy-web workflow only
 * runs on web-relevant paths, so a green workflow list is not an inventory of
 * what shipped. The only durable answer is to read the SHA out of the running
 * containers and compare it to git.
 *
 *   node scripts/release-record.mjs [--sha <intended>] [--write]
 *                                   [--web https://vitalcv.com]
 *                                   [--api https://api.vitalcv.com]
 *                                   [--repo <path>]
 *                                   [--review-url <url>] [--evidence <path>...]
 *
 * Default intended SHA is `origin/main`. `--write` persists the record to
 * docs/releases/<shortSha>.json and refreshes docs/releases/latest.json;
 * without it the record only goes to stdout. `--repo` points the commit lookups
 * at a different working tree — useful when generating a record from outside a
 * checkout, and what lets the ancestry logic be tested against purpose-built
 * history instead of whatever depth CI happened to clone.
 *
 * Convergence is reported as ANCESTRY, not equality. "Not equal" is three very
 * different situations — production trailing a just-merged commit is routine,
 * production running a commit that is not on main at all is an incident — and
 * a boolean cannot tell a founder which one they are looking at.
 *
 * Anything that cannot be measured is recorded as null with a stated reason.
 * A release record that guesses is worse than no release record.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const optAll = (name) => args.reduce((acc, arg, i) => (arg === name && args[i + 1] ? [...acc, args[i + 1]] : acc), []);

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/** Working tree the commit lookups resolve against; defaults to this checkout. */
const GIT_ROOT = opt('--repo', process.env.RELEASE_RECORD_REPO || REPO_ROOT);
const WEB_BASE = opt('--web', process.env.RELEASE_WEB_BASE || 'https://vitalcv.com').replace(/\/$/, '');
const API_BASE = opt('--api', process.env.RELEASE_API_BASE || 'https://api.vitalcv.com').replace(/\/$/, '');
const REVIEW_URL = opt('--review-url', process.env.RELEASE_REVIEW_URL || '') || null;
const EVIDENCE = optAll('--evidence');
const WRITE = flag('--write');

const git = (...gitArgs) => {
  try {
    return execFileSync('git', gitArgs, { cwd: GIT_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
};

const INTENDED_SHA = (opt('--sha', process.env.INTENDED_SHA || '') || git('rev-parse', 'origin/main') || '').toLowerCase();
if (!INTENDED_SHA) {
  console.error('release-record: no intended SHA — pass --sha or fetch origin/main first.');
  process.exit(2);
}

const bust = (url) => `${url}${url.includes('?') ? '&' : '?'}rr=${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Fetch JSON with caches defeated; never throws — failure is a recorded reason. */
async function probe(url) {
  try {
    const response = await fetch(bust(url), {
      headers: { 'Cache-Control': 'no-store', 'User-Agent': 'vitalcv-release-record' },
      redirect: 'manual',
    });
    const body = await response.text();
    let json = null;
    try {
      json = JSON.parse(body);
    } catch {
      return { ok: false, status: response.status, json: null, reason: `non-JSON response (HTTP ${response.status})` };
    }
    // A parseable body is not a healthy one. An error payload served with a 404
    // or 500 still leaves the SHA unmeasured, and every unmeasured field owes
    // the reader a reason — otherwise the record reports "unknown" with no
    // account of why, which is the failure this script exists to prevent.
    if (response.status !== 200) {
      return { ok: false, status: response.status, json, reason: `HTTP ${response.status} from ${new URL(url).pathname}` };
    }
    return { ok: true, status: response.status, json, reason: null };
  } catch (error) {
    return { ok: false, status: null, json: null, reason: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Classify a deployed SHA against the intended one using commit ancestry.
 *
 *   converged — byte-identical; this is the only state that means "shipped"
 *   behind    — deployed commit is an ancestor: the deploy has not landed yet
 *   ahead     — intended commit is an ancestor of deployed: main moved on, or
 *               the record was generated against a stale intended SHA
 *   diverged  — neither contains the other: the live container is not on this
 *               line of history at all. This is the incident case.
 *   unknown   — the SHA could not be read, or git cannot see the commit
 */
function classify(deployedSha) {
  if (!deployedSha) return { state: 'unknown', detail: 'no SHA reported by the service' };
  const deployed = deployedSha.toLowerCase();
  if (deployed === INTENDED_SHA) return { state: 'converged', detail: 'exact match' };
  // `git()` returns null when the command exits non-zero, so an unresolvable
  // commit and a failed ancestry test are both the null case.
  const known = git('rev-parse', '--verify', `${deployed}^{commit}`);
  if (!known) return { state: 'unknown', detail: 'commit not present in this clone — fetch, then re-run' };
  const deployedIsAncestor = git('merge-base', '--is-ancestor', deployed, INTENDED_SHA) !== null;
  if (deployedIsAncestor) {
    const gap = git('rev-list', '--count', `${deployed}..${INTENDED_SHA}`);
    return { state: 'behind', detail: `deployed commit is ${gap ?? '?'} commit(s) behind the intended SHA` };
  }
  const intendedIsAncestor = git('merge-base', '--is-ancestor', INTENDED_SHA, deployed) !== null;
  if (intendedIsAncestor) {
    const gap = git('rev-list', '--count', `${INTENDED_SHA}..${deployed}`);
    return { state: 'ahead', detail: `deployed commit is ${gap ?? '?'} commit(s) ahead of the intended SHA` };
  }
  return { state: 'diverged', detail: 'deployed commit is not on the intended line of history' };
}

const [webVersion, apiHealth] = await Promise.all([
  probe(`${WEB_BASE}/api/version`),
  probe(`${API_BASE}/health`),
]);

const webSha = webVersion.json?.commit ?? null;
const apiSha = apiHealth.json?.git_sha ?? null;

const web = {
  base: WEB_BASE,
  reachable: webVersion.ok,
  deployedSha: webSha,
  branch: webVersion.json?.branch ?? null,
  environment: webVersion.json?.environment ?? null,
  platform: webVersion.json?.platform ?? null,
  deploymentId: webVersion.json?.deploymentId ?? null,
  convergence: classify(webSha),
  reason: webVersion.reason,
};

const api = {
  base: API_BASE,
  reachable: apiHealth.ok,
  deployedSha: apiSha,
  branch: apiHealth.json?.git_branch ?? null,
  convergence: classify(apiSha),
  reason: apiHealth.reason,
};

const services = [web, api];
const converged = services.every((s) => s.convergence.state === 'converged');

const record = {
  schema: 'vitalcv.release-record/1',
  // Recorded from the generating host's clock. It stamps when this record was
  // produced — it is NOT a measurement of when the release was built or went
  // live, and must not be read as one.
  recordedAt: new Date().toISOString(),
  intended: {
    sha: INTENDED_SHA,
    shortSha: INTENDED_SHA.slice(0, 7),
    ref: opt('--sha', '') ? 'explicit --sha' : 'origin/main',
    subject: git('log', '-1', '--format=%s', INTENDED_SHA),
    committedAt: git('log', '-1', '--format=%cI', INTENDED_SHA),
  },
  services: { web, api },
  verdict: {
    converged,
    // Enumerated so a reader never has to infer which service is at fault.
    states: Object.fromEntries(
      Object.entries({ web, api }).map(([name, s]) => [name, s.convergence.state]),
    ),
  },
  // Populated only when a real review deployment produced a URL. Null here is
  // a finding, not an omission — see docs/deployment/review-environment.md.
  reviewUrl: REVIEW_URL,
  evidence: EVIDENCE,
};

console.log(JSON.stringify(record, null, 2));

if (WRITE) {
  const dir = join(REPO_ROOT, 'docs', 'releases');
  mkdirSync(dir, { recursive: true });
  const body = `${JSON.stringify(record, null, 2)}\n`;
  writeFileSync(join(dir, `${record.intended.shortSha}.json`), body);
  writeFileSync(join(dir, 'latest.json'), body);
  console.error(`\nwrote docs/releases/${record.intended.shortSha}.json and docs/releases/latest.json`);
}

process.exit(converged ? 0 : 1);
