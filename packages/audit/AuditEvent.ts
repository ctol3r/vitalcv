/** YC MVP — behavior frozen. Do not modify without scope approval. */
import crypto from 'crypto';

export const AUDIT_EVENT_TYPES = [
  'NPI_INGESTED',
  'NPI_VALIDATION_FAILED',
  'FILE_INGESTED',
  'INGEST_PARSE_SUMMARY',
  'INGEST_CONFLICT_DETECTED',
  'INGEST_ERROR',
  'VERIFICATION_REQUESTED',
  'VERIFICATION_COMPLETED',
  'VERIFICATION_FAILED',
  'EMPLOYER_ACCEPTANCE_REJECTED',
  'START_REJECTED',
  'PSV_RECEIPT',
  'RECOGNITION',
  'ACCEPTANCE',
  'EMPLOYER_ACCEPTANCE',
  'START',
  'START_ATTESTED',
  'COMMITTEE',
  'TRUST_STATE_CHECK',
  'TRUST_STATE_DECAY',
  'IDEMPOTENT_REPLAY',
  'CONCURRENCY_GUARD_TRIGGERED',
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export type AuditEventMetadata = Readonly<Record<string, unknown>>;

export type AuditEventInput = Readonly<{
  audit_event_id?: string;
  clinician_id: string;
  event_type: AuditEventType;
  reference_id: string;
  occurred_at: string;
  metadata?: AuditEventMetadata;
}>;

export type AuditEventSnapshot = Readonly<{
  audit_event_id: string;
  clinician_id: string;
  event_type: AuditEventType;
  reference_id: string;
  occurred_at: string;
  metadata: AuditEventMetadata;
}>;

const RFC3339_UTC_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/i;
const NON_REPUDIATION_EVENTS = new Set<AuditEventType>([
  'RECOGNITION',
  'ACCEPTANCE',
  'EMPLOYER_ACCEPTANCE',
  'START',
  'START_ATTESTED',
]);

function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
}

