import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ChainClient } from '../chain/client';

export type DelegateScope = 'verifyOnly' | 'issueOnly';

export interface DelegateRequest {
  clinicianId: string;
  delegateDid: string;
  scopes: DelegateScope[];
  expiresAt?: string;
  note?: string;
}

export interface DelegateRecord {
  delegateId: string;
  clinicianId: string;
  delegateDid: string;
  scopes: DelegateScope[];
  expiresAt?: string;
  anchor?: {
    txHash: string;
    timestamp: string;
  };
  note?: string;
  createdAt: string;
}

export async function registerDelegate(
  prisma: PrismaClient,
  request: DelegateRequest,
): Promise<DelegateRecord> {
  validateDelegateRequest(request);

  const delegateId = randomUUID();
  const chainClient = new ChainClient();
  const anchor = await chainClient.submitAuditEvent({
    eventType: 'did.delegate',
    payload: {
      delegateId,
      clinicianId: request.clinicianId,
      delegateDid: request.delegateDid,
      scopes: request.scopes,
      expiresAt: request.expiresAt,
    },
    tags: ['did', 'delegation'],
  });

  await prisma.auditEvidence.create({
    data: {
      clinicianId: request.clinicianId,
      category: 'did-delegation',
      payload: {
        delegateId,
        delegateDid: request.delegateDid,
        scopes: request.scopes,
        expiresAt: request.expiresAt,
        anchor,
        note: request.note,
      },
    },
  });

  return {
    delegateId,
    clinicianId: request.clinicianId,
    delegateDid: request.delegateDid,
    scopes: request.scopes,
    expiresAt: request.expiresAt,
    anchor: {
      txHash: anchor.txHash,
      timestamp: anchor.timestamp,
    },
    note: request.note,
    createdAt: new Date().toISOString(),
  };
}

export async function listDelegates(
  prisma: PrismaClient,
  clinicianId?: string,
  limit = 25,
): Promise<DelegateRecord[]> {
  const records = await prisma.auditEvidence.findMany({
    where: {
      category: 'did-delegation',
      ...(clinicianId ? { clinicianId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return records.map((record) => ({
    delegateId: ((record.payload as any)?.delegateId as string) ?? randomUUID(),
    clinicianId: record.clinicianId,
    delegateDid: ((record.payload as any)?.delegateDid as string) ?? 'did:unknown',
    scopes: (((record.payload as any)?.scopes as DelegateScope[]) ?? ['verifyOnly']).filter(Boolean),
    expiresAt: ((record.payload as any)?.expiresAt as string) ?? undefined,
    anchor: (record.payload as any)?.anchor
      ? {
          txHash: (record.payload as any).anchor.txHash,
          timestamp: (record.payload as any).anchor.timestamp,
        }
      : undefined,
    note: ((record.payload as any)?.note as string) ?? undefined,
    createdAt: record.createdAt.toISOString(),
  }));
}

function validateDelegateRequest(request: DelegateRequest) {
  if (!request.clinicianId || !request.delegateDid) {
    throw new Error('clinicianId and delegateDid are required');
  }
  if (!Array.isArray(request.scopes) || request.scopes.length === 0) {
    throw new Error('At least one scope must be provided');
  }
  const invalidScope = request.scopes.find(
    (scope) => scope !== 'verifyOnly' && scope !== 'issueOnly',
  );
  if (invalidScope) {
    throw new Error(`Invalid scope ${invalidScope}`);
  }
}


