import { Prisma, PrismaClient } from '@prisma/client';
import { PsvStore, type AppendReceiptInput } from '@vitalcv/psv';
import prisma from '../../backend/src/graphql/prisma_client';

type ManualVerificationSource = 'SERT' | 'GSA' | 'PUBLIC_REGULATOR' | 'PARTNER' | 'OTHER';
type VerificationRequestStatus = 'PENDING' | 'COMPLETE' | 'FAILED';

export type ManualVerificationRequestRecord = Readonly<{
  request_id: string;
  clinician_id: string;
  lane: 'MANUAL';
  source: ManualVerificationSource;
  subject: string;
  status: VerificationRequestStatus;
  attestor_id: string;
  document_hash: string;
  created_at: string;
  completed_at: string | null;
  receipt_id: string | null;
  failure_reason: string | null;
}>;

type CreateRequestInput = Readonly<{
  clinician_id: string;
  subject: string;
  source: ManualVerificationSource;
  attestor_id: string;
  document_hash: string;
  created_at?: string;
}>;

type ResolveRequestInput = Readonly<{
  request_id: string;
  receipt_id: string;
  completed_at?: string;
  failure_reason?: string;
}>;

type PrismaVerificationRequest = {
  requestId: string;
  clinicianId: string;
  lane: string;
  source: string;
  attestorId: string | null;
  documentHash: string | null;
  subject: string;
  status: { name: string } | VerificationRequestStatus;
  createdAt: Date;
  completedAt: Date | null;
  receiptId: string | null;
  failureReason: string | null;
};

let psvStore = new PsvStore();

function assertNonEmpty(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function toStatus(raw: unknown): VerificationRequestStatus {
  if (raw === 'COMPLETE' || raw === 'FAILED') return raw;
  return 'PENDING';
}

function toSource(value: string): ManualVerificationSource {
  const normalized = (value || '').trim();
  return (
    normalized === 'SERT' ||
    normalized === 'GSA' ||
    normalized === 'PUBLIC_REGULATOR' ||
    normalized === 'PARTNER' ||
    normalized === 'OTHER'
      ? normalized
      : 'OTHER'
  ) as ManualVerificationSource;
}

function normalizeStatus(raw: PrismaVerificationRequest['status']): VerificationRequestStatus {
  if (typeof raw === 'string') return toStatus(raw);
  return toStatus((raw as { name: string }).name);
}

function toRecord(row: PrismaVerificationRequest): ManualVerificationRequestRecord {
  return Object.freeze({
    request_id: row.requestId,
    clinician_id: row.clinicianId,
    lane: 'MANUAL',
    source: toSource(row.source),
    subject: row.subject,
    status: normalizeStatus(row.status),
    attestor_id: row.attestorId || '',
    document_hash: row.documentHash || '',
    created_at: row.createdAt.toISOString(),
    completed_at: row.completedAt ? row.completedAt.toISOString() : null,
    receipt_id: row.receiptId,
    failure_reason: row.failureReason,
  });
}

function ensurePending(request: ManualVerificationRequestRecord): void {
  if (request.status !== 'PENDING') {
    throw new Error(`verification request is already completed: ${request.request_id}`);
  }
}

export async function createManualVerificationRequest(
  input: CreateRequestInput,
): Promise<ManualVerificationRequestRecord> {
  const clinician_id = assertNonEmpty(input.clinician_id, 'clinician_id');
  const subject = assertNonEmpty(input.subject, 'subject');
  const attestor_id = assertNonEmpty(input.attestor_id, 'attestor_id');
  const document_hash = assertNonEmpty(input.document_hash, 'document_hash');
  const source = toSource(input.source || 'OTHER');

  const row = await prisma.verificationRequest.create({
    data: {
      clinicianId: clinician_id,
      lane: 'MANUAL',
      source,
      attestorId: attestor_id,
      documentHash: document_hash,
      subject,
      status: Prisma.VerificationRequestStatus.PENDING,
      createdAt: input.created_at ? new Date(input.created_at) : new Date(),
    },
  });

  return toRecord(row as PrismaVerificationRequest);
}

async function updateRequest(
  request_id: string,
  updater: (request: ManualVerificationRequestRecord) => ManualVerificationRequestRecord,
): Promise<ManualVerificationRequestRecord> {
  const existing = await prisma.verificationRequest.findUnique({
    where: { requestId: request_id },
  });

  if (!existing) {
    throw new Error(`verification request not found: ${request_id}`);
  }

  const record = toRecord(existing as PrismaVerificationRequest);
  const next = updater(record);

  const nextRecord = await prisma.verificationRequest.update({
    where: { requestId: request_id },
    data: {
      status: next.status,
      completedAt: next.completed_at ? new Date(next.completed_at) : null,
      receiptId: next.receipt_id,
      failureReason: next.failure_reason,
    },
  });

  return toRecord(nextRecord as PrismaVerificationRequest);
}

export async function completeManualVerificationRequest(
  input: ResolveRequestInput,
): Promise<ManualVerificationRequestRecord> {
  const request_id = assertNonEmpty(input.request_id, 'request_id');
  const receipt_id = assertNonEmpty(input.receipt_id, 'receipt_id');
  const completed_at = input.completed_at ?? new Date().toISOString();

  return updateRequest(request_id, (request) => {
    ensurePending(request);
    return {
      ...request,
      status: 'COMPLETE',
      completed_at,
      receipt_id,
      failure_reason: null,
    };
  });
}

export async function failManualVerificationRequest(
  input: ResolveRequestInput,
): Promise<ManualVerificationRequestRecord> {
  const request_id = assertNonEmpty(input.request_id, 'request_id');
  const receipt_id = assertNonEmpty(input.receipt_id, 'receipt_id');
  const completed_at = input.completed_at ?? new Date().toISOString();
  const failure_reason = assertNonEmpty(input.failure_reason ?? 'MANUAL_VERIFICATION_FAILED', 'failure_reason');

  return updateRequest(request_id, (request) => {
    ensurePending(request);
    return {
      ...request,
      status: 'FAILED',
      completed_at,
      receipt_id,
      failure_reason,
    };
  });
}

export function appendManualVerificationReceipt(input: AppendReceiptInput) {
  return psvStore.append(input);
}

export function listVerificationReceiptsByClinician(clinician_id: string) {
  return psvStore.listByClinician(assertNonEmpty(clinician_id, 'clinician_id'));
}

export function listVerificationReceiptIdsByClinician(clinician_id: string) {
  return psvStore.listReceiptIdsByClinician(assertNonEmpty(clinician_id, 'clinician_id'));
}

export async function getManualVerificationRequest(
  request_id: string,
): Promise<ManualVerificationRequestRecord | null> {
  const row = await prisma.verificationRequest.findUnique({
    where: { requestId: assertNonEmpty(request_id, 'request_id') },
  });

  if (!row) {
    return null;
  }

  return toRecord(row as PrismaVerificationRequest);
}

export async function listManualVerificationRequestsByClinician(
  clinician_id: string,
): Promise<readonly ManualVerificationRequestRecord[]> {
  const rows = await prisma.verificationRequest.findMany({
    where: { clinicianId: assertNonEmpty(clinician_id, 'clinician_id') },
    orderBy: { createdAt: 'desc' },
  });

  return Object.freeze(rows.map((row) => toRecord(row as PrismaVerificationRequest)));
}

export function resetVerificationStore(): void {
  psvStore = new PsvStore();
}

export { PrismaClient, Prisma };
