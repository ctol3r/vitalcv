/**
 * SAM.gov Exclusions Source Connector
 *
 * Checks the System for Award Management (SAM.gov) Entity Management API
 * for active exclusion records. Exclusion means the entity is prohibited
 * from receiving federal contracts or certain subcontracts.
 *
 * API docs: https://open.gsa.gov/api/entity-api/
 * Note: Requires a free API key from api.sam.gov
 */

import crypto from 'crypto';
import { PSVReceipt, type CreatePSVReceiptInput } from '../PSVReceipt';

const SAM_API_BASE = 'https://api.sam.gov/entity-information/v3/exclusions';
const DEFAULT_TTL_SECONDS = 86400; // 24 hours
const REQUEST_TIMEOUT_MS = 15_000;

export interface SamSearchInput {
  /** Entity name (individual or organization) */
  name: string;
  /** Optional: UEI (Unique Entity Identifier) */
  uei?: string;
  /** SAM.gov API key (required) */
  apiKey: string;
}

export interface SamExclusion {
  name: string;
  classificationType: string;
  exclusionType: string;
  exclusionProgram: string;
  activeDateStart: string;
  activeDateEnd: string;
  terminationDate: string;
  description: string;
}

export interface SamCheckResult {
  excluded: boolean;
  exclusions: readonly SamExclusion[];
  receipt: PSVReceipt;
  raw_response_hash: string;
}

function queryFingerprint(input: SamSearchInput): string {
  const canonical = JSON.stringify({
    name: input.name.trim().toLowerCase(),
    uei: input.uei?.trim() || '',
  });
  return crypto.createHash('sha256').update(canonical).digest('hex').substring(0, 16);
}

/**
 * Search SAM.gov exclusion records.
 *
 * @returns SamCheckResult with exclusion status and PSV receipt
 * @throws Error if API key is missing, API is unreachable, or returns error
 */
export async function checkSamExclusions(input: SamSearchInput): Promise<SamCheckResult> {
  if (!input.name?.trim()) {
    throw new Error('SAM.gov search requires a name');
  }

  if (!input.apiKey?.trim()) {
    throw new Error('SAM.gov API key is required (register at api.sam.gov)');
  }

  const params = new URLSearchParams({
    api_key: input.apiKey.trim(),
    q: input.name.trim(),
    exclusionName: input.name.trim(),
  });

  if (input.uei?.trim()) {
    params.set('ueiSAM', input.uei.trim());
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let rawBody: string;

  try {
    const response = await fetch(`${SAM_API_BASE}?${params.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`SAM.gov API returned HTTP ${response.status}`);
    }

    rawBody = await response.text();
  } finally {
    clearTimeout(timeout);
  }

  let exclusions: SamExclusion[] = [];
  try {
    const parsed = JSON.parse(rawBody);
    const results = Array.isArray(parsed?.results) ? parsed.results : [];
    exclusions = results.map((r: Record<string, unknown>) => ({
      name: String(r.name ?? ''),
      classificationType: String(r.classificationType ?? ''),
      exclusionType: String(r.exclusionType ?? ''),
      exclusionProgram: String(r.exclusionProgram ?? ''),
      activeDateStart: String(r.activeDateStart ?? ''),
      activeDateEnd: String(r.activeDateEnd ?? ''),
      terminationDate: String(r.terminationDate ?? ''),
      description: String(r.description ?? ''),
    }));
  } catch {
    throw new Error('SAM.gov API returned unparseable response');
  }

  const excluded = exclusions.length > 0;
  const transactionId = `sam-excl-${queryFingerprint(input)}-${Date.now()}`;
  const fetchedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');

  const receiptInput: CreatePSVReceiptInput = {
    source_authority: 'OTHER', // SAM.gov mapped to OTHER (not in core SourceAuthority enum)
    access_or_license_id: input.uei?.trim() || input.name.trim(),
    transaction_id: transactionId,
    fetched_at: fetchedAt,
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
