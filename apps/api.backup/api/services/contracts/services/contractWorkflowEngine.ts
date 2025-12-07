/**
 * B251B-CON-012: ContractWorkflowEngine
 *
 * Defines valid status transitions (draft→under_review→active→terminated);
 * enforces business rules; triggers notifications; integrates with ContractService.
 */

import { PrismaClient, ContractStatus, ContractEventType } from '@prisma/client';
import { ContractNotificationService } from './contractNotificationService.js';
import { getServiceLogger } from '../../logging/serviceLogger.js';

const prisma = new PrismaClient();
const log = getServiceLogger('contracts/workflow');

// Valid status transitions
const VALID_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  [ContractStatus.DRAFT]: [ContractStatus.UNDER_REVIEW, ContractStatus.TERMINATED],
  [ContractStatus.UNDER_REVIEW]: [ContractStatus.ACTIVE, ContractStatus.DRAFT, ContractStatus.TERMINATED],
  [ContractStatus.ACTIVE]: [ContractStatus.TERMINATED, ContractStatus.EXPIRED],
  [ContractStatus.TERMINATED]: [], // Cannot transition from terminated
  [ContractStatus.EXPIRED]: [ContractStatus.TERMINATED], // Can only terminate expired contracts
};

export class ContractWorkflowEngine {
  private notificationService: ContractNotificationService;

  constructor() {
    this.notificationService = new ContractNotificationService();
  }

  /**
   * Validate and execute status transition
   */
  async transitionStatus(
    currentStatus: ContractStatus,
    newStatus: ContractStatus,
    contractId: string
  ): Promise<void> {
    log.info('Validating status transition', {
      contractId,
      currentStatus,
      newStatus,
    });

    // Check if transition is valid
    const validTransitions = VALID_TRANSITIONS[currentStatus];
    if (!validTransitions.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from ${currentStatus} to ${newStatus}. ` +
        `Valid transitions from ${currentStatus}: ${validTransitions.join(', ')}`
      );
    }

    // Enforce business rules
    await this.enforceBusinessRules(contractId, currentStatus, newStatus);

    log.info('Status transition validated', {
      contractId,
      currentStatus,
      newStatus,
    });
  }

  /**
   * Enforce business rules for status transitions
   */
  private async enforceBusinessRules(
    contractId: string,
    currentStatus: ContractStatus,
    newStatus: ContractStatus
  ): Promise<void> {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        parties: true,
        currentVersion: true,
      },
    });

    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    // Rule: Cannot publish (UNDER_REVIEW) without a version
    if (newStatus === ContractStatus.UNDER_REVIEW && !contract.currentVersion) {
      throw new Error('Cannot publish contract without a version');
    }

    // Rule: Cannot activate without parties
    if (newStatus === ContractStatus.ACTIVE && contract.parties.length === 0) {
      throw new Error('Cannot activate contract without parties');
    }

    // Rule: Cannot activate if not all required signers have signed
    if (newStatus === ContractStatus.ACTIVE) {
      const requiredSigners = contract.parties.filter(
        (p) => p.role === 'SIGNER'
      );
      const signedCount = requiredSigners.filter(
        (p) => p.signatureStatus === 'SIGNED'
      ).length;

      if (signedCount < requiredSigners.length) {
        throw new Error(
          `Cannot activate contract: ${signedCount}/${requiredSigners.length} required signers have signed`
        );
      }
    }

    // Rule: Cannot transition from ACTIVE if contract has pending change requests
    if (currentStatus === ContractStatus.ACTIVE && newStatus !== ContractStatus.TERMINATED) {
      const pendingRequests = await prisma.contractChangeRequest.count({
        where: {
          contractId,
          status: 'PENDING',
        },
      });

      if (pendingRequests > 0) {
        throw new Error(
          'Cannot change status: contract has pending change requests'
        );
      }
    }
  }

  /**
   * Trigger notifications for status change
   */
  async triggerNotifications(
    contractId: string,
    newStatus: ContractStatus
  ): Promise<void> {
    log.info('Triggering notifications for status change', {
      contractId,
      newStatus,
    });

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        parties: true,
      },
    });

    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    // Map status to notification event
    const eventMap: Record<ContractStatus, string> = {
      [ContractStatus.DRAFT]: 'contract.draft',
      [ContractStatus.UNDER_REVIEW]: 'contract.under_review',
      [ContractStatus.ACTIVE]: 'contract.activated',
      [ContractStatus.TERMINATED]: 'contract.terminated',
      [ContractStatus.EXPIRED]: 'contract.expired',
    };

    const eventType = eventMap[newStatus];
    if (!eventType) {
      log.warn('No notification event mapped for status', { newStatus });
      return;
    }

    // Notify all parties
    for (const party of contract.parties) {
      if (party.contactEmail) {
        await this.notificationService.sendNotification(
          party.contactEmail,
          eventType,
          {
            contractId,
            contractTitle: contract.title,
            status: newStatus,
            partyRole: party.role,
          }
        );
      }
    }

    // Notify contract author (admin)
    await this.notificationService.sendNotification(
      contract.authorId,
      eventType,
      {
        contractId,
        contractTitle: contract.title,
        status: newStatus,
      }
    );

    log.info('Notifications triggered', { contractId, newStatus });
  }

  /**
   * Get valid next statuses for a contract
   */
  getValidNextStatuses(currentStatus: ContractStatus): ContractStatus[] {
    return VALID_TRANSITIONS[currentStatus] || [];
  }

  /**
   * Check if a transition is valid
   */
  isValidTransition(
    currentStatus: ContractStatus,
    newStatus: ContractStatus
  ): boolean {
    const validTransitions = VALID_TRANSITIONS[currentStatus];
    return validTransitions.includes(newStatus);
  }
}

// Export singleton instance
export const contractWorkflowEngine = new ContractWorkflowEngine();

