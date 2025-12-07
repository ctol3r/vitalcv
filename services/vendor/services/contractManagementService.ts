/**
 * B240A-VM-006: ContractManagementService
 *
 * Handles vendor contract lifecycle: template selection, draft generation,
 * signature tracking, renewal alerts; integrates with Marketplace and billing
 * modules; tested scenarios
 */

import { PrismaClient, ContractStatus } from '@prisma/client';
import {
  getContractLibrary,
  listContractLibraries,
  ContractLibraryInput,
} from '../models/ContractLibrary.js';
import { getVendor } from '../models/Vendor.js';

export interface ContractDraftInput {
  vendorId: string;
  templateId?: string;
  customContent?: string;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface ContractRenewalAlert {
  contractId: string;
  vendorId: string;
  vendorName: string;
  expiresAt: Date;
  daysUntilExpiry: number;
  alertSent: boolean;
}

export class ContractManagementService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Select appropriate contract template based on vendor category and jurisdiction
   */
  async selectContractTemplate(
    vendorId: string,
    jurisdiction?: string
  ): Promise<string | null> {
    const vendor = await getVendor(this.prisma, vendorId);
    if (!vendor) {
      throw new Error(`Vendor with id ${vendorId} not found`);
    }

    // Get vendor category to determine template requirements
    const category = await this.prisma.vendorCategory.findUnique({
      where: { id: vendor.categoryId },
    });

    // Find appropriate template
    const templates = await listContractLibraries(this.prisma, {
      jurisdiction: jurisdiction || undefined,
      activeOnly: true,
    });

    // Try to find template matching category name or use first available
    let template = templates.find((t) =>
      t.name.toLowerCase().includes(category?.name.toLowerCase() || '')
    );

    if (!template && templates.length > 0) {
      template = templates[0]; // Use first available template
    }

    return template?.id || null;
  }

  /**
   * Generate contract draft from template
   */
  async generateContractDraft(
    input: ContractDraftInput
  ): Promise<{ id: string; content: string; status: ContractStatus }> {
    const vendor = await getVendor(this.prisma, input.vendorId);
    if (!vendor) {
      throw new Error(`Vendor with id ${input.vendorId} not found`);
    }

    let templateId = input.templateId;
    let templateContent: string | null = null;

    // Select template if not provided
    if (!templateId) {
      templateId = await this.selectContractTemplate(input.vendorId);
    }

    // Get template content
    if (templateId) {
      const template = await getContractLibrary(this.prisma, templateId);
      if (template) {
        templateContent = template.content;
      }
    }

    // Use custom content if provided, otherwise use template
    const finalContent = input.customContent || templateContent || '';

    if (!finalContent) {
      throw new Error('No template or custom content provided');
    }

    // Create contract draft
    const contract = await this.prisma.vendorContract.create({
      data: {
        vendorId: input.vendorId,
        templateId: templateId || null,
        status: ContractStatus.DRAFT,
        expiresAt: input.expiresAt || null,
        metadata: input.metadata || {},
      },
    });

    return {
      id: contract.id,
      content: finalContent,
      status: contract.status,
    };
  }

  /**
   * Update contract status (e.g., move from DRAFT to PENDING_SIGNATURE)
   */
  async updateContractStatus(
    contractId: string,
    status: ContractStatus,
    signedAt?: Date
  ): Promise<void> {
    await this.prisma.vendorContract.update({
      where: { id: contractId },
      data: {
        status,
        ...(signedAt && { signedAt }),
      },
    });
  }

  /**
   * Track contract signature
   */
  async trackContractSignature(
    contractId: string,
    signedAt: Date = new Date()
  ): Promise<void> {
    await this.updateContractStatus(
      contractId,
      ContractStatus.SIGNED,
      signedAt
    );
  }

