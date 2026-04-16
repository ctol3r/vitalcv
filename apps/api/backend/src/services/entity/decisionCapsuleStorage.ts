import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { sha256ForPayload } from '../../utils/deterministic';

export type DecisionCapsuleOutcome = 'ACCEPTED';

export interface StoredDecisionCapsule {
  id: string;
  clinicianId: string;
  orgId: string | null;
  role: string | null;
  blockers: string[];
  outcome: DecisionCapsuleOutcome;
  timestamp: string;
}

export interface StoreDecisionCapsuleInput {
  clinicianId: string;
  orgId: string | null;
  role: string | null;
  blockers: string[];
  outcome: DecisionCapsuleOutcome;
  timestamp: string;
  auditEventId: string;
  entityId: string;
}

type DecisionCapsuleWriter = {
  decisionCapsule: {
    create: (args: {
      data: Prisma.DecisionCapsuleUncheckedCreateInput;
    }) => Promise<{
      id: string;
      subjectNpi: string;
      organizationId: string | null;
      decisionTimestamp: Date;
      metadata: unknown;
    }>;
  };
};

const DECISION_CAPSULE_SCHEMA = 'vitalcv.decision-capsule.storage.v1';
const DECISION_CAPSULE_METHODOLOGY = 'decision_capsule_storage.v1';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeBlockers(blockers: readonly string[]): string[] {
  return [...new Set(
    blockers
      .map((blocker) => blocker.trim())
      .filter((blocker) => blocker.length > 0),
  )];
}

function toDecisionTimestamp(value: string): Date {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error('DecisionCapsule timestamp must be a valid ISO-8601 string.');
  }

  return timestamp;
}

function normalizeOrganizationId(orgId: string | null): string | null {
  return orgId && UUID_RE.test(orgId) ? orgId : null;
}

function buildArtifactHashPayload(input: {
  clinicianId: string;
  orgId: string | null;
  role: string | null;
  blockers: string[];
  outcome: DecisionCapsuleOutcome;
  timestamp: string;
  auditEventId: string;
  entityId: string;
}): Record<string, unknown> {
  return {
    schema: DECISION_CAPSULE_SCHEMA,
    clinicianId: input.clinicianId,
    orgId: input.orgId,
    role: input.role,
    blockers: input.blockers,
    outcome: input.outcome,
    timestamp: input.timestamp,
    auditEventId: input.auditEventId,
    entityId: input.entityId,
  };
}

export async function storeDecisionCapsule(
  writer: DecisionCapsuleWriter,
  input: StoreDecisionCapsuleInput,
): Promise<StoredDecisionCapsule> {
  const clinicianId = input.clinicianId.trim();
  if (!/^\d{10}$/.test(clinicianId)) {
    throw new Error('DecisionCapsule clinicianId must be a 10-digit NPI.');
  }

  const timestamp = toDecisionTimestamp(input.timestamp);
  const normalizedRole = normalizeString(input.role);
  const normalizedOrgId = normalizeString(input.orgId);
  const blockers = normalizeBlockers(input.blockers);
  const artifactHash = sha256ForPayload(buildArtifactHashPayload({
    clinicianId,
    orgId: normalizedOrgId,
    role: normalizedRole,
    blockers,
    outcome: input.outcome,
    timestamp: timestamp.toISOString(),
    auditEventId: input.auditEventId,
    entityId: input.entityId,
  }));

  const row = await writer.decisionCapsule.create({
    data: {
      id: randomUUID(),
      subjectDid: `did:vitalcv:${clinicianId}`,
      subjectNpi: clinicianId,
      decisionType: 'HIRING',
      decisionTimestamp: timestamp,
      credentialIds: [],
      issuerIds: [],
      artifactHash,
      methodology: DECISION_CAPSULE_METHODOLOGY,
      status: 'VALID',
      organizationId: normalizeOrganizationId(normalizedOrgId),
      metadata: {
        schema: DECISION_CAPSULE_SCHEMA,
        appendOnly: true,
        auditFirst: true,
        triggerEvent: 'employment_acceptance',
        sourceReferenceId: input.auditEventId,
        decisionAction: 'APPROVE',
        clinicianId,
        orgId: normalizedOrgId,
        role: normalizedRole,
        blockers,
        outcome: input.outcome,
        timestamp: timestamp.toISOString(),
        auditEventId: input.auditEventId,
        entityId: input.entityId,
      } satisfies Record<string, unknown> as Prisma.InputJsonValue,
    },
  });

  const metadata = row.metadata as {
    role?: string | null;
    blockers?: string[];
    outcome?: DecisionCapsuleOutcome;
  } | null;

  return {
    id: row.id,
    clinicianId: row.subjectNpi,
    orgId: row.organizationId ?? normalizedOrgId,
    role: typeof metadata?.role === 'string' ? metadata.role : normalizedRole,
    blockers: Array.isArray(metadata?.blockers) ? metadata.blockers : blockers,
    outcome: metadata?.outcome === 'ACCEPTED' ? metadata.outcome : input.outcome,
    timestamp: row.decisionTimestamp.toISOString(),
  };
}
