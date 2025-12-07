/**
 * B148B-HOOK-004: Unit test for onEnrollmentSubmitted hook
 * Verifies domain event publish
 */

import { PrismaClient } from '@prisma/client';
import { eventBus } from '../../events';
import { onEnrollmentSubmitted } from './onEnrollmentSubmitted';

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    payerEnrollment: {
      findUnique: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma),
  };
});

// Mock EventBus
jest.mock('../../events', () => ({
  eventBus: {
    publish: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('onEnrollmentSubmitted', () => {
  let prisma: any;
  const mockedEventBus = eventBus as jest.Mocked<typeof eventBus>;

  beforeEach(() => {
    prisma = new PrismaClient();
    jest.clearAllMocks();
  });

  it('publishes PayerSubmitted event with enriched payload', async () => {
    const mockEnrollment = {
      id: 'enrollment-1',
      orgId: 'org-1',
      payer: {
        id: 'payer-1',
        name: 'Test Payer',
      },
    };

    prisma.payerEnrollment.findUnique.mockResolvedValue(mockEnrollment);
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });

    await onEnrollmentSubmitted({
      enrollmentId: 'enrollment-1',
      clinicianDid: 'did:example:clinician',
      payerId: 'payer-1',
      orgId: 'org-1',
    });

    expect(mockedEventBus.publish).toHaveBeenCalledWith(
      'PayerSubmitted',
      expect.objectContaining({
        enrollmentId: 'enrollment-1',
        notificationUserId: 'user-1',
        payerName: 'Test Payer',
        orgId: 'org-1',
      })
    );
  });

  it('falls back to clinician DID when user lookup fails', async () => {
    const mockEnrollment = {
      id: 'enrollment-1',
      orgId: 'org-1',
      payer: {
        id: 'payer-1',
        name: 'Test Payer',
      },
    };

    prisma.payerEnrollment.findUnique.mockResolvedValue(mockEnrollment);
    prisma.user.findFirst.mockResolvedValue(null);

    await onEnrollmentSubmitted({
      enrollmentId: 'enrollment-1',
      clinicianDid: 'did:example:clinician',
      payerId: 'payer-1',
    });

    expect(mockedEventBus.publish).toHaveBeenCalledWith(
      'PayerSubmitted',
      expect.objectContaining({
        notificationUserId: 'did:example:clinician',
        orgId: 'org-1',
      })
    );
  });
});
