/**
 * Reconciliation sweep — reaps synthetic release-monitor identities that
 * escaped `cleanupClinician`.
 *
 * The release monitor mints a real Clerk user + org on every wired run and
 * deletes both from a `finally`. Three narrow paths defeat that: a SIGKILL
 * (no grace period for the handler), the microsecond gap before a created id
 * is reported to `onResourceCreated`, and a Clerk DELETE that fails
 * transiently. Each leaks an identity whose ids no longer exist in any
 * process — so nothing can ever clean it up by id. This sweep is the backstop:
 * it finds leaked identities by their *shape* and deletes them.
 *
 * ── This code deletes users from production Clerk. Read this before editing.
 *
 * The identifying shape is taken from `syntheticClinician.ts`, which is the
 * only writer, NOT from prose. `docs/deployment/release-monitoring.md` claimed
 * for months that synthetic emails end in `@vitalcv-monitor.local`; the real
 * mint path has never used that, because production Clerk rejects a `.local`
 * TLD with 422 `form_param_format_invalid`. A sweep built from the doc would
 * have matched nothing and reaped nothing, forever, while reporting success.
 * If the mint path changes, change `isSyntheticUser` in the same commit —
 * `release-monitor-reconcile.test.ts` pins the two together and fails loudly
 * if they drift.
 *
 * Safety invariants, in order of how much they matter:
 *
 * 1. CONJUNCTION, NEVER DISJUNCTION. A user is a candidate only if it carries
 *    `public_metadata.synthetic === true` AND
 *    `public_metadata.purpose === 'release-monitor'` AND a plus-tagged
 *    `svc-monitor+…@vitalcv.com` address. A real clinician would have to
 *    satisfy all three simultaneously to be at risk. Matching on any ONE of
 *    them — an email pattern a human could plausibly pick, say — is the
 *    difference between a backstop and an incident.
 * 2. AGE GRACE. Only identities older than `minAgeMs` (default 2 h) are
 *    touched, so a verification running right now can never have its live
 *    identity deleted mid-flight. Release verify's whole job budget is 15 min,
 *    so 2 h is ~8× headroom.
 * 3. RE-VALIDATION AT THE POINT OF DELETE. Every candidate is re-checked
 *    against the same predicate immediately before its DELETE. Filtering and
 *    deleting are separated by network time; this closes that window.
 * 4. PER-RUN CAP. At most `maxDeletes` (default 25) deletions per run. A
 *    predicate bug cannot cascade through an entire user table before a human
 *    notices; the overflow is reported rather than silently dropped.
 *
 * Orgs are weaker and deliberately so: the mint path gives an org a
 * `vcv-monitor-<runId>` name and NO metadata, so name prefix + age is the only
 * available signal. That is stated plainly rather than dressed up — see
 * `isSyntheticOrg`.
 */

export type FetchLike = typeof fetch;

const DEFAULT_CLERK_API = 'https://api.clerk.com';
/** Live identities are never touched; comfortably exceeds the 15-min job budget. */
export const DEFAULT_MIN_AGE_MS = 2 * 60 * 60 * 1000;
/** Blast-radius cap per run. Overflow is reported, never silently dropped. */
export const DEFAULT_MAX_DELETES = 25;
/** Bounds a runaway pagination loop against a large or misbehaving instance. */
export const DEFAULT_MAX_PAGES = 20;
const PAGE_SIZE = 100;

/** Exact shape written by `mintClinicianSession`. Keep in lockstep with it. */
export const SYNTHETIC_EMAIL_RE = /^svc-monitor\+[^@]+@vitalcv\.com$/i;
export const SYNTHETIC_ORG_NAME_RE = /^vcv-monitor-/;

export interface ClerkUserLike {
  id: string;
  created_at?: number;
  email_addresses?: Array<{ email_address?: unknown }>;
  public_metadata?: { synthetic?: unknown; purpose?: unknown } | null;
}

export interface ClerkOrgLike {
  id: string;
  name?: unknown;
  created_at?: number;
}

export interface ReconcileDeps {
  fetchImpl?: FetchLike;
  clerkSecretKey: string;
  clerkApiBase?: string;
  now?: () => number;
  minAgeMs?: number;
  maxDeletes?: number;
  maxPages?: number;
  /** Report only — enumerate and classify, delete nothing. */
  dryRun?: boolean;
  log?: (line: string) => void;
}

