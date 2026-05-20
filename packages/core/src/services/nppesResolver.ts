/**
 * Live NPPES NPI resolver — WAVE C77.
 *
 * Fetches the CMS public NPI registry and maps the response to a
 * minimal DTO. Pure-functional from the caller's point of view; the
 * fetcher is injected so tests can mock without touching the network.
 *
 * Source: https://npiregistry.cms.hhs.gov/api/?number={npi}&version=2.1
 *
 * The CMS API is public, free, no API key required. It returns HTTP
 * 200 with `result_count: 0` for NPIs that don't exist — we surface
 * that as a typed `NppesNotFound` outcome, never a thrown error.
 */

export const NPPES_API_BASE = 'https://npiregistry.cms.hhs.gov/api/';
export const NPPES_API_VERSION = '2.1';
export const NPPES_DEFAULT_TIMEOUT_MS = 4000;

export interface NppesProviderDto {
  firstName: string | null;
  lastName: string | null;
  credential: string | null;
  primaryTaxonomy: {
    code: string | null;
    desc: string | null;
  };
  activeState: string | null;
}

export type NppesResolutionOutcome =
  | { kind: 'found'; provider: NppesProviderDto }
  | { kind: 'not_found' }
  | { kind: 'upstream_error'; status: number }
  | { kind: 'network_error'; detail: string };

export interface NppesResolverDeps {
  /** Override the global fetch (tests, custom proxies, mirrors). */
  fetchImpl?: typeof fetch;
  /** Override the API base (offline-demo mirror or staging). */
  apiBase?: string;
  /** Override the API version. */
  apiVersion?: string;
  /** Request abort timeout in ms. */
  timeoutMs?: number;
}

// ── CMS NPPES response shapes (narrow) ────────────────────────────────────

interface NppesBasic {
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  credential?: string;
  name_prefix?: string;
  name_suffix?: string;
  name?: string;
}

interface NppesTaxonomy {
  code?: string;
  desc?: string;
  primary?: boolean;
  state?: string;
}

interface NppesAddress {
  state?: string;
  address_purpose?: string;
}

interface NppesResult {
  number?: string;
  basic?: NppesBasic;
  taxonomies?: NppesTaxonomy[];
  addresses?: NppesAddress[];
}

interface NppesResponse {
  result_count?: number;
  results?: NppesResult[];
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Resolves an NPI against the NPPES API. Returns a typed outcome:
 *   - `found`           — provider DTO populated from the first result
 *   - `not_found`       — CMS returned `result_count: 0`
 *   - `upstream_error`  — CMS returned a non-2xx status
 *   - `network_error`   — fetch threw / timed out
 *
 * Never throws; callers can render every outcome deterministically.
 */
export async function resolveNppes(
  npi: string,
  deps: NppesResolverDeps = {},
): Promise<NppesResolutionOutcome> {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const apiBase = deps.apiBase ?? NPPES_API_BASE;
  const apiVersion = deps.apiVersion ?? NPPES_API_VERSION;
  const timeoutMs = deps.timeoutMs ?? NPPES_DEFAULT_TIMEOUT_MS;

  const url = `${apiBase}?number=${encodeURIComponent(npi)}&version=${encodeURIComponent(apiVersion)}`;

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetchImpl(url, {
      signal: ac.signal,
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    clearTimeout(timeout);
    const detail = err instanceof Error ? err.message.slice(0, 120) : 'unknown';
    return { kind: 'network_error', detail };
  }
  clearTimeout(timeout);

  if (!res.ok) {
    // CMS treats unknown NPIs as 200 with result_count=0, so a non-2xx
    // here is genuinely an upstream issue rather than a missing NPI.
    return { kind: 'upstream_error', status: res.status };
  }

  let json: NppesResponse;
  try {
    json = (await res.json()) as NppesResponse;
  } catch {
    return { kind: 'upstream_error', status: 502 };
  }

  if (!json.results || json.results.length === 0 || json.result_count === 0) {
    return { kind: 'not_found' };
  }

  return { kind: 'found', provider: projectMinimalDto(json.results[0]) };
}

/**
 * Projects the raw NPPES result into the minimal DTO. Exported for
 * tests; production callers should go through `resolveNppes` so the
 * outcome envelope is consistent.
 */
export function projectMinimalDto(r: NppesResult): NppesProviderDto {
  const basic = r.basic ?? {};
  const taxonomies = r.taxonomies ?? [];
  const primary =
    taxonomies.find((t) => t.primary === true) ?? taxonomies[0] ?? null;
  const locationAddr =
    r.addresses?.find((a) => a.address_purpose === 'LOCATION' && a.state) ??
    r.addresses?.find((a) => a.state) ??
    null;
  return {
    firstName: trimToNull(basic.first_name),
    lastName: trimToNull(basic.last_name),
    credential: trimToNull(basic.credential),
    primaryTaxonomy: {
      code: trimToNull(primary?.code),
      desc: trimToNull(primary?.desc),
    },
    activeState: trimToNull(primary?.state ?? locationAddr?.state),
  };
}

function trimToNull(value: string | undefined | null): string | null {
  if (!value) return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

// ── NPI Luhn (re-exported so callers don't reimplement) ──────────────────

/**
 * Validates the 10-digit NPI Luhn checksum (ISO/IEC 7812 with "80840"
 * prefix). Use BEFORE calling `resolveNppes` so malformed inputs never
 * hit the upstream service.
 */
export function isValidNpiChecksum(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false;
  const digits = ('80840' + npi).split('').map(Number);
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i];
    if ((digits.length - 1 - i) % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}
