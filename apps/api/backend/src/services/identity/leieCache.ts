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
const NPI_DIGITS_RE = /\D/g;

export interface ExclusionEntry {
  npi: string;
  lastName: string;
  firstName: string;
  middleName: string;
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
  middleName?: string | null;
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
  matchType: 'EXACT' | 'STRONG_FUZZY' | 'WEAK' | 'NONE' | 'UNCHECKED';
  matchConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNCERTAIN';
  matchScore: number | null;
  matchedFields: readonly string[];
  dataVersion: string | null;
  leieVersionDate: string | null;
  sourceLatency: 'MONTHLY';
}

type MatchCandidate = Readonly<{
  entry: ExclusionEntry;
  matchType: 'STRONG_FUZZY' | 'WEAK';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
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
let leieVersionDate: string | null = null;

// ── Parsing helpers ──────────────────────────────────────────────────────────

function normalizeToken(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeNpi(value: string | null | undefined): string {
  if (typeof value !== 'string') {
    return '';
  }

  const digits = value.replace(NPI_DIGITS_RE, '');
  return digits.length === 10 ? digits : '';
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

const SPECIALTY_STOPWORDS = new Set([
  'AND',
  'CARE',
  'CLINIC',
  'GENERAL',
  'HEALTH',
  'MEDICAL',
  'MEDICINE',
  'PRACTICE',
  'PROVIDER',
  'SPECIALIST',
  'SURGERY',
]);

function specialtyFamilyKeys(value: string): readonly string[] {
  const normalized = value.toUpperCase();
  const families = new Set<string>();

  if (normalized.includes('FAMILY')) families.add('FAMILY_MEDICINE');
  if (normalized.includes('INTERNAL') || normalized.includes('HOSPITALIST')) families.add('INTERNAL_MEDICINE');
  if (normalized.includes('CARDI')) families.add('CARDIOLOGY');
  if (normalized.includes('DERMAT')) families.add('DERMATOLOGY');
  if (normalized.includes('ENDOCR')) families.add('ENDOCRINOLOGY');
  if (normalized.includes('EMERGENCY')) families.add('EMERGENCY_MEDICINE');
  if (normalized.includes('GASTRO')) families.add('GASTROENTEROLOGY');
  if (normalized.includes('HEMATO') || normalized.includes('ONCO')) families.add('HEMATOLOGY_ONCOLOGY');
  if (normalized.includes('NEPHRO')) families.add('NEPHROLOGY');
  if (normalized.includes('NEURO')) families.add('NEUROLOGY');
  if (normalized.includes('OBSTET') || normalized.includes('GYNE')) families.add('OBSTETRICS_GYNECOLOGY');
  if (normalized.includes('ORTHO')) families.add('ORTHOPEDICS');
  if (normalized.includes('PATHO')) families.add('PATHOLOGY');
  if (normalized.includes('PEDIATR')) families.add('PEDIATRICS');
  if (normalized.includes('PSYCH')) families.add('PSYCHIATRY');
  if (normalized.includes('PULMON')) families.add('PULMONOLOGY');
  if (normalized.includes('RADIO')) families.add('RADIOLOGY');
  if (normalized.includes('URO')) families.add('UROLOGY');
  if (normalized.includes('NURSE PRACTITIONER')) families.add('NURSE_PRACTITIONER');
  if (normalized.includes('PHYSICIAN ASSISTANT') || normalized.includes('PHYSICIAN ASST')) {
    families.add('PHYSICIAN_ASSISTANT');
  }

  if (families.size === 0) {
    for (const token of specialtyTokens(value)) {
      if (!SPECIALTY_STOPWORDS.has(token)) {
        families.add(token);
        break;
      }
    }
  }

  return Object.freeze(Array.from(families));
}

function exactSpecialtyMatch(left: string, right: string): boolean {
  const normalizedLeft = normalizeToken(left);
  const normalizedRight = normalizeToken(right);
  return Boolean(normalizedLeft) && normalizedLeft === normalizedRight;
}

function specialtyFamilyMatch(left: string, right: string): boolean {
  const leftFamilies = specialtyFamilyKeys(left);
  const rightFamilies = specialtyFamilyKeys(right);

  return leftFamilies.some((family) => rightFamilies.includes(family));
}

function partialNameMatch(inputFirst: string, entryFirst: string): boolean {
  if (!inputFirst || !entryFirst) {
    return false;
  }

  if (inputFirst === entryFirst) {
    return true;
  }

  return inputFirst[0] === entryFirst[0]
    || inputFirst.startsWith(entryFirst)
    || entryFirst.startsWith(inputFirst);
}

function middleNameMatch(inputMiddle: string, entryMiddle: string): boolean {
  if (!inputMiddle || !entryMiddle) {
    return false;
  }

  if (inputMiddle === entryMiddle) {
    return true;
  }

  return inputMiddle[0] === entryMiddle[0];
}

function toIsoDateOrNull(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString().slice(0, 10);
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
  const npi = normalizeNpi(fieldFromRow(row, headerIndex, ['NPI'], 7));
  const entry: ExclusionEntry = {
    npi: npi && npi !== '0000000000' ? npi : '',
    lastName: fieldFromRow(row, headerIndex, ['LASTNAME', 'LAST_NAME'], 0),
    firstName: fieldFromRow(row, headerIndex, ['FIRSTNAME', 'FIRST_NAME'], 1),
    middleName: fieldFromRow(row, headerIndex, ['MIDNAME', 'MIDDLE_NAME'], 2),
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
            headers: { Accept: 'text/csv,text/plain,*/*' },
          });
          if (!response.ok) {
            throw new Error(`LEIE supplement HTTP ${response.status}`);
          }
          return response.text();
        })()
      : await readFile(source, 'utf8');

    return {
      entries: buildEntriesFromCsv(payload),
      version: `supplement:${checksumOf(payload).slice(0, 12)}`,
    };
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

  const inputNpi = normalizeNpi(input.npi);
  const inputFirst = normalizeToken(input.firstName ?? '');
  const inputMiddle = normalizeToken(input.middleName ?? '');
  const inputLast = normalizeToken(input.lastName ?? '');
  const entryFirst = normalizeToken(entry.firstName);
  const entryMiddle = normalizeToken(entry.middleName);
  const entryLast = normalizeToken(entry.lastName);

  if (inputNpi && entry.npi && inputNpi !== entry.npi) {
    return null;
  }

  if (!inputLast || !entryLast || inputLast !== entryLast) {
    return null;
  }

  const inputState = normalizeState(input.state ?? '');
  const stateMatch = Boolean(inputState && entry.state && inputState === entry.state);
  const firstExact = Boolean(inputFirst && entryFirst && inputFirst === entryFirst);
  const firstPartial = partialNameMatch(inputFirst, entryFirst);
  const middleMatch = middleNameMatch(inputMiddle, entryMiddle);
  const specialtyExact = exactSpecialtyMatch(input.specialty ?? '', entry.specialty);
  const specialtyFamily = specialtyFamilyMatch(input.specialty ?? '', entry.specialty);

  matchedFields.add('last_name');
  if (firstExact) {
    matchedFields.add('first_name');
  } else if (firstPartial) {
    matchedFields.add('partial_name');
  }
  if (middleMatch) {
    matchedFields.add('middle_name');
  }
  if (stateMatch) {
    matchedFields.add('state');
  }
  if (specialtyExact) {
    matchedFields.add('specialty');
  } else if (specialtyFamily) {
    matchedFields.add('specialty_family');
  }

  if (firstExact && middleMatch && stateMatch && specialtyExact) {
    return {
      entry,
      matchType: 'STRONG_FUZZY',
      confidence: 'HIGH',
      score: 0.9,
      matchedFields: Object.freeze(Array.from(matchedFields)),
    };
  }

  if (firstExact && stateMatch && specialtyFamily) {
    return {
      entry,
      matchType: 'STRONG_FUZZY',
      confidence: 'MEDIUM',
      score: 0.76,
      matchedFields: Object.freeze(Array.from(matchedFields)),
    };
  }

  if (!firstExact && firstPartial) {
    return {
      entry,
      matchType: 'WEAK',
      confidence: 'LOW',
      score: 0.58,
      matchedFields: Object.freeze(Array.from(matchedFields)),
    };
  }

  return null;
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
    leieVersionDate = toIsoDateOrNull(response.headers.get('last-modified'));

    log('info', 'leie_cache_refreshed', {
      entries: mergedEntries.length,
      exactIndexSize: indexes.npi.size,
      supplementEntries: supplement.entries.length,
      durationMs: Date.now() - startedAt,
      dataVersion,
      leieVersionDate,
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
  const staleBecauseSourceRefreshFailed = Boolean(refreshError);
  const cacheAge: LeieResult['cacheAge'] =
    !npiIndex || !nameIndex
      ? 'unavailable'
      : staleBecauseSourceRefreshFailed
        ? 'stale'
        : 'fresh';

  const normalizedInput = {
    ...input,
    npi: normalizeNpi(input.npi),
  };

  if (!npiIndex || !nameIndex) {
    return {
      npi: normalizedInput.npi,
      excluded: false,
      entry: null,
      matchedEntries: [],
      source: 'LEIE_CSV',
      checkedAt,
      cacheAge: 'unavailable',
      verdict: 'UNCHECKED',
      matchType: 'UNCHECKED',
      matchConfidence: 'UNCERTAIN',
      matchScore: null,
      matchedFields: [],
      dataVersion,
      leieVersionDate,
      sourceLatency: 'MONTHLY',
    };
  }

  const exact = normalizedInput.npi ? npiIndex.get(normalizedInput.npi) ?? null : null;
  if (exact) {
    return {
      npi: normalizedInput.npi,
      excluded: true,
      entry: exact,
      matchedEntries: [exact],
      source: 'LEIE_CSV',
      checkedAt,
      cacheAge,
      verdict: 'EXCLUDED',
      matchType: 'EXACT',
      matchConfidence: 'HIGH',
      matchScore: 1,
      matchedFields: ['npi'],
      dataVersion,
      leieVersionDate,
      sourceLatency: 'MONTHLY',
    };
  }

  if (normalizedInput.npi) {
    return {
      npi: normalizedInput.npi,
      excluded: false,
      entry: null,
      matchedEntries: [],
      source: 'LEIE_CSV',
      checkedAt,
      cacheAge,
      verdict: 'CLEAR',
      matchType: 'NONE',
      matchConfidence: 'HIGH',
      matchScore: 0,
      matchedFields: [],
      dataVersion,
      leieVersionDate,
      sourceLatency: 'MONTHLY',
    };
  }

  const candidate = bestFuzzyCandidate(normalizedInput);
  if (candidate) {
    return {
      npi: normalizedInput.npi,
      excluded: false,
      entry: candidate.entry,
      matchedEntries: [candidate.entry],
      source: 'LEIE_CSV',
      checkedAt,
      cacheAge,
      verdict: 'POSSIBLE_MATCH',
      matchType: candidate.matchType,
      matchConfidence: candidate.confidence,
      matchScore: candidate.score,
      matchedFields: candidate.matchedFields,
      dataVersion,
      leieVersionDate,
      sourceLatency: 'MONTHLY',
    };
  }

  return {
    npi: normalizedInput.npi,
    excluded: false,
    entry: null,
    matchedEntries: [],
    source: 'LEIE_CSV',
    checkedAt,
    cacheAge,
    verdict: 'CLEAR',
    matchType: 'NONE',
    matchConfidence: 'HIGH',
    matchScore: 0,
    matchedFields: [],
    dataVersion,
    leieVersionDate,
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
  leieVersionDate: string | null;
} {
  return {
    loaded: npiIndex !== null && nameIndex !== null,
    entries: allEntries.length,
    ageMs: lastRefreshed ? Date.now() - lastRefreshed : -1,
    error: refreshError,
    dataVersion,
    leieVersionDate,
  };
}

export function resetLeieCacheForTests(): void {
  npiIndex = null;
  nameIndex = null;
  allEntries = [];
  lastRefreshed = 0;
  refreshing = false;
  refreshError = null;
  dataVersion = null;
  leieVersionDate = null;
}

export function prewarmLeieCache(): void {
  void refresh();
}