export interface ReconcileReport {
  ok: boolean;
  dryRun: boolean;
  scannedUsers: number;
  scannedOrgs: number;
  /** Matched the predicate AND cleared the age grace. */
  staleUsers: number;
  staleOrgs: number;
  deletedUsers: number;
  deletedOrgs: number;
  /** Candidates left because the per-run cap was hit. Non-zero ⇒ run again. */
  skippedForCap: number;
  /** Truncated + safe; never contains a Clerk error body verbatim. */
  problems: string[];
  /** True when pagination hit `maxPages` — the scan was not exhaustive. */
  truncated: boolean;
}

function backendHeaders(secret: string): Record<string, string> {
  return { authorization: `Bearer ${secret}`, 'content-type': 'application/json' };
}

/**
 * The authoritative predicate. All three conditions must hold — see invariant 1.
 * Exported so the reconcile script, the tests, and any future caller share one
 * definition rather than re-deriving a near-miss copy.
 */
export function isSyntheticUser(user: ClerkUserLike): boolean {
  const meta = user.public_metadata;
  if (!meta || typeof meta !== 'object') return false;
  if (meta.synthetic !== true) return false;
  if (meta.purpose !== 'release-monitor') return false;
  const emails = Array.isArray(user.email_addresses) ? user.email_addresses : [];
  // Every address on the account must look synthetic. A synthetic account has
  // exactly one; requiring `.every` (over a non-empty list) means an account
  // that somehow also carries a real address is left alone.
  const addrs = emails
    .map((e) => (typeof e?.email_address === 'string' ? e.email_address : ''))
    .filter(Boolean);
  if (addrs.length === 0) return false;
  return addrs.every((a) => SYNTHETIC_EMAIL_RE.test(a));
}

/**
 * Orgs carry no metadata marker — the mint path sets only `name`. Name prefix
 * is therefore the whole signal, which is a weaker guarantee than the user
 * predicate and is not pretended otherwise: a human-created org literally named
 * `vcv-monitor-*` would match. Nothing in the product creates such a name, and
 * the age grace still applies.
 */
export function isSyntheticOrg(org: ClerkOrgLike): boolean {
  return typeof org.name === 'string' && SYNTHETIC_ORG_NAME_RE.test(org.name);
}

/** Clerk `created_at` is epoch ms. A missing/!finite value is treated as NOT
 *  old enough — unknown age must never authorise a delete. */
export function isOlderThan(createdAt: number | undefined, nowMs: number, minAgeMs: number): boolean {
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return false;
  return nowMs - createdAt >= minAgeMs;
}

