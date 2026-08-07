/**
 * generate-provider-reference-data.ts
 *
 * Regenerates the committed provider reference tables under
 * apps/web/lib/reference/ from their upstream federal sources.
 *
 * Sources (both free, both official — see docs on the no-paid-data-sources
 * policy; neither is licensed or rate-limited):
 *
 *   1. NUCC Health Care Provider Taxonomy code set
 *      https://www.nucc.org/images/stories/CSV/nucc_taxonomy_<version>.csv
 *      The authoritative meaning of every taxonomy code NPPES can emit.
 *
 *   2. CMS Medicare Provider and Supplier Taxonomy Crosswalk
 *      https://data.cms.gov/provider-characteristics/...
 *      Maps a NUCC taxonomy code to Medicare specialty code(s) and the
 *      Medicare provider/supplier type description.
 *
 * Why generated-and-committed rather than fetched at runtime: these are the
 * dictionaries used to *label* a provider's record. A runtime fetch would
 * make label rendering depend on two external hosts being up, and a silent
 * fetch failure would blank out specialty labels on every profile. Pinning
 * them makes the labels deterministic and reviewable in diff.
 *
 * Usage:
 *   pnpm tsx scripts/generate-provider-reference-data.ts
 *   pnpm tsx scripts/generate-provider-reference-data.ts --nucc-version 251
 *
 * The generated files carry the source URLs and retrieval date in a header
 * so a reader can tell exactly which vintage is in force.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const NUCC_VERSION =
  process.argv.includes('--nucc-version')
    ? process.argv[process.argv.indexOf('--nucc-version') + 1]
    : '251';

const NUCC_URL = `https://www.nucc.org/images/stories/CSV/nucc_taxonomy_${NUCC_VERSION}.csv`;
const CMS_CROSSWALK_URL =
  'https://data.cms.gov/sites/default/files/2025-12/2c2c6ece-e78f-45be-ba66-4e92075fbb7a/Medicare_Provider_and_Supplier_Taxonomy_Crosswalk_October_2025.csv';

const OUT_DIR = join(process.cwd(), 'apps/web/lib/reference');

// ── Minimal RFC-4180 CSV parser ──────────────────────────────────────────
// The NUCC definitions contain commas, quotes and embedded newlines, so a
// split(',') would silently corrupt roughly a third of the rows.

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  // Strip a UTF-8 BOM if present — NUCC ships one and it would otherwise
  // become part of the first header name.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

function toRecords(text: string): Array<Record<string, string>> {
  const [header, ...body] = parseCsv(text);
  return body.map((cells) => {
    const rec: Record<string, string> = {};
    header.forEach((h, idx) => {
      rec[h.trim()] = (cells[idx] ?? '').trim();
    });
    return rec;
  });
}

async function fetchCsv(url: string): Promise<Array<Record<string, string>>> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status} for ${url}`);
  }
  return toRecords(await res.text());
}

function banner(sourceUrl: string, rowCount: number, extra = ''): string {
  return `/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Regenerate with:
 *   pnpm tsx scripts/generate-provider-reference-data.ts
 *
 * Source:    ${sourceUrl}
 * Retrieved: ${new Date().toISOString().slice(0, 10)}
 * Rows:      ${rowCount}
${extra}
 */
`;
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  // ── NUCC taxonomy ──────────────────────────────────────────────────────
  const nucc = await fetchCsv(NUCC_URL);
  const nuccEntries = nucc
    .filter((r) => r.Code)
    .map((r) => ({
      code: r.Code,
      grouping: r.Grouping ?? '',
      classification: r.Classification ?? '',
      specialization: r.Specialization ?? '',
      displayName: r['Display Name'] ?? '',
      // "Individual" | "Non-Individual" — whether the code describes a person
      // or an organization. Lets a surface flag a Type-1 NPI carrying an
      // organization-only taxonomy, which is a genuine data-quality signal.
      section: r.Section ?? '',
      definition: r.Definition ?? '',
    }));

  const nuccOut =
    banner(NUCC_URL, nuccEntries.length, ` * Version:   NUCC ${NUCC_VERSION}`) +
    `