  /**
   * Get contracts expiring soon (for renewal alerts)
   */
  async getContractsExpiringSoon(
    daysAhead: number = 90
  ): Promise<ContractRenewalAlert[]> {
    const now = new Date();
    const alertDate = new Date(now);
    alertDate.setDate(alertDate.getDate() + daysAhead);

    const contracts = await this.prisma.vendorContract.findMany({
      where: {
        status: ContractStatus.SIGNED,
        expiresAt: {
          gte: now,
          lte: alertDate,
        },
        renewalAlertAt: null, // Not yet alerted
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return contracts.map((contract) => {
      const daysUntilExpiry = Math.ceil(
        (contract.expiresAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        contractId: contract.id,
        vendorId: contract.vendorId,
        vendorName: contract.vendor.name,
        expiresAt: contract.expiresAt!,
        daysUntilExpiry,
        alertSent: false,
      };
    });
  }

  /**
   * Set renewal alert date
   */
  async setRenewalAlert(
    contractId: string,
    alertDate: Date
  ): Promise<void> {
    await this.prisma.vendorContract.update({
      where: { id: contractId },
      data: {
        renewalAlertAt: alertDate,
      },
    });
  }

  /**
   * Mark renewal alert as sent
   */
  async markRenewalAlertSent(contractId: string): Promise<void> {
    const contract = await this.prisma.vendorContract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new Error(`Contract with id ${contractId} not found`);
    }

    // Update metadata to track alert sent
    const metadata = (contract.metadata as Record<string, any>) || {};
    metadata.renewalAlertSent = true;
    metadata.renewalAlertSentAt = new Date().toISOString();

    await this.prisma.vendorContract.update({
      where: { id: contractId },
      data: {
        metadata,
      },
    });
  }

  /**
   * Get contract by ID with related data
   */
  async getContractWithRelations(contractId: string) {
    return this.prisma.vendorContract.findUnique({
      where: { id: contractId },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        template: true,
      },
    });
  }

  /**
   * List contracts for a vendor
   */
  async listVendorContracts(
    vendorId: string,
    filters?: {
      status?: ContractStatus;
      activeOnly?: boolean;
    }
  ) {
    const now = new Date();
    return this.prisma.vendorContract.findMany({
      where: {
        vendorId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.activeOnly && {
          status: ContractStatus.SIGNED,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            version: true,
          },
        },
      },
    });
  }

  /**
   * Renew contract (create new contract from existing)
   */
  async renewContract(
    contractId: string,
    newExpiresAt: Date
  ): Promise<{ id: string }> {
    const existing = await this.prisma.vendorContract.findUnique({
      where: { id: contractId },
      include: {
        template: true,
      },
    });

    if (!existing) {
      throw new Error(`Contract with id ${contractId} not found`);
    }

    // Create new contract based on existing
    const newContract = await this.prisma.vendorContract.create({
      data: {
        vendorId: existing.vendorId,
        templateId: existing.templateId,
        status: ContractStatus.DRAFT,
        expiresAt: newExpiresAt,
        metadata: {
          ...((existing.metadata as Record<string, any>) || {}),
          renewedFrom: contractId,
          renewedAt: new Date().toISOString(),
        },
      },
    });

    // Mark old contract as terminated
    await this.updateContractStatus(contractId, ContractStatus.TERMINATED);

    return { id: newContract.id };
  }

  /**
   * Integrate with Marketplace module
   * This would be called when a marketplace purchase requires a contract
   */
  async createContractFromMarketplacePurchase(
    vendorId: string,
    purchaseId: string,
    purchaseMetadata: Record<string, any>
  ): Promise<{ id: string }> {
    // Select appropriate template
    const templateId = await this.selectContractTemplate(vendorId);

    // Generate draft
    const draft = await this.generateContractDraft({
      vendorId,
      templateId: templateId || undefined,
      metadata: {
        ...purchaseMetadata,
        marketplacePurchaseId: purchaseId,
        source: 'marketplace',
      },
    });

    return { id: draft.id };
  }

  /**
   * Integrate with Billing module
   * This would be called to track contract-related billing events
   */
  async linkContractToBilling(
    contractId: string,
    billingEventId: string
  ): Promise<void> {
    const contract = await this.prisma.vendorContract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new Error(`Contract with id ${contractId} not found`);
    }

    const metadata = (contract.metadata as Record<string, any>) || {};
    metadata.billingEventId = billingEventId;
    metadata.billingLinkedAt = new Date().toISOString();

    await this.prisma.vendorContract.update({
      where: { id: contractId },
      data: {
        metadata,
      },
    });
  }
}

