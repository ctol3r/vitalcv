import { randomUUID } from 'crypto';
import { PrismaClient, type MultiPartyCredential } from '@prisma/client';
import { aggregatePartialSignatures, type PartialSignatureInput } from './partial-signature-aggregator';
import { adaptToMultiIssuerCredential, type MultiIssuerCredentialEnvelope } from './multi-party-adapter';
import {
  buildMultiIssuerThreadId,
  notifyWorkflowUpdate,
  sendCoIssuerInvites,
} from '../didcomm/multi-issuers';
import { appendProofEvent } from '../proofs/stream';
import { anchorMultiPartyCredential, anchorMultiPartyRevocation } from '../audit/anchor';

const prisma = new PrismaClient();
const MAX_ACTIVITY = 200;

export type WorkflowState = 'draft' | 'requested' | 'partially_signed' | 'fully_signed' | 'revoked';

export interface WorkflowActivityEntry {
  id: string;
  type:
    | 'draft_created'
    | 'invite_sent'
    | 'signatures_requested'
    | 'partial_signature'
    | 'fully_signed'
    | 'revoked';
  actor: string;
  timestamp: string;
  details?: Record<string, any>;
}

export interface StoredWorkflowState {
  activity: WorkflowActivityEntry[];
  signatures: StoredSignature[];
  jointCredential?: MultiIssuerCredentialEnvelope | null;
}

export interface StoredSignature extends PartialSignatureInput {
  issuerDid: string;
  proof: Record<string, any>;
  signedAt: string;
  anchor?: PartialSignatureInput['anchor'];
  summary?: string;
}

export interface MultiPartyWorkflowRecord extends MultiPartyCredential {
  activityLog: WorkflowActivityEntry[];
  signatures: StoredSignature[];
  jointCredential?: MultiIssuerCredentialEnvelope | null;
  threadId: string;
}

export interface CreateWorkflowInput {
  baseCredentialId: string;
  participantDids: string[];
  requestedBy: string;
  summary?: string;
}

export interface SignatureInput {
  multiCredentialId: string;
  issuerDid: string;
  proof: Record<string, any>;
  signedAt?: string;
  anchor?: {
    txHash: string;
    timestamp: string;
    network?: string;
  } | null;
  summary?: string;
}

export interface RevocationInput {
  multiCredentialId: string;
  revokedBy: string;
  reason: string;
}

export async function createWorkflowDraft(input: CreateWorkflowInput): Promise<MultiPartyWorkflowRecord> {
  const participants = dedupeDids(input.participantDids);
  if (participants.length < 2) {
    throw new Error('Multi-party issuance requires at least two participant DIDs');
  }

  const now = new Date().toISOString();
  const initialState: StoredWorkflowState = {
    activity: [
      {
        id: randomUUID(),
        type: 'draft_created',
        actor: input.requestedBy,
        timestamp: now,
        details: {
          participantCount: participants.length,
          summary: input.summary ?? null,
        },
      },
    ],
    signatures: [],
  };

  const record = await prisma.multiPartyCredential.create({
    data: {
      baseCredentialId: input.baseCredentialId,
      participantDids: participants,
      status: 'draft',
      partialProofs: initialState,
    },
  });

  await appendProofEvent(buildMultiIssuerThreadId(record.id), 'draft_created', {
    actor: input.requestedBy,
    participantCount: participants.length,
  });

  return withComputedState(record, initialState);
}

export async function requestSignatures(
  multiCredentialId: string,
  actorDid: string,
  summary?: string,
): Promise<MultiPartyWorkflowRecord> {
  const record = await prisma.multiPartyCredential.findUnique({ where: { id: multiCredentialId } });
  if (!record) {
    throw new Error('Multi-party credential not found');
  }
  if (record.status === 'revoked') {
    throw new Error('Cannot request signatures for revoked workflow');
  }

  const state = parseState(record);
  const timestamp = new Date().toISOString();
  state.activity = appendActivity(state.activity, {
    id: randomUUID(),
    type: 'signatures_requested',
    actor: actorDid,
    timestamp,
    details: { summary: summary ?? null },
  });

  const updated = await prisma.multiPartyCredential.update({
    where: { id: multiCredentialId },
    data: {
      status: 'requested',
      partialProofs: state,
    },
  });

  await sendCoIssuerInvites({
    multiCredentialId,
    baseCredentialId: record.baseCredentialId,
    fromDid: actorDid,
    toDids: record.participantDids,
    summary: summary ?? `Sign ${record.baseCredentialId}`,
  });

  await appendProofEvent(buildMultiIssuerThreadId(record.id), 'signatures_requested', {
    actor: actorDid,
    participantCount: record.participantDids.length,
  });

  return withComputedState(updated, state);
}