async function listPage<T>(
  fetchImpl: FetchLike,
  url: string,
  secret: string,
): Promise<{ ok: boolean; items: T[]; status: number }> {
  const res = await fetchImpl(url, {
    method: 'GET',
    headers: backendHeaders(secret),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return { ok: false, items: [], status: res.status };
  const body = (await res.json()) as unknown;
  // Clerk returns a bare array for /v1/users and {data:[...]} for some list
  // endpoints depending on version; accept both rather than assuming.
  const items = Array.isArray(body)
    ? (body as T[])
    : Array.isArray((body as { data?: unknown })?.data)
      ? ((body as { data: T[] }).data)
      : [];
  return { ok: true, items, status: res.status };
}

/**
 * Enumerate, classify, and (unless `dryRun`) delete leaked synthetic identities.
 * Never throws: transport failures land in `report.problems` with `ok: false`,
 * because the caller is a scheduled job whose job is to report, not to crash.
 */
export async function reconcileSynthetics(deps: ReconcileDeps): Promise<ReconcileReport> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const clerkApi = deps.clerkApiBase ?? DEFAULT_CLERK_API;
  const nowMs = (deps.now ?? Date.now)();
  const minAgeMs = deps.minAgeMs ?? DEFAULT_MIN_AGE_MS;
  const maxDeletes = deps.maxDeletes ?? DEFAULT_MAX_DELETES;
  const maxPages = deps.maxPages ?? DEFAULT_MAX_PAGES;
  const dryRun = deps.dryRun === true;
  const log = deps.log ?? (() => {});

  const report: ReconcileReport = {
    ok: true,
    dryRun,
    scannedUsers: 0,
    scannedOrgs: 0,
    staleUsers: 0,
    staleOrgs: 0,
    deletedUsers: 0,
    deletedOrgs: 0,
    skippedForCap: 0,
    problems: [],
    truncated: false,
  };

  if (!deps.clerkSecretKey.trim()) {
    report.ok = false;
    report.problems.push('CLERK_SECRET_KEY is not set — cannot reconcile');
    return report;
  }

  let budget = maxDeletes;

  // ── users ────────────────────────────────────────────────────────────────
  const staleUsers: ClerkUserLike[] = [];
  for (let page = 0; page < maxPages; page += 1) {
    const url = `${clerkApi}/v1/users?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}&order_by=%2Bcreated_at`;
    let res: { ok: boolean; items: ClerkUserLike[]; status: number };
    try {
      res = await listPage<ClerkUserLike>(fetchImpl, url, deps.clerkSecretKey);
    } catch (err) {
      report.ok = false;
      report.problems.push(`list users error: ${(err as Error).message.slice(0, 80)}`);
      break;
    }
    if (!res.ok) {
      report.ok = false;
      report.problems.push(`list users ${res.status}`);
      break;
    }
    report.scannedUsers += res.items.length;
    for (const u of res.items) {
      if (isSyntheticUser(u) && isOlderThan(u.created_at, nowMs, minAgeMs)) staleUsers.push(u);
    }
    if (res.items.length < PAGE_SIZE) break;
    if (page === maxPages - 1) report.truncated = true;
  }
  report.staleUsers = staleUsers.length;

  for (const u of staleUsers) {
    if (budget <= 0) {
      report.skippedForCap += 1;
      continue;
    }
    if (dryRun) {
      log(`would delete user ${u.id}`);
      continue;
    }
    // Invariant 3: re-validate immediately before deleting. The list response
    // that produced this candidate is already stale by one network round-trip.
    if (!isSyntheticUser(u) || !isOlderThan(u.created_at, nowMs, minAgeMs)) {
      report.problems.push(`refused ${u.id}: failed re-validation`);
      report.ok = false;
      continue;
    }
    try {
      const res = await fetchImpl(`${clerkApi}/v1/users/${u.id}`, {
        method: 'DELETE',
        headers: backendHeaders(deps.clerkSecretKey),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok || res.status === 404) {
        report.deletedUsers += 1;
        budget -= 1;
        log(`deleted user ${u.id}`);
      } else {
        report.ok = false;
        report.problems.push(`delete user ${res.status}`);
      }
    } catch (err) {
      report.ok = false;
      report.problems.push(`delete user error: ${(err as Error).message.slice(0, 80)}`);
    }
  }

  // ── orgs ─────────────────────────────────────────────────────────────────
  const staleOrgs: ClerkOrgLike[] = [];
  for (let page = 0; page < maxPages; page += 1) {
    const url = `${clerkApi}/v1/organizations?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`;
    let res: { ok: boolean; items: ClerkOrgLike[]; status: number };
    try {
      res = await listPage<ClerkOrgLike>(fetchImpl, url, deps.clerkSecretKey);
    } catch (err) {
      report.ok = false;
      report.problems.push(`list orgs error: ${(err as Error).message.slice(0, 80)}`);
      break;
    }
    if (!res.ok) {
      report.ok = false;
      report.problems.push(`list orgs ${res.status}`);
      break;
    }
    report.scannedOrgs += res.items.length;
    for (const o of res.items) {
      if (isSyntheticOrg(o) && isOlderThan(o.created_at, nowMs, minAgeMs)) staleOrgs.push(o);
    }
    if (res.items.length < PAGE_SIZE) break;
    if (page === maxPages - 1) report.truncated = true;
  }
  report.staleOrgs = staleOrgs.length;

  for (const o of staleOrgs) {
    if (budget <= 0) {
      report.skippedForCap += 1;
      continue;
    }
    if (dryRun) {
      log(`would delete org ${o.id}`);
      continue;
    }
    if (!isSyntheticOrg(o) || !isOlderThan(o.created_at, nowMs, minAgeMs)) {
      report.problems.push(`refused org ${o.id}: failed re-validation`);
      report.ok = false;
      continue;
    }
    try {
      const res = await fetchImpl(`${clerkApi}/v1/organizations/${o.id}`, {
        method: 'DELETE',
        headers: backendHeaders(deps.clerkSecretKey),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok || res.status === 404) {
        report.deletedOrgs += 1;
        budget -= 1;
        log(`deleted org ${o.id}`);
      } else {
        report.ok = false;
        report.problems.push(`delete org ${res.status}`);
      }
    } catch (err) {
      report.ok = false;
      report.problems.push(`delete org error: ${(err as Error).message.slice(0, 80)}`);
    }
  }

  report.problems = report.problems.slice(0, 10);
  return report;
}
