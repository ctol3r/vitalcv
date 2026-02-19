import { PSVReceipt, type CreatePSVReceiptInput, type PSVReceiptSnapshot } from './PSVReceipt';

export type AppendReceiptInput = Readonly<{
  clinician_id: string;
  receipt: PSVReceipt | CreatePSVReceiptInput;
  lane?: 'PUBLIC' | 'PARTNER' | 'MANUAL';
  verification_check?: string;
  verification_outcome?: 'PASS' | 'FAIL';
  failure_reason?: string;
  source?: 'EMPLOYER' | 'CVO';
  attestor_id?: string;
  verification_request_id?: string;
}>;

export type TrustStateReceiptRecord = Readonly<{
  receipt_id: string;
  fetched_at: string;
  ttl_seconds: number;
  revoked: boolean;
  lane?: 'PUBLIC' | 'PARTNER' | 'MANUAL';
  verification_check?: string;
  verification_outcome?: 'PASS' | 'FAIL';
  failure_reason?: string;
  source?: 'EMPLOYER' | 'CVO';
  attestor_id?: string;
  verification_request_id?: string;
}>;

type ReceiptMetadata = Readonly<{
  lane?: 'PUBLIC' | 'PARTNER' | 'MANUAL';
  verification_check?: string;
  verification_outcome?: 'PASS' | 'FAIL';
  failure_reason?: string;
  source?: 'EMPLOYER' | 'CVO';
  attestor_id?: string;
  verification_request_id?: string;
}>;

function assertClinicianId(clinician_id: unknown): asserts clinician_id is string {
  if (typeof clinician_id !== 'string' || clinician_id.trim().length === 0) {
    throw new Error('clinician_id is required');
  }
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function toReceiptInstance(receipt: PSVReceipt | CreatePSVReceiptInput): PSVReceipt {
  if (receipt instanceof PSVReceipt) {
    return receipt;
  }

  return PSVReceipt.create(receipt);
}

export class PsvStore {
  private readonly receiptById = new Map<string, { clinician_id: string; receipt: PSVReceipt }>();
  private readonly receiptIdsByClinician = new Map<string, string[]>();
  private readonly metadataByReceiptId = new Map<string, ReceiptMetadata>();

  append(input: AppendReceiptInput): PSVReceipt {
    if (!input || typeof input !== 'object') {
      throw new Error('append input is required');
    }

    assertClinicianId(input.clinician_id);

    const receipt = toReceiptInstance(input.receipt);
    if (this.receiptById.has(receipt.receipt_id)) {
      throw new Error(`PSV receipt already exists: ${receipt.receipt_id}`);
    }

    this.receiptById.set(receipt.receipt_id, {
      clinician_id: input.clinician_id,
      receipt,
    });

    const lane =
      input.lane === 'PUBLIC' || input.lane === 'PARTNER' || input.lane === 'MANUAL'
        ? input.lane
        : undefined;
    const verification_check =
      typeof input.verification_check === 'string' && input.verification_check.trim().length > 0
        ? input.verification_check.trim()
        : undefined;
    const verification_outcome =
      input.verification_outcome === 'PASS' || input.verification_outcome === 'FAIL'
        ? input.verification_outcome
        : undefined;
    const failure_reason =
      typeof input.failure_reason === 'string' && input.failure_reason.trim().length > 0
        ? input.failure_reason.trim()
        : undefined;
    const source = input.source === 'EMPLOYER' || input.source === 'CVO' ? input.source : undefined;
    const attestor_id = normalizeOptionalString(input.attestor_id);
    const verification_request_id = normalizeOptionalString(input.verification_request_id);

    this.metadataByReceiptId.set(
      receipt.receipt_id,
      Object.freeze({
        ...(lane ? { lane } : {}),
        ...(verification_check ? { verification_check } : {}),
        ...(verification_outcome ? { verification_outcome } : {}),
        ...(failure_reason ? { failure_reason } : {}),
        ...(source ? { source } : {}),
        ...(attestor_id ? { attestor_id } : {}),
        ...(verification_request_id ? { verification_request_id } : {}),
      }),
    );

    const priorIds = this.receiptIdsByClinician.get(input.clinician_id) ?? [];
    this.receiptIdsByClinician.set(input.clinician_id, [...priorIds, receipt.receipt_id]);

    return receipt;
  }

  getById(receipt_id: string): PSVReceipt | null {
    const record = this.receiptById.get(receipt_id);
    return record?.receipt ?? null;
  }

  listByIds(receipt_ids: readonly string[]): readonly PSVReceipt[] {
    if (!Array.isArray(receipt_ids) || receipt_ids.length === 0) {
      return Object.freeze([]);
    }

    const receipts: PSVReceipt[] = [];

    for (const receipt_id of receipt_ids) {
      const record = this.receiptById.get(receipt_id);
      if (!record) {
        throw new Error(`Missing PSV receipt: ${receipt_id}`);
      }
      receipts.push(record.receipt);
    }

    return Object.freeze(receipts);
  }

  listSnapshotsByClinician(clinician_id: string): readonly PSVReceiptSnapshot[] {
    assertClinicianId(clinician_id);

    const ids = this.receiptIdsByClinician.get(clinician_id) ?? [];
    const snapshots = ids
      .map((id) => this.receiptById.get(id)?.receipt)
      .filter((receipt): receipt is PSVReceipt => Boolean(receipt))
      .map((receipt) => receipt.toJSON());

    return Object.freeze(snapshots);
  }

  listByClinician(clinician_id: string): readonly TrustStateReceiptRecord[] {
    const snapshots = this.listSnapshotsByClinician(clinician_id);

    return Object.freeze(
      snapshots.map((receipt) =>
        Object.freeze({
          receipt_id: receipt.receipt_id,
          fetched_at: receipt.fetched_at,
          ttl_seconds: receipt.ttl_seconds,
          revoked: receipt.revoked,
          ...(this.metadataByReceiptId.get(receipt.receipt_id) ?? {}),
        }),
      ),
    );
  }

  listReceiptIdsByClinician(clinician_id: string): readonly string[] {
    assertClinicianId(clinician_id);
    return Object.freeze([...(this.receiptIdsByClinician.get(clinician_id) ?? [])]);
  }
}
