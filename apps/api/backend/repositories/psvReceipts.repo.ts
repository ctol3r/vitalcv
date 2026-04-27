// BACKEND-1 boundary note (2026-04-26):
//
// This repository does not yet persist the full issuer PSVReceipt
// contract.
//
// The rows written here are the LEGACY `PSVReceiptSnapshot` shape
// (receipt_id / source_authority / access_or_license_id /
// transaction_id / fetched_at / response_hash / ttl_seconds /
// revoked, plus optional lane / verification_check /
// verification_outcome / failure_reason / source / attestor_id /
// verification_request_id). They do NOT carry the issuer
// trust-contract fields:
//   - limitations[] (ISSUER-2/4)
//   - sourceBasis with contracted-agent vs source distinction (ISSUER-2)
//   - attributedResponder with attributionMethod (ISSUER-2)
//   - scope (covers / doesNotCover / sourceOrganizationName) (ISSUER-4)
//   - freshness (ttlDays / issuedAt / staleAfter) (ISSUER-4)
//   - candidate-vs-receipt distinction (ISSUER-3/4)
//   - writerConfirmation as the persistence gate (ISSUER-7/8)
//
// Persistence here MUST NOT be interpreted as a persisted issuer
// PSVReceipt under the truth contract — see
// docs/architecture/vitalcv-backend-persistence-defer-decision.md and
// packages/domain-core/psvReceiptMapping.ts (mapLegacySnapshotToDomainReceipt
// always emits a `legacy_snapshot_only` contract gap).
//
// A future wave is required to (a) add a contract-aligned schema, and
// (b) add a server-only writer that confirms each row before reporting
// persisted status. This file remains untouched in BACKEND-1 except
// for this header.

import {
  PSVReceipt,
  type AppendReceiptInput,
  type PSVReceiptSnapshot,
  type SourceAuthority,
  type TrustStateReceiptRecord,
} from '@vitalcv/psv';
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
