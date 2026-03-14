import type { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { appendAuditEvent } from '../audit/auditLedger';
import type { ClinicianTrustState } from '../trust/trustStateEngine';
import { ensureTrustStateBeforeCapsule } from '../integrity/pipelineEnforcer';
import { getBindingByNpi } from '../identity/npiDidBinding';
import {
  computeTrustState as computeTrustStateV2,
  findLatestTrustState as findLatestTrustStateV2,
  type TrustStateSnapshotPayload,
  type WorkflowContext,
} from '../trust-state';
import { sha256ForPayload } from '../../utils/deterministic';
import {
  createAuthorityEdges,
  createDecisionCapsule as persistDecisionCapsule,
  findDecisionCapsuleById as findDecisionCapsuleByIdRepo,
  findDecisionCapsulesByNpi as findDecisionCapsulesByNpiRepo,
  type DecisionCapsuleRepositoryRecord,
  type DecisionTriggerEvent,
} from '../../../repositories/decisionCapsules.repo';
import { getCredentialEvidence } from '../../../repositories/auditBundles.repo';
import { enqueueDecisionCapsuleCreatedEvent } from './decisionOutbox';

export type DecisionType = 'HIRING' | 'PRIVILEGING' | 'DEPLOYMENT' | 'RENEWAL';
export type CapsuleStatus = 'VALID' | 'AT_RISK' | 'INVALID';
export type VerifierDecisionAction =
  | 'APPROVE'
  | 'REJECT'
  | 'CONDITIONAL_APPROVE'
  | 'START_ATTESTATION';

export interface CreateCapsuleInput {
  subjectDid: string;
  subjectNpi: string;
  decisionType: DecisionType;
  decisionAction?: VerifierDecisionAction | null;
  credentialIds?: string[];
  issuerIds?: string[];
  verifierOrgId?: string | null;
  metadata?: Record<string, unknown>;
  triggerEvent?: DecisionTriggerEvent;
  sourceReferenceId?: string;
  status?: CapsuleStatus;
}

export interface DecisionCapsuleRecord {
  id: string;
  subjectDid: string;
  subjectNpi: string;
  decisionType: string;
  decisionTimestamp: string;
  credentialIds: string[];
  issuerIds: string[];
  artifactHash: string;
  methodology: string;
  methodologyVersion: string;
  verifierOrgId: string | null;
  decisionAction: VerifierDecisionAction | null;
  trustStateHash: string | null;
  status: CapsuleStatus;
  triggerEvent: DecisionTriggerEvent | null;
  sourceReferenceId: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApplicationDecisionInput {
  applicationId: string;
  verifierClerkUserId: string;
  decisionType: DecisionType;
  decisionAction?: VerifierDecisionAction | null;
}

export interface CreateHireDecisionInput {
  subjectNpi: string;
  employerId: string;
  acceptanceId: string;
  startAttestationId: string;
  role: string;
  facility: string;
  startedAt: string;
  organizationId?: string;
}

export interface CreateAcceptanceDecisionInput {
  subjectNpi: string;
  employerId: string;
  acceptanceId: string;
  artifactId?: string | null;
}

export interface DecisionCapsuleReplayResult {
  capsuleId: string;
  valid: boolean;
  expectedArtifactHash: string;
  actualArtifactHash: string;
}

type DecisionEvidenceSet = {
  credentialIds: string[];
  compatibilityCredentialIds: string[];
  issuerIds: string[];
};

const METHODOLOGY_VERSION = 'decision_capsule.v262';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) => (
    left.localeCompare(right)
  ));
}