function assertRfc3339Utc(value: unknown, field: string): asserts value is string {
  assertNonEmptyString(value, field);

  if (!RFC3339_UTC_REGEX.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${field} must be RFC3339 UTC`);
  }
}

function assertEventType(value: unknown): asserts value is AuditEventType {
  if (!AUDIT_EVENT_TYPES.includes(value as AuditEventType)) {
    throw new Error(`event_type must be one of ${AUDIT_EVENT_TYPES.join(' | ')}`);
  }
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  const target = value as Record<string, unknown>;
  for (const key of Object.keys(target)) {
    const nested = target[key];
    if (nested && typeof nested === 'object') {
      deepFreeze(nested);
    }
  }

  return Object.freeze(value);
}

function readOptionalScopeField(
  metadata: Record<string, unknown>,
  field: 'employer_id' | 'facility_id' | 'role',
): string | undefined {
  const value = metadata[field];
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function readOptionalString(metadata: Record<string, unknown>, field: string): string | undefined {
  const value = metadata[field];
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function readOptionalProofField(
  metadata: Record<string, unknown>,
  proofKey: 'type' | 'verificationMethod',
): string | undefined {
  const proof = metadata.proof;
  if (!proof || typeof proof !== 'object') {
    return undefined;
  }

  return readOptionalString(proof as Record<string, unknown>, proofKey);
}

function readOptionalEmployerProofField(
  metadata: Record<string, unknown>,
  proofKey: 'type' | 'verificationMethod',
): string | undefined {
  const proof = metadata.employerProof;
  if (!proof || typeof proof !== 'object') {
    return undefined;
  }

  return readOptionalString(proof as Record<string, unknown>, proofKey);
}

function normalizeNonRepudiationMetadata(
  event_type: AuditEventType,
  metadata: Record<string, unknown>,
): void {
  if (!NON_REPUDIATION_EVENTS.has(event_type)) {
    return;
  }

  const hashAnchor = readOptionalString(metadata, 'hashAnchor') ?? readOptionalString(metadata, 'hash_anchor');
  const proofType =
    readOptionalString(metadata, 'proofType') ??
    readOptionalProofField(metadata, 'type') ??
    readOptionalEmployerProofField(metadata, 'type');
  const verificationMethod =
    readOptionalString(metadata, 'verificationMethod') ??
    readOptionalProofField(metadata, 'verificationMethod') ??
    readOptionalEmployerProofField(metadata, 'verificationMethod');

  if (!hashAnchor || !SHA256_HEX_REGEX.test(hashAnchor)) {
    throw new Error(`metadata.hashAnchor is required for ${event_type}`);
  }
  if (!proofType) {
    throw new Error(`metadata.proofType is required for ${event_type}`);
  }
  if (!verificationMethod) {
    throw new Error(`metadata.verificationMethod is required for ${event_type}`);
  }

  metadata.hashAnchor = hashAnchor.toLowerCase();
  metadata.proofType = proofType;
  metadata.verificationMethod = verificationMethod;
}

function normalizeMetadata(
  event_type: AuditEventType,
  clinician_id: string,
  metadata: AuditEventMetadata | undefined,
): AuditEventMetadata {
  const payload = metadata ? { ...metadata } : {};

  // Canonical trust events always carry the clinician anchor for graph traversal.
  if (
    event_type === 'NPI_INGESTED' ||
    event_type === 'NPI_VALIDATION_FAILED' ||
    event_type === 'FILE_INGESTED' ||
    event_type === 'INGEST_PARSE_SUMMARY' ||
    event_type === 'INGEST_CONFLICT_DETECTED' ||
    event_type === 'INGEST_ERROR' ||
    event_type === 'VERIFICATION_REQUESTED' ||
    event_type === 'VERIFICATION_COMPLETED' ||
    event_type === 'VERIFICATION_FAILED' ||
    event_type === 'EMPLOYER_ACCEPTANCE_REJECTED' ||
    event_type === 'START_REJECTED' ||
    event_type === 'PSV_RECEIPT' ||
    event_type === 'RECOGNITION' ||
    event_type === 'EMPLOYER_ACCEPTANCE' ||
    event_type === 'START' ||
    event_type === 'START_ATTESTED' ||
    event_type === 'TRUST_STATE_DECAY'
  ) {
    payload.clinician_id = clinician_id;
  }

  const employer_id = readOptionalScopeField(payload, 'employer_id');
  const facility_id = readOptionalScopeField(payload, 'facility_id');
  const role = readOptionalScopeField(payload, 'role');

  if (employer_id) payload.employer_id = employer_id;
  if (facility_id) payload.facility_id = facility_id;
  if (role) payload.role = role;
  normalizeNonRepudiationMetadata(event_type, payload);

  return deepFreeze(payload);
}

function createAuditEventId(audit_event_id?: string): string {
  const id = audit_event_id ?? crypto.randomUUID();
  assertNonEmptyString(id, 'audit_event_id');

  if (!UUID_V4_REGEX.test(id)) {
    throw new Error('audit_event_id must be a UUID v4');
  }

  return id;
}

export class AuditEvent {
  public readonly audit_event_id: string;
  public readonly clinician_id: string;
  public readonly event_type: AuditEventType;
  public readonly reference_id: string;
  public readonly occurred_at: string;
  public readonly metadata: AuditEventMetadata;

  private constructor(snapshot: AuditEventSnapshot) {
    this.audit_event_id = snapshot.audit_event_id;
    this.clinician_id = snapshot.clinician_id;
    this.event_type = snapshot.event_type;
    this.reference_id = snapshot.reference_id;
    this.occurred_at = snapshot.occurred_at;
    this.metadata = snapshot.metadata;

    Object.freeze(this);
  }

  static create(input: AuditEventInput): AuditEvent {
    if (!input || typeof input !== 'object') {
      throw new Error('AuditEvent input is required');
    }

    const audit_event_id = createAuditEventId(input.audit_event_id);

    assertNonEmptyString(input.clinician_id, 'clinician_id');
    assertEventType(input.event_type);
    assertNonEmptyString(input.reference_id, 'reference_id');
    assertRfc3339Utc(input.occurred_at, 'occurred_at');

    return new AuditEvent({
      audit_event_id,
      clinician_id: input.clinician_id,
      event_type: input.event_type,
      reference_id: input.reference_id,
      occurred_at: input.occurred_at,
      metadata: normalizeMetadata(input.event_type, input.clinician_id, input.metadata),
    });
  }

  toJSON(): AuditEventSnapshot {
    return Object.freeze({
      audit_event_id: this.audit_event_id,
      clinician_id: this.clinician_id,
      event_type: this.event_type,
      reference_id: this.reference_id,
      occurred_at: this.occurred_at,
      metadata: this.metadata,
    });
  }
}
