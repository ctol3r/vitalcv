import { logApplicationTransition } from '../applicationLifecycle';
import { estimateTimeToStart } from '../../../domain/entity/vcvApplication';

jest.mock('../../../graphql/prisma_client', () => {
  const updateMock = jest.fn();
  const createMock = jest.fn();

  return {
    __esModule: true,
    default: {
      auditEvent: {
        create: createMock
      },
      application: {
        findUnique: jest.fn().mockResolvedValue({ id: 'app1', timeline: [] }),
        update: updateMock
      }
    }
  };
});

import prisma from '../../../graphql/prisma_client';

describe('Hiring Operating System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('audit logs always written and timeline updates correctly', async () => {
    await logApplicationTransition('app1', 'SUBMITTED', 'IN_REVIEW', 'actor1');

    expect(prisma.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'status_change',
        metadata: expect.objectContaining({
          entity_type: 'application',
          action: 'status_change',
          from: 'SUBMITTED',
          to: 'IN_REVIEW'
        })
      })
    }));

    expect(prisma.application.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'app1' },
      data: expect.objectContaining({
        timeline: expect.arrayContaining([
          expect.objectContaining({
            event: 'IN_REVIEW'
          })
        ])
      })
    }));
  });

  test('progress matches lane states and ETA computed correctly', () => {
    expect(estimateTimeToStart({
      identity: 'complete',
      sanctions: 'complete',
      licensure: 'complete',
      enrollment: 'missing'
    })).toBe('45–90 days');

    expect(estimateTimeToStart({
      identity: 'complete',
      sanctions: 'pending',
      licensure: 'complete',
      enrollment: 'complete'
    })).toBe('monthly');
  });
});
