import crypto from 'crypto';

export const SOURCE_AUTHORITIES = ['ABMS', 'FSMB', 'NPI', 'LEIE', 'OTHER'] as const;
export const RECEIPT_SOURCE_COVERAGE_STATES = [
  'checked',
  'stale',
  'pending',
  'gated',
  'unavailable',
  'accessRequired',
  'reviewRequired',
  'notDecisionGrade',
  'previewOnly',
] as const;

export type SourceAuthority = (typeof SOURCE_AUTHORITIES)[number];
export type ReceiptSourceCoverageState =
  (typeof RECEIPT_SOURCE_COVERAGE_STATES)[number];

export type PSVReceiptSnapshot = Readonly<{
  receipt_id: string;
  source_authority: SourceAuthority;
  access_or_license_id: string;
  transaction_id: string;
  fetched_at: string;
  response_hash: string;
  ttl_seconds: number;
  revoked: boolean;
  source_coverage_state?: ReceiptSourceCoverageState;
}>;

export type CreatePSVReceiptInput = Readonly<{
  receipt_id?: string;
  source_authority: SourceAuthority;
  access_or_license_id: string;
  transaction_id: string;
  fetched_at: string;
  raw_response: string;
  ttl_seconds: number;
  revoked?: boolean;
  source_coverage_state?: ReceiptSourceCoverageState;
}>;

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RFC3339_UTC_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/i;

function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
}

function assertSourceAuthority(value: unknown): asserts value is SourceAuthority {
  if (!SOURCE_AUTHORITIES.includes(value as SourceAuthority)) {
    throw new Error('source_authority must be one of ABMS | FSMB | NPI | LEIE | OTHER');
  }
}

function assertReceiptSourceCoverageState(
  value: unknown,
): asserts value is ReceiptSourceCoverageState {
  if (
    value !== undefined &&
    !RECEIPT_SOURCE_COVERAGE_STATES.includes(value as ReceiptSourceCoverageState)
  ) {
    throw new Error(
      'source_coverage_state must be one of: checked | stale | pending | gated | unavailable | accessRequired | reviewRequired | notDecisionGrade | previewOnly',
    );
  }
}

function assertRfc3339Utc(value: unknown, field: string): asserts value is string {
  assertNonEmptyString(value, field);

  if (!RFC3339_UTC_REGEX.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${field} must be RFC3339 UTC`);
  }
}

function assertPositiveInteger(value: unknown, field: string): asserts value is number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
}

function assertUuidV4(value: unknown, field: string): asserts value is string {
  assertNonEmptyString(value, field);

  if (!UUID_V4_REGEX.test(value)) {
    throw new Error(`${field} must be a UUID v4`);
  }
}

function assertSha256Hex(value: unknown, field: string): asserts value is string {
  assertNonEmptyString(value, field);

  if (!SHA256_HEX_REGEX.test(value)) {
    throw new Error(`${field} must be a sha256 hex string`);
  }
}

function hashRawResponse(rawResponse: string): string {
  return crypto.createHash('sha256').update(rawResponse).digest('hex');
}

export class PSVReceipt {
  public readonly receipt_id: string;
  public readonly source_authority: SourceAuthority;
  public readonly access_or_license_id: string;
  public readonly transaction_id: string;
  public readonly fetched_at: string;
  public readonly response_hash: string;
  public readonly ttl_seconds: number;
  public readonly revoked: boolean;
  public readonly source_coverage_state?: ReceiptSourceCoverageState;

  private constructor(snapshot: PSVReceiptSnapshot) {
    assertUuidV4(snapshot.receipt_id, 'receipt_id');
    assertSourceAuthority(snapshot.source_authority);
    assertNonEmptyString(snapshot.access_or_license_id, 'access_or_license_id');
    assertNonEmptyString(snapshot.transaction_id, 'transaction_id');
    assertRfc3339Utc(snapshot.fetched_at, 'fetched_at');
    assertSha256Hex(snapshot.response_hash, 'response_hash');
    assertPositiveInteger(snapshot.ttl_seconds, 'ttl_seconds');
    assertReceiptSourceCoverageState(snapshot.source_coverage_state);

    this.receipt_id = snapshot.receipt_id;
    this.source_authority = snapshot.source_authority;
    this.access_or_license_id = snapshot.access_or_license_id;
    this.transaction_id = snapshot.transaction_id;
    this.fetched_at = snapshot.fetched_at;
    this.response_hash = snapshot.response_hash;
    this.ttl_seconds = snapshot.ttl_seconds;
    this.revoked = Boolean(snapshot.revoked);
    this.source_coverage_state = snapshot.source_coverage_state;

    Object.freeze(this);
  }

  static create(input: CreatePSVReceiptInput): PSVReceipt {
    if (!input || typeof input !== 'object') {
      throw new Error('PSVReceipt input is required');
    }

    assertSourceAuthority(input.source_authority);
    assertNonEmptyString(input.access_or_license_id, 'access_or_license_id');
    assertNonEmptyString(input.transaction_id, 'transaction_id');
    assertRfc3339Utc(input.fetched_at, 'fetched_at');
    assertPositiveInteger(input.ttl_seconds, 'ttl_seconds');
    assertNonEmptyString(input.raw_response, 'raw_response');
    assertReceiptSourceCoverageState(input.source_coverage_state);

    const receipt_id = input.receipt_id ?? crypto.randomUUID();
    assertUuidV4(receipt_id, 'receipt_id');

    // Raw source response is intentionally not persisted.
    const response_hash = hashRawResponse(input.raw_response);

    return new PSVReceipt({
      receipt_id,
      source_authority: input.source_authority,
      access_or_license_id: input.access_or_license_id,
      transaction_id: input.transaction_id,
      fetched_at: input.fetched_at,
      response_hash,
      ttl_seconds: input.ttl_seconds,
      revoked: Boolean(input.revoked),
      source_coverage_state: input.source_coverage_state,
    });
  }

  toJSON(): PSVReceiptSnapshot {
    return Object.freeze({
      receipt_id: this.receipt_id,
      source_authority: this.source_authority,
      access_or_license_id: this.access_or_license_id,
      transaction_id: this.transaction_id,
      fetched_at: this.fetched_at,
      response_hash: this.response_hash,
      ttl_seconds: this.ttl_seconds,
      revoked: this.revoked,
      ...(this.source_coverage_state
        ? { source_coverage_state: this.source_coverage_state }
        : {}),
    });
  }
}
