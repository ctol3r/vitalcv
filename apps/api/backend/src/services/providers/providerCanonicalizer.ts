/**
 * providerCanonicalizer.ts — Wave 119: Provider Data Integrity Fabric
 *
 * Normalizes provider data across multiple sources (NPPES, State Board, OIG, ABMS)
 * into a canonical representation with conflict detection and resolution.
 *
 * Principles:
 *   - Never truncate any field — store full values as TEXT
 *   - Preserve raw endpoint URLs verbatim
 *   - UTF-8 normalization (NFC)
 *   - Quote-safe parsing (embedded quotes in CSV/JSON)
 *   - SHA-256 bundle verification for data integrity
 */

import { createHash } from 'node:crypto';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────

export type ProviderSourceType = 'NPPES' | 'STATE_BOARD' | 'OIG' | 'ABMS' | 'MANUAL';

export interface RawProviderRecord {
  source: ProviderSourceType;
  npi?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  organizationName?: string;
  credential?: string;
  gender?: string;
  taxonomies?: Array<{ code: string; desc: string; primary: boolean; state?: string; license?: string }>;
  addresses?: Array<{
    purpose: string;
    address_1: string;
    address_2?: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
    phone?: string;
    fax?: string;
  }>;
  enumeration_date?: string;
  last_updated?: string;
  status?: string;
  deactivation_date?: string;
  rawPayload?: Record<string, unknown>;
  fetchedAt: string;
  sourceUrl?: string;
}

export interface CanonicalProvider {
  npi: string;
  canonicalName: {
    first: string;
    middle: string;
    last: string;
    displayName: string;
    credential: string;
  };
  organization: string | null;
  gender: string | null;
  taxonomies: Array<{
    code: string;
    description: string;
    primary: boolean;
    state: string | null;
    license: string | null;
  }>;
  addresses: Array<{
    purpose: string;
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone: string | null;
  }>;
  status: 'ACTIVE' | 'INACTIVE' | 'DEACTIVATED' | 'UNKNOWN';
  enumerationDate: string | null;
  lastUpdated: string | null;
  sources: ProviderSourceType[];
  conflicts: CanonicalConflict[];
  bundleHash: string;
  canonicalizedAt: string;
}

export interface CanonicalConflict {
  field: string;
  values: Array<{ source: ProviderSourceType; value: string }>;
  resolution: string;
  resolvedValue: string;
}

// ── UTF-8 Normalization ───────────────────────────────────────────────

function normalizeUtf8(s: string | null | undefined): string {
  if (!s) return '';
  // NFC normalization + trim + collapse whitespace
  return s.normalize('NFC').trim().replace(/\s+/g, ' ');
}

