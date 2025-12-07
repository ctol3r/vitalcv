/**
 * B225A-FIN-001: LedgerEntry model
 *
 * Represents a ledger entry in the double-entry accounting system.
 * Each entry tracks credits and debits with full audit trail.
 */

import { PrismaClient } from '@prisma/client';

export interface LedgerEntryData {
  id?: string;
  orgId?: string | null;
  amount: number;
  currency?: string;
  type: 'credit' | 'debit';
  referenceId?: string | null;
  relatedEventId?: string | null;
  metadata?: Record<string, any> | null;
  createdAt?: Date;
}

export class LedgerEntry {
  constructor(
    private prisma: PrismaClient,
    public readonly id: string,
    public readonly orgId: string | null,
    public readonly amount: number,
    public readonly currency: string,
    public readonly type: 'credit' | 'debit',
    public readonly referenceId: string | null,
    public readonly relatedEventId: string | null,
    public readonly metadata: Record<string, any> | null,
    public readonly createdAt: Date
  ) {}

  /**
   * Create a new ledger entry
   */
  static async create(
    prisma: PrismaClient,
    data: LedgerEntryData
  ): Promise<LedgerEntry> {
    const entry = await prisma.ledgerEntry.create({
      data: {
        orgId: data.orgId ?? null,
        amount: data.amount,
        currency: data.currency ?? 'USD',
        type: data.type,
        referenceId: data.referenceId ?? null,
        relatedEventId: data.relatedEventId ?? null,
        metadata: data.metadata ?? null,
      },
    });

    return new LedgerEntry(
      prisma,
      entry.id,
      entry.orgId,
      entry.amount,
      entry.currency,
      entry.type as 'credit' | 'debit',
      entry.referenceId,
      entry.relatedEventId,
      entry.metadata as Record<string, any> | null,
      entry.createdAt
    );
  }

  /**
   * Find ledger entry by ID
   */
  static async findById(
    prisma: PrismaClient,
    id: string
  ): Promise<LedgerEntry | null> {
    const entry = await prisma.ledgerEntry.findUnique({
      where: { id },
    });

    if (!entry) return null;

    return new LedgerEntry(
      prisma,
      entry.id,
      entry.orgId,
      entry.amount,
      entry.currency,
      entry.type as 'credit' | 'debit',
      entry.referenceId,
      entry.relatedEventId,
      entry.metadata as Record<string, any> | null,
      entry.createdAt
    );
  }

  /**
   * Find ledger entries by organization ID
   */
  static async findByOrgId(
    prisma: PrismaClient,
    orgId: string,
    options?: {
      type?: 'credit' | 'debit';
      currency?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<LedgerEntry[]> {
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        orgId,
        ...(options?.type && { type: options.type }),
        ...(options?.currency && { currency: options.currency }),
      },
      take: options?.limit,
      skip: options?.offset,
      orderBy: { createdAt: 'desc' },
    });

    return entries.map(
      (entry) =>
        new LedgerEntry(
          prisma,
          entry.id,
          entry.orgId,
          entry.amount,
          entry.currency,
          entry.type as 'credit' | 'debit',
          entry.referenceId,
          entry.relatedEventId,
          entry.metadata as Record<string, any> | null,
          entry.createdAt
        )
    );
  }

  /**
   * Find ledger entries by reference ID
   */
  static async findByReferenceId(
    prisma: PrismaClient,
    referenceId: string
  ): Promise<LedgerEntry[]> {
    const entries = await prisma.ledgerEntry.findMany({
      where: { referenceId },
      orderBy: { createdAt: 'desc' },
    });

    return entries.map(
      (entry) =>
        new LedgerEntry(
          prisma,
          entry.id,
          entry.orgId,
          entry.amount,
          entry.currency,
          entry.type as 'credit' | 'debit',
          entry.referenceId,
          entry.relatedEventId,
          entry.metadata as Record<string, any> | null,
          entry.createdAt
        )
    );
  }

  /**
   * Get balance for an organization
   */
  static async getBalance(
    prisma: PrismaClient,
    orgId: string,
    currency: string = 'USD'
  ): Promise<number> {
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        orgId,
        currency,
      },
    });

    return entries.reduce((balance, entry) => {
      if (entry.type === 'credit') {
        return balance + entry.amount;
      } else {
        return balance - entry.amount;
      }
    }, 0);
  }

  /**
   * Convert to plain object
   */
  toJSON(): LedgerEntryData {
    return {
      id: this.id,
      orgId: this.orgId,
      amount: this.amount,
      currency: this.currency,
      type: this.type,
      referenceId: this.referenceId,
      relatedEventId: this.relatedEventId,
      metadata: this.metadata,
      createdAt: this.createdAt,
    };
  }
}

