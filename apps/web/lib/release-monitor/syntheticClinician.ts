/**
 * Synthetic signed-in-clinician harness (Clerk Backend API + FAPI).
 *
 * Reproduces a real active Clerk clinician session end-to-end so the release
 * monitor can black-box the signed-in `/holder/*` flow the way a real user
 * experiences it — the same technique used to diagnose the signed-in-clinician
 * P0 (memory `signed_in_clinician_auth_p0.md`), promoted here from a throwaway
 * session script into tested, reusable code.
 *
 * Sequence:
 *   1. Clerk Backend API  POST /v1/users                 → synthetic user
 *   2. Clerk Backend API  POST /v1/organizations         → org (created_by user)
 *   3. Clerk Backend API  POST /v1/sign_in_tokens        → one-time ticket
 *   4. FAPI               POST /v1/client/sign_ins        → redeem ticket (strategy=ticket)
 *   5. FAPI               POST /v1/client/sessions/{sid}/touch  → set active org
 *   6. FAPI               POST /v1/client/sessions/{sid}/tokens → __session JWT
 *   → cleanup deletes the org + user (best-effort, always runs)
 *
 * `fetch` is injected so the step sequence / cookie propagation / cleanup calls
 * are unit-testable; the live redemption is validated by the owner running the
 * workflow with real secrets. Every synthetic identity uses an `@*.local` email
 * so it can never collide with (or rebind, per #504) a real user row.
 */

import {
  analyzeNavigation,
  isAuthErrorPath,
  isResolvingPath,
  isSignInPath,
  pathOf,
  type NavHop,
  type NavOutcome,
} from './holderRoutes';

export type FetchLike = typeof fetch;

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36 vitalcv-release-monitor';

const CLERK_JS_VERSION = '5';
const DEFAULT_CLERK_API = 'https://api.clerk.com';
const DEFAULT_FAPI = 'https://clerk.vitalcv.com';

export interface SyntheticClinicianDeps {
  fetchImpl?: FetchLike;
  clerkSecretKey: string;
  /** Clerk Backend API base. Default https://api.clerk.com. */
  clerkApiBase?: string;
  /** Clerk Frontend API (FAPI) base. Default https://clerk.vitalcv.com. */
  fapiBase?: string;
  /** Deployed web origin, e.g. https://vitalcv.com — the FAPI Origin + the app under test. */
  appBase: string;
  /** Deterministic run id — seeds the synthetic email/org name (no Math.random). */
  runId: string;
  now?: () => number;
  /** Invoked with a snapshot of created ids the instant each Clerk resource
   *  exists (user, then org), so a hard-kill handler can clean up resources
   *  created mid-mint — before mintClinicianSession() returns. */
  onResourceCreated?: (created: { userId: string | null; orgId: string | null }) => void;
}

export interface ClinicianSession {
  userId: string;
  orgId: string | null;
  sessionId: string | null;
  jwt: string;
  clientUat: string;
  /** Cookie jar (name → value); seeded with __session/__client_uat, gains vitalcv_role. */
  cookies: Record<string, string>;
  email: string;
}

export interface MintResult {
  ok: boolean;
  session?: ClinicianSession;
  /** Always populated with whatever was created, so cleanup can run on partial failure. */
  created: { userId: string | null; orgId: string | null };
  error?: string;
}

/**
 * Reduce a Clerk / FAPI error body to safe, structured fields before it can
 * reach logs, the Actions job summary, or report.json. Clerk error responses
 * are `{ errors: [{ code, message, long_message }] }`; a raw-body dump risked
 * echoing credential-adjacent material (the sign-in ticket, request echoes).
 * We keep only code + message, and defensively redact any long token-like
 * fragment that slips through.
 */
