import { Prisma } from '@prisma/client';
import prisma from '../src/graphql/prisma_client';
import type {
  AuditReceipt,
  ReceiptType,
} from '../src/services/audit/receiptGenerator';

export interface AuditReceiptsRepository {
  saveReceipt(receipt: AuditReceipt): Promise<AuditReceipt>;
  getReceipt(receiptId: string): Promise<AuditReceipt | null>;
  listReceipts(type?: ReceiptType): Promise<AuditReceipt[]>;
  receiptStats(): Promise<Record<ReceiptType, number>>;
}

type AuditReceiptRow = {
  receiptId: string;
  type: string;
  status: string;
  issuedAt: Date;
  hash: string;
  payload: Prisma.JsonValue;
  summary: string;
  actor: string;
  subject: string;
};

function toDomainReceipt(row: AuditReceiptRow): AuditReceipt {
  if (typeof row.payload !== 'object' || row.payload === null || Array.isArray(row.payload)) {
    throw new Error(`Audit receipt ${row.receiptId} payload is malformed.`);
  }

  return {
    receiptId: row.receiptId,
    type: row.type as AuditReceipt['type'],
    status: row.status as AuditReceipt['status'],
    issuedAt: row.issuedAt.toISOString(),
    hash: row.hash,
    payload: row.payload as unknown as AuditReceipt['payload'],
    summary: row.summary,
    actor: row.actor,
    subject: row.subject,
  };
}

function sortReceipts(receipts: readonly AuditReceipt[]): AuditReceipt[] {
  return [...receipts].sort(
    (left, right) => new Date(right.issuedAt).getTime() - new Date(left.issuedAt).getTime(),
  );
}

export class PrismaAuditReceiptsRepository implements AuditReceiptsRepository {
  async saveReceipt(receipt: AuditReceipt): Promise<AuditReceipt> {
    const row = await prisma.auditReceiptRecord.upsert({
      where: { receiptId: receipt.receiptId },
      update: {
        type: receipt.type,
        status: receipt.status,
        issuedAt: new Date(receipt.issuedAt),
        hash: receipt.hash,
        payload: receipt.payload as unknown as Prisma.InputJsonValue,
        summary: receipt.summary,
        actor: receipt.actor,
        subject: receipt.subject,
      },
      create: {
        receiptId: receipt.receiptId,
        type: receipt.type,
        status: receipt.status,
        issuedAt: new Date(receipt.issuedAt),
        hash: receipt.hash,
        payload: receipt.payload as unknown as Prisma.InputJsonValue,
        summary: receipt.summary,
        actor: receipt.actor,
        subject: receipt.subject,
      },
    });

    return toDomainReceipt(row);
  }

  async getReceipt(receiptId: string): Promise<AuditReceipt | null> {
    const row = await prisma.auditReceiptRecord.findUnique({
      where: { receiptId },
    });
    return row ? toDomainReceipt(row) : null;
  }

  async listReceipts(type?: ReceiptType): Promise<AuditReceipt[]> {
    const rows = await prisma.auditReceiptRecord.findMany({
      where: type ? { type } : undefined,
      orderBy: { issuedAt: 'desc' },
    });
    return sortReceipts(rows.map((row) => toDomainReceipt(row)));
  }

  async receiptStats(): Promise<Record<ReceiptType, number>> {
    const [issuance, presentation, verification] = await Promise.all([
      prisma.auditReceiptRecord.count({ where: { type: 'ISSUANCE' } }),
      prisma.auditReceiptRecord.count({ where: { type: 'PRESENTATION' } }),
      prisma.auditReceiptRecord.count({ where: { type: 'VERIFICATION' } }),
    ]);

    return {
      ISSUANCE: issuance,
      PRESENTATION: presentation,
      VERIFICATION: verification,
    };
  }
}

export class InMemoryAuditReceiptsRepository implements AuditReceiptsRepository {
  private readonly receipts = new Map<string, AuditReceipt>();

  constructor(initialReceipts: readonly AuditReceipt[] = []) {
    for (const receipt of initialReceipts) {
      this.receipts.set(receipt.receiptId, structuredClone(receipt));
    }
  }

  async saveReceipt(receipt: AuditReceipt): Promise<AuditReceipt> {
    const stored = structuredClone(receipt);
    this.receipts.set(receipt.receiptId, stored);
    return structuredClone(stored);
  }

  async getReceipt(receiptId: string): Promise<AuditReceipt | null> {
    const receipt = this.receipts.get(receiptId);
    return receipt ? structuredClone(receipt) : null;
  }

  async listReceipts(type?: ReceiptType): Promise<AuditReceipt[]> {
    const all = Array.from(this.receipts.values())
      .filter((receipt) => !type || receipt.type === type)
      .map((receipt) => structuredClone(receipt));
    return sortReceipts(all);
  }

  async receiptStats(): Promise<Record<ReceiptType, number>> {
    const receipts = Array.from(this.receipts.values());
    return {
      ISSUANCE: receipts.filter((receipt) => receipt.type === 'ISSUANCE').length,
      PRESENTATION: receipts.filter((receipt) => receipt.type === 'PRESENTATION').length,
      VERIFICATION: receipts.filter((receipt) => receipt.type === 'VERIFICATION').length,
    };
  }
}
