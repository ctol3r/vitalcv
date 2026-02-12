/** YC MVP — behavior frozen. Do not modify without scope approval. */
import crypto from 'crypto';
import { type AuditEvent, type AuditEventType } from './AuditEvent';

export type NcqaTag = 'CR1' | 'CR2' | 'CR3' | 'CR4' | 'CR5';

export type AuditTimelineEntry = Readonly<{
  audit_event_id: string;
  clinician_id: string;
  event_type: AuditEventType;
  reference_id: string;
  occurred_at: string;
  metadata: Readonly<Record<string, unknown>>;
  ncqa_tags: readonly NcqaTag[];
}>;

export type DelegateAuditSelector = Readonly<{
  total_files: number;
  sample_size: number;
}>;

export type AuditPacket = Readonly<{
  audit_packet_id: string;
  clinician_id: string;
  timeline: readonly AuditTimelineEntry[];
  delegate_audit_selector: DelegateAuditSelector;
}>;

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function toPacketId(clinician_id: string, timeline: readonly AuditTimelineEntry[]): string {
  const payload = stableStringify({ clinician_id, timeline });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function mapNcqaTags(eventType: AuditEventType): readonly NcqaTag[] {
  switch (eventType) {
    case 'NPI_INGESTED':
      return Object.freeze(['CR1']);
    case 'NPI_VALIDATION_FAILED':
      return Object.freeze(['CR1']);
    case 'FILE_INGESTED':
      return Object.freeze(['CR1']);
    case 'INGEST_PARSE_SUMMARY':
      return Object.freeze(['CR1']);
    case 'INGEST_CONFLICT_DETECTED':
      return Object.freeze(['CR1']);
    case 'INGEST_ERROR':
      return Object.freeze(['CR1']);
    case 'VERIFICATION_REQUESTED':
      return Object.freeze(['CR1']);
    case 'VERIFICATION_COMPLETED':
      return Object.freeze(['CR1']);
    case 'VERIFICATION_FAILED':
      return Object.freeze(['CR1']);
    case 'EMPLOYER_ACCEPTANCE_REJECTED':
      return Object.freeze(['CR1']);
    case 'START_REJECTED':
      return Object.freeze(['CR1']);
    case 'PSV_RECEIPT':
      return Object.freeze(['CR1', 'CR5']);
    case 'RECOGNITION':
      return Object.freeze(['CR1']);
    case 'ACCEPTANCE':
      return Object.freeze(['CR1']);
    case 'EMPLOYER_ACCEPTANCE':
      return Object.freeze(['CR1']);
    case 'START':
      return Object.freeze(['CR1']);
    case 'START_ATTESTED':
      return Object.freeze(['CR1']);
    case 'COMMITTEE':
      return Object.freeze(['CR4']);
    case 'TRUST_STATE_CHECK':
      return Object.freeze(['CR1']);
    case 'TRUST_STATE_DECAY':
      return Object.freeze(['CR1']);
    case 'IDEMPOTENT_REPLAY':
      return Object.freeze(['CR1']);
    case 'CONCURRENCY_GUARD_TRIGGERED':
      return Object.freeze(['CR1']);
    default:
      return Object.freeze(['CR1']);
  }
}

function assertClinicianId(clinician_id: unknown): asserts clinician_id is string {
  if (typeof clinician_id !== 'string' || clinician_id.trim().length === 0) {
    throw new Error('clinician_id is required');
  }
}

export function buildAuditScrapbook(
  clinician_id: string,
  events: readonly AuditEvent[],
): AuditPacket {
  assertClinicianId(clinician_id);

  const timeline = Object.freeze(
    [...events]
      .map((event) => event.toJSON())
      .filter((event) => event.clinician_id === clinician_id)
      .sort((left, right) => {
        const leftTs = Date.parse(left.occurred_at);
        const rightTs = Date.parse(right.occurred_at);

        if (leftTs !== rightTs) return leftTs - rightTs;
        return left.audit_event_id.localeCompare(right.audit_event_id);
      })
      .map((event) =>
        Object.freeze({
          ...event,
          ncqa_tags: mapNcqaTags(event.event_type),
        }),
      ),
  );

  const total_files = timeline.length;
  const sample_size = Math.min(Math.ceil(0.05 * total_files), 50);

  return Object.freeze({
    audit_packet_id: toPacketId(clinician_id, timeline),
    clinician_id,
    timeline,
    delegate_audit_selector: Object.freeze({
      total_files,
      sample_size,
    }),
  });
}
