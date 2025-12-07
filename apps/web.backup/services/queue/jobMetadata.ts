import type { JobQueueRecord } from './models/JobQueue.js';

type JsonRecord = Record<string, unknown>;

function asJsonRecord(payload: unknown): JsonRecord | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }
  return payload as JsonRecord;
}

function readString(
  record: JsonRecord | null,
  keys: string[]
): string | null {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

export function getClinicianIdentifier(job: JobQueueRecord): string | null {
  const payload = asJsonRecord(job.payload);
  return (
    readString(payload, ['clinicianId', 'clinician_id']) ??
    readString(payload, ['clinicianDid', 'clinician_did']) ??
    null
  );
}

export function getPrivilegeGrantedId(job: JobQueueRecord): string | null {
  const payload = asJsonRecord(job.payload);
  return readString(payload, ['privilegeGrantedId', 'privilege_granted_id']);
}

export function getOrgIdentifier(job: JobQueueRecord): string | null {
  const payload = asJsonRecord(job.payload);
  return readString(payload, ['orgId', 'organizationId', 'organization_id']);
}

export function getEhrSyncId(job: JobQueueRecord): string | null {
  const payload = asJsonRecord(job.payload);
  return readString(payload, ['syncId', 'sync_id']);
}

