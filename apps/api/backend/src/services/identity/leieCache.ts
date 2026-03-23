/**
 * leieCache.ts — OIG LEIE exclusion lookup via bulk CSV
 *
 * The OIG NPI-based API endpoint is dead (404).
 * The real data is available as a monthly CSV:
 *   https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv
 *
 * Strategy:
 *   1. Download CSV on first lookup (lazy init)
 *   2. Build in-memory indexes for NPI and person-name matching
 *   3. Optionally merge a local/remote supplement file
 *   4. Refresh every REFRESH_INTERVAL_MS (default 24h)
 *   5. lookupProvider(...) returns exact vs possible-match semantics
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { log } from '../../obs/logger';

const LEIE_CSV_URL = 'https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv';
const REFRESH_INTERVAL = 24 * 60 * 60 * 1000; // 24h
const DOWNLOAD_TIMEOUT = 30_000; // 30s

export interface ExclusionEntry {
  npi: string;
  lastName: string;
  firstName: string;
  busName: string;
  specialty: string;
  state: string;
  exclusionType: string;
  exclusionDate: string;
  reinstatementDate: string;
  waiverState: string;
}

export interface LookupProviderInput {
  npi: string;
  firstName?: string | null;
  lastName?: string | null;
  state?: string | null;
  specialty?: string | null;
}

export interface LeieResult {
  npi: string;
  excluded: boolean;
  entry: ExclusionEntry | null;
  matchedEntries: readonly ExclusionEntry[];
  source: 'LEIE_CSV';
  checkedAt: string;
  cacheAge: 'fresh' | 'stale' | 'unavailable';
  verdict: 'CLEAR' | 'EXCLUDED' | 'POSSIBLE_MATCH' | 'UNCHECKED';
  matchType: 'NPI_MATCH' | 'NAME_MATCH' | 'NO_MATCH' | 'UNCLEAR';
  matchConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNCERTAIN';
  matchScore: number | null;
  matchedFields: readonly string[];
  dataVersion: string | null;
  sourceLatency: 'MONTHLY';
}

type MatchCandidate = Readonly<{
  entry: ExclusionEntry;
  score: number;
  matchedFields: readonly string[];
}>;

// ── In-memory indexes ────────────────────────────────────────────────────────

let npiIndex: Map<string, ExclusionEntry> | null = null;
let nameIndex: Map<string, ExclusionEntry[]> | null = null;
let allEntries: ExclusionEntry[] = [];
let lastRefreshed = 0;
let refreshing = false;
let refreshError: string | null = null;
let dataVersion: string | null = null;

// ── Parsing helpers ──────────────────────────────────────────────────────────

function normalizeToken(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeState(value: string): string {
  return value.trim().toUpperCase();
}

function specialtyTokens(value: string): string[] {
  return value
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim().toUpperCase())
    .filter((token) => token.length >= 3);
}

function checksumOf(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuote = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (char === '"') {
      if (inQuote && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        inQuote = !inQuote;
      }
      continue;
    }

    if (char === ',' && !inQuote) {
      fields.push(field.trim());
      field = '';
      continue;
    }

    field += char;
  }

  fields.push(field.trim());
  return fields;
}

function buildHeaderIndex(header: readonly string[]): Map<string, number> {
  return new Map(
    header.map((name, index) => [normalizeToken(name), index] as const),
  );
}

function fieldFromRow(
  row: readonly string[],
  headerIndex: Map<string, number>,
  keys: readonly string[],
  fallbackIndex: number,
): string {
  for (const key of keys) {
    const headerMatch = headerIndex.get(normalizeToken(key));
    if (typeof headerMatch === 'number') {
      return row[headerMatch]?.trim() ?? '';
    }
  }

  return row[fallbackIndex]?.trim() ?? '';
}

function entryFromRow(
  row: readonly string[],
  headerIndex: Map<string, number>,
): ExclusionEntry | null {
  const npi = fieldFromRow(row, headerIndex, ['NPI'], 7);
  const entry: ExclusionEntry = {
    npi: npi && npi !== '0000000000' ? npi : '',
    lastName: fieldFromRow(row, headerIndex, ['LASTNAME', 'LAST_NAME'], 0),
    firstName: fieldFromRow(row, headerIndex, ['FIRSTNAME', 'FIRST_NAME'], 1),
    busName: fieldFromRow(row, headerIndex, ['BUSNAME', 'BUS_NAME', 'ORGANIZATION'], 3),
    specialty: fieldFromRow(row, headerIndex, ['SPECIALTY', 'SPECIALITY'], 5),
    state: normalizeState(fieldFromRow(row, headerIndex, ['STATE'], 11)),
    exclusionType: fieldFromRow(row, headerIndex, ['EXCLTYPE', 'EXCLUSIONTYPE', 'EXCLUSION_TYPE'], 13),
    exclusionDate: fieldFromRow(row, headerIndex, ['EXCLDATE', 'EXCLUSIONDATE', 'EXCLUSION_DATE'], 14),
    reinstatementDate: fieldFromRow(row, headerIndex, ['REINDATE', 'REINSTATEMENTDATE', 'REINSTATEMENT_DATE'], 15),
    waiverState: normalizeState(fieldFromRow(row, headerIndex, ['WVRSTATE', 'WAIVERSTATE', 'WAIVER_STATE'], 17)),
  };

  if (!entry.npi && !entry.lastName && !entry.busName) {
    return null;
  }

  return entry;
}

function buildEntriesFromCsv(csv: string): ExclusionEntry[] {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return [];
  }

  const header = parseCsvLine(lines[0]!);
  const headerIndex = buildHeaderIndex(header);
  const startIndex = headerIndex.has('NPI') || headerIndex.has('LASTNAME') ? 1 : 0;
  const entries: ExclusionEntry[] = [];

  for (let index = startIndex; index < lines.length; index += 1) {
    const row = parseCsvLine(lines[index]!);
    const entry = entryFromRow(row, headerIndex);
    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}

function entryFromUnknown(record: unknown): ExclusionEntry | null {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return null;
  }

  const row = record as Record<string, unknown>;
  const stringField = (...keys: string[]): string => {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
    return '';
  };

  const entry: ExclusionEntry = {
    npi: stringField('npi', 'NPI'),
    lastName: stringField('lastName', 'last_name', 'LASTNAME', 'LAST_NAME'),
    firstName: stringField('firstName', 'first_name', 'FIRSTNAME', 'FIRST_NAME'),
    busName: stringField('busName', 'bus_name', 'organization', 'BUSNAME'),
    specialty: stringField('specialty', 'SPECIALTY'),
    state: normalizeState(stringField('state', 'STATE')),
    exclusionType: stringField('exclusionType', 'exclusion_type', 'EXCLTYPE'),
    exclusionDate: stringField('exclusionDate', 'exclusion_date', 'EXCLDATE'),
    reinstatementDate: stringField('reinstatementDate', 'reinstatement_date', 'REINDATE'),
    waiverState: normalizeState(stringField('waiverState', 'waiver_state', 'WVRSTATE')),
  };

  if (!entry.npi && !entry.lastName && !entry.busName) {
    return null;
  }

  return entry;
}

async function loadSupplementEntries(): Promise<{ entries: ExclusionEntry[]; version: string | null }> {
  const supplementPath = process.env.LEIE_SUPPLEMENT_PATH?.trim();
  const supplementUrl = process.env.LEIE_SUPPLEMENT_URL?.trim();
  const source = supplementPath || supplementUrl;

  if (!source) {
    return { entries: [], version: null };
  }

  try {
    const payload = supplementUrl
      ? await (async () => {
          const response = await fetch(supplementUrl, {
            signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT),
            headers: { Accept: 'application/json,text/csv,text/plain,*/*' },
          });
          if (!response.ok) {
            throw new Error(`LEIE supplement HTTP ${response.status}`);
          }
          return response.text();
        })()
      : await readFile(source, 'utf8');

    try {
      const parsed = JSON.parse(payload) as unknown;
      const records = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object' && Array.isArray((parsed as { entries?: unknown[] }).entries)
          ? (parsed as { entries: unknown[] }).entries
          : [];

      return {
        entries: records
          .map((record) => entryFromUnknown(record))
          .filter((entry): entry is ExclusionEntry => Boolean(entry)),
        version: `supplement:${checksumOf(payload).slice(0, 12)}`,
      };
    } catch {
      return {
        entries: buildEntriesFromCsv(payload),
        version: `supplement:${checksumOf(payload).slice(0, 12)}`,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log('warn', 'leie_supplement_load_failed', { source, error: message });
    return { entries: [], version: null };
  }
}

