/**
 * Carrying the NPI across sign-in and back — Wave 1076 B1.
 *
 * The clinician sees a resolved preview before they have an account. Signing in
 * navigates them away to Clerk and back, and the product's entire promise is
 * that they do not type anything twice — so the NPI has to survive that round
 * trip, and every other way a browser can lose state.
 *
 * Three layers, deliberately, because each one fails differently:
 *
 *   1. **The URL** (`?npi=…`) — survives sign-in, because the return
 *      destination sent to Clerk carries the query string. Also survives a
 *      refresh, a bookmark, and a link the clinician sends to themselves.
 *   2. **localStorage** — survives a browser restart and a return with no
 *      query, which is where a session-scoped store would have dropped it.
 *   3. **The durable draft on the server** — survives everything, including a
 *      different machine. The surface asks for it when the first two are empty.
 *
 * Only the first two live here; the third is a fetch. What matters is that no
 * layer is load-bearing alone.
 *
 * On what is stored: an NPI is a public federal identifier, published in the
 * NPPES directory, so this is not private data being cached. It is still
 * cleared once the profile is active, because a stale pending value on a shared
 * computer is a confusing thing to leave behind, not because it is a secret.
 */

const STORAGE_KEY = 'vitalcv.activation.pendingNpi';
const NPI_RE = /^\d{10}$/;

export const ACTIVATION_PATH = '/profile/activate';

function isNpi(value: unknown): value is string {
  return typeof value === 'string' && NPI_RE.test(value.trim());
}

/**
 * Storage access that cannot throw.
 *
 * `localStorage` is not merely absent on the server — it throws on ACCESS in
 * Safari private browsing and when a user has blocked site data. An unguarded
 * read there would take down the whole activation surface for a reason that has
 * nothing to do with the profile.
 */
function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function rememberPendingNpi(npi: string): void {
  if (!isNpi(npi)) return;
  try {
    safeStorage()?.setItem(STORAGE_KEY, npi.trim());
  } catch {
    /* Storage full or blocked. The URL and the server draft still carry it. */
  }
}

export function readPendingNpi(): string | null {
  try {
    const raw = safeStorage()?.getItem(STORAGE_KEY);
    // Validated on the way out as well as in: whatever is in storage came from
    // a browser, and a value read back is about to be put into a URL.
    return isNpi(raw) ? (raw as string).trim() : null;
  } catch {
    return null;
  }
}

export function clearPendingNpi(): void {
  try {
    safeStorage()?.removeItem(STORAGE_KEY);
  } catch {
    /* Nothing to do — a value we cannot remove is one we also cannot read. */
  }
}

/** Where the activation flow lives for a given NPI. */
export function activationPath(npi: string): string {
  return isNpi(npi) ? `${ACTIVATION_PATH}?npi=${encodeURIComponent(npi.trim())}` : ACTIVATION_PATH;
}

/**
 * The sign-in link that comes back to the right place.
 *
 * `redirect_url` is built here from a validated NPI and a fixed path, never
 * from anything a caller supplies, so it cannot become an off-site bounce.
 */
export function signInHref(npi: string): string {
  return `/sign-in?redirect_url=${encodeURIComponent(activationPath(npi))}`;
}

/**
 * The NPI this surface should work on: the URL first, then what the browser
 * remembered. Returns null when neither has one — the caller then asks the
 * server for a draft, which is the layer that works on a new machine.
 */
export function resolveWorkingNpi(fromUrl: string | null | undefined): string | null {
  if (isNpi(fromUrl)) return (fromUrl as string).trim();
  return readPendingNpi();
}
