/**
 * B231B-CON-008: ContractObligationTracker
 *
 * Tracks financial and data obligations (e.g., revenue share payments, data sharing limitations)
 * per contract; integrates with Ledger and Consent services.
 */

import { PrismaClient } from '@prisma/client';

export type ObligationType = 'financial' | 'data_sharing' | 'service_delivery' | 'compliance';

export type ObligationStatus = 'pending' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';

export interface FinancialObligation {
  type: 'revenue_share' | 'payment' | 'refund' | 'penalty';
  amount: number; // in cents
  currency: string;
  dueDate: Date;
  recipientOrgId: string;
  description: string;
  metadata?: Record<string, any>;
}

export interface DataSharingObligation {
  type: 'share' | 'restrict' | 'delete' | 'anonymize';
  dataTypes: string[];
  maxRecords?: number;
  retentionPeriod?: number; // in days
  allowedRecipients?: string[];
  restrictions?: string[];
  description: string;
  metadata?: Record<string, any>;
}

export interface Obligation {
  id: string;
  contractId: string;
  obligationType: ObligationType;
  status: ObligationStatus;
  financialObligation?: FinancialObligation;
  dataSharingObligation?: DataSharingObligation;
  dueDate: Date;
  completedAt?: Date;
  ledgerEntryId?: string; // Reference to VitaLedger entry
  consentRecordId?: string; // Reference to consent record
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ObligationSummary {
  contractId: string;
  totalFinancialObligations: number;
  pendingFinancialObligations: number;
  overdueFinancialObligations: number;
  totalDataObligations: number;
  pendingDataObligations: number;
  nextDueDate?: Date;
}

/**
 * ContractObligationTracker - Tracks contract obligations
 */
export class ContractObligationTracker {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a financial obligation
   */
  async createFinancialObligation(
    contractId: string,
    obligation: FinancialObligation
  ): Promise<Obligation> {
    const contract = await this.prisma.partnerContract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    // Create obligation record
    const obligationRecord = await this.prisma.$executeRaw`
      INSERT INTO "ContractObligation" (
        "id", "contractId", "obligationType", "status",
        "financialObligation", "dueDate", "metadata", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text,
        ${contractId},
        'financial',
        'pending',
        ${JSON.stringify(obligation)}::jsonb,
        ${obligation.dueDate},
        '{}'::jsonb,
        NOW(),
        NOW()
      )
      RETURNING *
    `;

    // Create ledger entry if this is a revenue share payment
    if (obligation.type === 'revenue_share') {
      const ledgerEntry = await this.createLedgerEntry(contractId, obligation);
      // Update obligation with ledger entry ID
      // Note: In production, you'd update the obligation record with the ledger entry ID
    }

    return this.mapToObligation(obligationRecord as any);
  }

  /**
   * Create a data sharing obligation
   */
  async createDataSharingObligation(
    contractId: string,
    obligation: DataSharingObligation
  ): Promise<Obligation> {
    const contract = await this.prisma.partnerContract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    // Create obligation record
    const obligationRecord = await this.prisma.$executeRaw`
      INSERT INTO "ContractObligation" (
        "id", "contractId", "obligationType", "status",
        "dataSharingObligation", "dueDate", "metadata", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text,
        ${contractId},
        'data_sharing',
        'pending',
        ${JSON.stringify(obligation)}::jsonb,
        ${obligation.retentionPeriod ? new Date(Date.now() + obligation.retentionPeriod * 24 * 60 * 60 * 1000) : new Date()},
        '{}'::jsonb,
        NOW(),
        NOW()
      )
      RETURNING *
    `;

    // Create consent record if needed
    if (obligation.type === 'share' || obligation.type === 'restrict') {
      const consentRecord = await this.createConsentRecord(contractId, obligation);
      // Update obligation with consent record ID
    }

    return this.mapToObligation(obligationRecord as any);
  }

  /**
   * Create ledger entry for financial obligation
   */
  private async createLedgerEntry(
    contractId: string,
    obligation: FinancialObligation
  ): Promise<string> {
    const contract = await this.prisma.partnerContract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    // Create VitaLedger entry
    const ledgerEntry = await this.prisma.vitaLedger.create({
      data: {
        orgId: contract.orgId,
        amount: obligation.amount,
        type: obligation.type === 'revenue_share' ? 'REVENUE_SHARE' : 'PAYMENT',
        reference: `contract_${contractId}_obligation`,
        metadata: {
          contractId,
          obligationType: obligation.type,
          recipientOrgId: obligation.recipientOrgId,
          description: obligation.description,
          dueDate: obligation.dueDate.toISOString(),
        },
      },
    });

    return ledgerEntry.id;
  }

  /**
   * Create consent record for data sharing obligation
   */
  private async createConsentRecord(
    contractId: string,
    obligation: DataSharingObligation
  ): Promise<string> {
    // In production, this would integrate with Consent service
    // For now, return a mock ID
    const consentId = `consent_${contractId}_${Date.now()}`;

    // TODO: Integrate with Consent service
    // const consentService = new ConsentService(this.prisma);
    // return await consentService.createConsentRecord({
    //   contractId,
    //   dataTypes: obligation.dataTypes,
    //   restrictions: obligation.restrictions,
    //   allowedRecipients: obligation.allowedRecipients,
    // });

    return consentId;
  }