function appendNameIndex(index: Map<string, ExclusionEntry[]>, key: string, entry: ExclusionEntry): void {
  if (!key) {
    return;
  }

  const existing = index.get(key) ?? [];
  existing.push(entry);
  index.set(key, existing);
}

function buildIndexes(entries: readonly ExclusionEntry[]): {
  npi: Map<string, ExclusionEntry>;
  name: Map<string, ExclusionEntry[]>;
} {
  const npi = new Map<string, ExclusionEntry>();
  const name = new Map<string, ExclusionEntry[]>();

  for (const entry of entries) {
    if (entry.npi) {
      npi.set(entry.npi, entry);
    }

    const fullNameKey = `${normalizeToken(entry.firstName)}:${normalizeToken(entry.lastName)}`;
    if (fullNameKey !== ':') {
      appendNameIndex(name, fullNameKey, entry);
    }

    if (entry.busName) {
      appendNameIndex(name, normalizeToken(entry.busName), entry);
    }
  }

  return { npi, name };
}

function scoreCandidate(entry: ExclusionEntry, input: LookupProviderInput): MatchCandidate | null {
  const matchedFields = new Set<string>();
  let score = 0;

  if (input.npi && entry.npi && entry.npi === input.npi) {
    matchedFields.add('npi');
    score = 1;
    return {
      entry,
      score,
      matchedFields: Object.freeze(Array.from(matchedFields)),
    };
  }

  const inputFirst = normalizeToken(input.firstName ?? '');
  const inputLast = normalizeToken(input.lastName ?? '');
  const entryFirst = normalizeToken(entry.firstName);
  const entryLast = normalizeToken(entry.lastName);

  if (!inputLast || !entryLast || inputLast !== entryLast) {
    return null;
  }

  matchedFields.add('last_name');
  score += 0.35;

  if (inputFirst && entryFirst && inputFirst === entryFirst) {
    matchedFields.add('first_name');
    score += 0.3;
  } else if (inputFirst && entryFirst && inputFirst[0] === entryFirst[0]) {
    matchedFields.add('first_initial');
    score += 0.15;
  }

  const inputState = normalizeState(input.state ?? '');
  if (inputState && entry.state && inputState === entry.state) {
    matchedFields.add('state');
    score += 0.2;
  }

  const inputSpecialtyTokens = specialtyTokens(input.specialty ?? '');
  const entrySpecialtyTokens = specialtyTokens(entry.specialty);
  if (inputSpecialtyTokens.length > 0 && entrySpecialtyTokens.length > 0) {
    const overlap = inputSpecialtyTokens.filter((token) => entrySpecialtyTokens.includes(token));
    if (overlap.length > 0) {
      matchedFields.add('specialty');
      score += 0.15;
    }
  }

  if (score < 0.55) {
    return null;
  }

  return {
    entry,
    score: Number(score.toFixed(2)),
    matchedFields: Object.freeze(Array.from(matchedFields)),
  };
}