export function safeErrorBody(text: string): string {
  try {
    const parsed = JSON.parse(text) as { errors?: Array<{ code?: unknown; message?: unknown }> };
    const errs = Array.isArray(parsed?.errors) ? parsed.errors : [];
    const fields = errs
      .flatMap((e) => [typeof e?.code === 'string' ? e.code : '', typeof e?.message === 'string' ? e.message : ''])
      .filter(Boolean)
      .slice(0, 4);
    const joined = fields.join('; ').slice(0, 160);
    // Redact token-like runs (≥16 chars containing a digit — tickets/JWTs/keys)
    // while leaving readable word-codes like `form_identifier_exists` intact.
    const redacted = joined.replace(/[A-Za-z0-9_-]{16,}/g, (m) => (/\d/.test(m) ? '[redacted]' : m));
    return redacted || 'clerk error (no safe fields)';
  } catch {
    return 'clerk error (unparseable body)';
  }
}

// ── cookie-jar helpers ──────────────────────────────────────────────────────

function getSetCookies(res: Response): string[] {
  const anyHeaders = res.headers as unknown as { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === 'function') return anyHeaders.getSetCookie();
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}

export function mergeSetCookie(jar: Record<string, string>, res: Response): void {
  for (const c of getSetCookies(res)) {
    const pair = c.split(';', 1)[0];
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (name) jar[name] = value;
  }
}