export async function recordPartialSignature(
  input: SignatureInput,
): Promise<MultiPartyWorkflowRecord> {
  const record = await prisma.multiPartyCredential.findUnique({ where: { id: input.multiCredentialId } });
  if (!record) {
    throw new Error('Multi-party credential not found');
  }
  if (record.status === 'revoked') {
    throw new Error('Workflow already revoked');
  }
  if (!record.participantDids.includes(input.issuerDid)) {
    throw new Error(`Issuer ${input.issuerDid} is not part of this workflow`);
  }

  const state = parseState(record);
  const signedAt = input.signedAt ? new Date(input.signedAt).toISOString() : new Date().toISOString();
  const signatureEntry: StoredSignature = {
    issuerDid: input.issuerDid,
    proof: sanitizeProof(input.proof),
    signedAt,
    anchor: input.anchor ?? null,
    summary: input.summary,
  };

  state.signatures = upsertSignature(state.signatures, signatureEntry);
  state.activity = appendActivity(state.activity, {
    id: randomUUID(),
    type: 'partial_signature',
    actor: input.issuerDid,
    timestamp: signedAt,
    details: {
      anchor: input.anchor ?? null,
    },
  });

  const signaturesComplete = state.signatures.length >= record.participantDids.length;
  const nextStatus: WorkflowState = signaturesComplete ? 'fully_signed' : 'partially_signed';
  let rootHash: string | undefined;

  if (signaturesComplete) {
    const aggregation = aggregatePartialSignatures(record.baseCredentialId, state.signatures);
    const baseEnvelope = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      id: record.baseCredentialId,
      type: ['VerifiableCredential', 'VitalMultiIssuerCredential'],
      issuanceDate: aggregation.issuedAt,
    };
    state.jointCredential = adaptToMultiIssuerCredential(baseEnvelope, aggregation);
    rootHash = aggregation.rootHash;
    state.activity = appendActivity(state.activity, {
      id: randomUUID(),
      type: 'fully_signed',
      actor: input.issuerDid,
      timestamp: aggregation.issuedAt,
      details: {
        rootHash,
        proofCount: aggregation.proofSet.proofCount,
      },
    });

    anchorMultiPartyCredential({
      multiCredentialId: record.id,
      baseCredentialId: record.baseCredentialId,
      participantDids: record.participantDids,
      rootHash,
      proofCount: aggregation.proofSet.proofCount,
    });

    await notifyWorkflowUpdate({
      multiCredentialId: record.id,
      event: 'fully_signed',
      toDids: record.participantDids,
      status: 'fully_signed',
      payload: {
        rootHash,
        proofCount: aggregation.proofSet.proofCount,
      },
    });
  } else {
    await notifyWorkflowUpdate({
      multiCredentialId: record.id,
      event: 'signature_recorded',
      toDids: record.participantDids,
      status: 'partially_signed',
      payload: {
        issuerDid: input.issuerDid,
        signatureCount: state.signatures.length,
      },
    });
  }

  const updated = await prisma.multiPartyCredential.update({
    where: { id: record.id },
    data: {
      status: nextStatus,
      partialProofs: state,
      ...(rootHash ? { rootHash } : {}),
    },
  });

  await appendProofEvent(buildMultiIssuerThreadId(record.id), 'partial_signature', {
    issuerDid: input.issuerDid,
    status: nextStatus,
    rootHash: rootHash ?? null,
  });

  return withComputedState(updated, state);
}

