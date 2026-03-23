/**
 * OIG LEIE (List of Excluded Individuals/Entities) Source Connector
 *
 * Uses the monthly LEIE bulk CSV instead of the retired search API.
 * The CSV is the source of truth:
 *   https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv
 */

import crypto from 'crypto';
import { PSVReceipt, type CreatePSVReceiptInput } from '../PSVReceipt';

const LEIE_CSV_URL = 'https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv';
const DEFAULT_TTL_SECONDS = 86400; // 24 hours
const REQUEST_TIMEOUT_MS = 15_000;

export interface OigSearchInput {
  firstName: string;
  lastName: string;
  npi?: string;
}

export interface OigExclusion {
  firstname: string;
  lastname: string;
  npi: string;
  excltype: string;
  excldate: string;
  reindate: string;
  state: string;
  specialty: string;
}

export interface OigCheckResult {
  excluded: boolean;
  exclusions: readonly OigExclusion[];
  receipt: PSVReceipt;
  raw_response_hash: string;
}

function normalizeToken(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
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

function headerIndex(header: readonly string[]): Map<string, number> {
  return new Map(header.map((name, index) => [normalizeToken(name), index] as const));
}

function fieldFromRow(
  row: readonly string[],
  index: Map<string, number>,
  keys: readonly string[],
  fallbackIndex: number,
): string {
  for (const key of keys) {
    const headerMatch = index.get(normalizeToken(key));
    if (typeof headerMatch === 'number') {
      return row[headerMatch]?.trim() ?? '';
    }
  }

  return row[fallbackIndex]?.trim() ?? '';
}

function toExclusion(
  row: readonly string[],
  index: Map<string, number>,
): OigExclusion | null {
  const exclusion: OigExclusion = {
    lastname: fieldFromRow(row, index, ['LASTNAME', 'LAST_NAME'], 0),
    firstname: fieldFromRow(row, index, ['FIRSTNAME', 'FIRST_NAME'], 1),
    npi: fieldFromRow(row, index, ['NPI'], 7),
    excltype: fieldFromRow(row, index, ['EXCLTYPE', 'EXCLUSIONTYPE', 'EXCLUSION_TYPE'], 13),
    excldate: fieldFromRow(row, index, ['EXCLDATE', 'EXCLUSIONDATE', 'EXCLUSION_DATE'], 14),
    reindate: fieldFromRow(row, index, ['REINDATE', 'REINSTATEMENTDATE', 'REINSTATEMENT_DATE'], 15),
    state: fieldFromRow(row, index, ['STATE'], 11),
    specialty: fieldFromRow(row, index, ['SPECIALTY', 'SPECIALITY'], 5),
  };

  if (!exclusion.npi && !exclusion.lastname) {
    return null;
  }

  return exclusion;
}

function buildExclusions(csv: string): OigExclusion[] {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return [];
  }

  const header = parseCsvLine(lines[0]!);
  const index = headerIndex(header);
  const startIndex = index.has('NPI') || index.has('LASTNAME') ? 1 : 0;
  const exclusions: OigExclusion[] = [];

  for (let lineIndex = startIndex; lineIndex < lines.length; lineIndex += 1) {
    const row = parseCsvLine(lines[lineIndex]!);
    const exclusion = toExclusion(row, index);
    if (exclusion) {
      exclusions.push(exclusion);
    }
  }

  return exclusions;
}

function partialFirstNameMatch(input: string, candidate: string): boolean {
  if (!input || !candidate) {
    return false;
  }

  return input === candidate
    || input[0] === candidate[0]
    || input.startsWith(candidate)
    || candidate.startsWith(input);
}

function queryFingerprint(input: OigSearchInput): string {
  const canonical = JSON.stringify({
    firstName: input.firstName.trim().toLowerCase(),
    lastName: input.lastName.trim().toLowerCase(),
    npi: input.npi?.trim() || '',
  });
  return crypto.createHash('sha256').update(canonical).digest('hex').substring(0, 16);
}

/**
 * Search the monthly LEIE CSV for exclusions.
 *
 * @returns OigCheckResult with exclusion status and PSV receipt
 * @throws Error if the LEIE CSV is unreachable or returns an unexpected response
 */
export async function checkOigLeie(input: OigSearchInput): Promise<OigCheckResult> {
  if (!input.firstName?.trim() || !input.lastName?.trim()) {
    throw new Error('OIG LEIE search requires firstName and lastName');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let csv: string;
  let lastModified: string | null = null;

  try {
    const response = await fetch(LEIE_CSV_URL, {
      method: 'GET',
      headers: {
        Accept: 'text/csv,text/plain,*/*',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`LEIE CSV returned HTTP ${response.status}`);
    }

    csv = await response.text();
    lastModified = response.headers.get('last-modified');
  } finally {
    clearTimeout(timeout);
  }

  const exclusions = buildExclusions(csv);
  const inputNpi = (input.npi ?? '').trim();
  const exactMatches = inputNpi
    ? exclusions.filter((entry) => entry.npi === inputNpi)
    : [];

  const matchedExclusions = exactMatches.length > 0
    ? exactMatches
    : exclusions.filter((entry) => {
        const inputLast = normalizeToken(input.lastName);
        const inputFirst = normalizeToken(input.firstName);
        const entryLast = normalizeToken(entry.lastname);
        const entryFirst = normalizeToken(entry.firstname);

        return Boolean(inputLast)
          && inputLast === entryLast
          && partialFirstNameMatch(inputFirst, entryFirst);
      });

  const rawPayload = JSON.stringify({
    source: 'LEIE_CSV',
    lastModified,
    matchedCount: matchedExclusions.length,
    exclusions: matchedExclusions,
  });
  const transactionId = `oig-leie-${queryFingerprint(input)}-${Date.now()}`;
  const fetchedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const normalizedFetchedAt = fetchedAt.includes('.')
    ? fetchedAt
    : fetchedAt.replace('Z', '.000Z');

  const receiptInput: CreatePSVReceiptInput = {
    source_authority: 'LEIE',
    access_or_license_id: input.npi?.trim() || `${input.lastName.trim()}-${input.firstName.trim()}`,
    transaction_id: transactionId,
    fetched_at: normalizedFetchedAt,
    raw_response: rawPayload,
    ttl_seconds: DEFAULT_TTL_SECONDS,
    revoked: false,
  };

  const receipt = PSVReceipt.create(receiptInput);

  return {
    excluded: matchedExclusions.length > 0,
    exclusions: Object.freeze(matchedExclusions),
    receipt,
    raw_response_hash: receipt.response_hash,
  };
}
