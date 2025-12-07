import crypto from 'crypto';

export interface TefcaAuditEvent {
  resourceType: string;
  subject: string;
  pou: string;
  requester: string;
  timestamp?: string;
}

export interface TefcaAuditRecord extends TefcaAuditEvent {
  hash: string;
  anchorId: string;
}

const auditTrail: TefcaAuditRecord[] = [];

function createAnchorId(): string {
  return `tefca-audit-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
}

export async function logTefcaAudit(event: TefcaAuditEvent): Promise<TefcaAuditRecord> {
  const timestamp = event.timestamp || new Date().toISOString();
  const payload = { ...event, timestamp };
  const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const anchorId = createAnchorId();

  const record: TefcaAuditRecord = { ...payload, hash, anchorId };
  auditTrail.push(record);
  return record;
}

export function getAuditTrail(limit = 50): TefcaAuditRecord[] {
  return auditTrail.slice(-limit);
}

export function resetAuditTrail(): void {
  auditTrail.length = 0;
}
/**
 * B166B-TEFCA-003: TEFCA audit logger (FHIR-style)
 *
 * Produces anchored audit entries for each FHIR facade call.
 * Entry shape: {resourceType, subject, pou, requester, timestamp, hash, prevHash}
 */

import crypto from 'crypto';

export interface TefcaAuditInput {
  resourceType: string;
  subject: string;
  pou: string;
  requester: string;
  timestamp?: string;
}

export interface TefcaAuditEntry extends TefcaAuditInput {
  id: string;
  timestamp: string;
  hash: string;
  prevHash: string | null;
}

const auditTrail: TefcaAuditEntry[] = [];

function computeHash(payload: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export async function logTefcaAudit(entry: TefcaAuditInput): Promise<TefcaAuditEntry> {
  const timestamp = entry.timestamp ?? new Date().toISOString();
  const prevHash = auditTrail.length ? auditTrail[auditTrail.length - 1].hash : null;
  const basePayload = { ...entry, timestamp, prevHash };
  const hash = computeHash(basePayload);

  const auditEntry: TefcaAuditEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp,
    prevHash,
    hash,
  };

  auditTrail.push(auditEntry);
  return auditEntry;
}

export function getAuditTrail(limit?: number): TefcaAuditEntry[] {
  if (typeof limit === 'number') {
    return auditTrail.slice(-limit);
  }
  return [...auditTrail];
}

export function resetAuditTrail(): void {
  auditTrail.length = 0;
}


