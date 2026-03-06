/**
 * capsuleEngine.ts — Wave 82: Extended Decision Capsule Service
 *
 * Stores decision hash, credential dependencies, and timestamp
 * for each decision capsule. Uses AuditEvent with structured
 * metadata as the storage backend (no DecisionCapsule model).
 */

import prisma, { Prisma } from '../../graphql/prisma_client';
import { sha256Hex } from '../../utils/deterministic';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────

export interface CapsuleRecord {
  id: string;
  subjectNpi: string;
  decisionType: string;
  status: string;
  credentialIds: string[];
  issuerIds: string[];
  artifactHash: string;
  decisionTimestamp: string;
}

export interface CapsuleCreateInput {
  subjectNpi: string;
  decisionType: string;
  credentialIds: string[];
  issuerIds: string[];
}

// ── Metadata helpers ──────────────────────────────────────────────────

const CAPSULE_EVENT_TYPE = 'DECISION_CAPSULE';

function eventToCapsule(ev: { id: string; clinicianId: string | null; hash: string; metadata: unknown; createdAt: Date }): CapsuleRecord {
  const meta = (ev.metadata ?? {}) as Record<string, unknown>;
  return {
    id: ev.id,
    subjectNpi: ev.clinicianId ?? '',
    decisionType: typeof meta['decisionType'] === 'string' ? meta['decisionType'] : 'UNKNOWN',
    status: typeof meta['status'] === 'string' ? meta['status'] : 'VALID',
    credentialIds: Array.isArray(meta['credentialIds']) ? meta['credentialIds'] as string[] : [],
    issuerIds: Array.isArray(meta['issuerIds']) ? meta['issuerIds'] as string[] : [],
    artifactHash: ev.hash,
    decisionTimestamp: ev.createdAt.toISOString(),
  };
}

// ── Core Operations ───────────────────────────────────────────────────

export async function createCapsule(input: CapsuleCreateInput): Promise<CapsuleRecord> {
  const timestamp = new Date();
  const artifactHash = sha256Hex(
    `${input.subjectNpi}:${input.decisionType}:${input.credentialIds.join(',')}:${timestamp.toISOString()}`,
  );

  const event = await prisma.auditEvent.create({
    data: {
      type: CAPSULE_EVENT_TYPE,
      hash: artifactHash,
      clinicianId: input.subjectNpi,
      metadata: {
        decisionType: input.decisionType,
        status: 'VALID',
        credentialIds: input.credentialIds,
        issuerIds: input.issuerIds,
        credentialCount: input.credentialIds.length,
        issuerCount: input.issuerIds.length,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  log('info', 'capsule_engine: created', {
    capsuleId: event.id,
    npi: input.subjectNpi,
    type: input.decisionType,
    deps: input.credentialIds.length,
  });

  return eventToCapsule(event);
}

export async function getCapsulesByNpi(npi: string): Promise<CapsuleRecord[]> {
  const events = await prisma.auditEvent.findMany({
    where: { type: CAPSULE_EVENT_TYPE, clinicianId: npi },
    orderBy: { createdAt: 'desc' },
  });

  return events.map(eventToCapsule);
}

export async function getCapsuleDependencies(capsuleId: string): Promise<{
  capsule: CapsuleRecord;
  credentialStatuses: Array<{ id: string; status: string; trustState: string }>;
} | null> {
  const event = await prisma.auditEvent.findUnique({ where: { id: capsuleId } });
  if (!event || event.type !== CAPSULE_EVENT_TYPE) return null;

  const capsule = eventToCapsule(event);

  const credentials = await prisma.verificationArtifact.findMany({
    where: { id: { in: capsule.credentialIds } },
    select: { id: true, status: true, trustState: true },
  });

  return {
    capsule,
    credentialStatuses: credentials.map((c) => ({
      id: c.id,
      status: c.status,
      trustState: c.trustState,
    })),
  };
}

export async function countCapsules(): Promise<number> {
  return prisma.auditEvent.count({ where: { type: CAPSULE_EVENT_TYPE } });
}

export const capsuleEngine = { createCapsule, getCapsulesByNpi, getCapsuleDependencies, countCapsules };
