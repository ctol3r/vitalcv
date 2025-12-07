import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { runMonthlyOppeGenerator } from '../oppe/monthlyGenerator';

const mockScheduleFindMany = jest.fn();
const mockScheduleUpdate = jest.fn();
const mockPrivilegeFindMany = jest.fn();
const mockCaseFindFirst = jest.fn();
const mockCaseCreate = jest.fn();

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      oPPEScheduleV2: {
        findMany: mockScheduleFindMany,
        update: mockScheduleUpdate,
      },
      privilegeGranted: {
        findMany: mockPrivilegeFindMany,
      },
      oPPECase: {
        findFirst: mockCaseFindFirst,
        create: mockCaseCreate,
      },
    })),
    Prisma: {
      InputJsonValue: Object,
    },
  };
});

describe('OPPE monthly generator job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates OPPE cases for due schedules', async () => {
    const nextDueAt = new Date('2025-01-01T00:00:00Z');
    mockScheduleFindMany.mockResolvedValue([
      {
        id: 'sched-1',
        clinicianId: 'did:example:123',
        orgId: 'org-1',
        frequencyMonths: 3,
        nextDueAt,
        metricsConfig: { cases: 12 },
      },
    ]);

    mockPrivilegeFindMany.mockResolvedValue([
      {
        id: 'priv-1',
        privilegeSet: {
          procedures: [
            { code: 'PROC-1', name: 'Procedure 1' },
            'PROC-2',
          ],
        },
      },
    ]);

    mockCaseFindFirst.mockResolvedValue(null);
    mockCaseCreate.mockResolvedValue({ id: 'case-1' });

    const result = await runMonthlyOppeGenerator(new Date('2025-02-01T00:00:00Z'));

    expect(result.success).toBe(true);
    expect(result.casesCreated).toBe(2);
    expect(mockCaseCreate).toHaveBeenCalledTimes(2);
    expect(mockScheduleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sched-1' } })
    );
  });

  it('skips creation when case already exists', async () => {
    mockScheduleFindMany.mockResolvedValue([
      {
        id: 'sched-1',
        clinicianId: 'did:example:123',
        orgId: 'org-1',
        frequencyMonths: 3,
        nextDueAt: new Date('2025-01-01T00:00:00Z'),
        metricsConfig: {},
      },
    ]);
    mockPrivilegeFindMany.mockResolvedValue([
      {
        id: 'priv-1',
        privilegeSet: {
          procedures: ['PROC-1'],
        },
      },
    ]);
    mockCaseFindFirst.mockResolvedValue({ id: 'existing-case' });

    const result = await runMonthlyOppeGenerator();

    expect(result.casesCreated).toBe(0);
    expect(mockCaseCreate).not.toHaveBeenCalled();
  });

  it('records errors per schedule without aborting all work', async () => {
    mockScheduleFindMany.mockResolvedValue([
      {
        id: 'sched-error',
        clinicianId: 'did:example:999',
        orgId: 'org-err',
        frequencyMonths: 3,
        nextDueAt: new Date('2025-01-01T00:00:00Z'),
        metricsConfig: {},
      },
    ]);
    mockPrivilegeFindMany.mockRejectedValue(new Error('DB issue'));

    const result = await runMonthlyOppeGenerator();

    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('DB issue');
  });
});