function normalizeCase(s: string): string {
  if (!s) return '';
  // Title case for names
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bMc(\w)/g, (_, c) => `Mc${c.toUpperCase()}`)
    .replace(/\bO'(\w)/g, (_, c) => `O'${c.toUpperCase()}`);
}

// ── Bundle Hash ───────────────────────────────────────────────────────

function computeBundleHash(data: Record<string, unknown>): string {
  const canonical = JSON.stringify(data, Object.keys(data).sort());
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

// ── Conflict Detection ────────────────────────────────────────────────

function detectConflicts(
  records: RawProviderRecord[],
  field: string,
  extractor: (r: RawProviderRecord) => string | undefined
): CanonicalConflict | null {
  const values = records
    .map((r) => ({ source: r.source, value: normalizeUtf8(extractor(r)) }))
    .filter((v) => v.value.length > 0);

  const unique = new Set(values.map((v) => v.value.toLowerCase()));
  if (unique.size <= 1) return null;

  // Resolve: prefer NPPES > STATE_BOARD > ABMS > OIG > MANUAL
  const priority: ProviderSourceType[] = ['NPPES', 'STATE_BOARD', 'ABMS', 'OIG', 'MANUAL'];
  const sorted = values.sort(
    (a, b) => priority.indexOf(a.source) - priority.indexOf(b.source)
  );

  return {
    field,
    values,
    resolution: `Preferred source: ${sorted[0].source}`,
    resolvedValue: sorted[0].value,
  };
}

// ── Canonicalize ──────────────────────────────────────────────────────

/**
 * Merge multiple raw provider records into a single canonical representation.
 * Detects and logs field-level conflicts across sources.
 */
export function canonicalizeProvider(records: RawProviderRecord[]): CanonicalProvider {
  if (records.length === 0) {
    throw new Error('providerCanonicalizer: no records to canonicalize');
  }

  // Priority: NPPES > STATE_BOARD > ABMS > OIG > MANUAL
  const primary = records.find((r) => r.source === 'NPPES') ?? records[0];
  const npi = primary.npi ?? '';

  const conflicts: CanonicalConflict[] = [];

  // Detect field conflicts
  const nameConflict = detectConflicts(records, 'lastName', (r) => r.lastName);
  if (nameConflict) conflicts.push(nameConflict);

  const statusConflict = detectConflicts(records, 'status', (r) => r.status);
  if (statusConflict) conflicts.push(statusConflict);

  const first = normalizeCase(normalizeUtf8(primary.firstName));
  const middle = normalizeCase(normalizeUtf8(primary.middleName));
  const last = normalizeCase(normalizeUtf8(primary.lastName));
  const credential = normalizeUtf8(primary.credential);

  const displayName = [first, middle, last].filter(Boolean).join(' ') + (credential ? `, ${credential}` : '');

  // Merge taxonomies from all sources (deduplicated by code)
  const taxonomyMap = new Map<string, CanonicalProvider['taxonomies'][0]>();
  for (const r of records) {
    for (const t of r.taxonomies ?? []) {
      if (!taxonomyMap.has(t.code)) {
        taxonomyMap.set(t.code, {
          code: t.code,
          description: normalizeUtf8(t.desc),
          primary: t.primary,
          state: t.state ?? null,
          license: t.license ?? null,
        });
      }
    }
  }

  // Merge addresses
  const addresses = (primary.addresses ?? []).map((a) => ({
    purpose: a.purpose,
    line1: normalizeUtf8(a.address_1),
    line2: normalizeUtf8(a.address_2),
    city: normalizeCase(normalizeUtf8(a.city)),
    state: (a.state ?? '').toUpperCase(),
    postalCode: normalizeUtf8(a.postalCode),
    country: normalizeUtf8(a.country) || 'US',
    phone: normalizeUtf8(a.phone) || null,
  }));

  const statusRaw = normalizeUtf8(primary.status).toUpperCase();
  const status: CanonicalProvider['status'] =
    statusRaw === 'A' || statusRaw === 'ACTIVE' ? 'ACTIVE'
    : statusRaw === 'I' || statusRaw === 'INACTIVE' ? 'INACTIVE'
    : primary.deactivation_date ? 'DEACTIVATED'
    : 'UNKNOWN';

  const canonical: CanonicalProvider = {
    npi,
    canonicalName: { first, middle, last, displayName, credential },
    organization: normalizeUtf8(primary.organizationName) || null,
    gender: normalizeUtf8(primary.gender) || null,
    taxonomies: [...taxonomyMap.values()],
    addresses,
    status,
    enumerationDate: primary.enumeration_date ?? null,
    lastUpdated: primary.last_updated ?? null,
    sources: [...new Set(records.map((r) => r.source))],
    conflicts,
    bundleHash: computeBundleHash({
      npi,
      name: displayName,
      status,
      taxonomies: [...taxonomyMap.keys()],
      sources: records.map((r) => r.source),
    }),
    canonicalizedAt: new Date().toISOString(),
  };

  if (conflicts.length > 0) {
    log('warn', 'provider_canonicalizer: conflicts detected', {
      npi,
      conflictCount: conflicts.length,
      fields: conflicts.map((c) => c.field),
    });
  }

  log('info', 'provider_canonicalizer: canonicalized', {
    npi,
    sources: canonical.sources,
    taxonomies: canonical.taxonomies.length,
    conflicts: conflicts.length,
  });

  return canonical;
}
