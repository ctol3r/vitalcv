import type { ClinicianIdentity, PracticeLocation } from './models';
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

  return Object.freeze({
    clinician_id,
    npi,
    first_name,
    last_name,
    enumeration_type,
    taxonomy: toTaxonomy(result),
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

export async function ingestNpiIdentity(input: {
  clinician_id: string;
  npi: string;
  fetcher?: NppesFetcher;
  fetched_at?: string;
}): Promise<ClinicianIdentity> {
  const clinician_id = assertNonEmptyString(input.clinician_id, 'clinician_id');
  const npi = normalizeNpi(input.npi);
  const fetched_at = input.fetched_at ?? new Date().toISOString();

  const fetcher = resolveFetch(input.fetcher);
  const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&number=${encodeURIComponent(npi)}`;
  const response = await fetcher(url, {
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new NpiIngestError(
      `NPPES lookup failed with status ${response.status}`,
      'NPPES_UNAVAILABLE',
    );
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const resultCount = Number(payload.result_count ?? 0);
  const results = Array.isArray(payload.results) ? payload.results : [];

  if (resultCount <= 0 || results.length === 0 || !results[0] || typeof results[0] !== 'object') {
    throw new NpiIngestError(`NPI ${npi} was not found in NPPES`, 'NPPES_NOT_FOUND');
  }

  return toClinicianIdentity(clinician_id, npi, results[0] as Record<string, unknown>, fetched_at);
}