function bestFuzzyCandidate(input: LookupProviderInput): MatchCandidate | null {
  if (!nameIndex) {
    return null;
  }

  const inputFirst = normalizeToken(input.firstName ?? '');
  const inputLast = normalizeToken(input.lastName ?? '');
  if (!inputLast) {
    return null;
  }

  const exactNameKey = `${inputFirst}:${inputLast}`;
  const fallbackCandidates = inputFirst
    ? nameIndex.get(exactNameKey) ?? []
    : [];

  const scanPool = fallbackCandidates.length > 0
    ? fallbackCandidates
    : allEntries.filter((entry) => normalizeToken(entry.lastName) === inputLast);

  let winner: MatchCandidate | null = null;
  for (const entry of scanPool) {
    const candidate = scoreCandidate(entry, input);
    if (!candidate) {
      continue;
    }

    if (!winner || candidate.score > winner.score) {
      winner = candidate;
    }
  }

  return winner;
}

// ── Refresh logic ────────────────────────────────────────────────────────────

async function refresh(): Promise<void> {
  if (refreshing) return;
  refreshing = true;
  const startedAt = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT);
    const response = await fetch(LEIE_CSV_URL, {
      signal: controller.signal,
      headers: { Accept: 'text/csv,text/plain,*/*' },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`LEIE CSV HTTP ${response.status}`);
    }

    const csv = await response.text();
    const baseEntries = buildEntriesFromCsv(csv);
    const supplement = await loadSupplementEntries();
    const mergedEntries = [...baseEntries, ...supplement.entries];
    const indexes = buildIndexes(mergedEntries);

    npiIndex = indexes.npi;
    nameIndex = indexes.name;
    allEntries = mergedEntries;
    lastRefreshed = Date.now();
    refreshError = null;

    const responseVersion =
      response.headers.get('last-modified')
      ?? response.headers.get('etag')
      ?? `csv:${checksumOf(csv).slice(0, 12)}`;
    dataVersion = [responseVersion, supplement.version].filter(Boolean).join('+') || null;

    log('info', 'leie_cache_refreshed', {
      entries: mergedEntries.length,
      exactIndexSize: indexes.npi.size,
      supplementEntries: supplement.entries.length,
      durationMs: Date.now() - startedAt,
      dataVersion,
    });
  } catch (error) {
    refreshError = error instanceof Error ? error.message : String(error);
    log('warn', 'leie_cache_refresh_failed', { error: refreshError });
  } finally {
    refreshing = false;
  }
}

