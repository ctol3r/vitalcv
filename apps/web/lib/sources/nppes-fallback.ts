/**
 * NPPES public-registry fallback (LIVE-101).
 *
 * When the VitalCV backend ingest pipeline is unreachable, we still
 * want the homepage hero to surface source-backed *identity* — NPPES
 * is a public, unauthenticated, no-PHI API operated by CMS. Hitting
 * it directly is safe.
 *
 * What this does:
 *   - calls https://npiregistry.cms.hhs.gov/api/?version=2.1&number=<npi>
 *   - returns a tight projection of public-registry fields only
 *   - never hits anything other than NPPES; never returns a bare error
 *     stack; never claims licensure validity.
 *
 * What this is NOT:
 *   - not a license check (NPPES does not validate license status)
 *   - not an OIG/LEIE check (federal exclusions are a separate lane)
 *   - not a PECOS check (Medicare enrollment is a separate lane)
 *   - not a substitute for primary source verification
 */

const NPPES_API = 'https://npiregistry.cms.hhs.gov/api';
const NPPES_VERSION = '2.1';

export interface NppesIdentityProjection {
  /** Full provider/organization name as listed on NPPES. */
  displayName: string;
  /** NPI-1 (Individual) or NPI-2 (Organization). */
  enumerationType: 'NPI-1' | 'NPI-2' | 'unknown';
  /** Primary taxonomy code + description if NPPES exposes one. */
  taxonomy: string | null;
  /** ISO date when the NPI was first enumerated. */
  enumerationDate: string | null;
  /** ISO date NPPES last updated this record. */
  lastUpdated: string | null;
  /** "A" = Active, "I" = Inactive (deactivated). Anything else → "unknown". */
  nppesStatus: 'A' | 'I' | 'unknown';
  /** Practice state if listed. NOT a license-state claim. */
  practiceState: string | null;
}

export interface NppesFallbackOk {
  ok: true;
  identity: NppesIdentityProjection;
  /** When the NPPES fetch returned successfully (ISO-8601 UTC). */
  fetchedAt: string;
  /** Public-API source URL we read from, for receipt-style attribution. */
  sourceUrl: string;
}

export interface NppesFallbackFail {
  ok: false;
  reason:
    | 'not_found'
    | 'invalid_shape'
    | 'timeout'
    | 'network'
    | 'non_json'
    | 'upstream_error';
  /** When the attempt happened (ISO-8601 UTC). */
  attemptedAt: string;
}

export type NppesFallbackResult = NppesFallbackOk | NppesFallbackFail;

function isValidNpi(raw: string): boolean {
  return /^\d{10}$/.test(raw);
}

function pickEnumerationType(value: unknown): NppesIdentityProjection['enumerationType'] {
  if (value === 'NPI-1' || value === 'NPI-2') return value;
  return 'unknown';
}

function pickStatus(value: unknown): NppesIdentityProjection['nppesStatus'] {
  if (value === 'A' || value === 'I') return value;
  return 'unknown';
}

function pickDisplayName(basic: Record<string, unknown> | null): string {
  if (!basic) return '';
  const orgName = typeof basic.organization_name === 'string' ? basic.organization_name : '';
  if (orgName.trim()) return orgName.trim();
  const first = typeof basic.first_name === 'string' ? basic.first_name : '';
  const last = typeof basic.last_name === 'string' ? basic.last_name : '';
  return [first, last].filter(Boolean).join(' ').trim();
}

function pickTaxonomy(taxonomies: unknown): string | null {
  if (!Array.isArray(taxonomies)) return null;
  const primary = taxonomies.find(
    (t) => t && typeof t === 'object' && (t as Record<string, unknown>).primary === true,
  ) ?? taxonomies[0];
  if (!primary || typeof primary !== 'object') return null;
  const t = primary as Record<string, unknown>;
  const code = typeof t.code === 'string' ? t.code : '';
  const desc = typeof t.desc === 'string' ? t.desc : '';
  if (!code && !desc) return null;
  return [desc || null, code ? `(${code})` : null].filter(Boolean).join(' ').trim() || null;
}

function pickPracticeState(addresses: unknown): string | null {
  if (!Array.isArray(addresses)) return null;
  const location = addresses.find(
    (a) => a && typeof a === 'object' && (a as Record<string, unknown>).address_purpose === 'LOCATION',
  ) ?? addresses[0];
  if (!location || typeof location !== 'object') return null;
  const state = (location as Record<string, unknown>).state;
  return typeof state === 'string' && state.length > 0 ? state : null;
}

interface NppesFetchOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /** Overridable for tests so we don't bake the public URL into assertions. */
  baseUrl?: string;
}

export async function fetchNppesIdentityFallback(
  npi: string,
  options: NppesFetchOptions = {},
): Promise<NppesFallbackResult> {
  const attemptedAt = new Date().toISOString();
  if (!isValidNpi(npi)) {
    return { ok: false, reason: 'invalid_shape', attemptedAt };
  }

  const baseUrl = options.baseUrl ?? NPPES_API;
  const url = `${baseUrl}?version=${NPPES_VERSION}&number=${encodeURIComponent(npi)}`;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(url, { method: 'GET', signal: controller.signal });
    if (!res.ok) {
      return { ok: false, reason: 'upstream_error', attemptedAt };
    }
    let body: Record<string, unknown> | null = null;
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      return { ok: false, reason: 'non_json', attemptedAt };
    }
    const results = body?.results;
    if (!Array.isArray(results) || results.length === 0) {
      return { ok: false, reason: 'not_found', attemptedAt };
    }
    const first = results[0] as Record<string, unknown>;
    const basic = (first.basic as Record<string, unknown> | undefined) ?? null;

    const identity: NppesIdentityProjection = {
      displayName: pickDisplayName(basic),
      enumerationType: pickEnumerationType(first.enumeration_type),
      taxonomy: pickTaxonomy(first.taxonomies),
      enumerationDate:
        typeof basic?.enumeration_date === 'string' ? (basic.enumeration_date as string) : null,
      lastUpdated:
        typeof basic?.last_updated === 'string' ? (basic.last_updated as string) : null,
      nppesStatus: pickStatus(basic?.status),
      practiceState: pickPracticeState(first.addresses),
    };

    return {
      ok: true,
      identity,
      fetchedAt: attemptedAt,
      sourceUrl: url,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, reason: 'timeout', attemptedAt };
    }
    return { ok: false, reason: 'network', attemptedAt };
  } finally {
    clearTimeout(timer);
  }
}