/** One entry from the NUCC Health Care Provider Taxonomy code set. */
export interface NuccTaxonomyEntry {
  code: string;
  grouping: string;
  classification: string;
  specialization: string;
  displayName: string;
  /** "Individual" | "Non-Individual" */
  section: string;
  definition: string;
}

export const NUCC_TAXONOMY_VERSION = ${JSON.stringify(NUCC_VERSION)};
export const NUCC_TAXONOMY_SOURCE_URL = ${JSON.stringify(NUCC_URL)};

const ENTRIES: NuccTaxonomyEntry[] = ${JSON.stringify(nuccEntries, null, 0)};

export const NUCC_TAXONOMY: ReadonlyMap<string, NuccTaxonomyEntry> = new Map(
  ENTRIES.map((e) => [e.code, e]),
);

/** Look up a taxonomy code. Returns null for codes absent from this vintage. */
export function lookupTaxonomy(code: string | null | undefined): NuccTaxonomyEntry | null {
  if (!code) return null;
  return NUCC_TAXONOMY.get(code.trim().toUpperCase()) ?? null;
}
`;

  writeFileSync(join(OUT_DIR, 'nucc-taxonomy.generated.ts'), nuccOut, 'utf8');
  console.log(`nucc-taxonomy.generated.ts — ${nuccEntries.length} codes`);

  // ── CMS Medicare crosswalk ─────────────────────────────────────────────
  const cms = await fetchCsv(CMS_CROSSWALK_URL);
  const TAX = 'PROVIDER TAXONOMY CODE';
  const SPEC = 'MEDICARE SPECIALTY CODE';
  const DESC = 'MEDICARE PROVIDER/SUPPLIER TYPE DESCRIPTION';

  // A taxonomy code can map to SEVERAL Medicare specialty codes (86 of 460 do
  // in the Oct-2025 vintage). Keep every mapping — collapsing to one would
  // silently drop, for example, two of the three specialties that vascular
  // surgery legitimately maps to.
  const grouped = new Map<string, Array<{ specialtyCode: string; description: string }>>();
  for (const row of cms) {
    const code = (row[TAX] ?? '').trim().toUpperCase();
    const specialtyCode = (row[SPEC] ?? '').trim();
    const description = (row[DESC] ?? '').trim();
    if (!code || !specialtyCode) continue;

    const list = grouped.get(code) ?? [];
    if (!list.some((e) => e.specialtyCode === specialtyCode)) {
      list.push({ specialtyCode, description });
    }
    grouped.set(code, list);
  }

  const crosswalkEntries = [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, mappings]) => ({ code, mappings }));

  const cmsOut =
    banner(CMS_CROSSWALK_URL, crosswalkEntries.length,
      ' * Note:      One taxonomy code may map to several Medicare specialty\n' +
      ' *            codes; every mapping is preserved.') +
    `
/** A Medicare specialty a taxonomy code maps to. */
export interface MedicareSpecialtyMapping {
  /** Two-character CMS Medicare specialty code, e.g. "97" */
  specialtyCode: string;
  /** CMS provider/supplier type description, e.g. "Physician Assistant" */
  description: string;
}

export const MEDICARE_CROSSWALK_SOURCE_URL = ${JSON.stringify(CMS_CROSSWALK_URL)};

const CROSSWALK: Array<{ code: string; mappings: MedicareSpecialtyMapping[] }> =
  ${JSON.stringify(crosswalkEntries, null, 0)};

export const MEDICARE_CROSSWALK: ReadonlyMap<string, readonly MedicareSpecialtyMapping[]> =
  new Map(CROSSWALK.map((e) => [e.code, e.mappings]));

/**
 * Medicare specialty mappings for a taxonomy code.
 *
 * Returns an empty array — never a guess — when the code is not Medicare
 * enrollable. Only 460 of the 883 NUCC codes appear in the crosswalk, so an
 * empty result is the normal case, not an error.
 */
export function lookupMedicareSpecialties(
  code: string | null | undefined,
): readonly MedicareSpecialtyMapping[] {
  if (!code) return [];
  return MEDICARE_CROSSWALK.get(code.trim().toUpperCase()) ?? [];
}
`;

  writeFileSync(join(OUT_DIR, 'medicare-crosswalk.generated.ts'), cmsOut, 'utf8');
  console.log(`medicare-crosswalk.generated.ts — ${crosswalkEntries.length} taxonomy codes`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
