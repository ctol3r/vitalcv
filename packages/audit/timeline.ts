import type { AuditEventType } from './AuditEvent';
import type { AuditPacket, AuditTimelineEntry } from './AuditScrapbook';

export type TimelineEvent = Readonly<{
  event_type: AuditEventType;
  occurred_at: string;
  clinician_id: string;
  employer_id?: string;
  facility_id?: string;
  role?: string;
  metadata_summary: string;
}>;

export type BuildTimelineOptions = Readonly<{
  audit_packet?: AuditPacket;
  limit?: number;
}>;

const METADATA_SUMMARY_MAX_CHARS = 120;
const METADATA_SUMMARY_MAX_FIELDS = 3;
const METADATA_EXCLUDED_KEYS = new Set([
  'clinician_id',
  'employer_id',
  'facility_id',
  'role',
  'hashAnchor',
  'hash_anchor',
  'proofType',
  'verificationMethod',
  'proof',
  'employerProof',
]);

function assertClinicianId(clinician_id: unknown): asserts clinician_id is string {
  if (typeof clinician_id !== 'string' || clinician_id.trim().length === 0) {
    throw new Error('clinician_id is required');
  }
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function summarizeValue(value: unknown): string {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  ) {
    return String(value);
  }

  return stableStringify(value);
}

function summarizeMetadata(metadata: Readonly<Record<string, unknown>>): string {
  const summaryParts: string[] = [];
  const keys = Object.keys(metadata)
    .filter((key) => !METADATA_EXCLUDED_KEYS.has(key))
    .sort();

  for (const key of keys) {
    if (summaryParts.length >= METADATA_SUMMARY_MAX_FIELDS) break;

    const candidate = `${key}=${summarizeValue(metadata[key])}`;
    const existing = summaryParts.join('; ');
    const next = existing.length === 0 ? candidate : `${existing}; ${candidate}`;
    if (next.length > METADATA_SUMMARY_MAX_CHARS) break;
    summaryParts.push(candidate);
  }

  if (summaryParts.length > 0) {
    return summaryParts.join('; ');
  }

  return keys.length === 0 ? 'none' : `fields=${keys.length}`;
}

function coerceLimit(limit: unknown): number | undefined {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return undefined;
  if (limit <= 0) return undefined;
  return Math.floor(limit);
}

function sortByOccurredAtThenEventId(
  left: Pick<AuditTimelineEntry, 'occurred_at' | 'audit_event_id'>,
  right: Pick<AuditTimelineEntry, 'occurred_at' | 'audit_event_id'>,
): number {
  const leftTs = Date.parse(left.occurred_at);
  const rightTs = Date.parse(right.occurred_at);

  if (leftTs !== rightTs) return leftTs - rightTs;
  return left.audit_event_id.localeCompare(right.audit_event_id);
}

function toTimelineEvent(entry: AuditTimelineEntry): TimelineEvent {
  const employer_id = normalizeString(entry.metadata.employer_id);
  const facility_id = normalizeString(entry.metadata.facility_id);
  const role = normalizeString(entry.metadata.role);

  return Object.freeze({
    event_type: entry.event_type,
    occurred_at: entry.occurred_at,
    clinician_id: entry.clinician_id,
    ...(employer_id ? { employer_id } : {}),
    ...(facility_id ? { facility_id } : {}),
    ...(role ? { role } : {}),
    metadata_summary: summarizeMetadata(entry.metadata),
  });
}

export function buildTimeline(
  clinician_id: string,
  options: BuildTimelineOptions = {},
): readonly TimelineEvent[] {
  assertClinicianId(clinician_id);

  const auditPacket = options.audit_packet;
  if (!auditPacket || auditPacket.clinician_id !== clinician_id) {
    return Object.freeze([]);
  }

  const limit = coerceLimit(options.limit);
  const ordered = [...auditPacket.timeline]
    .filter((entry) => entry.clinician_id === clinician_id)
    .sort(sortByOccurredAtThenEventId);

  const projected = ordered.map(toTimelineEvent);
  const limited = typeof limit === 'number' ? projected.slice(-limit) : projected;

  return Object.freeze(limited);
}
