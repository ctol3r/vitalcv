/**
 * B251B-CON-014: ContractPartyService
 *
 * Invites parties to sign: add/remove parties, assign roles (signer/witness/observer),
 * update signatureStatus, track signedAt; checks for duplicate invites.
 */

import { PrismaClient, ContractPartyRole, SignatureStatus } from '@prisma/client';
import { ContractNotificationService } from './contractNotificationService.js';
import { getServiceLogger } from '../../logging/serviceLogger.js';

const prisma = new PrismaClient();
const log = getServiceLogger('contracts/party');

export interface AddPartyInput {
  contractId: string;
  organizationId?: string;
  partnerId?: string;
  contactName?: string;
  contactEmail: string;
  role: 'SIGNER' | 'WITNESS' | 'OBSERVER';
}

export interface UpdateSignatureStatusInput {
  partyId: string;
  signatureStatus: 'PENDING' | 'SIGNED' | 'DECLINED';
  signedAt?: Date;
}

export class ContractPartyService {
  private notificationService: ContractNotificationService;

  constructor() {
    this.notificationService = new ContractNotificationService();
  }

  /**
   * Add a party to a contract
   */
  async addParty(input: AddPartyInput): Promise<any> {
    log.info('Adding party to contract', {
      contractId: input.contractId,
      email: input.contactEmail,
      role: input.role,
    });

    // Check for duplicate invite
    const existing = await prisma.contractParty.findFirst({
      where: {
        contractId: input.contractId,
        contactEmail: input.contactEmail,
      },
    });

    if (existing) {
      throw new Error(
        `Party with email ${input.contactEmail} is already invited to this contract`
      );
    }

    // Verify contract exists
    const contract = await prisma.contract.findUnique({
      where: { id: input.contractId },
    });

    if (!contract) {
      throw new Error(`Contract ${input.contractId} not found`);
    }

    // Create party
    const party = await prisma.contractParty.create({
      data: {
        contractId: input.contractId,
        organizationId: input.organizationId,
        partnerId: input.partnerId,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        role: input.role as ContractPartyRole,
        signatureStatus: SignatureStatus.PENDING,
      },
    });

    // Log to audit log
    await prisma.contractAuditLog.create({
      data: {
        contractId: input.contractId,
        eventType: 'PARTY_ADDED',
        details: {
          partyId: party.id,
          contactEmail: input.contactEmail,
          role: input.role,
        },
      },
    });

    // Send invitation notification
    if (input.contactEmail) {
      await this.notificationService.sendNotification(
        input.contactEmail,
        'contract.party_invited',
        {
          contractId: input.contractId,
          contractTitle: contract.title,
          role: input.role,
        }
      );
    }

    log.info('Party added to contract', {
      contractId: input.contractId,
      partyId: party.id,
    });

    return party;
  }

  /**
   * Remove a party from a contract
   */
  async removeParty(partyId: string, userId: string): Promise<void> {
    log.info('Removing party from contract', { partyId, userId });

    const party = await prisma.contractParty.findUnique({
      where: { id: partyId },
      include: { contract: true },
    });

    if (!party) {
      throw new Error(`Party ${partyId} not found`);
    }

    // Don't allow removing parties who have already signed
    if (party.signatureStatus === SignatureStatus.SIGNED) {
      throw new Error('Cannot remove party who has already signed the contract');
    }

    await prisma.contractParty.delete({
      where: { id: partyId },
    });

    // Log to audit log
    await prisma.contractAuditLog.create({
      data: {
        contractId: party.contractId,
        eventType: 'PARTY_REMOVED',
        userId,
        details: {
          partyId,
          contactEmail: party.contactEmail,
          role: party.role,
        },
      },
    });

    log.info('Party removed from contract', { partyId });
  }

  /**
   * Update signature status
   */
  async updateSignatureStatus(
    input: UpdateSignatureStatusInput
  ): Promise<any> {
    log.info('Updating signature status', {
      partyId: input.partyId,
      signatureStatus: input.signatureStatus,
    });

    const party = await prisma.contractParty.findUnique({
      where: { id: input.partyId },
      include: { contract: true },
    });

    if (!party) {
      throw new Error(`Party ${input.partyId} not found`);
    }

    const previousStatus = party.signatureStatus;

    // Update signature status
    const updated = await prisma.contractParty.update({
      where: { id: input.partyId },
      data: {
        signatureStatus: input.signatureStatus as SignatureStatus,
        signedAt: input.signatureStatus === 'SIGNED' ? (input.signedAt || new Date()) : null,
      },
    });

    // Log to audit log
    await prisma.contractAuditLog.create({
      data: {
        contractId: party.contractId,
        eventType: 'SIGNED',
        details: {
          partyId: input.partyId,
          previousStatus,
          newStatus: input.signatureStatus,
          signedAt: updated.signedAt,
        },
      },
    });

    // Send notification if signed
    if (input.signatureStatus === 'SIGNED' && party.contactEmail) {
      await this.notificationService.sendNotification(
        party.contactEmail,
        'contract.signature_completed',
        {
          contractId: party.contractId,
          contractTitle: party.contract.title,
        }
      );
    }

    log.info('Signature status updated', {
      partyId: input.partyId,
      signatureStatus: input.signatureStatus,
    });

    return updated;
  }

  /**
   * Get parties for a contract
   */
  async getParties(contractId: string): Promise<any[]> {
    return prisma.contractParty.findMany({
      where: { contractId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Get party by ID
   */
  async getParty(partyId: string): Promise<any> {
    return prisma.contractParty.findUnique({
      where: { id: partyId },
      include: { contract: true },
    });
  }

  /**
   * Check if all required signers have signed
   */
  async areAllSignersSigned(contractId: string): Promise<boolean> {
    const parties = await prisma.contractParty.findMany({
      where: {
        contractId,
        role: ContractPartyRole.SIGNER,
      },
    });

    if (parties.length === 0) {
      return false; // No signers means not all signed
    }

    return parties.every(
      (p) => p.signatureStatus === SignatureStatus.SIGNED
    );
  }
}

// Export singleton instance
export const contractPartyService = new ContractPartyService();

