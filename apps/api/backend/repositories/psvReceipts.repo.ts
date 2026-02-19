import { PSVReceipt, type PSVReceiptSnapshot, type SourceAuthority } from '../../../../packages/psv/PSVReceipt';
import type { AppendReceiptInput, TrustStateReceiptRecord } from '../../../../packages/psv/psvStore';
import prisma from '../src/graphql/prisma_client';

function toReceiptInstance(receipt: PSVReceipt | { receipt_id?: string; source_authority: SourceAuthority; access_or_license_id: string; transaction_id: string; fetched_at: string; raw_response: string; ttl_seconds: number; revoked?: boolean }): PSVReceipt {
  if (receipt instanceof PSVReceipt) return receipt;
  return PSVReceipt.create(receipt);
}

function rowToSnapshot(row: {
  receiptId: string;
  sourceAuthority: string;
  licenseId: string;
  transactionId: string;
  fetchedAt: Date;
  responseHash: string;
  ttlSeconds: number;
  revoked: boolean;
}): PSVReceiptSnapshot {
  return Object.freeze({
    receipt_id: row.receiptId,
    source_authority: row.sourceAuthority as SourceAuthority,
    access_or_license_id: row.licenseId,
    transaction_id: row.transactionId,
    fetched_at: row.fetchedAt.toISOString(),
    response_hash: row.responseHash,
    ttl_seconds: row.ttlSeconds,
    revoked: row.revoked,
  });
}

function rowToTrustStateRecord(row: {
  receiptId: string;
  fetchedAt: Date;
  ttlSeconds: number;
  revoked: boolean;
  lane: string | null;
  verificationCheck: string | null;
  verificationOutcome: string | null;
  failureReason: string | null;
  source: string | null;
  attestorId: string | null;
  verificationRequestId: string | null;
}): TrustStateReceiptRecord {
  return Object.freeze({
    receipt_id: row.receiptId,
    fetched_at: row.fetchedAt.toISOString(),
    ttl_seconds: row.ttlSeconds,
    revoked: row.revoked,
    ...(row.lane ? { lane: row.lane as 'PUBLIC' | 'PARTNER' | 'MANUAL' } : {}),
    ...(row.verificationCheck ? { verification_check: row.verificationCheck } : {}),
    ...(row.verificationOutcome ? { verification_outcome: row.verificationOutcome as 'PASS' | 'FAIL' } : {}),
    ...(row.failureReason ? { failure_reason: row.failureReason } : {}),
    ...(row.source ? { source: row.source as 'EMPLOYER' | 'CVO' } : {}),
    ...(row.attestorId ? { attestor_id: row.attestorId } : {}),
    ...(row.verificationRequestId ? { verification_request_id: row.verificationRequestId } : {}),
  });
}

export async function appendReceipt(input: AppendReceiptInput): Promise<PSVReceipt> {
  const receipt = toReceiptInstance(input.receipt);

  const existing = await prisma.psvReceipt.findUnique({
    where: { receiptId: receipt.receipt_id },
  });
  if (existing) {
    throw new Error(`PSV receipt already exists: ${receipt.receipt_id}`);
  }

  await prisma.psvReceipt.create({
    data: {
      receiptId: receipt.receipt_id,
      clinicianId: input.clinician_id,
      sourceAuthority: receipt.source_authority,
      licenseId: receipt.access_or_license_id,
      transactionId: receipt.transaction_id,
      fetchedAt: new Date(receipt.fetched_at),
      responseHash: receipt.response_hash,
      ttlSeconds: receipt.ttl_seconds,
      revoked: receipt.revoked,
      lane: input.lane ?? null,
      verificationCheck: input.verification_check ?? null,
      verificationOutcome: input.verification_outcome ?? null,
      failureReason: input.failure_reason ?? null,
      source: input.source ?? null,
      attestorId: input.attestor_id ?? null,
      verificationRequestId: input.verification_request_id ?? null,
    },
  });

  return receipt;
}

export async function listByClinician(clinicianId: string): Promise<readonly TrustStateReceiptRecord[]> {
  const rows = await prisma.psvReceipt.findMany({
    where: { clinicianId },
    orderBy: { fetchedAt: 'desc' },
  });
  return Object.freeze(rows.map(rowToTrustStateRecord));
}

export async function listReceiptIdsByClinician(clinicianId: string): Promise<readonly string[]> {
  const rows = await prisma.psvReceipt.findMany({
    where: { clinicianId },
    select: { receiptId: true },
    orderBy: { fetchedAt: 'desc' },
  });
  return Object.freeze(rows.map((r) => r.receiptId));
}

export async function getById(receiptId: string): Promise<PSVReceiptSnapshot | null> {
  const row = await prisma.psvReceipt.findUnique({
    where: { receiptId },
  });
  if (!row) return null;
  return rowToSnapshot(row);
}
