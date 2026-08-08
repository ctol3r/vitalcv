/**
 * verifyStatus.ts — FAIL-CLOSED Bitstring Status List verification.
 * https://www.w3.org/TR/vc-bitstring-status-list/ §3.2 (validate algorithm)
 *
 * THE CONTRACT (launch blocker #11):
 *   A credential's revocation status is `not_revoked` ONLY when a
 *   well-formed VC 2.0 BitstringStatusListCredential was obtained, its
 *   bitstring decoded strictly, the entry's index was in range, and the
 *   bit read 0. EVERY other condition — unfetchable list, malformed
 *   bitstring, wrong credential format (including the retired
 *   StatusList2021 shape), purpose mismatch, index out of range, expired
 *   list — yields `unverifiable`, which callers MUST treat as
 *   not-acceptable. There is no code path from a failure to
 *   `not_revoked`.
 *
 * The single decision bit for callers is `acceptable`:
 *   acceptable === true  ⇔  status === 'not_revoked'.
 */

import { BitstringDecodeError, decodeBitstring, getBit } from './bitstring';
import { VC_V2_CONTEXT } from './types';

// ── Result model ───────────────────────────────────────────────────────────

/** Error codes aligned with spec §3.2 processing errors where one exists. */
export type StatusVerificationErrorCode =
  | 'STATUS_RETRIEVAL_ERROR' // list unfetchable / non-200 / not JSON
  | 'STATUS_LIST_MALFORMED' // encodedList not strict base64url+GZIP, or undersized
  | 'STATUS_LIST_WRONG_FORMAT' // not a VC 2.0 BitstringStatusListCredential
  | 'STATUS_PURPOSE_MISMATCH' // list purpose ≠ entry purpose
  | 'RANGE_ERROR' // statusListIndex outside the bitstring
  | 'STATUS_ENTRY_MALFORMED' // credentialStatus entry itself malformed
  | 'STATUS_LIST_EXPIRED' // validUntil in the past / validFrom in the future
  | 'UNSUPPORTED_STATUS_SIZE'; // statusSize present and ≠ 1

export type StatusCheckOutcome =
  | { status: 'revoked'; acceptable: false; statusListIndex: number }
  | { status: 'not_revoked'; acceptable: true; statusListIndex: number }
  | {
      status: 'unverifiable';
      acceptable: false;
      code: StatusVerificationErrorCode;
      reason: string;
    };

function unverifiable(
  code: StatusVerificationErrorCode,
  reason: string,
): StatusCheckOutcome {
  return { status: 'unverifiable', acceptable: false, code, reason };
}

// ── Entry parsing ──────────────────────────────────────────────────────────

