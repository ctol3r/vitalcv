/**
 * B251B-CON-011: ContractService
 *
 * Manages contract lifecycle: createContract from template (fills variables),
 * updateContract metadata, publishContract (sets status to under_review),
 * activateContract (sets status to active), terminateContract;
 * logs events to ContractAuditLog.
 */

import { PrismaClient, ContractStatus, ContractEventType } from '@prisma/client';
import { ContractTemplateService } from './contractTemplateService.js';
import { ContractWorkflowEngine } from './contractWorkflowEngine.js';
import { ContractAuditLog } from '../audit/contractAuditLog.js';
import { getServiceLogger } from '../../logging/serviceLogger.js';

const prisma = new PrismaClient();
const log = getServiceLogger('contracts/service');

export interface CreateContractInput {
  templateId: string;
  title: string;
  slug: string;
  type: 'NDA' | 'SERVICE' | 'PARTNERSHIP' | 'EMPLOYMENT' | 'VENDOR' | 'OTHER';
  authorId: string;
  variables?: Record<string, string>; // Variables for template placeholders
  effectiveDate?: Date;
  expirationDate?: Date;
  metadata?: Record<string, any>;
}

export interface UpdateContractMetadataInput {
  title?: string;
  metadata?: Record<string, any>;
}

export class ContractService {
  private templateService: ContractTemplateService;
  private workflowEngine: ContractWorkflowEngine;
  private auditLog: ContractAuditLog;

  constructor() {
    this.templateService = new ContractTemplateService();
    this.workflowEngine = new ContractWorkflowEngine();
    this.auditLog = new ContractAuditLog(prisma);
  }

  /**
   * Create a contract from a template
   */
  async createContract(input: CreateContractInput): Promise<any> {
    log.info('Creating contract from template', {
      templateId: input.templateId,
      authorId: input.authorId,
    });

    // Get template
    const template = await this.templateService.getTemplate(input.templateId);
    if (!template) {
      throw new Error(`Template ${input.templateId} not found`);
    }

    // Generate contract content by replacing variables
    const content = await this.templateService.generateContent(
      input.templateId,
      input.variables || {}
    );

    // Create contract first
    const contract = await prisma.contract.create({
      data: {
        title: input.title,
        slug: input.slug,
        type: input.type,
        status: ContractStatus.DRAFT,
        authorId: input.authorId,
        effectiveDate: input.effectiveDate,
        expirationDate: input.expirationDate,
      },
    });

    // Create initial version with contractId
    const version = await prisma.contractVersion.create({
      data: {
        contractId: contract.id,
        versionNumber: 1,
        content,
        authorId: input.authorId,
        changeSummary: 'Initial version created from template',
      },
    });

    // Update contract with currentVersionId
    await prisma.contract.update({
      where: { id: contract.id },
      data: { currentVersionId: version.id },
    });

    // Log to audit log
    await this.auditLog.recordAction(
      contract.id,
      'contract_created',
      {
        templateId: input.templateId,
        title: input.title,
        type: input.type,
      },
      {
        actorId: input.authorId,
        actorType: 'user',
        newState: {
          status: ContractStatus.DRAFT,
          title: input.title,
          type: input.type,
        },
      }
    );

    log.info('Contract created', { contractId: contract.id });
    return contract;
  }

  /**
   * Update contract metadata
   */
  async updateContract(
    contractId: string,
    userId: string,
    updates: UpdateContractMetadataInput
  ): Promise<any> {
    log.info('Updating contract metadata', { contractId, userId });

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    // Get previous state for audit log
    const previousState = {
      title: contract.title,
      metadata: contract.metadata,
    };

    // Update contract
    const updated = await prisma.contract.update({
      where: { id: contractId },
      data: {
        ...(updates.title && { title: updates.title }),
        ...(updates.metadata && {
          metadata: {
            ...((contract.metadata as any) || {}),
            ...updates.metadata,
          },
        }),
      },
    });

    // Log to audit log
    await this.auditLog.recordAction(
      contractId,
      'contract_updated',
      {
        updates,
      },
      {
        actorId: userId,
        actorType: 'user',
        previousState,
        newState: {
          title: updated.title,
          metadata: updated.metadata,
        },
      }
    );

    log.info('Contract updated', { contractId });
    return updated;
  }