async function ensureLoaded(): Promise<void> {
  const age = Date.now() - lastRefreshed;
  if (!npiIndex || !nameIndex) {
    await refresh();
    return;
  }

  if (age > REFRESH_INTERVAL && !refreshing) {
    void refresh();
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function lookupProvider(input: LookupProviderInput): Promise<LeieResult> {
  await ensureLoaded();

  const checkedAt = new Date().toISOString();
  const cacheAge: LeieResult['cacheAge'] =
    !npiIndex || !nameIndex
      ? 'unavailable'
      : refreshError
        ? 'stale'
        : 'fresh';

  if (!npiIndex || !nameIndex) {
    return {
      npi: input.npi,
      excluded: false,
      entry: null,
      matchedEntries: [],
      source: 'LEIE_CSV',
      checkedAt,
      cacheAge: 'unavailable',
      verdict: 'UNCHECKED',
      matchType: 'UNCLEAR',
      matchConfidence: 'UNCERTAIN',
      matchScore: null,
      matchedFields: [],
      dataVersion,
      sourceLatency: 'MONTHLY',
    };
  }

  const exact = input.npi ? npiIndex.get(input.npi) ?? null : null;
  if (exact) {
    return {
      npi: input.npi,
      excluded: true,
      entry: exact,
      matchedEntries: [exact],
      source: 'LEIE_CSV',
      checkedAt,
      cacheAge,
      verdict: 'EXCLUDED',
      matchType: 'NPI_MATCH',
      matchConfidence: 'HIGH',
      matchScore: 1,
      matchedFields: ['npi'],
      dataVersion,
      sourceLatency: 'MONTHLY',
    };
  }

  const candidate = bestFuzzyCandidate(input);
  if (candidate) {
    const matchConfidence =
      candidate.score >= 0.75
        ? 'MEDIUM'
        : 'LOW';

    return {
      npi: input.npi,
      excluded: false,
      entry: candidate.entry,
      matchedEntries: [candidate.entry],
      source: 'LEIE_CSV',
      checkedAt,
      cacheAge,
      verdict: 'POSSIBLE_MATCH',
      matchType: 'NAME_MATCH',
      matchConfidence,
      matchScore: candidate.score,
      matchedFields: candidate.matchedFields,
      dataVersion,
      sourceLatency: 'MONTHLY',
    };
  }

  return {
    npi: input.npi,
    excluded: false,
    entry: null,
    matchedEntries: [],
    source: 'LEIE_CSV',
    checkedAt,
    cacheAge,
    verdict: 'CLEAR',
    matchType: 'NO_MATCH',
    matchConfidence: 'HIGH',
    matchScore: 1,
    matchedFields: ['npi'],
    dataVersion,
    sourceLatency: 'MONTHLY',
  };
}

export async function lookupNpi(npi: string): Promise<LeieResult> {
  return lookupProvider({ npi });
}

export function leieCacheStats(): {
  loaded: boolean;
  entries: number;
  ageMs: number;
  error: string | null;
  dataVersion: string | null;
} {
  return {
    loaded: npiIndex !== null && nameIndex !== null,
    entries: allEntries.length,
    ageMs: lastRefreshed ? Date.now() - lastRefreshed : -1,
    error: refreshError,
    dataVersion,
  };
}

export function prewarmLeieCache(): void {
  void refresh();
}
