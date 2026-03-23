/**
 * leieCache.ts — OIG LEIE exclusion lookup via bulk CSV
 *
 * The OIG NPI-based API endpoint is dead (404).
 * The real data is available as a monthly CSV:
 *   https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv
 *
 * Strategy:
 *   1. Download CSV on first lookup (lazy init)
 *   2. Build in-memory NPI → ExclusionEntry index
 *   3. Refresh every REFRESH_INTERVAL_MS (default 24h)
 *   4. lookupNpi(npi) → ExclusionResult (instant, no network call)
 *
 * CSV shape:
 *   LASTNAME,FIRSTNAME,MIDNAME,BUSNAME,GENERAL,SPECIALTY,UPIN,NPI,DOB,
 *   ADDRESS,CITY,STATE,ZIP,EXCLTYPE,EXCLDATE,REINDATE,WAIVERDATE,WVRSTATE
 *
 * NPI column index: 7 (0-based)
 *
 * Entries with NPI "0000000000" are excluded entities without NPI — skipped.
 */

import { log } from '../../obs/logger';

const LEIE_CSV_URL      = 'https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv';
const REFRESH_INTERVAL  = 24 * 60 * 60 * 1000; // 24h
const DOWNLOAD_TIMEOUT  = 30_000;               // 30s

export interface ExclusionEntry {
  npi:            string;
  lastName:       string;
  firstName:      string;
  busName:        string;
  exclusionType:  string;
  exclusionDate:  string;
  reinstatementDate: string;
  waiverState:    string;
}

// ── In-memory index ────────────────────────────────────────────────────────────

let npiIndex:      Map<string, ExclusionEntry> | null = null;
let lastRefreshed: number = 0;
let refreshing:    boolean = false;
let refreshError:  string | null = null;

// ── CSV parser ─────────────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  // Simple RFC 4180 parser — handles quoted fields with commas
  const fields: string[] = [];
  let field = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { field += '"'; i++; }
      else { inQuote = !inQuote; }
    } else if (ch === ',' && !inQuote) {
      fields.push(field.trim());
      field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field.trim());
  return fields;
}

function buildIndex(csv: string): Map<string, ExclusionEntry> {
  const idx = new Map<string, ExclusionEntry>();
  const lines = csv.split('\n');
  // Skip header (line 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    const f = parseCsvLine(line);
    const npi = f[7]?.trim();
    if (!npi || npi === '0000000000') continue;
    idx.set(npi, {
      npi,
      lastName:         f[0]  ?? '',
      firstName:        f[1]  ?? '',
      busName:          f[3]  ?? '',
      exclusionType:    f[13] ?? '',
      exclusionDate:    f[14] ?? '',
      reinstatementDate: f[15] ?? '',
      waiverState:      f[17] ?? '',
    });
  }
  return idx;
}

// ── Refresh logic ──────────────────────────────────────────────────────────────

async function refresh(): Promise<void> {
  if (refreshing) return;
  refreshing = true;
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT);
    const res = await fetch(LEIE_CSV_URL, {
      signal: controller.signal,
      headers: { Accept: 'text/csv,text/plain,*/*' },
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`LEIE CSV HTTP ${res.status}`);

    const csv = await res.text();
    const idx = buildIndex(csv);
    npiIndex      = idx;
    lastRefreshed = Date.now();
    refreshError  = null;

    log('info', 'leie_cache_refreshed', {
      entries: idx.size,
      durationMs: Date.now() - start,
    });
  } catch (err) {
    refreshError = err instanceof Error ? err.message : String(err);
    log('warn', 'leie_cache_refresh_failed', { error: refreshError });
  } finally {
    refreshing = false;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Ensure the cache is loaded. Triggers a refresh if stale or empty.
 * Non-blocking: if a refresh is already in progress, uses existing data.
 */
async function ensureLoaded(): Promise<void> {
  const age = Date.now() - lastRefreshed;
  if (!npiIndex) {
    // First call — must wait for initial load
    await refresh();
  } else if (age > REFRESH_INTERVAL && !refreshing) {
    // Stale — refresh in background, serve existing data now
    void refresh();
  }
}

// ── Match confidence ───────────────────────────────────────────────────────────

export type MatchConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export interface LeieMatchDetail {
  matchType:       'NPI_EXACT' | 'NPI_ABSENT' | 'CACHE_UNAVAILABLE';
  matchConfidence: MatchConfidence;
  exclusionType?:  string;
  exclusionDate?:  string;
}

/**
 * Look up an NPI in the LEIE exclusion list.
 * Returns excluded=true if found, false if not found, with cache metadata.
 */
export async function lookupNpi(npi: string): Promise<LeieResult> {
  await ensureLoaded();

  const checkedAt = new Date().toISOString();
  const cacheAge: LeieResult['cacheAge'] =
    !npiIndex       ? 'unavailable'
    : refreshError  ? 'stale'
    :                 'fresh';

  if (!npiIndex) {
    // Cache unavailable — return UNCERTAIN signal (will be PENDING_REVIEW upstream)
    return {
      npi, excluded: false, entry: null,
      source: 'LEIE_CSV', checkedAt, cacheAge: 'unavailable',
    };
  }

  const entry = npiIndex.get(npi) ?? null;

  return {
    npi,
    excluded: entry !== null,
    entry,
    source:   'LEIE_CSV',
    checkedAt,
    cacheAge,
    matchDetail: {
      matchType:       entry ? 'NPI_EXACT' : 'NPI_ABSENT',
      matchConfidence: entry ? 'HIGH' : 'NONE',
      exclusionType:   entry?.exclusionType,
      exclusionDate:   entry?.exclusionDate,
    } satisfies LeieMatchDetail,
  };
}

export interface LeieResult {
  npi:            string;
  excluded:       boolean;
  entry:          ExclusionEntry | null;
  source:         'LEIE_CSV';
  checkedAt:      string;
  cacheAge:       'fresh' | 'stale' | 'unavailable';
  matchDetail?:   LeieMatchDetail;
}

/**
 * Current cache stats — useful for healthcheck endpoints.
 */
export function leieCacheStats(): {
  loaded: boolean; entries: number; ageMs: number; error: string | null;
} {
  return {
    loaded:  npiIndex !== null,
    entries: npiIndex?.size ?? 0,
    ageMs:   lastRefreshed ? Date.now() - lastRefreshed : -1,
    error:   refreshError,
  };
}

/**
 * Pre-warm the cache. Call at server startup (non-blocking).
 */
export function prewarmLeieCache(): void {
  void refresh();
}
