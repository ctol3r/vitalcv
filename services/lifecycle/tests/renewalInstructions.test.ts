import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { RenewalInstructionService } from '../api/renewals/service.js';
import { RenewalMethod } from '../models/CredentialLifecycle.js';
import { onPulse } from '../notifications/pulse.js';

class MockPrismaClient {
  credential: any;
  credentialExpiryPolicy: any;
  auditEvent: any;

  constructor() {
    this.credential = {
      findUnique: jest.fn(),
    };
    this.credentialExpiryPolicy = {
      findUnique: jest.fn(),
    };
    this.auditEvent = {
      create: jest.fn(),
    };
  }
}

describe('RenewalInstructionService', () => {
  let prisma: any;
  let service: RenewalInstructionService;

  beforeEach(() => {
    prisma = new MockPrismaClient();
    service = new RenewalInstructionService(prisma as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('builds renewal instructions with audit and pulse signals', async () => {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    prisma.credential.findUnique.mockResolvedValue({
      id: 'cred-1',
      type: 'license',
      status: 'active',
      expiresAt,
      issuer: 'STATE_BOARD',
      metadata: {
        renewalAuthorityId: 'STATE_BOARD',
        renewalMethod: 'MAIL',
      },
      user: { id: 'user-1', email: 'clinician@example.com' },
    });

    prisma.credentialExpiryPolicy.findUnique.mockResolvedValue({
      id: 'policy-1',
      credentialType: 'license',
      defaultValidityPeriod: 365,
      gracePeriod: 30,
      renewalRequirements: {
        requiredDocuments: ['ID', 'CME'],
        requiresPayment: true,
        minDaysBeforeExpiry: 45,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const pulsePromise = new Promise((resolve) => {
      const unsubscribe = onPulse('RENEWAL_INSTRUCTIONS_AVAILABLE', (event) => {
        unsubscribe();
        resolve(event);
      });
    });

    const instructions = await service.getRenewalInstructions('cred-1');

    expect(instructions.renewalMethod).toBe(RenewalMethod.MAIL);
    expect(instructions.renewalAuthorityId).toBe('STATE_BOARD');
    expect(instructions.supportingDocuments).toContain('ID');
    expect(instructions.recommendedStartDate).toBeInstanceOf(Date);
    expect(prisma.auditEvent.create).toHaveBeenCalled();

    const pulseEvent: any = await pulsePromise;
    expect(pulseEvent.credentialId).toBe('cred-1');
    expect(pulseEvent.renewalMethod).toBe(RenewalMethod.MAIL);
  });
});

