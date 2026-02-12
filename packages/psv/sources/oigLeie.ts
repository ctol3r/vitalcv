/**
 * OIG LEIE (List of Excluded Individuals/Entities) Source Connector
 *
 * Checks the HHS-OIG exclusion database via their public REST API.
 * An exclusion finding means the individual is barred from participating
 * in Federal health care programs.
 *
 * API docs: https://oig.hhs.gov/exclusions/exclusions_list.asp
 * Search endpoint: https://exclusions.oig.hhs.gov/exclusions/search
 */

import crypto from 'crypto';
import { PSVReceipt, type CreatePSVReceiptInput } from '../PSVReceipt';

const OIG_SEARCH_URL = 'https://exclusions.oig.hhs.gov/exclusions/search.aspx/Search';
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

function buildSearchPayload(input: OigSearchInput): string {
  return JSON.stringify({
    FirstName: input.firstName.trim(),
    LastName: input.lastName.trim(),
    NPI: input.npi?.trim() || '',
  });
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
 * Search the OIG LEIE database for exclusions.
 *
 * @returns OigCheckResult with exclusion status and PSV receipt
 * @throws Error if the OIG API is unreachable or returns an unexpected response
 */
export async function checkOigLeie(input: OigSearchInput): Promise<OigCheckResult> {
  if (!input.firstName?.trim() || !input.lastName?.trim()) {
    throw new Error('OIG LEIE search requires firstName and lastName');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let rawBody: string;

  try {
    const response = await fetch(OIG_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json',
      },
      body: buildSearchPayload(input),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`OIG API returned HTTP ${response.status}`);
    }

    rawBody = await response.text();
  } finally {
    clearTimeout(timeout);
  }

  // OIG returns { d: [...] } wrapper
  let exclusions: OigExclusion[] = [];
  try {
    const parsed = JSON.parse(rawBody);
    const results = Array.isArray(parsed?.d) ? parsed.d : [];
    exclusions = results.map((r: Record<string, unknown>) => ({
      firstname: String(r.FIRSTNAME ?? ''),
      lastname: String(r.LASTNAME ?? ''),
      npi: String(r.NPI ?? ''),
      excltype: String(r.EXCLTYPE ?? ''),
      excldate: String(r.EXCLDATE ?? ''),
      reindate: String(r.REINDATE ?? ''),
      state: String(r.STATE ?? ''),
      specialty: String(r.SPECIALTY ?? ''),
    }));
  } catch {
    throw new Error('OIG API returned unparseable response');
  }

  const excluded = exclusions.length > 0;
  const transactionId = `oig-leie-${queryFingerprint(input)}-${Date.now()}`;
  const fetchedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  // Ensure we match RFC3339 UTC exactly for PSVReceipt validation
  const normalizedFetchedAt = fetchedAt.includes('.')
    ? fetchedAt
    : fetchedAt.replace('Z', '.000Z');

  const receiptInput: CreatePSVReceiptInput = {
    source_authority: 'LEIE',
    access_or_license_id: input.npi?.trim() || `${input.lastName.trim()}-${input.firstName.trim()}`,
    transaction_id: transactionId,
    fetched_at: normalizedFetchedAt,
    raw_response: rawBody,
    ttl_seconds: DEFAULT_TTL_SECONDS,
    revoked: false,
  };

  const receipt = PSVReceipt.create(receiptInput);

  return {
    excluded,
    exclusions: Object.freeze(exclusions),
    receipt,
    raw_response_hash: receipt.response_hash,
  };
}