export async function revokeMultiPartyCredential(
  input: RevocationInput,
): Promise<MultiPartyWorkflowRecord> {
  const record = await prisma.multiPartyCredential.findUnique({ where: { id: input.multiCredentialId } });
  if (!record) {
    throw new Error('Multi-party credential not found');
  }
  if (record.status === 'revoked') {
    return withComputedState(record);
  }

  const state = parseState(record);
  const timestamp = new Date().toISOString();
  state.activity = appendActivity(state.activity, {
    id: randomUUID(),
    type: 'revoked',
    actor: input.revokedBy,
    timestamp,
    details: { reason: input.reason },
  });

  const updated = await prisma.multiPartyCredential.update({
    where: { id: record.id },
    data: {
      status: 'revoked',
      partialProofs: state,
    },
  });

  anchorMultiPartyRevocation({
    multiCredentialId: record.id,
    baseCredentialId: record.baseCredentialId,
    participantDids: record.participantDids,
    reason: input.reason,
    revokedBy: input.revokedBy,
    rootHash: record.rootHash ?? null,
  });

  await notifyWorkflowUpdate({
    multiCredentialId: record.id,
    event: 'revoked',
    toDids: record.participantDids,
    status: 'revoked',
    payload: {
      reason: input.reason,
      revokedBy: input.revokedBy,
    },
  });

  await appendProofEvent(buildMultiIssuerThreadId(record.id), 'revoked', {
    reason: input.reason,
    actor: input.revokedBy,
  });

  return withComputedState(updated, state);
}

export async function getWorkflow(id: string): Promise<MultiPartyWorkflowRecord | null> {
  const record = await prisma.multiPartyCredential.findUnique({ where: { id } });
  if (!record) {
    return null;
  }
  return withComputedState(record);
}

export async function listWorkflows(limit = 25): Promise<MultiPartyWorkflowRecord[]> {
  const rows = await prisma.multiPartyCredential.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.min(100, Math.max(1, limit)),
  });
  return rows.map((row) => withComputedState(row));
}

function withComputedState(
  record: MultiPartyCredential,
  parsed?: StoredWorkflowState,
): MultiPartyWorkflowRecord {
  const state = parsed ?? parseState(record);
  return {
    ...record,
    activityLog: state.activity,
    signatures: state.signatures,
    jointCredential: state.jointCredential ?? null,
    threadId: buildMultiIssuerThreadId(record.id),
  };
}

function parseState(record: MultiPartyCredential): StoredWorkflowState {
  const raw = (record.partialProofs as StoredWorkflowState | null) ?? null;
  const activity = Array.isArray(raw?.activity) ? raw.activity.map(coerceActivity) : [];
  const signatures = Array.isArray(raw?.signatures) ? raw.signatures.map(coerceSignature) : [];
  return {
    activity,
    signatures,
    jointCredential: raw?.jointCredential ?? null,
  };
}

function coerceActivity(entry: WorkflowActivityEntry): WorkflowActivityEntry {
  return {
    id: entry?.id ?? randomUUID(),
    type: entry?.type ?? 'draft_created',
    actor: entry?.actor ?? 'system',
    timestamp: entry?.timestamp ? new Date(entry.timestamp).toISOString() : new Date().toISOString(),
    details: entry?.details ?? {},
  };
}

function coerceSignature(entry: StoredSignature): StoredSignature {
  return {
    issuerDid: entry?.issuerDid ?? 'unknown',
    proof: sanitizeProof(entry?.proof ?? {}),
    signedAt: entry?.signedAt ? new Date(entry.signedAt).toISOString() : new Date().toISOString(),
    anchor: entry?.anchor ?? null,
    summary: entry?.summary,
  };
}

function sanitizeProof(proof: Record<string, any>): Record<string, any> {
  try {
    return JSON.parse(JSON.stringify(proof ?? {}));
  } catch {
    return { error: 'proof_not_serializable' };
  }
}

function dedupeDids(dids: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  dids.forEach((did) => {
    const normalized = did?.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    next.push(normalized);
  });
  return next;
}

function appendActivity(
  list: WorkflowActivityEntry[],
  entry: WorkflowActivityEntry,
): WorkflowActivityEntry[] {
  const appended = [...list, entry];
  if (appended.length <= MAX_ACTIVITY) {
    return appended;
  }
  return appended.slice(appended.length - MAX_ACTIVITY);
}

function upsertSignature(
  entries: StoredSignature[],
  next: StoredSignature,
): StoredSignature[] {
  const existingIndex = entries.findIndex((entry) => entry.issuerDid === next.issuerDid);
  if (existingIndex === -1) {
    return [...entries, next];
  }
  const updated = [...entries];
  updated[existingIndex] = next;
  return updated;
}









