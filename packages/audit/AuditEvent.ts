import crypto from 'crypto';

export const AUDIT_EVENT_TYPES = [
  'PSV_RECEIPT',
  'RECOGNITION',
  'ACCEPTANCE',
  'START',
  'COMMITTEE',
  'TRUST_STATE_CHECK',
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

function normalizeMetadata(metadata: AuditEventMetadata | undefined): AuditEventMetadata {
  if (!metadata) return Object.freeze({});

  return deepFreeze({ ...metadata });
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
      metadata: normalizeMetadata(input.metadata),
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
