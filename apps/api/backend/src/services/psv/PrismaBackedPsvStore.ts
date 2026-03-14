import prisma from '../../graphql/prisma_client';
import { sha256Hex } from '../../utils/deterministic';
import {
  PSVReceipt,
  type AppendReceiptInput,
  type CreatePSVReceiptInput,
  type TrustStateReceiptRecord,
} from '../../../../../../packages/psv';

export type PsvReceiptRow = Readonly<{
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
}>;

function assertClinicianId(clinician_id: unknown): asserts clinician_id is string {
  if (typeof clinician_id !== 'string' || clinician_id.trim().length === 0) {
    throw new Error('clinician_id is required');
  }
}

function toReceiptInstance(receipt: AppendReceiptInput['receipt']): PSVReceipt {
  if (receipt instanceof PSVReceipt) {
    return receipt;
  }

  return PSVReceipt.create(receipt as CreatePSVReceiptInput);
}

function deriveSourceAuthority(receipt: PSVReceipt): string {
  switch (receipt.source_authority) {
    case 'NPI':
      return 'NPPES';
    case 'LEIE':
      return 'OIG_LEIE';
    default:
      return receipt.source_authority;
  }
}

function isDuplicateReceiptError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

export class PrismaBackedPsvStore {
  static mapRowToReceiptRecord(row: PsvReceiptRow): TrustStateReceiptRecord {
    return Object.freeze({
      receipt_id: row.receiptId,
      fetched_at: row.fetchedAt.toISOString(),
      ttl_seconds: row.ttlSeconds,
      revoked: row.revoked,
      ...(row.lane ? { lane: row.lane as TrustStateReceiptRecord['lane'] } : {}),
      ...(row.verificationCheck ? { verification_check: row.verificationCheck } : {}),
      ...(row.verificationOutcome
        ? {
            verification_outcome:
              row.verificationOutcome as TrustStateReceiptRecord['verification_outcome'],
          }
        : {}),
      ...(row.failureReason ? { failure_reason: row.failureReason } : {}),
      ...(row.source ? { source: row.source as TrustStateReceiptRecord['source'] } : {}),
      ...(row.attestorId ? { attestor_id: row.attestorId } : {}),
      ...(row.verificationRequestId
        ? { verification_request_id: row.verificationRequestId }
        : {}),
    });
  }

  async appendReceipt(input: AppendReceiptInput): Promise<PSVReceipt> {
    if (!input || typeof input !== 'object') {
      throw new Error('append input is required');
    }

    assertClinicianId(input.clinician_id);

    const receipt = toReceiptInstance(input.receipt);
    const receiptSnapshot = receipt.toJSON();

    try {
      await prisma.psvReceipt.create({
        data: {
          receiptId: receipt.receipt_id,
          clinicianId: input.clinician_id,
          sourceAuthority: deriveSourceAuthority(receipt),
          licenseId: receipt.receipt_id,
          transactionId: receipt.receipt_id,
          fetchedAt: new Date(receipt.fetched_at),
          responseHash:
            receiptSnapshot.response_hash || sha256Hex(`psv-receipt:${receipt.receipt_id}`),
          ttlSeconds: receipt.ttl_seconds,
          revoked: receipt.revoked ?? false,
          lane: input.lane ?? 'PUBLIC',
          verificationCheck: input.verification_check ?? null,
          verificationOutcome: input.verification_outcome ?? null,
          failureReason: input.failure_reason ?? null,
          source: input.source ?? null,
          attestorId: input.attestor_id ?? null,
          verificationRequestId: input.verification_request_id ?? null,
        },
      });
    } catch (error) {
      if (isDuplicateReceiptError(error)) {
        return receipt;
      }
      throw error;
    }

    return receipt;
  }

  async append(input: AppendReceiptInput): Promise<PSVReceipt> {
    return this.appendReceipt(input);
  }

  async listByClinician(clinician_id: string): Promise<TrustStateReceiptRecord[]> {
    assertClinicianId(clinician_id);

    const rows = await prisma.psvReceipt.findMany({
      where: { clinicianId: clinician_id },
      orderBy: { fetchedAt: 'desc' },
    });

    return rows.map((row) => PrismaBackedPsvStore.mapRowToReceiptRecord(row as PsvReceiptRow));
  }
}
