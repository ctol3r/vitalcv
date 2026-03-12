import { createHash } from 'node:crypto';

export type RetrievalMethod =
  | 'api'
  | 'file'
  | 'polling'
  | 'webhook'
  | 'portal'
  | 'manual';

export type ProvenanceMetadata = Readonly<{
  source: string;
  retrieval_time: string;
  retrieval_method: RetrievalMethod;
  evidence_pointer: string;
  raw_response_hash: string;
  endpoint?: string;
  source_record_id?: string;
}>;

function stableSerializeRecord(value: Record<string, unknown>): string {
  const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));
  const body = keys
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
    .join(',');
  return `{${body}}`;
}

export function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`;
  }

  if (typeof value === 'object') {
    return stableSerializeRecord(value as Record<string, unknown>);
  }

  return JSON.stringify(value);
}

export function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hashRawResponse(rawResponse: unknown): string {
  return sha256Hex(stableSerialize(rawResponse));
}

export function hashSensitiveInput(value: unknown): string {
  return sha256Hex(stableSerialize(value));
}

export function createEvidencePointer(input: {
  source: string;
  retrievalTime: string;
  rawResponseHash: string;
  subjectId: string;
}): string {
  const datePrefix = input.retrievalTime.slice(0, 10).replace(/-/g, '/');
  return `evidence://${input.source}/${datePrefix}/${input.subjectId}/${input.rawResponseHash}.json`;
}

export function createProvenanceMetadata(input: {
  source: string;
  retrievalTime: string;
  retrievalMethod: RetrievalMethod;
  rawResponse: unknown;
  subjectId: string;
  endpoint?: string;
  sourceRecordId?: string;
}): ProvenanceMetadata {
  const rawResponseHash = hashRawResponse(input.rawResponse);

  return Object.freeze({
    source: input.source,
    retrieval_time: input.retrievalTime,
    retrieval_method: input.retrievalMethod,
    evidence_pointer: createEvidencePointer({
      source: input.source,
      retrievalTime: input.retrievalTime,
      rawResponseHash,
      subjectId: input.subjectId,
    }),
    raw_response_hash: rawResponseHash,
    ...(input.endpoint ? { endpoint: input.endpoint } : {}),
    ...(input.sourceRecordId ? { source_record_id: input.sourceRecordId } : {}),
  });
}

const SECRET_KEY_PATTERN = /(token|secret|password|authorization|api[_-]?key|cookie|signature)/i;
const LONG_STRING_PATTERN = /^[A-Za-z0-9+/=_-]{12,}$/;

function redactPrimitive(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  if (LONG_STRING_PATTERN.test(value)) {
    return `${value.slice(0, 4)}...[redacted]`;
  }

  return value;
}

export function redactPayloadForLog(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactPayloadForLog(entry));
  }

  if (!value || typeof value !== 'object') {
    return redactPrimitive(value);
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      if (SECRET_KEY_PATTERN.test(key)) {
        return [key, '[redacted]'];
      }

      return [key, redactPayloadForLog(entry)];
    }),
  );
}

export function createDisclosureAuditDigest(input: {
  batchId: string;
  audience: string;
  factIds: readonly string[];
}): string {
  return sha256Hex(
    stableSerialize({
      batchId: input.batchId,
      audience: input.audience,
      factIds: [...input.factIds].sort(),
    }),
  );
}
