// ── VitalCV Audit Event System ───────────────────────────────────
// Every meaningful system action produces a structured, queryable event.
// Events are APPEND-ONLY, IMMUTABLE, and MUST NOT block the main flow.

// ── Event Types ──────────────────────────────────────────────────

export enum AuditEventType {
  // Ingest lifecycle
  INGEST_STARTED = 'ingest.started',
  SOURCE_CHECKED = 'source.checked',
  SOURCE_FAILED = 'source.failed',

  // Readiness lifecycle
  READINESS_COMPUTED = 'readiness.computed',

  // Manifest / Proof lifecycle
  MANIFEST_GENERATED = 'manifest.generated',
  MANIFEST_DOWNLOADED = 'manifest.downloaded',

  // Review lifecycle
  REVIEW_OPENED = 'review.opened',

  // Employer decision lifecycle
  EMPLOYER_ACCEPTED = 'employer.accepted_head_start',
  EMPLOYER_REJECTED = 'employer.rejected',
  EMPLOYER_REQUESTED_REFRESH = 'employer.requested_refresh',
  EMPLOYER_ESCALATED = 'employer.escalated',
  EMPLOYER_HOLD = 'employer.hold',

  // Application lifecycle
  APPLICATION_SUBMITTED = 'application.submitted',

  // Employment lifecycle
  EMPLOYMENT_STARTED = 'employment.started',

  // Attestation lifecycle
  ATTESTATION_CREATED = 'attestation.created',
  ATTESTATION_EXPORTED = 'attestation.exported',
  ATTESTATION_VERIFIED = 'attestation.verified',

  // Drift lifecycle
  DRIFT_DETECTED = 'drift.detected',
  DRIFT_RESOLVED = 'drift.resolved',
}

// ── Event Model ──────────────────────────────────────────────────

export interface AuditEvent {
  /** UUID v4 — unique event identifier */
  eventId: string;
  /** What happened */
  eventType: AuditEventType;
  /** When it happened (ISO 8601) */
  timestamp: string;
  /** Who triggered it (employer ID, system, null for automated) */
  actor: string | null;
  /** The clinician NPI this event relates to. ALWAYS required. */
  subjectNpi: string;
  /** The trust manifest this event relates to (nullable) */
  manifestId: string | null;
  /** The decision attestation this event relates to (nullable) */
  attestationId: string | null;
  /** SHA-256 of the input state that produced this event */
  inputsHash: string | null;
  /** SHA-256 of the output state produced by this event */
  outputsHash: string | null;
  /** Arbitrary structured metadata (source-specific details, error info, etc.) */
  metadata: Record<string, unknown>;
}

// ── Event Envelope ───────────────────────────────────────────────

export interface AuditEventEnvelope {
  schema: 'vitalcv.audit-event.v1';
  event: AuditEvent;
}

// ── Validation Rules ─────────────────────────────────────────────

export interface EventValidationError {
  field: string;
  rule: string;
  message: string;
}

export function validateAuditEvent(event: AuditEvent): EventValidationError[] {
  const errors: EventValidationError[] = [];

  if (!event.eventId || typeof event.eventId !== 'string') {
    errors.push({ field: 'eventId', rule: 'required', message: 'eventId must be a non-empty UUID string' });
  }

  if (!event.eventType || typeof event.eventType !== 'string') {
    errors.push({ field: 'eventType', rule: 'required', message: 'eventType must be a valid AuditEventType string' });
  }

  if (!event.timestamp || isNaN(Date.parse(event.timestamp))) {
    errors.push({ field: 'timestamp', rule: 'required', message: 'timestamp must be a valid ISO 8601 string' });
  }

  if (!event.subjectNpi || typeof event.subjectNpi !== 'string' || !/^\d{10}$/.test(event.subjectNpi)) {
    errors.push({ field: 'subjectNpi', rule: 'required', message: 'subjectNpi must be a 10-digit NPI string' });
  }

  // metadata must be a plain object
  if (event.metadata === null || typeof event.metadata !== 'object' || Array.isArray(event.metadata)) {
    errors.push({ field: 'metadata', rule: 'object', message: 'metadata must be a non-null object' });
  }

  return errors;
}

export function isValidAuditEvent(event: AuditEvent): boolean {
  return validateAuditEvent(event).length === 0;
}

// ── Event Factory ────────────────────────────────────────────────

export interface CreateEventInput {
  eventType: AuditEventType;
  subjectNpi: string;
  actor?: string | null;
  manifestId?: string | null;
  attestationId?: string | null;
  inputsHash?: string | null;
  outputsHash?: string | null;
  metadata?: Record<string, unknown>;
}

export function createAuditEvent(input: CreateEventInput): AuditEvent {
  const event: AuditEvent = {
    eventId: crypto.randomUUID(),
    eventType: input.eventType,
    timestamp: new Date().toISOString(),
    actor: input.actor ?? null,
    subjectNpi: input.subjectNpi,
    manifestId: input.manifestId ?? null,
    attestationId: input.attestationId ?? null,
    inputsHash: input.inputsHash ?? null,
    outputsHash: input.outputsHash ?? null,
    metadata: input.metadata ?? {},
  };

  if (!isValidAuditEvent(event)) {
    throw new Error(`Invalid audit event: ${JSON.stringify(validateAuditEvent(event))}`);
  }

  return event;
}

// ── Event Query Interface ───────────────────────────────────────

export interface AuditEventQuery {
  subjectNpi?: string;
  eventType?: AuditEventType | AuditEventType[];
  actor?: string | null;
  from?: string;
  to?: string;
  manifestId?: string;
  attestationId?: string;
  limit?: number;
  offset?: number;
}