  /**
   * Update obligation status
   */
  async updateObligationStatus(
    obligationId: string,
    status: ObligationStatus,
    completedAt?: Date
  ): Promise<Obligation> {
    const obligationRecord = await this.prisma.$executeRaw`
      UPDATE "ContractObligation"
      SET
        "status" = ${status},
        "completedAt" = ${completedAt || null},
        "updatedAt" = NOW()
      WHERE "id" = ${obligationId}
      RETURNING *
    `;

    return this.mapToObligation(obligationRecord as any);
  }

  /**
   * Get obligations for a contract
   */
  async getContractObligations(
    contractId: string,
    filters?: {
      obligationType?: ObligationType;
      status?: ObligationStatus;
      dueBefore?: Date;
    }
  ): Promise<Obligation[]> {
    // In production, this would query the ContractObligation table
    // For now, return empty array as the table doesn't exist yet
    // This is a placeholder that shows the expected interface

    const obligations: Obligation[] = [];

    // TODO: Implement actual database query once ContractObligation table is created
    // const records = await this.prisma.contractObligation.findMany({
    //   where: {
    //     contractId,
    //     ...(filters?.obligationType && { obligationType: filters.obligationType }),
    //     ...(filters?.status && { status: filters.status }),
    //     ...(filters?.dueBefore && { dueDate: { lte: filters.dueBefore } }),
    //   },
    //   orderBy: { dueDate: 'asc' },
    // });

    return obligations;
  }

  /**
   * Get obligation summary for a contract
   */
  async getObligationSummary(contractId: string): Promise<ObligationSummary> {
    const obligations = await this.getContractObligations(contractId);

    const financialObligations = obligations.filter(
      (o) => o.obligationType === 'financial'
    );
    const dataObligations = obligations.filter(
      (o) => o.obligationType === 'data_sharing'
    );

    const pendingFinancial = financialObligations.filter(
      (o) => o.status === 'pending' || o.status === 'in_progress'
    );
    const overdueFinancial = financialObligations.filter(
      (o) => o.status === 'overdue' || (o.status === 'pending' && o.dueDate < new Date())
    );

    const pendingData = dataObligations.filter(
      (o) => o.status === 'pending' || o.status === 'in_progress'
    );

    const nextDueDate = obligations
      .filter((o) => o.status === 'pending' || o.status === 'in_progress')
      .map((o) => o.dueDate)
      .sort((a, b) => a.getTime() - b.getTime())[0];

    return {
      contractId,
      totalFinancialObligations: financialObligations.length,
      pendingFinancialObligations: pendingFinancial.length,
      overdueFinancialObligations: overdueFinancial.length,
      totalDataObligations: dataObligations.length,
      pendingDataObligations: pendingData.length,
      nextDueDate,
    };
  }

  /**
   * Check for overdue obligations and update status
   */
  async checkOverdueObligations(): Promise<Obligation[]> {
    const now = new Date();
    const obligations = await this.getContractObligations(undefined, {
      status: 'pending',
      dueBefore: now,
    });

    const updated: Obligation[] = [];

    for (const obligation of obligations) {
      if (obligation.dueDate < now && obligation.status === 'pending') {
        const updatedObligation = await this.updateObligationStatus(
          obligation.id,
          'overdue'
        );
        updated.push(updatedObligation);
      }
    }

    return updated;
  }

  /**
   * Map database record to Obligation interface
   */
  private mapToObligation(record: any): Obligation {
    return {
      id: record.id,
      contractId: record.contractId,
      obligationType: record.obligationType,
      status: record.status,
      financialObligation: record.financialObligation
        ? JSON.parse(JSON.stringify(record.financialObligation))
        : undefined,
      dataSharingObligation: record.dataSharingObligation
        ? JSON.parse(JSON.stringify(record.dataSharingObligation))
        : undefined,
      dueDate: record.dueDate,
      completedAt: record.completedAt,
      ledgerEntryId: record.ledgerEntryId,
      consentRecordId: record.consentRecordId,
      metadata: record.metadata || {},
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Extract obligations from contract terms
   */
  async extractObligationsFromContract(contractId: string): Promise<Obligation[]> {
    const contract = await this.prisma.partnerContract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    const terms = (contract.terms || {}) as any;
    const obligations: Obligation[] = [];

    // Extract revenue share obligations
    if (terms.revenueShareId) {
      const revenueShare = await this.prisma.orgRevenueShare.findUnique({
        where: { id: terms.revenueShareId },
      });

      if (revenueShare && contract.effectiveDate) {
        // Create monthly revenue share obligation
        const obligation = await this.createFinancialObligation(contractId, {
          type: 'revenue_share',
          amount: 0, // Will be calculated based on actual revenue
          currency: 'USD',
          dueDate: new Date(contract.effectiveDate.getTime() + 30 * 24 * 60 * 60 * 1000),
          recipientOrgId: contract.counterpartyId,
          description: `Monthly revenue share payment`,
          metadata: {
            basisPoints: revenueShare.basisPoints,
            minGuarantee: revenueShare.minGuarantee,
            maxCap: revenueShare.maxCap,
          },
        });
        obligations.push(obligation);
      }
    }

    // Extract data sharing obligations
    if (terms.dataSharingLimits) {
      const dataObligation = await this.createDataSharingObligation(contractId, {
        type: 'restrict',
        dataTypes: terms.dataSharingLimits.allowedDataTypes || [],
        maxRecords: terms.dataSharingLimits.maxRecords,
        retentionPeriod: terms.dataSharingLimits.retentionPeriod,
        restrictions: terms.dataSharingLimits.restrictions || [],
        description: `Data sharing restrictions per contract terms`,
      });
      obligations.push(dataObligation);
    }

    return obligations;
  }
}