export function cookieHeader(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function absolutize(location: string, currentUrl: string): string {
  try {
    return new URL(location, currentUrl).toString();
  } catch {
    return location;
  }
}

function relPath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

// ── Clerk Backend API + FAPI primitives ─────────────────────────────────────

function backendHeaders(secret: string): Record<string, string> {
  return {
    Authorization: `Bearer ${secret}`,
    'Content-Type': 'application/json',
    'User-Agent': BROWSER_UA,
  };
}

function fapiUrl(base: string, path: string): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${base}${path}${sep}_clerk_js_version=${CLERK_JS_VERSION}`;
}

function fapiHeaders(origin: string, jar: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': BROWSER_UA,
    Origin: origin,
    Referer: origin + '/',
  };
  const cookie = cookieHeader(jar);
  if (cookie) h.Cookie = cookie;
  return h;
}

/** Mint a fresh synthetic clinician session. Never throws — returns MintResult. */
export async function mintClinicianSession(deps: SyntheticClinicianDeps): Promise<MintResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const clerkApi = deps.clerkApiBase ?? DEFAULT_CLERK_API;
  const fapi = deps.fapiBase ?? DEFAULT_FAPI;
  const origin = new URL(deps.appBase).origin;
  const nowMs = (deps.now ?? Date.now)();
  const email = `svc-monitor+${deps.runId}@vitalcv-monitor.local`;
  const created: { userId: string | null; orgId: string | null } = { userId: null, orgId: null };
  const jar: Record<string, string> = {};

  // Fail fast with a crisp operator message — an empty key would otherwise
  // surface as a cryptic Clerk 401 ("Invalid Authorization header format").
  if (!deps.clerkSecretKey.trim()) {
    return { ok: false, created, error: 'CLERK_SECRET_KEY is not set — cannot mint a synthetic clinician' };
  }

  try {
    // 1. Create the synthetic user (role hint in metadata; the backend upsert is authoritative).
    const userRes = await fetchImpl(`${clerkApi}/v1/users`, {
      method: 'POST',
      headers: backendHeaders(deps.clerkSecretKey),
      body: JSON.stringify({
        email_address: [email],
        skip_password_checks: true,
        skip_password_requirement: true,
        public_metadata: { vitalcv: { role: 'CLINICIAN' }, synthetic: true, purpose: 'release-monitor' },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!userRes.ok) {
      return { ok: false, created, error: `create user ${userRes.status}: ${safeErrorBody(await userRes.text())}` };
    }
    const user = (await userRes.json()) as { id: string };
    created.userId = user.id;
    // Report the id THE INSTANT it exists — a hard kill (step timeout) during the
    // subsequent FAPI work must still be able to clean this user up. Reporting
    // only after mint() returns would leak a user created mid-mint.
    deps.onResourceCreated?.({ ...created });

    // 2. Create an org owned by the user (satisfies instances that require an active org).
    try {
      const orgRes = await fetchImpl(`${clerkApi}/v1/organizations`, {
        method: 'POST',
        headers: backendHeaders(deps.clerkSecretKey),
        body: JSON.stringify({ name: `vcv-monitor-${deps.runId}`, created_by: user.id }),
        signal: AbortSignal.timeout(15000),
      });
      if (orgRes.ok) {
        const org = (await orgRes.json()) as { id: string };
        created.orgId = org.id;
        deps.onResourceCreated?.({ ...created });
      }
    } catch {
      /* org is best-effort — instances without orgs still yield a usable session */
    }

    // 3. One-time sign-in ticket.
    const tokenRes = await fetchImpl(`${clerkApi}/v1/sign_in_tokens`, {
      method: 'POST',
      headers: backendHeaders(deps.clerkSecretKey),
      body: JSON.stringify({ user_id: user.id }),
      signal: AbortSignal.timeout(15000),
    });
    if (!tokenRes.ok) {
      return { ok: false, created, error: `sign_in_tokens ${tokenRes.status}: ${safeErrorBody(await tokenRes.text())}` };
    }
    const ticket = ((await tokenRes.json()) as { token: string }).token;

    // 4. Redeem the ticket at the FAPI to create the client session.
    const signInRes = await fetchImpl(fapiUrl(fapi, '/v1/client/sign_ins'), {
      method: 'POST',
      headers: fapiHeaders(origin, jar),
      body: new URLSearchParams({ strategy: 'ticket', ticket }).toString(),
      signal: AbortSignal.timeout(15000),
    });
    mergeSetCookie(jar, signInRes);
    if (!signInRes.ok) {
      return { ok: false, created, error: `FAPI sign_ins ${signInRes.status}: ${safeErrorBody(await signInRes.text())}` };
    }
    const signIn = (await signInRes.json()) as {
      response?: { created_session_id?: string; status?: string };
      client?: { sessions?: Array<{ id: string }>; last_active_session_id?: string };
    };
    const sessionId =
      signIn.response?.created_session_id ??
      signIn.client?.last_active_session_id ??
      signIn.client?.sessions?.[0]?.id ??
      null;
    if (!sessionId) {
      return { ok: false, created, error: `no session id after ticket redemption (status=${signIn.response?.status ?? '∅'})` };
    }

    // 5. Set the active organization on the session (best-effort).
    if (created.orgId) {
      try {
        const touchRes = await fetchImpl(fapiUrl(fapi, `/v1/client/sessions/${sessionId}/touch`), {
          method: 'POST',
          headers: fapiHeaders(origin, jar),
          body: new URLSearchParams({ active_organization_id: created.orgId }).toString(),
          signal: AbortSignal.timeout(15000),
        });
        mergeSetCookie(jar, touchRes);
      } catch {
        /* touch is best-effort */
      }
    }

    // 6. Mint the __session JWT.
    const jwtRes = await fetchImpl(fapiUrl(fapi, `/v1/client/sessions/${sessionId}/tokens`), {
      method: 'POST',
      headers: fapiHeaders(origin, jar),
      body: '',
      signal: AbortSignal.timeout(15000),
    });
    mergeSetCookie(jar, jwtRes);
    if (!jwtRes.ok) {
      return { ok: false, created, error: `FAPI session tokens ${jwtRes.status}: ${safeErrorBody(await jwtRes.text())}` };
    }
    const jwt = ((await jwtRes.json()) as { jwt: string }).jwt;
    if (!jwt) return { ok: false, created, error: 'no jwt returned from session tokens' };

    // Middleware treats a cookie session as signed-out unless __client_uat is
    // present and non-zero (P0 harness note). Seed both cookies + send the
    // bearer, so auth never reads as signed-out for a transport reason.
    const clientUat = jar.__client_uat ?? String(Math.floor(nowMs / 1000));
    jar.__session = jwt;
    jar.__client_uat = clientUat;

    return {
      ok: true,
      created,
      session: { userId: user.id, orgId: created.orgId, sessionId, jwt, clientUat, cookies: jar, email },
    };
  } catch (err) {
    return { ok: false, created, error: `mint error: ${(err as Error).message}` };
  }
}

/** Re-mint the short-lived __session JWT (60s TTL) to widen the verification window. */
export async function refreshSessionToken(deps: SyntheticClinicianDeps, session: ClinicianSession): Promise<boolean> {
  if (!session.sessionId) return false;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const fapi = deps.fapiBase ?? DEFAULT_FAPI;
  const origin = new URL(deps.appBase).origin;
  try {
    const res = await fetchImpl(fapiUrl(fapi, `/v1/client/sessions/${session.sessionId}/tokens`), {
      method: 'POST',
      headers: fapiHeaders(origin, session.cookies),
      body: '',
      signal: AbortSignal.timeout(15000),
    });
    mergeSetCookie(session.cookies, res);
    if (!res.ok) return false;
    const jwt = ((await res.json()) as { jwt: string }).jwt;
    if (!jwt) return false;
    session.jwt = jwt;
    session.cookies.__session = jwt;
    return true;
  } catch {
    return false;
  }
}

function authHeaders(session: ClinicianSession): Record<string, string> {
  return {
    Authorization: `Bearer ${session.jwt}`,
    Cookie: cookieHeader(session.cookies),
    'User-Agent': BROWSER_UA,
    Accept: 'text/html,application/xhtml+xml',
  };
}

export interface WarmUpResult {
  ok: boolean;
  hops: NavHop[];
  reason?: string;
}

/**
 * Drive the cold-start signed-in navigation the way a browser would, capturing
 * the `vitalcv_role` cookie the flow mints. This IS the P0 detector: a fresh
 * session hitting `/holder` either resolves (200, cookie set — the #503 shape),
 * bounces to `/auth/error` (P0 live), or is handed the `/auth/resolving`
 * interstitial (#507), which we emulate by calling `/api/auth/resolve-role`.
 */
export async function warmUpClinicianSession(
  deps: SyntheticClinicianDeps,
  session: ClinicianSession,
  maxHops = 8,
): Promise<WarmUpResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const origin = new URL(deps.appBase).origin;
  const hops: NavHop[] = [];
  let url = `${deps.appBase}/holder`;

  for (let i = 0; i < maxHops; i += 1) {
    let res: Response;
    try {
      res = await fetchImpl(url, { headers: authHeaders(session), redirect: 'manual', signal: AbortSignal.timeout(15000) });
    } catch (err) {
      return { ok: false, hops, reason: `request error: ${(err as Error).message}` };
    }
    mergeSetCookie(session.cookies, res);
    const location = res.headers.get('location');
    hops.push({ url: relPath(url), status: res.status, location });

    if (res.status === 200) {
      // The 200 must be ON the clinician surface. A role-mismatch redirect
      // (middleware sends a wrong-role user to its ROLE_LANDING, which 200s)
      // must fail, not pass — the whole point is that a CLINICIAN reaches /holder.
      const finalPath = pathOf(url);
      if (finalPath !== '/holder' && !finalPath.startsWith('/holder/')) {
        return { ok: false, hops, reason: `wrong_destination ${finalPath}` };
      }
      return { ok: true, hops };
    }

    if (res.status >= 300 && res.status < 400 && location) {
      if (isAuthErrorPath(location)) return { ok: false, hops, reason: 'auth_error' };
      if (isSignInPath(location)) return { ok: false, hops, reason: 'sign_in' };
      if (isResolvingPath(location)) {
        // Emulate the interstitial's browser fetch to mint the role cookie.
        try {
          const rr = await fetchImpl(`${deps.appBase}/api/auth/resolve-role`, {
            headers: { ...authHeaders(session), 'x-clerk-user-id': session.userId, Origin: origin },
            redirect: 'manual',
            signal: AbortSignal.timeout(15000),
          });
          mergeSetCookie(session.cookies, rr);
          if (!rr.ok) return { ok: false, hops, reason: `resolve-role ${rr.status}` };
        } catch (err) {
          return { ok: false, hops, reason: `resolve-role error: ${(err as Error).message}` };
        }
        url = `${deps.appBase}/holder`;
        continue;
      }
      url = absolutize(location, url);
      continue;
    }

    return { ok: false, hops, reason: `non_200 status ${res.status}` };
  }
  return { ok: false, hops, reason: 'too_many_hops' };
}

/** Steady-state reachability of one route with the (now resolved) session. */
export async function reachRoute(
  deps: SyntheticClinicianDeps,
  session: ClinicianSession,
  path: string,
  maxHops = 5,
): Promise<NavOutcome> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const hops: NavHop[] = [];
  let url = `${deps.appBase}${path}`;

  for (let i = 0; i < maxHops; i += 1) {
    let res: Response;
    try {
      res = await fetchImpl(url, { headers: authHeaders(session), redirect: 'manual', signal: AbortSignal.timeout(15000) });
    } catch (err) {
      return { ok: false, finalStatus: 0, finalUrl: `${path} (${(err as Error).message})`, hops: hops.length + 1, reason: 'non_200' };
    }
    mergeSetCookie(session.cookies, res);
    const location = res.headers.get('location');
    hops.push({ url: relPath(url), status: res.status, location });
    if (res.status >= 300 && res.status < 400 && location) {
      url = absolutize(location, url);
      continue;
    }
    break;
  }
  // Enforce the terminal path is the requested surface (or under it) — a
  // role-mismatch redirect that 200s elsewhere is a failure, not a pass.
  return analyzeNavigation(hops, pathOf(path));
}

export interface CleanupResult {
  attempted: boolean;
  ok: boolean;
  detail: string;
}

/**
 * Delete the synthetic org + user (best-effort, idempotent). Takes the `created`
 * ids directly so it runs even when mint failed partway. Note: the backend has
 * no delete API for the `User` row it upserts on first role-resolve, so one
 * orphan DB row per run remains (placeholder `@*.local` email, non-colliding —
 * see doc for the reconciliation follow-up).
 */
export async function cleanupClinician(
  deps: SyntheticClinicianDeps,
  created: { userId: string | null; orgId: string | null },
): Promise<CleanupResult> {
  if (!created.userId && !created.orgId) return { attempted: false, ok: true, detail: 'nothing to clean up' };
  const fetchImpl = deps.fetchImpl ?? fetch;
  const clerkApi = deps.clerkApiBase ?? DEFAULT_CLERK_API;
  const problems: string[] = [];

  if (created.orgId) {
    try {
      const res = await fetchImpl(`${clerkApi}/v1/organizations/${created.orgId}`, {
        method: 'DELETE',
        headers: backendHeaders(deps.clerkSecretKey),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok && res.status !== 404) problems.push(`org ${res.status}`);
    } catch (err) {
      problems.push(`org error ${(err as Error).message}`);
    }
  }

  if (created.userId) {
    try {
      const res = await fetchImpl(`${clerkApi}/v1/users/${created.userId}`, {
        method: 'DELETE',
        headers: backendHeaders(deps.clerkSecretKey),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok && res.status !== 404) problems.push(`user ${res.status}`);
    } catch (err) {
      problems.push(`user error ${(err as Error).message}`);
    }
  }

  return problems.length
    ? { attempted: true, ok: false, detail: `cleanup issues: ${problems.join(', ')}` }
    : { attempted: true, ok: true, detail: 'deleted synthetic user + org' };
}
