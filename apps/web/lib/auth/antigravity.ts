/**
 * Antigravity routing contract — WAVE C73.
 *
 * Verifiers exist to make decisions on receipts. Any navigation that
 * pulls them off their active receipt route — onto a SaaS-style
 * dashboard, an empty "home", or a non-canonical action subpath — is
 * a contract violation. This module is the pure decision function for
 * the middleware enforcement.
 *
 * Edge-safe: no DB, no fetch, no Clerk SDK. Reads only the request URL
 * + cookies. Cookies are set server-side by the `/verify/receipt/<id>`
 * page renderer when a verifier loads a receipt.
 *
 * Status semantics:
 *   - `ACTIVE`   — verifier may interact (accept / revoke / etc.)
 *   - `ACCEPTED` — read-only; no further mutating actions
 *   - `REVOKED`  — read-only; revocation is terminal
 */

export type AntigravityRole = 'VERIFIER' | 'CLINICIAN' | 'ISSUER' | 'ADMIN' | 'AUTHENTICATED' | null;
export type ReceiptStatus = 'ACTIVE' | 'ACCEPTED' | 'REVOKED' | null;

export const ANTIGRAVITY_COOKIE_ACTIVE_RECEIPT = 'vcv_active_receipt';
export const ANTIGRAVITY_COOKIE_RECEIPT_STATUS = 'vcv_active_receipt_status';

/**
 * Canonical paths a VERIFIER is allowed to be on while a receipt is
 * active. Anything outside this list redirects back to the active
 * receipt URL.
 *
 * `/verify` (root) and `/verify/guide` are explicitly allowed so the
 * verifier can return to the discovery landing without being trapped.
 */
const CANONICAL_VERIFIER_PATHS_EXACT = new Set<string>([
  '/verify',
  '/verify/',
  '/verify/guide',
  '/sign-in',
  '/sign-up',
]);

const CANONICAL_VERIFIER_PATH_PREFIXES = [
  // The active receipt-detail surface is canonical
  '/verify/receipt/',
] as const;

/**
 * Routes that always pull a verifier off-contract — explicit denylist
 * for clarity in the audit log.
 */
const ANTIGRAVITY_BLOCKED_PATHS_EXACT = new Set<string>([
  '/dashboard',
  '/dashboard/',
  '/home',
  '/home/',
]);

const ANTIGRAVITY_BLOCKED_PATH_PREFIXES = [
  '/dashboard/',
  '/home/',
] as const;

export interface AntigravityInput {
  role: AntigravityRole;
  pathname: string;
  activeReceiptId: string | null;
  receiptStatus: ReceiptStatus;
}

export interface AntigravityDecision {
  /**
   * `pass` — allow the request through unchanged.
   * `redirect` — issue a 307 to `redirectTo`.
   */
  action: 'pass' | 'redirect';
  redirectTo?: string;
  /** Machine-readable reason for telemetry. */
  reason?:
    | 'verifier_blocked_route'
    | 'verifier_off_canonical_path'
    | 'receipt_terminal_status_locked_to_read_only';
}

function isCanonicalVerifierPath(pathname: string): boolean {
  if (CANONICAL_VERIFIER_PATHS_EXACT.has(pathname)) return true;
  return CANONICAL_VERIFIER_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

function isExplicitlyBlocked(pathname: string): boolean {
  if (ANTIGRAVITY_BLOCKED_PATHS_EXACT.has(pathname)) return true;
  return ANTIGRAVITY_BLOCKED_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * Pure decision function. Given the request shape, returns whether to
 * pass or 307-redirect, and where.
 *
 * Order of rules (binding):
 *   1. Non-VERIFIER roles always pass — antigravity is verifier-scoped.
 *   2. If the route is in the explicit denylist (`/dashboard`, `/home`,
 *      etc.) AND the verifier has an active receipt → redirect home to
 *      the receipt.
 *   3. If the receipt status is terminal (ACCEPTED | REVOKED) AND the
 *      verifier is on any path other than the canonical read-only
 *      receipt view → redirect home to the receipt (locked-read-only).
 *   4. If the verifier is on a non-canonical path AND has an active
 *      receipt → redirect home.
 *   5. Otherwise pass.
 */
export function evaluateAntigravityRoute(
  input: AntigravityInput,
): AntigravityDecision {
  if (input.role !== 'VERIFIER') return { action: 'pass' };

  const { pathname, activeReceiptId, receiptStatus } = input;
  const homeUrl = activeReceiptId
    ? `/verify/receipt/${encodeURIComponent(activeReceiptId)}`
    : null;

  // Rule 2 — explicit denylist
  if (isExplicitlyBlocked(pathname) && homeUrl) {
    return {
      action: 'redirect',
      redirectTo: homeUrl,
      reason: 'verifier_blocked_route',
    };
  }

  // Rule 3 — terminal status locks the verifier to read-only receipt
  if (
    homeUrl &&
    (receiptStatus === 'ACCEPTED' || receiptStatus === 'REVOKED') &&
    pathname !== homeUrl
  ) {
    return {
      action: 'redirect',
      redirectTo: homeUrl,
      reason: 'receipt_terminal_status_locked_to_read_only',
    };
  }

  // Rule 4 — non-canonical path during an active receipt session
  if (homeUrl && !isCanonicalVerifierPath(pathname)) {
    return {
      action: 'redirect',
      redirectTo: homeUrl,
      reason: 'verifier_off_canonical_path',
    };
  }

  return { action: 'pass' };
}
