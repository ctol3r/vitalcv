import type { ClinicianIdentity, NpiTaxonomy, PracticeLocation } from './models';
import { normalizeStates } from './engine';

export type NppesFetchResponse = Readonly<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export type NppesFetcher = (
  url: string,
  init?: {
    headers?: Readonly<Record<string, string>>;
  },
) => Promise<NppesFetchResponse>;

export class NpiIngestError extends Error {
  public readonly code:
    | 'INVALID_NPI'
    | 'INVALID_NPI_CHECKSUM'
    | 'NPPES_UNAVAILABLE'
    | 'NPPES_NOT_FOUND';

  constructor(
    message: string,
    code: 'INVALID_NPI' | 'INVALID_NPI_CHECKSUM' | 'NPPES_UNAVAILABLE' | 'NPPES_NOT_FOUND',
  ) {
    super(message);
    this.name = 'NpiIngestError';
    this.code = code;
  }
}

function assertNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new NpiIngestError(`${field} is required`, 'INVALID_NPI');
  }

  return value.trim();
}

export function normalizeNpi(rawNpi: unknown): string {
  const npi = assertNonEmptyString(rawNpi, 'npi');
  if (!/^\d{10}$/.test(npi)) {
    throw new NpiIngestError('npi must be a 10-digit numeric string', 'INVALID_NPI');
  }

  if (!isValidNpiChecksum(npi)) {
    throw new NpiIngestError(
      'npi checksum is invalid; verify the number and retry',
      'INVALID_NPI_CHECKSUM',
    );
  }

  return npi;
}

function isLuhnValid(number: string): boolean {
  let sum = 0;
  let shouldDouble = false;

  for (let idx = number.length - 1; idx >= 0; idx -= 1) {
    let digit = Number(number[idx]);
    if (Number.isNaN(digit)) return false;

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

export function isValidNpiChecksum(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) {
    return false;
  }

  // CMS NPI check-digit uses Luhn over constant prefix 80840 + 10-digit NPI.
  return isLuhnValid(`80840${npi}`);
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

/**
 * Extract the raw CMS `basic.credential` string verbatim.
 *
 * Rules (decided 2026-04-10 for fix/nppes-full-hydration):
 *   - trim whitespace only
 *   - preserve original casing ("PA-C" stays "PA-C", "Pa-C" stays "Pa-C")
 *   - DO NOT split on commas ("DO, FACC" is one string, not two)
 *   - DO NOT normalize punctuation ("M.D." stays "M.D.")
 *
 * Rationale: this is source-of-truth ingestion, not presentation. Any
 * splitting/normalization belongs at the render layer where the UX
 * context is known. Mirrors `normalizeProvider` in the hardened path
 * (apps/api/backend/src/modules/identity/nppes.validator.ts:247).
 *
 * Returns `undefined` when the source field is missing or empty, so the
 * ClinicianIdentity spread can omit the `credentials` key cleanly.
 */
function extractCredential(value: unknown): string | undefined {
  return normalizeString(value);
}

function toPracticeLocation(entry: unknown): PracticeLocation | null {
  if (!entry || typeof entry !== 'object') return null;
  const record = entry as Record<string, unknown>;

  const address_1 = normalizeString(record.address_1);
  if (!address_1) return null;

  const address_2 = normalizeString(record.address_2);
  const city = normalizeString(record.city);
  const state = normalizeString(record.state);
  const postal_code = normalizeString(record.postal_code);
  const country_code = normalizeString(record.country_code);

  return Object.freeze({
    address_1,
    ...(address_2 ? { address_2 } : {}),
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
    ...(postal_code ? { postal_code } : {}),
    ...(country_code ? { country_code } : {}),
  });
}

function toTaxonomy(result: Record<string, unknown>): readonly string[] {
  const taxonomiesRaw = Array.isArray(result.taxonomies) ? result.taxonomies : [];
  const taxonomies = taxonomiesRaw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      return normalizeString(record.desc) ?? normalizeString(record.code) ?? null;
    })
    .filter((value): value is string => typeof value === 'string');

  return Object.freeze([...new Set(taxonomies)]);
}

