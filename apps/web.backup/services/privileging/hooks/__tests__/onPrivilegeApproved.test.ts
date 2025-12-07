jest.mock('../../fppeChecklist', () => ({
  getChecklistTemplate: jest.fn(() => ({
    version: 1,
    privilegeCode: 'CARD-CATH-ADULT',
    items: [],
  })),
  normalizePrivilegeCode: jest.fn((code: string) => code.toUpperCase()),
}));

import { Prisma } from '@prisma/client';
import { createFPPECaseForApprovedPrivilege } from '../onPrivilegeApproved';

describe('createFPPECaseForApprovedPrivilege', () => {
  const mockClient = {
    fPPECase: {
      create: jest.fn(),
    },
    auditEvent: {
      create: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates FPPE case with 30-day due date and audit log', async () => {
    const startAt = new Date('2025-04-01T00:00:00.000Z');
    mockClient.fPPECase.create.mockResolvedValue({
      id: 'case-1',
      privilegeCode: 'CARD-CATH-ADULT',
    });
    mockClient.auditEvent.create.mockResolvedValue({});

    await createFPPECaseForApprovedPrivilege(
      {
        privilegeGrantedId: 'pg-1',
        privilegeRequestId: 'pr-1',
        clinicianId: 'did:example:123',
        orgId: 'org-1',
        privilegeCode: 'card cath adult',
        reviewerDid: 'did:reviewer:1',
        startAt,
      },
      mockClient as unknown as Pick<typeof Prisma, never>
    );

    expect(mockClient.fPPECase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicianId: 'did:example:123',
        privilegeCode: 'CARD-CATH-ADULT',
        startAt,
        dueAt: new Date('2025-05-01T00:00:00.000Z'),
      }),
    });

    expect(mockClient.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'FPPE_CASE_CREATED',
        data: expect.objectContaining({
          privilegeRequestId: 'pr-1',
          reviewerDid: 'did:reviewer:1',
        }),
      }),
    });
  });
});

