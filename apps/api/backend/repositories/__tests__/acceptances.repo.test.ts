jest.mock('../../src/graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    acceptance: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('../../src/obs/logger', () => ({
  log: jest.fn(),
}));

import { EmployerAcceptance } from '@vitalcv/domain';
import prisma from '../../src/graphql/prisma_client';
import { log } from '../../src/obs/logger';
import { insertAcceptance } from '../acceptances.repo';

const prismaMock = prisma as unknown as {
  acceptance: {
    findUnique: jest.Mock;
    create: jest.Mock;
  };
};

const logMock = log as jest.MockedFunction<typeof log>;

function buildAcceptanceEvent() {
  return new EmployerAcceptance({
    acceptanceId: 'acc-graph-1',
    recognitionId: 'rec-graph-1',
    subjectId: '1234567890',
    employerId: 'emp-graph-1',
    facilityId: 'fac-graph-1',
    acceptedAt: '2026-04-14T08:00:00.000Z',
    psvReportId: 'psv-graph-1',
  });
}

describe('acceptances.repo', () => {
  beforeEach(() => {
    prismaMock.acceptance.findUnique.mockReset();
    prismaMock.acceptance.create.mockReset();
    logMock.mockReset();

    prismaMock.acceptance.findUnique.mockResolvedValue(null);
    prismaMock.acceptance.create.mockResolvedValue({ id: 'row-1' });
  });

  it('deep-clones and normalizes graph snapshot fields before persistence', async () => {
    const trustSignalsInput = {
      reuse: {
        accepted_count: 1,
        ignored: undefined,
      },
      signals: [
        { status: 'clear', observedAt: new Date('2026-04-14T08:00:00.000Z') },
        undefined,
      ],
    };

    await insertAcceptance(buildAcceptanceEvent(), {
      decisionState: ' proceed ',
      trustSignalsSnapshot: trustSignalsInput,
      role: ' reviewer ',
    });

    const createArgs = prismaMock.acceptance.create.mock.calls[0][0];
    expect(createArgs.data.decisionState).toBe('PROCEED');
    expect(createArgs.data.role).toBe('reviewer');
    expect(createArgs.data.trustSignalsSnapshot).toEqual({
      reuse: {
        accepted_count: 1,
      },
      signals: [
        { observedAt: '2026-04-14T08:00:00.000Z', status: 'clear' },
        null,
      ],
    });
    expect(createArgs.data.trustSignalsSnapshot).not.toBe(trustSignalsInput);
    expect(createArgs.data.trustSignalsSnapshot.reuse).not.toBe(trustSignalsInput.reuse);
    expect(logMock).not.toHaveBeenCalled();
  });

  it('drops circular snapshots and still persists the base acceptance record', async () => {
    const circular: Record<string, unknown> = { reuse: { accepted_count: 1 } };
    circular['self'] = circular;

    await insertAcceptance(buildAcceptanceEvent(), {
      decisionState: 'proceed',
      trustSignalsSnapshot: circular,
    });

    const createArgs = prismaMock.acceptance.create.mock.calls[0][0];
    expect(createArgs.data.decisionState).toBe('PROCEED');
    expect(createArgs.data.trustSignalsSnapshot).toBeUndefined();
    expect(logMock).toHaveBeenCalledWith(
      'warn',
      'acceptance_graph_snapshot_dropped',
      expect.objectContaining({
        acceptanceId: 'acc-graph-1',
        reason: 'snapshot_serialization_failed',
      }),
    );
  });

  it('drops oversized snapshots and still persists the base acceptance record', async () => {
    await insertAcceptance(buildAcceptanceEvent(), {
      trustSignalsSnapshot: {
        payload: 'x'.repeat(33 * 1024),
      },
    });

    const createArgs = prismaMock.acceptance.create.mock.calls[0][0];
    expect(createArgs.data.trustSignalsSnapshot).toBeUndefined();
    expect(logMock).toHaveBeenCalledWith(
      'warn',
      'acceptance_graph_snapshot_dropped',
      expect.objectContaining({
        acceptanceId: 'acc-graph-1',
        reason: 'snapshot_too_large',
      }),
    );
  });

  it('retries without graph fields if graph persistence fails', async () => {
    prismaMock.acceptance.create
      .mockRejectedValueOnce(new Error('column "trust_signals_snapshot" does not exist'))
      .mockResolvedValueOnce({ id: 'row-1' });

    await insertAcceptance(buildAcceptanceEvent(), {
      decisionState: 'proceed',
      trustSignalsSnapshot: { reuse: { accepted_count: 1 } },
      role: 'reviewer',
    });

    expect(prismaMock.acceptance.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.acceptance.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        decisionState: 'PROCEED',
        trustSignalsSnapshot: { reuse: { accepted_count: 1 } },
        role: 'reviewer',
      }),
    );
    expect(prismaMock.acceptance.create.mock.calls[1][0].data).toEqual(
      expect.not.objectContaining({
        decisionState: expect.anything(),
        trustSignalsSnapshot: expect.anything(),
        role: expect.anything(),
      }),
    );
    expect(logMock).toHaveBeenCalledWith(
      'warn',
      'acceptance_graph_persist_retry_without_graph_fields',
      expect.objectContaining({
        acceptanceId: 'acc-graph-1',
        hasTrustSignalsSnapshot: true,
      }),
    );
  });
});