function cloneMetadata(value: Record<string, unknown> | undefined): Record<string, unknown> {
  return value ? JSON.parse(JSON.stringify(value)) as Record<string, unknown> : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeOrganizationId(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed || !UUID_RE.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function resolveWorkflowContext(decisionType: DecisionType): WorkflowContext {
  if (decisionType === 'PRIVILEGING' || decisionType === 'DEPLOYMENT') {
    return 'privileging';
  }

  return 'job_application';
}

function resolveReadinessStatus(
  legacySnapshot: ClinicianTrustState,
): TrustStateSnapshotPayload['readinessStatus'] {
  if (
    legacySnapshot.readiness_status === 'READY'
    || legacySnapshot.readiness_status === 'CONDITIONALLY_READY'
    || legacySnapshot.readiness_status === 'NOT_READY'
  ) {
    return legacySnapshot.readiness_status;
  }

  if (legacySnapshot.readiness_level === 'L3') {
    return 'READY';
  }
  if (legacySnapshot.readiness_level === 'L0') {
    return 'NOT_READY';
  }
  return 'CONDITIONALLY_READY';
}

function buildFallbackV2Snapshot(input: {
  subjectDid: string;
  subjectNpi: string;
  contextOrgId: string | null;
  workflowContext: WorkflowContext;
  legacySnapshot: ClinicianTrustState;
}): TrustStateSnapshotPayload {
  return {
    subjectDid: input.subjectDid,
    subjectNpi: input.subjectNpi,
    contextOrgId: input.contextOrgId,
    workflowContext: input.workflowContext,
    readinessScore: input.legacySnapshot.readiness_score,
    readinessLevel: input.legacySnapshot.readiness_level,
    readinessStatus: resolveReadinessStatus(input.legacySnapshot),
    artifactStatuses: [],
    warnings: [...input.legacySnapshot.gap_summary],
    methodologyVersion: input.legacySnapshot.methodology_version,
    generatedAt: input.legacySnapshot.computed_at,
  };
}

async function resolveSubjectIdentity(
  subjectNpi: string,
  fallbackSubjectDid: string,
): Promise<{ subjectDid: string; bindingDid: string | null }> {
  const binding = await getBindingByNpi(subjectNpi).catch(() => null);
  if (binding?.status === 'ACTIVE' && typeof binding.did === 'string' && binding.did.trim()) {
    return {
      subjectDid: binding.did,
      bindingDid: binding.did,
    };
  }

  return {
    subjectDid: fallbackSubjectDid,
    bindingDid: null,
  };
}

async function resolveTrustSnapshots(input: {
  subjectNpi: string;
  subjectDid: string;
  contextOrgId: string | null;
  workflowContext: WorkflowContext;
}): Promise<{
  subjectDid: string;
  legacySnapshot: ClinicianTrustState;
  v2Snapshot: TrustStateSnapshotPayload;
}> {
  const legacySnapshot = await ensureTrustStateBeforeCapsule(input.subjectNpi);
  const subjectIdentity = await resolveSubjectIdentity(input.subjectNpi, input.subjectDid);

  if (!subjectIdentity.bindingDid) {
    return {
      subjectDid: subjectIdentity.subjectDid,
      legacySnapshot,
      v2Snapshot: buildFallbackV2Snapshot({
        subjectDid: subjectIdentity.subjectDid,
        subjectNpi: input.subjectNpi,
        contextOrgId: input.contextOrgId,
        workflowContext: input.workflowContext,
        legacySnapshot,
      }),
    };
  }

  try {
    const latest = await findLatestTrustStateV2(
      subjectIdentity.subjectDid,
      input.contextOrgId,
      input.workflowContext,
    );

    const v2Snapshot = latest ?? await computeTrustStateV2(
      subjectIdentity.subjectDid,
      input.contextOrgId,
      input.workflowContext,
    );

    return {
      subjectDid: subjectIdentity.subjectDid,
      legacySnapshot,
      v2Snapshot,
    };
  } catch {
    return {
      subjectDid: subjectIdentity.subjectDid,
      legacySnapshot,
      v2Snapshot: buildFallbackV2Snapshot({
        subjectDid: subjectIdentity.subjectDid,
        subjectNpi: input.subjectNpi,
        contextOrgId: input.contextOrgId,
        workflowContext: input.workflowContext,
        legacySnapshot,
      }),
    };
  }
}

async function resolveDecisionEvidence(input: {
  subjectNpi: string;
  contextOrgId: string | null;
  credentialIds?: string[];
  issuerIds?: string[];
}): Promise<DecisionEvidenceSet> {
  const explicitCredentialIds = uniqueSorted(input.credentialIds ?? []);
  const explicitIssuerIds = uniqueSorted(input.issuerIds ?? []);
  const evidence = await getCredentialEvidence(
    input.subjectNpi,
    input.contextOrgId ? { organizationId: input.contextOrgId } : {},
  );

  const scopedEvidence = explicitCredentialIds.length > 0
    ? evidence.filter((record) => (
      explicitCredentialIds.includes(record.credentialId)
      || (record.relatedCompatibilityArtifactId
        ? explicitCredentialIds.includes(record.relatedCompatibilityArtifactId)
        : false)
    ))
    : evidence;

  const credentialIds = explicitCredentialIds.length > 0
    ? explicitCredentialIds
    : uniqueSorted(scopedEvidence.map((record) => record.credentialId));
  const compatibilityCredentialIds = uniqueSorted(scopedEvidence.map((record) => (
    record.relatedCompatibilityArtifactId
    ?? record.verificationArtifactId
    ?? ''
  )));
  const issuerIds = explicitIssuerIds.length > 0
    ? explicitIssuerIds
    : uniqueSorted(scopedEvidence.map((record) => record.issuerId));

  return { credentialIds, compatibilityCredentialIds, issuerIds };
}

function resolveVerifierOrgId(
  input: Pick<CreateCapsuleInput, 'verifierOrgId' | 'metadata'>,
): string | null {
  const metadata = cloneMetadata(input.metadata);
  const candidate = [
    input.verifierOrgId,
    typeof metadata.verifierOrgId === 'string' ? metadata.verifierOrgId : null,
    typeof metadata.organizationId === 'string' ? metadata.organizationId : null,
    typeof metadata.employerId === 'string' ? metadata.employerId : null,
  ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);

  return candidate?.trim() ?? null;
}

function resolveTriggerEvent(input: Pick<CreateCapsuleInput, 'decisionType' | 'triggerEvent'>): DecisionTriggerEvent {
  if (input.triggerEvent) {
    return input.triggerEvent;
  }

  if (input.decisionType === 'PRIVILEGING') {
    return 'privilege_recommendation';
  }

  return 'verifier_decision';
}

function resolveDecisionAction(
  input: Pick<CreateCapsuleInput, 'decisionAction' | 'triggerEvent'>,
): VerifierDecisionAction | null {
  if (input.decisionAction) {
    return input.decisionAction;
  }

  if (input.triggerEvent === 'start_attestation') {
    return 'START_ATTESTATION';
  }

  return null;
}

function assertApplicationDecisionStatus(
  applicationStatus: string,
  decisionAction: VerifierDecisionAction,
  applicationId: string,
): void {
  if (decisionAction === 'APPROVE' && applicationStatus === 'ACCEPTED') {
    return;
  }

  if (decisionAction === 'REJECT' && applicationStatus === 'DECLINED') {
    return;
  }

  if (decisionAction === 'CONDITIONAL_APPROVE' && applicationStatus === 'REVIEWED') {
    return;
  }

  throw new Error(
    `Application ${applicationId} status ${applicationStatus} is incompatible with ${decisionAction}`,
  );
}

function resolveSourceReferenceId(input: {
  sourceReferenceId?: string;
  triggerEvent: DecisionTriggerEvent;
  decisionType: DecisionType;
  subjectNpi: string;
  verifierOrgId: string | null;
}): string {
  const explicit = input.sourceReferenceId?.trim();
  if (explicit) {
    return explicit;
  }

  return [
    'manual',
    input.triggerEvent,
    input.decisionType,
    input.subjectNpi,
    input.verifierOrgId ?? 'unscoped',
  ].join(':');
}

function buildDecisionMetadata(input: {
  metadata?: Record<string, unknown>;
  legacySnapshot: ClinicianTrustState;
  v2Snapshot: TrustStateSnapshotPayload;
  compatibilityCredentialIds: string[];
  verifierOrgId: string | null;
  decisionAction: VerifierDecisionAction | null;
  trustStateHash: string;
  methodologyVersion: string;
  decisionType: DecisionType;
  status: CapsuleStatus;
  decisionCapsulePayload: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    ...cloneMetadata(input.metadata),
    verifierOrgId: input.verifierOrgId,
    decisionAction: input.decisionAction,
    trustStateHash: input.trustStateHash,
    methodologyVersion: input.methodologyVersion,
    decisionType: input.decisionType,
    status: input.status,
    trust_state_snapshot: input.legacySnapshot,
    trust_state_snapshot_v2: input.v2Snapshot,
    compatibility_credential_ids: uniqueSorted(input.compatibilityCredentialIds),
    decision_capsule_payload: cloneMetadata(input.decisionCapsulePayload),
  };
}

function buildDecisionHashPayload(input: {
  subjectDid: string;
  subjectNpi: string;
  trustStateHash: string;
  verifierOrgId: string | null;
  decisionType: DecisionType;
  decisionAction: VerifierDecisionAction | null;
  credentialIds: string[];
  compatibilityCredentialIds: string[];
  issuerIds: string[];
  status: CapsuleStatus;
  triggerEvent: DecisionTriggerEvent;
  sourceReferenceId: string;
  methodologyVersion: string;
  decisionTimestamp: string;
}): Record<string, unknown> {
  return {
    subjectDid: input.subjectDid,
    subjectNpi: input.subjectNpi,
    trustStateHash: input.trustStateHash,
    verifierOrg: input.verifierOrgId,
    decisionType: input.decisionType,
    decisionAction: input.decisionAction,
    credentialIds: uniqueSorted(input.credentialIds),
    compatibilityCredentialIds: uniqueSorted(input.compatibilityCredentialIds),
    issuerIds: uniqueSorted(input.issuerIds),
    status: input.status,
    triggerEvent: input.triggerEvent,
    sourceReferenceId: input.sourceReferenceId,
    methodologyVersion: input.methodologyVersion,
    decisionTimestamp: input.decisionTimestamp,
  };
}

function mapRecord(record: DecisionCapsuleRepositoryRecord): DecisionCapsuleRecord {
  const metadata = cloneMetadata(
    typeof record.metadata === 'object' && record.metadata !== null && !Array.isArray(record.metadata)
      ? record.metadata as Record<string, unknown>
      : undefined,
  );
  const verifierOrgId = typeof metadata.verifierOrgId === 'string'
    ? metadata.verifierOrgId
    : typeof metadata.organizationId === 'string'
      ? metadata.organizationId
      : typeof metadata.employerId === 'string'
        ? metadata.employerId
        : null;
  const triggerEvent = typeof metadata.triggerEvent === 'string'
    ? metadata.triggerEvent as DecisionTriggerEvent
    : null;
  const decisionAction = typeof metadata.decisionAction === 'string'
    ? metadata.decisionAction as VerifierDecisionAction
    : null;
  const sourceReferenceId = typeof metadata.sourceReferenceId === 'string'
    ? metadata.sourceReferenceId
    : null;
  const trustStateHash = typeof metadata.trustStateHash === 'string'
    ? metadata.trustStateHash
    : null;

  return {
    id: record.id,
    subjectDid: record.subjectDid,
    subjectNpi: record.subjectNpi,
    decisionType: record.decisionType,
    decisionTimestamp: record.decisionTimestamp,
    credentialIds: record.credentialIds,
    issuerIds: record.issuerIds,
    artifactHash: record.artifactHash,
    methodology: record.methodology,
    methodologyVersion: typeof metadata.methodologyVersion === 'string'
      ? metadata.methodologyVersion
      : record.methodology,
    verifierOrgId,
    decisionAction,
    trustStateHash,
    status: record.status as CapsuleStatus,
    triggerEvent,
    sourceReferenceId,
    metadata: record.metadata,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function persistDecisionAuditEvent(input: {
  capsule: DecisionCapsuleRecord;
  decisionAction: VerifierDecisionAction | null;
  triggerEvent: DecisionTriggerEvent;
  sourceReferenceId: string;
  trustStateHash: string;
  verifierOrgId: string | null;
  compatibilityCredentialIds: string[];
}): Promise<void> {
  const organizationId = normalizeOrganizationId(input.verifierOrgId);

  await prisma.auditEvent.create({
    data: {
      type: 'DECISION_CAPSULE',
      hash: input.capsule.artifactHash,
      referenceId: input.capsule.id,
      clinicianId: input.capsule.subjectNpi,
      ...(organizationId ? { organizationId } : {}),
      metadata: {
        capsuleId: input.capsule.id,
        decisionType: input.capsule.decisionType,
        decisionAction: input.decisionAction,
        status: input.capsule.status,
        trustStateHash: input.trustStateHash,
        credentialIds: input.capsule.credentialIds,
        compatibilityCredentialIds: uniqueSorted(input.compatibilityCredentialIds),
        issuerIds: input.capsule.issuerIds,
        verifierOrgId: input.verifierOrgId,
        methodologyVersion: input.capsule.methodologyVersion,
        triggerEvent: input.triggerEvent,
        sourceReferenceId: input.sourceReferenceId,
      } as Prisma.InputJsonValue,
    },
  });

  appendAuditEvent({
    category: 'DECISION',
    severity: 'INFO',
    actor: 'decision_capsule_engine',
    resource: `decision-capsule:${input.capsule.id}`,
    requestFields: {
      triggerEvent: input.triggerEvent,
      sourceReferenceId: input.sourceReferenceId,
      subjectNpi: input.capsule.subjectNpi,
    },
    resultFields: {
      capsuleId: input.capsule.id,
      artifactHash: input.capsule.artifactHash,
      decisionAction: input.decisionAction,
      trustStateHash: input.trustStateHash,
      verifierOrgId: input.verifierOrgId,
    },
  });
}

async function createDecisionCapsule(
  input: CreateCapsuleInput,
): Promise<DecisionCapsuleRecord> {
  const verifierOrgId = resolveVerifierOrgId(input);
  const triggerEvent = resolveTriggerEvent(input);
  const decisionAction = resolveDecisionAction(input);
  const sourceReferenceId = resolveSourceReferenceId({
    sourceReferenceId: input.sourceReferenceId,
    triggerEvent,
    decisionType: input.decisionType,
    subjectNpi: input.subjectNpi,
    verifierOrgId,
  });
  const workflowContext = resolveWorkflowContext(input.decisionType);
  const contextOrgId = normalizeOrganizationId(verifierOrgId);
  const decisionTimestamp = new Date();

  const { subjectDid, legacySnapshot, v2Snapshot } = await resolveTrustSnapshots({
    subjectNpi: input.subjectNpi,
    subjectDid: input.subjectDid,
    contextOrgId,
    workflowContext,
  });
  const evidence = await resolveDecisionEvidence({
    subjectNpi: input.subjectNpi,
    contextOrgId,
    credentialIds: input.credentialIds,
    issuerIds: input.issuerIds,
  });

  if (evidence.credentialIds.length === 0) {
    throw new Error(`No credential evidence found for ${input.subjectNpi}`);
  }

  const status = input.status ?? 'VALID';
  const trustStateHash = sha256ForPayload({
    trust_state_snapshot: legacySnapshot,
    trust_state_snapshot_v2: v2Snapshot,
  });
  const decisionHashPayload = buildDecisionHashPayload({
    subjectDid,
    subjectNpi: input.subjectNpi,
    trustStateHash,
    verifierOrgId,
    decisionType: input.decisionType,
    decisionAction,
    credentialIds: evidence.credentialIds,
    compatibilityCredentialIds: evidence.compatibilityCredentialIds,
    issuerIds: evidence.issuerIds,
    status,
    triggerEvent,
    sourceReferenceId,
    methodologyVersion: METHODOLOGY_VERSION,
    decisionTimestamp: decisionTimestamp.toISOString(),
  });
  const artifactHash = sha256ForPayload(decisionHashPayload);
  const decisionCapsulePayload = {
    ...decisionHashPayload,
    artifactHash,
  };
  const metadata = buildDecisionMetadata({
    metadata: input.metadata,
    legacySnapshot,
    v2Snapshot,
    compatibilityCredentialIds: evidence.compatibilityCredentialIds,
    verifierOrgId,
    decisionAction,
    trustStateHash,
    methodologyVersion: METHODOLOGY_VERSION,
    decisionType: input.decisionType,
    status,
    decisionCapsulePayload,
  });

  const persisted = await persistDecisionCapsule({
    subjectDid,
    subjectNpi: input.subjectNpi,
    decisionType: input.decisionType,
    decisionAction,
    decisionTimestamp,
    credentialIds: evidence.credentialIds,
    issuerIds: evidence.issuerIds,
    artifactHash,
    methodology: METHODOLOGY_VERSION,
    status,
    metadata,
    triggerEvent,
    sourceReferenceId,
  });
  const capsule = mapRecord(persisted.capsule);

  if (!persisted.idempotent) {
    await createAuthorityEdges({
      capsuleId: capsule.id,
      subjectDid,
      subjectNpi: input.subjectNpi,
      verifierOrgId,
      decisionType: input.decisionType,
      decisionAction,
      credentialIds: capsule.credentialIds,
      issuerIds: capsule.issuerIds,
      artifactHash: capsule.artifactHash,
      methodologyVersion: METHODOLOGY_VERSION,
      decisionTimestamp: capsule.decisionTimestamp,
      triggerEvent,
    });

    await persistDecisionAuditEvent({
      capsule,
      decisionAction,
      triggerEvent,
      sourceReferenceId,
      trustStateHash,
      verifierOrgId,
      compatibilityCredentialIds: evidence.compatibilityCredentialIds,
    });

    await enqueueDecisionCapsuleCreatedEvent({
      capsuleId: capsule.id,
      subjectDid,
      subjectNpi: input.subjectNpi,
      trustStateHash,
      decisionType: input.decisionType,
      decisionAction,
      triggerEvent,
      sourceReferenceId,
      artifactHash: capsule.artifactHash,
      decisionTimestamp: capsule.decisionTimestamp,
      methodologyVersion: METHODOLOGY_VERSION,
      credentialIds: capsule.credentialIds,
      issuerIds: capsule.issuerIds,
      verifierOrg: verifierOrgId,
    });

    log('info', 'capsule_engine: created', {
      capsuleId: capsule.id,
      subjectNpi: input.subjectNpi.slice(0, 4) + '****',
      decisionType: input.decisionType,
      decisionAction,
      triggerEvent,
      credentialCount: capsule.credentialIds.length,
      artifactHash: capsule.artifactHash.slice(0, 16),
    });
  }

  return capsule;
}

async function getCapsulesByNpi(npi: string): Promise<DecisionCapsuleRecord[]> {
  const rows = await findDecisionCapsulesByNpiRepo(npi);
  return rows.map(mapRecord);
}

async function getCapsuleById(id: string): Promise<DecisionCapsuleRecord | null> {
  const row = await findDecisionCapsuleByIdRepo(id);
  return row ? mapRecord(row) : null;
}

async function countCapsules(): Promise<number> {
  return prisma.decisionCapsule.count();
}

async function verifyDecisionCapsuleReplay(
  capsuleId: string,
): Promise<DecisionCapsuleReplayResult> {
  const capsule = await getCapsuleById(capsuleId);
  if (!capsule) {
    throw new Error(`Decision capsule not found: ${capsuleId}`);
  }

  const metadata = isRecord(capsule.metadata) ? capsule.metadata : {};
  const storedPayload = metadata.decision_capsule_payload;
  if (!isRecord(storedPayload)) {
    throw new Error(`Decision capsule ${capsuleId} is missing replay metadata`);
  }

  const payloadForReplay = { ...storedPayload };
  delete payloadForReplay.artifactHash;
  const actualArtifactHash = sha256ForPayload(payloadForReplay);

  return {
    capsuleId,
    valid: actualArtifactHash === capsule.artifactHash,
    expectedArtifactHash: capsule.artifactHash,
    actualArtifactHash,
  };
}

async function createDecisionFromApplication(
  params: CreateApplicationDecisionInput,
): Promise<DecisionCapsuleRecord> {
  const application = await prisma.application.findUnique({
    where: { id: params.applicationId },
    select: {
      id: true,
      npi: true,
      status: true,
      reviewNote: true,
      opportunityId: true,
      opportunity: {
        select: {
          organizationId: true,
          organization: { select: { name: true } },
        },
      },
    },
  });

  if (!application) {
    throw new Error(`Application not found: ${params.applicationId}`);
  }

  if (!application.npi || !/^\d{10}$/.test(application.npi)) {
    throw new Error(`Application ${params.applicationId} has no valid NPI`);
  }

  const decisionAction = params.decisionAction ?? 'APPROVE';
  if (decisionAction === 'START_ATTESTATION') {
    throw new Error('Application decisions cannot trigger START_ATTESTATION');
  }
  assertApplicationDecisionStatus(application.status, decisionAction, params.applicationId);

  return createDecisionCapsule({
    subjectDid: `did:vitalcv:${application.npi}`,
    subjectNpi: application.npi,
    decisionType: params.decisionType,
    decisionAction,
    verifierOrgId: application.opportunity.organizationId,
    triggerEvent: 'verifier_decision',
    sourceReferenceId: params.applicationId,
    metadata: {
      applicationId: params.applicationId,
      opportunityId: application.opportunityId,
      organizationId: application.opportunity.organizationId,
      organizationName: application.opportunity.organization.name,
      verifierClerkUserId: params.verifierClerkUserId,
      applicationStatus: application.status,
      reviewNote: application.reviewNote,
    },
  });
}

async function createDecisionFromAcceptance(
  input: CreateAcceptanceDecisionInput,
): Promise<DecisionCapsuleRecord> {
  return createDecisionCapsule({
    subjectDid: `did:vitalcv:${input.subjectNpi}`,
    subjectNpi: input.subjectNpi,
    decisionType: 'HIRING',
    decisionAction: 'APPROVE',
    verifierOrgId: input.employerId,
    triggerEvent: 'employment_acceptance',
    sourceReferenceId: input.acceptanceId,
    metadata: {
      acceptanceId: input.acceptanceId,
      employerId: input.employerId,
      artifactId: input.artifactId ?? null,
    },
  });
}

async function createDecisionFromHire(
  input: CreateHireDecisionInput,
): Promise<DecisionCapsuleRecord> {
  return createDecisionCapsule({
    subjectDid: `did:vitalcv:${input.subjectNpi}`,
    subjectNpi: input.subjectNpi,
    decisionType: 'HIRING',
    decisionAction: 'START_ATTESTATION',
    verifierOrgId: input.organizationId ?? input.employerId,
    triggerEvent: 'start_attestation',
    sourceReferenceId: input.startAttestationId,
    metadata: {
      acceptanceId: input.acceptanceId,
      startAttestationId: input.startAttestationId,
      employerId: input.employerId,
      organizationId: input.organizationId ?? input.employerId,
      role: input.role,
      facility: input.facility,
      startedAt: input.startedAt,
    },
  });
}

export const capsuleEngine = {
  createDecisionCapsule,
  createDecisionFromApplication,
  createDecisionFromAcceptance,
  createDecisionFromHire,
  getCapsulesByNpi,
  getCapsuleById,
  countCapsules,
  verifyDecisionCapsuleReplay,
};