/**
 * Extract full per-taxonomy records from a CMS NPPES result.
 *
 * Preserves `code`, `desc`, `state`, `license`, and `primary` so downstream
 * role mapping can identify the primary taxonomy and correlate a license
 * number to its issuing state. Mirrors `NormalizedTaxonomy` in the hardened
 * validator path (apps/api/backend/src/modules/identity/nppes.validator.ts:201).
 *
 * Missing fields become empty strings (not undefined) to match the hardened
 * path's semantics and keep downstream code branch-free.
 */
function toTaxonomyRecords(result: Record<string, unknown>): readonly NpiTaxonomy[] {
  const taxonomiesRaw = Array.isArray(result.taxonomies) ? result.taxonomies : [];
  return Object.freeze(
    taxonomiesRaw
      .filter((entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === 'object',
      )
      .map((entry) =>
        Object.freeze({
          code: normalizeString(entry.code) ?? '',
          desc: normalizeString(entry.desc) ?? '',
          state: normalizeString(entry.state) ?? '',
          license: normalizeString(entry.license) ?? '',
          primary: entry.primary === true,
        }),
      ),
  );
}

function toNpiLicenses(result: Record<string, unknown>) {
  const addresses = Array.isArray(result.addresses) ? result.addresses : [];
  const states = addresses
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      return normalizeString((entry as Record<string, unknown>).state) ?? null;
    })
    .filter((state): state is string => typeof state === 'string');

  const uniqueStates = normalizeStates(states);
  return Object.freeze(
    uniqueStates.map((state) =>
      Object.freeze({
        state,
        source: 'npi' as const,
        status: 'UNVERIFIED' as const,
      }),
    ),
  );
}

function toLocations(result: Record<string, unknown>): readonly PracticeLocation[] {
  const addresses = Array.isArray(result.addresses) ? result.addresses : [];

  const primary = addresses
    .filter((entry) => {
      if (!entry || typeof entry !== 'object') return false;
      const purpose = normalizeString((entry as Record<string, unknown>).address_purpose);
      return purpose === 'LOCATION';
    })
    .map(toPracticeLocation)
    .filter((location): location is PracticeLocation => location !== null);

  if (primary.length > 0) {
    return Object.freeze(
      primary.map((location) =>
        Object.freeze({
          ...location,
          ...(location.state ? { state: normalizeStates([location.state])[0] ?? location.state } : {}),
        }),
      ),
    );
  }

  const fallback = addresses
    .map(toPracticeLocation)
    .filter((location): location is PracticeLocation => location !== null);

  return Object.freeze(
    fallback.map((location) =>
      Object.freeze({
        ...location,
        ...(location.state ? { state: normalizeStates([location.state])[0] ?? location.state } : {}),
      }),
    ),
  );
}

function toClinicianIdentity(
  clinician_id: string,
  npi: string,
  result: Record<string, unknown>,
  fetched_at: string,
): ClinicianIdentity {
  const basic = (result.basic ?? {}) as Record<string, unknown>;
  const first_name =
    normalizeString(basic.first_name) ??
    normalizeString(basic.organization_name) ??
    'Unknown';
  const last_name = normalizeString(basic.last_name) ?? '';
  const enumeration_type = normalizeString(result.enumeration_type) ?? 'Unknown';
  const credentials = extractCredential(basic.credential);

  return Object.freeze({
    clinician_id,
    npi,
    first_name,
    last_name,
    ...(credentials ? { credentials } : {}),
    enumeration_type,
    taxonomy: toTaxonomy(result),
    taxonomies: toTaxonomyRecords(result),
    practice_locations: toLocations(result),
    licenses: toNpiLicenses(result),
    status: 'UNVERIFIED',
    source: 'NPPES',
    fetched_at,
  });
}

function resolveFetch(fetcher?: NppesFetcher): NppesFetcher {
  if (fetcher) return fetcher;

  const candidate = (globalThis as unknown as { fetch?: NppesFetcher }).fetch;
  if (typeof candidate !== 'function') {
    throw new NpiIngestError('NPPES fetch is unavailable in this runtime', 'NPPES_UNAVAILABLE');
  }
  return candidate;
}

/** Retry policy mirrors `apps/api/backend/src/utils/fetchWithRetry.ts`. */
export type RetryPolicy = Readonly<{
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}>;

const DEFAULT_RETRY_POLICY: RetryPolicy = Object.freeze({
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 8_000,
});