interface ParsedEntry {
  statusPurpose: string;
  statusListIndex: number;
  statusListCredential: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parse a `credentialStatus` entry. Accepts the spec's string-encoded
 * integer or a plain number for `statusListIndex`.
 */
function parseEntry(entry: unknown): ParsedEntry | string {
  if (!isRecord(entry)) return 'credentialStatus entry is not an object.';

  if (entry.type !== 'BitstringStatusListEntry') {
    return `credentialStatus entry type is ${JSON.stringify(entry.type)}; expected "BitstringStatusListEntry".`;
  }

  const purpose = entry.statusPurpose;
  if (typeof purpose !== 'string' || purpose.length === 0) {
    return 'credentialStatus entry is missing statusPurpose.';
  }

  const rawIndex = entry.statusListIndex;
  let index: number;
  if (typeof rawIndex === 'number') {
    index = rawIndex;
  } else if (typeof rawIndex === 'string' && /^[0-9]+$/.test(rawIndex)) {
    index = Number.parseInt(rawIndex, 10);
  } else {
    return `statusListIndex ${JSON.stringify(rawIndex)} is not a non-negative integer.`;
  }
  if (!Number.isSafeInteger(index) || index < 0) {
    return `statusListIndex ${JSON.stringify(rawIndex)} is not a non-negative integer.`;
  }

  const listUrl = entry.statusListCredential;
  if (typeof listUrl !== 'string' || listUrl.length === 0) {
    return 'credentialStatus entry is missing statusListCredential.';
  }

  return { statusPurpose: purpose, statusListIndex: index, statusListCredential: listUrl };
}

// ── Core check (list already in hand) ──────────────────────────────────────

export interface CheckOptions {
  /** Injectable clock for validity-window tests. Defaults to `Date.now()`. */
  now?: Date;
}

/**
 * Check one credentialStatus entry against a status list credential that
 * has already been fetched/supplied. Fail-closed per the module contract.
 */
export async function checkStatusListEntry(
  entry: unknown,
  statusListCredential: unknown,
  options: CheckOptions = {},
): Promise<StatusCheckOutcome> {
  const parsed = parseEntry(entry);
  if (typeof parsed === 'string') {
    return unverifiable('STATUS_ENTRY_MALFORMED', parsed);
  }

  if (!isRecord(statusListCredential)) {
    return unverifiable('STATUS_LIST_WRONG_FORMAT', 'Status list credential is not an object.');
  }

  // Format pinning: VC 2.0 BitstringStatusListCredential ONLY. The retired
  // StatusList2021Credential shape (2018 context, StatusList2021 subject)
  // deliberately fails here.
  const types = statusListCredential.type;
  if (!Array.isArray(types) || !types.includes('BitstringStatusListCredential')) {
    return unverifiable(
      'STATUS_LIST_WRONG_FORMAT',
      `Status list credential type ${JSON.stringify(types)} does not include "BitstringStatusListCredential".`,
    );
  }

  const context = statusListCredential['@context'];
  if (!Array.isArray(context) || !context.includes(VC_V2_CONTEXT)) {
    return unverifiable(
      'STATUS_LIST_WRONG_FORMAT',
      `Status list credential @context does not include the VC 2.0 context ${VC_V2_CONTEXT}.`,
    );
  }

  // Validity window (fail closed on a stale or not-yet-valid list).
  const now = options.now ?? new Date();
  const windowError = checkValidityWindow(statusListCredential, now);
  if (windowError) return windowError;

  const subject = statusListCredential.credentialSubject;
  if (!isRecord(subject) || subject.type !== 'BitstringStatusList') {
    return unverifiable(
      'STATUS_LIST_WRONG_FORMAT',
      'credentialSubject.type is not "BitstringStatusList".',
    );
  }

  if (subject.statusPurpose !== parsed.statusPurpose) {
    return unverifiable(
      'STATUS_PURPOSE_MISMATCH',
      `Entry statusPurpose "${parsed.statusPurpose}" does not match list statusPurpose ${JSON.stringify(subject.statusPurpose)}.`,
    );
  }

  // statusSize other than 1 bit per status is not supported — refuse to
  // guess rather than misread multi-bit statuses.
  if ('statusSize' in subject && subject.statusSize !== undefined && subject.statusSize !== 1) {
    return unverifiable(
      'UNSUPPORTED_STATUS_SIZE',
      `statusSize ${JSON.stringify(subject.statusSize)} is not supported (only 1).`,
    );
  }

  let bits: Buffer;
  try {
    bits = await decodeBitstring(subject.encodedList);
  } catch (err) {
    const reason =
      err instanceof BitstringDecodeError ? err.message : `Bitstring decode failed: ${String(err)}`;
    return unverifiable('STATUS_LIST_MALFORMED', reason);
  }

  const totalBits = bits.length * 8;
  if (parsed.statusListIndex >= totalBits) {
    return unverifiable(
      'RANGE_ERROR',
      `statusListIndex ${parsed.statusListIndex} is outside the ${totalBits}-bit status list.`,
    );
  }

  const bit = getBit(bits, parsed.statusListIndex);
  if (bit === 1) {
    return { status: 'revoked', acceptable: false, statusListIndex: parsed.statusListIndex };
  }
  return { status: 'not_revoked', acceptable: true, statusListIndex: parsed.statusListIndex };
}

function checkValidityWindow(
  credential: Record<string, unknown>,
  now: Date,
): StatusCheckOutcome | null {
  const { validFrom, validUntil } = credential;
  if (typeof validFrom === 'string') {
    const from = Date.parse(validFrom);
    if (Number.isNaN(from)) {
      return unverifiable('STATUS_LIST_WRONG_FORMAT', `validFrom ${JSON.stringify(validFrom)} is not a valid datetime.`);
    }
    if (from > now.getTime()) {
      return unverifiable('STATUS_LIST_EXPIRED', 'Status list validFrom is in the future.');
    }
  }
  if (typeof validUntil === 'string') {
    const until = Date.parse(validUntil);
    if (Number.isNaN(until)) {
      return unverifiable('STATUS_LIST_WRONG_FORMAT', `validUntil ${JSON.stringify(validUntil)} is not a valid datetime.`);
    }
    if (until < now.getTime()) {
      return unverifiable('STATUS_LIST_EXPIRED', 'Status list validUntil is in the past.');
    }
  }
  return null;
}

// ── Fetch + check ──────────────────────────────────────────────────────────

export type FetchLike = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export interface ResolveOptions extends CheckOptions {
  /** Injectable fetch for tests. Defaults to global fetch. */
  fetchImpl?: FetchLike;
}

/**
 * Resolve the entry's `statusListCredential` URL and check the bit.
 * ANY retrieval failure — network error, non-200, unparseable JSON —
 * yields `unverifiable` (never `not_revoked`).
 */
export async function resolveAndCheckStatus(
  entry: unknown,
  options: ResolveOptions = {},
): Promise<StatusCheckOutcome> {
  const parsed = parseEntry(entry);
  if (typeof parsed === 'string') {
    return unverifiable('STATUS_ENTRY_MALFORMED', parsed);
  }

  const fetchImpl: FetchLike = options.fetchImpl ?? (globalThis.fetch as FetchLike);
  if (typeof fetchImpl !== 'function') {
    return unverifiable('STATUS_RETRIEVAL_ERROR', 'No fetch implementation available.');
  }

  let credential: unknown;
  try {
    const response = await fetchImpl(parsed.statusListCredential);
    if (!response.ok) {
      return unverifiable(
        'STATUS_RETRIEVAL_ERROR',
        `Status list fetch returned HTTP ${response.status}.`,
      );
    }
    credential = await response.json();
  } catch (err) {
    return unverifiable(
      'STATUS_RETRIEVAL_ERROR',
      `Status list could not be retrieved: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return checkStatusListEntry(entry, credential, options);
}
