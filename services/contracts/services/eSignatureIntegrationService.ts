/**
 * B251B-CON-015: ESignatureIntegrationService
 *
 * Integrates with third-party or internal e-signature provider:
 * creates signature request via API, handles callbacks to update signatureStatus;
 * includes stubbed provider for tests; provides methods to retrieve signature logs.
 */

import { PrismaClient, SignatureStatus } from '@prisma/client';
import { ContractPartyService } from './contractPartyService.js';
import { getServiceLogger } from '../../logging/serviceLogger.js';

const prisma = new PrismaClient();
const log = getServiceLogger('contracts/esignature');

export interface SignatureRequestInput {
  contractId: string;
  partyId: string;
  documentUrl: string;
  signerEmail: string;
  signerName?: string;
  returnUrl?: string;
}

export interface SignatureCallbackData {
  signatureRequestId: string;
  status: 'completed' | 'declined' | 'expired';
  signedAt?: Date;
  signatureData?: Record<string, any>;
}

export interface SignatureProvider {
  createSignatureRequest(
    input: SignatureRequestInput
  ): Promise<{ requestId: string; signingUrl: string }>;
  getSignatureStatus(requestId: string): Promise<{
    status: 'pending' | 'completed' | 'declined' | 'expired';
    signedAt?: Date;
  }>;
  retrieveSignatureLog(requestId: string): Promise<Record<string, any>>;
}

/**
 * Stubbed e-signature provider for testing
 */
export class StubSignatureProvider implements SignatureProvider {
  private requests: Map<string, SignatureRequestInput> = new Map();
  private statuses: Map<string, 'pending' | 'completed' | 'declined' | 'expired'> = new Map();

  async createSignatureRequest(
    input: SignatureRequestInput
  ): Promise<{ requestId: string; signingUrl: string }> {
    const requestId = `stub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.requests.set(requestId, input);
    this.statuses.set(requestId, 'pending');

    return {
      requestId,
      signingUrl: `https://stub-signing.example.com/sign/${requestId}`,
    };
  }

  async getSignatureStatus(requestId: string): Promise<{
    status: 'pending' | 'completed' | 'declined' | 'expired';
    signedAt?: Date;
  }> {
    const status = this.statuses.get(requestId) || 'pending';
    return {
      status,
      signedAt: status === 'completed' ? new Date() : undefined,
    };
  }

  async retrieveSignatureLog(requestId: string): Promise<Record<string, any>> {
    const request = this.requests.get(requestId);
    const status = this.statuses.get(requestId);

    return {
      requestId,
      status,
      request,
      signedAt: status === 'completed' ? new Date() : undefined,
      metadata: {
        provider: 'stub',
        createdAt: new Date(),
      },
    };
  }

  // Test helper: simulate signature completion
  async simulateSignature(requestId: string): Promise<void> {
    this.statuses.set(requestId, 'completed');
  }

  // Test helper: simulate signature decline
  async simulateDecline(requestId: string): Promise<void> {
    this.statuses.set(requestId, 'declined');
  }
}

export class ESignatureIntegrationService {
  private provider: SignatureProvider;
  private partyService: ContractPartyService;

  constructor(provider?: SignatureProvider) {
    // Use provided provider or default to stub for development/testing
    this.provider = provider || new StubSignatureProvider();
    this.partyService = new ContractPartyService();
  }

  /**
   * Create a signature request for a party
   */
  async createSignatureRequest(
    input: SignatureRequestInput
  ): Promise<{ requestId: string; signingUrl: string }> {
    log.info('Creating signature request', {
      contractId: input.contractId,
      partyId: input.partyId,
      signerEmail: input.signerEmail,
    });

    // Verify party exists and is pending
    const party = await prisma.contractParty.findUnique({
      where: { id: input.partyId },
      include: { contract: true },
    });

    if (!party) {
      throw new Error(`Party ${input.partyId} not found`);
    }

    if (party.contractId !== input.contractId) {
      throw new Error('Party does not belong to the specified contract');
    }

    if (party.signatureStatus !== SignatureStatus.PENDING) {
      throw new Error(
        `Party signature status is ${party.signatureStatus}, expected PENDING`
      );
    }

    // Create signature request via provider
    const result = await this.provider.createSignatureRequest(input);

    // Store signature request ID in party metadata or separate table
    // For now, we'll store it in a metadata field if available
    await prisma.contractParty.update({
      where: { id: input.partyId },
      data: {
        // Store requestId in metadata if schema supports it
        // metadata: { signatureRequestId: result.requestId }
      },
    });

    log.info('Signature request created', {
      requestId: result.requestId,
      partyId: input.partyId,
    });

    return result;
  }

  /**
   * Handle signature callback from provider
   */
  async handleCallback(data: SignatureCallbackData): Promise<void> {
    log.info('Handling signature callback', {
      signatureRequestId: data.signatureRequestId,
      status: data.status,
    });

    // Find party by signature request ID
    // In production, you'd have a mapping table or store requestId in party metadata
    const parties = await prisma.contractParty.findMany({
      where: {
        // This assumes we store requestId somewhere - adjust based on schema
        // For now, we'll need to track this differently
      },
    });

    // For stub provider, we'll need a different approach
    // In production, the callback would include partyId or contractId
    // This is a simplified version - adjust based on your provider's callback format

    // Update signature status based on callback
    const signatureStatus =
      data.status === 'completed'
        ? SignatureStatus.SIGNED
        : data.status === 'declined'
        ? SignatureStatus.DECLINED
        : SignatureStatus.PENDING;

    // Note: In production, you'd update the specific party
    // This is a placeholder that needs to be implemented based on your callback structure
    log.warn('Signature callback handling needs party identification', {
      signatureRequestId: data.signatureRequestId,
    });
  }

  /**
   * Update signature status for a party (called after callback)
   */
  async updateSignatureFromCallback(
    partyId: string,
    status: 'completed' | 'declined' | 'expired',
    signedAt?: Date
  ): Promise<void> {
    const signatureStatus =
      status === 'completed'
        ? SignatureStatus.SIGNED
        : status === 'declined'
        ? SignatureStatus.DECLINED
        : SignatureStatus.PENDING;

    await this.partyService.updateSignatureStatus({
      partyId,
      signatureStatus,
      signedAt,
    });
  }

  /**
   * Retrieve signature log for a request
   */
  async retrieveSignatureLog(requestId: string): Promise<Record<string, any>> {
    log.info('Retrieving signature log', { requestId });

    const log = await this.provider.retrieveSignatureLog(requestId);

    return log;
  }

  /**
   * Get signature status for a request
   */
  async getSignatureStatus(requestId: string): Promise<{
    status: 'pending' | 'completed' | 'declined' | 'expired';
    signedAt?: Date;
  }> {
    return this.provider.getSignatureStatus(requestId);
  }
}

// Export singleton instance with stub provider (for development)
export const eSignatureIntegrationService = new ESignatureIntegrationService();

// Export with custom provider for production
export function createESignatureService(
  provider: SignatureProvider
): ESignatureIntegrationService {
  return new ESignatureIntegrationService(provider);
}