  /**
   * Publish contract (sets status to UNDER_REVIEW)
   */
  async publishContract(contractId: string, userId: string): Promise<any> {
    log.info('Publishing contract', { contractId, userId });

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    // Use workflow engine to validate transition
    await this.workflowEngine.transitionStatus(
      contract.status,
      ContractStatus.UNDER_REVIEW,
      contractId
    );

    // Update status
    const updated = await prisma.contract.update({
      where: { id: contractId },
      data: { status: ContractStatus.UNDER_REVIEW },
    });

    // Log to audit log
    await prisma.contractAuditLog.create({
      data: {
        contractId,
        eventType: ContractEventType.STATUS_CHANGED,
        userId,
        details: {
          previousStatus: contract.status,
          newStatus: ContractStatus.UNDER_REVIEW,
        },
      },
    });

    // Trigger notifications via workflow engine
    await this.workflowEngine.triggerNotifications(
      contractId,
      ContractStatus.UNDER_REVIEW
    );

    log.info('Contract published', { contractId });
    return updated;
  }

  /**
   * Activate contract (sets status to ACTIVE)
   */
  async activateContract(contractId: string, userId: string): Promise<any> {
    log.info('Activating contract', { contractId, userId });

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    // Use workflow engine to validate transition
    await this.workflowEngine.transitionStatus(
      contract.status,
      ContractStatus.ACTIVE,
      contractId
    );

    // Update status
    const updated = await prisma.contract.update({
      where: { id: contractId },
      data: { status: ContractStatus.ACTIVE },
    });

    // Log to audit log
    await prisma.contractAuditLog.create({
      data: {
        contractId,
        eventType: ContractEventType.STATUS_CHANGED,
        userId,
        details: {
          previousStatus: contract.status,
          newStatus: ContractStatus.ACTIVE,
        },
      },
    });

    // Trigger notifications via workflow engine
    await this.workflowEngine.triggerNotifications(
      contractId,
      ContractStatus.ACTIVE
    );

    log.info('Contract activated', { contractId });
    return updated;
  }

  /**
   * Terminate contract
   */
  async terminateContract(
    contractId: string,
    userId: string,
    reason?: string
  ): Promise<any> {
    log.info('Terminating contract', { contractId, userId, reason });

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    // Use workflow engine to validate transition
    await this.workflowEngine.transitionStatus(
      contract.status,
      ContractStatus.TERMINATED,
      contractId
    );

    // Update status
    const updated = await prisma.contract.update({
      where: { id: contractId },
      data: { status: ContractStatus.TERMINATED },
    });

    // Log to audit log
    await prisma.contractAuditLog.create({
      data: {
        contractId,
        eventType: ContractEventType.TERMINATED,
        userId,
        details: {
          previousStatus: contract.status,
          newStatus: ContractStatus.TERMINATED,
          reason,
        },
      },
    });

    // Trigger notifications via workflow engine
    await this.workflowEngine.triggerNotifications(
      contractId,
      ContractStatus.TERMINATED
    );

    log.info('Contract terminated', { contractId });
    return updated;
  }

  /**
   * Get contract by ID
   */
  async getContract(contractId: string): Promise<any> {
    return prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        currentVersion: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
        parties: true,
        changeRequests: true,
        auditLogs: {
          orderBy: { timestamp: 'desc' },
          take: 10,
        },
        schedules: true,
      },
    });
  }

  /**
   * List contracts with filters
   */
  async listContracts(options?: {
    status?: ContractStatus;
    type?: string;
    authorId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ contracts: any[]; total: number }> {
    const where: any = {};
    if (options?.status) where.status = options.status;
    if (options?.type) where.type = options.type;
    if (options?.authorId) where.authorId = options.authorId;

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        include: {
          currentVersion: true,
          parties: true,
        },
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      prisma.contract.count({ where }),
    ]);

    return { contracts, total };
  }
}

// Export singleton instance
export const contractService = new ContractService();

