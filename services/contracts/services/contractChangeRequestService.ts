/**
 * B251B-CON-016: ContractChangeRequestService
 *
 * Handles change requests: createChangeRequest(contractId, requestedBy, summary),
 * approveChangeRequest, rejectChangeRequest;
 * updates ContractVersion and ContractAuditLog accordingly.
 */

import { PrismaClient, ChangeRequestStatus, ContractEventType } from '@prisma/client';
import { ContractService } from './contractService.js';
import { getServiceLogger } from '../../logging/serviceLogger.js';

const prisma = new PrismaClient();
const log = getServiceLogger('contracts/change-request');

export interface CreateChangeRequestInput {
  contractId: string;
  requestedBy: string;
  changeSummary: string;
  proposedChanges?: Record<string, any>;
}

export interface ApproveChangeRequestInput {
  changeRequestId: string;
  approvedBy: string;
  newVersionContent?: string;
  changeSummary?: string;
}

export class ContractChangeRequestService {
  private contractService: ContractService;

  constructor() {
    this.contractService = new ContractService();
  }

  /**
   * Create a change request
   */
  async createChangeRequest(
    input: CreateChangeRequestInput
  ): Promise<any> {
    log.info('Creating change request', {
      contractId: input.contractId,
      requestedBy: input.requestedBy,
    });

    // Verify contract exists
    const contract = await prisma.contract.findUnique({
      where: { id: input.contractId },
    });

    if (!contract) {
      throw new Error(`Contract ${input.contractId} not found`);
    }

    // Create change request
    const changeRequest = await prisma.contractChangeRequest.create({
      data: {
        contractId: input.contractId,
        requestedBy: input.requestedBy,
        changeSummary: input.changeSummary,
        status: ChangeRequestStatus.PENDING,
      },
    });

    // Log to audit log
    await prisma.contractAuditLog.create({
      data: {
        contractId: input.contractId,
        eventType: ContractEventType.REVISED,
        userId: input.requestedBy,
        details: {
          changeRequestId: changeRequest.id,
          changeSummary: input.changeSummary,
          proposedChanges: input.proposedChanges,
        },
      },
    });

    log.info('Change request created', {
      changeRequestId: changeRequest.id,
      contractId: input.contractId,
    });

    return changeRequest;
  }

  /**
   * Approve a change request
   */
  async approveChangeRequest(
    input: ApproveChangeRequestInput
  ): Promise<any> {
    log.info('Approving change request', {
      changeRequestId: input.changeRequestId,
      approvedBy: input.approvedBy,
    });

    const changeRequest = await prisma.contractChangeRequest.findUnique({
      where: { id: input.changeRequestId },
      include: { contract: true },
    });

    if (!changeRequest) {
      throw new Error(`Change request ${input.changeRequestId} not found`);
    }

    if (changeRequest.status !== ChangeRequestStatus.PENDING) {
      throw new Error(
        `Cannot approve change request with status ${changeRequest.status}`
      );
    }

    // Get current version number
    const currentVersion = await prisma.contractVersion.findFirst({
      where: { contractId: changeRequest.contractId },
      orderBy: { versionNumber: 'desc' },
    });

    const nextVersionNumber = currentVersion
      ? currentVersion.versionNumber + 1
      : 1;

    // Create new version if content provided
    let newVersionId: string | undefined;
    if (input.newVersionContent) {
      const newVersion = await prisma.contractVersion.create({
        data: {
          contractId: changeRequest.contractId,
          versionNumber: nextVersionNumber,
          content: input.newVersionContent,
          authorId: input.approvedBy,
          changeSummary: input.changeSummary || changeRequest.changeSummary,
        },
      });

      newVersionId = newVersion.id;

      // Update contract's current version
      await prisma.contract.update({
        where: { id: changeRequest.contractId },
        data: { currentVersionId: newVersion.id },
      });
    }

    // Update change request status
    const updated = await prisma.contractChangeRequest.update({
      where: { id: input.changeRequestId },
      data: {
        status: ChangeRequestStatus.APPROVED,
        decisionBy: input.approvedBy,
        decisionAt: new Date(),
      },
    });

    // Log to audit log
    await prisma.contractAuditLog.create({
      data: {
        contractId: changeRequest.contractId,
        eventType: ContractEventType.REVISED,
        userId: input.approvedBy,
        details: {
          changeRequestId: input.changeRequestId,
          action: 'approved',
          newVersionId,
          newVersionNumber,
        },
      },
    });

    log.info('Change request approved', {
      changeRequestId: input.changeRequestId,
      contractId: changeRequest.contractId,
    });

    return updated;
  }

  /**
   * Reject a change request
   */
  async rejectChangeRequest(
    changeRequestId: string,
    rejectedBy: string,
    reason?: string
  ): Promise<any> {
    log.info('Rejecting change request', {
      changeRequestId,
      rejectedBy,
      reason,
    });

    const changeRequest = await prisma.contractChangeRequest.findUnique({
      where: { id: changeRequestId },
    });

    if (!changeRequest) {
      throw new Error(`Change request ${changeRequestId} not found`);
    }

    if (changeRequest.status !== ChangeRequestStatus.PENDING) {
      throw new Error(
        `Cannot reject change request with status ${changeRequest.status}`
      );
    }

    // Update change request status
    const updated = await prisma.contractChangeRequest.update({
      where: { id: changeRequestId },
      data: {
        status: ChangeRequestStatus.REJECTED,
        decisionBy: rejectedBy,
        decisionAt: new Date(),
      },
    });

    // Log to audit log
    await prisma.contractAuditLog.create({
      data: {
        contractId: changeRequest.contractId,
        eventType: ContractEventType.REVISED,
        userId: rejectedBy,
        details: {
          changeRequestId,
          action: 'rejected',
          reason,
        },
      },
    });

    log.info('Change request rejected', {
      changeRequestId,
      contractId: changeRequest.contractId,
    });

    return updated;
  }

  /**
   * Get change request by ID
   */
  async getChangeRequest(changeRequestId: string): Promise<any> {
    return prisma.contractChangeRequest.findUnique({
      where: { id: changeRequestId },
      include: {
        contract: {
          include: {
            currentVersion: true,
          },
        },
      },
    });
  }

  /**
   * List change requests for a contract
   */
  async listChangeRequests(contractId: string): Promise<any[]> {
    return prisma.contractChangeRequest.findMany({
      where: { contractId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get pending change requests for a contract
   */
  async getPendingChangeRequests(contractId: string): Promise<any[]> {
    return prisma.contractChangeRequest.findMany({
      where: {
        contractId,
        status: ChangeRequestStatus.PENDING,
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}

// Export singleton instance
export const contractChangeRequestService = new ContractChangeRequestService();