const SLEEP = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Perform a single NPPES fetch and classify the response.
 *
 * Returns one of:
 *   - `{ kind: 'ok', response }`   — caller should parse the body
 *   - `{ kind: 'retry', reason }`  — transient (5xx or network), retry
 *   - `{ kind: 'fatal', error }`   — non-retryable (4xx other than 404 is
 *                                    treated as bad input by CMS)
 */
type AttemptOutcome =
  | Readonly<{ kind: 'ok'; response: NppesFetchResponse }>
  | Readonly<{ kind: 'retry'; reason: string }>
  | Readonly<{ kind: 'fatal'; error: NpiIngestError }>;

async function attemptNppesFetch(
  fetcher: NppesFetcher,
  url: string,
): Promise<AttemptOutcome> {
  let response: NppesFetchResponse;
  try {
    response = await fetcher(url, { headers: { accept: 'application/json' } });
  } catch (err) {
    // Network / DNS / TLS failures — always retryable.
    return { kind: 'retry', reason: err instanceof Error ? err.message : 'network error' };
  }

  if (response.ok) {
    return { kind: 'ok', response };
  }

  // 5xx — transient upstream failure, retry.
  if (response.status >= 500 && response.status < 600) {
    return { kind: 'retry', reason: `upstream ${response.status}` };
  }

  // 4xx — client error (malformed NPI, rate-limit, etc). Do NOT retry.
  // Note: CMS NPPES returns 200 with `result_count: 0` for "not found", not 404,
  // so a 404 here actually means the endpoint path is wrong — still fatal.
  return {
    kind: 'fatal',
    error: new NpiIngestError(
      `NPPES lookup failed with status ${response.status}`,
      'NPPES_UNAVAILABLE',
    ),
  };
}

/**
 * Fetch a CMS NPPES response with exponential-backoff retry.
 *
 * Retries on network errors and 5xx responses only. 4xx is fatal (non-retryable).
 * NPI checksum errors never reach this function — they're caught upstream in
 * `normalizeNpi()`.
 *
 * Matches the retry semantics of the hardened `fetchNpiFromCMS` path
 * (`apps/api/backend/src/modules/identity/nppes.service.ts`), but inlined here
 * because `packages/ingest` cannot depend on `apps/api/backend`.
 */
async function fetchWithNppesRetry(
  fetcher: NppesFetcher,
  url: string,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): Promise<NppesFetchResponse> {
  let lastReason = 'no attempts made';

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    const outcome = await attemptNppesFetch(fetcher, url);

    if (outcome.kind === 'ok') {
      return outcome.response;
    }
    if (outcome.kind === 'fatal') {
      throw outcome.error;
    }

    lastReason = outcome.reason;

    // Back off before the next attempt, capped at maxDelayMs. No sleep after
    // the final attempt — we're about to throw.
    if (attempt < policy.maxAttempts) {
      const exponential = policy.baseDelayMs * 2 ** (attempt - 1);
      const delay = Math.min(exponential, policy.maxDelayMs);
      await SLEEP(delay);
    }
  }

  throw new NpiIngestError(
    `NPPES lookup failed after ${policy.maxAttempts} attempts: ${lastReason}`,
    'NPPES_UNAVAILABLE',
  );
}

export async function ingestNpiIdentity(input: {
  clinician_id: string;
  npi: string;
  fetcher?: NppesFetcher;
  fetched_at?: string;
  /** Override retry policy, primarily for tests. */
  retryPolicy?: RetryPolicy;
}): Promise<ClinicianIdentity> {
  const clinician_id = assertNonEmptyString(input.clinician_id, 'clinician_id');
  const npi = normalizeNpi(input.npi);
  const fetched_at = input.fetched_at ?? new Date().toISOString();

  const fetcher = resolveFetch(input.fetcher);
  const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&number=${encodeURIComponent(npi)}`;
  const response = await fetchWithNppesRetry(fetcher, url, input.retryPolicy);

  const payload = (await response.json()) as Record<string, unknown>;
  const resultCount = Number(payload.result_count ?? 0);
  const results = Array.isArray(payload.results) ? payload.results : [];

  if (resultCount <= 0 || results.length === 0 || !results[0] || typeof results[0] !== 'object') {
    throw new NpiIngestError(`NPI ${npi} was not found in NPPES`, 'NPPES_NOT_FOUND');
  }

  return toClinicianIdentity(clinician_id, npi, results[0] as Record<string, unknown>, fetched_at);
}
