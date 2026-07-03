/**
 * The signed-in clinician surfaces the release monitor must reach, plus the
 * pure navigation-outcome classifier.
 *
 * These six `/holder/*` routes are CLINICIAN-gated (`lib/auth/roles.ts`). The
 * signed-in-clinician P0 was that every authenticated clinician was redirected
 * to `/auth/error` before any of them rendered, so the monitor's hard gate is:
 * a real synthetic clinician session reaches all six with a terminal 200, never
 * passing through `/auth/error`, and never looping.
 *
 * Pure module — no I/O. The fetch-driven navigation that produces the hop
 * chains lives in `syntheticClinician.ts`; this file only defines the target
 * set and classifies a chain.
 */

/** The exact routes from the task requirement, in navigation order. */
export const HOLDER_ROUTES = [
  '/holder',
  '/holder/home',
  '/holder/readiness',
  '/holder/opportunities',
  '/holder/applications',
  '/holder/timeline',
] as const;

export type HolderRoute = (typeof HOLDER_ROUTES)[number];

/** One hop in a manually-followed redirect chain. */
export interface NavHop {
  /** Path (or full URL) that was requested for this hop. */
  url: string;
  /** HTTP status returned. */
  status: number;
  /** `Location` header when this hop was a redirect. */
  location?: string | null;
}

export type NavFailureReason =
  | 'auth_error' // passed through /auth/error — the P0 signature
  | 'redirect_loop' // a URL repeated in the chain
  | 'sign_in' // bounced to /sign-in (session was not accepted as signed-in)
  | 'non_200' // terminal status was not 200
  | 'too_many_hops' // never settled within the hop budget
  | 'no_hops'; // empty chain (harness error)

export interface NavOutcome {
  ok: boolean;
  finalStatus: number | null;
  finalUrl: string | null;
  hops: number;
  reason?: NavFailureReason;
}

/** Extract just the pathname from a path or absolute URL (query/hash stripped). */
export function pathOf(pathOrUrl: string): string {
  try {
    if (pathOrUrl.startsWith('http')) return new URL(pathOrUrl).pathname;
  } catch {
    /* fall through to manual strip */
  }
  return pathOrUrl.split('?')[0].split('#')[0];
}

export function isAuthErrorPath(pathOrUrl: string): boolean {
  return pathOf(pathOrUrl).startsWith('/auth/error');
}

export function isSignInPath(pathOrUrl: string): boolean {
  return pathOf(pathOrUrl).startsWith('/sign-in');
}

export function isResolvingPath(pathOrUrl: string): boolean {
  return pathOf(pathOrUrl).startsWith('/auth/resolving');
}

/**
 * Classify a manually-followed redirect chain for one target route.
 *
 * PASS = the chain settled on a 200 whose path is not /auth/error or /sign-in,
 * with no repeated path. A hop through /auth/error fails as `auth_error` even
 * if a later hop 200s, because /auth/error is the circuit-breaker the P0
 * tripped. Used for the steady-state per-route checks, where the role is
 * already resolved so a healthy chain is a single 200 with no redirects.
 */
export function analyzeNavigation(hops: NavHop[]): NavOutcome {
  if (hops.length === 0) {
    return { ok: false, finalStatus: null, finalUrl: null, hops: 0, reason: 'no_hops' };
  }

  const seen = new Set<string>();
  for (const hop of hops) {
    if (isAuthErrorPath(hop.url) || (hop.location && isAuthErrorPath(hop.location))) {
      return { ok: false, finalStatus: hop.status, finalUrl: hop.url, hops: hops.length, reason: 'auth_error' };
    }
    if (isSignInPath(hop.url) || (hop.location && isSignInPath(hop.location))) {
      return { ok: false, finalStatus: hop.status, finalUrl: hop.url, hops: hops.length, reason: 'sign_in' };
    }
    const key = pathOf(hop.url);
    if (seen.has(key)) {
      return { ok: false, finalStatus: hop.status, finalUrl: hop.url, hops: hops.length, reason: 'redirect_loop' };
    }
    seen.add(key);
  }

  const last = hops[hops.length - 1];
  if (last.status !== 200) {
    const reason: NavFailureReason = last.status >= 300 && last.status < 400 ? 'too_many_hops' : 'non_200';
    return { ok: false, finalStatus: last.status, finalUrl: last.url, hops: hops.length, reason };
  }

  return { ok: true, finalStatus: 200, finalUrl: last.url, hops: hops.length };
}
