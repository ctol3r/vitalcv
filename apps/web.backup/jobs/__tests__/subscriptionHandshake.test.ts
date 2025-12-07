import { runSubscriptionHandshake } from '../fhir/subscriptionHandshake';

const mockFindMany = jest.fn();
const mockUpdate = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    fHIRSubscription: {
      findMany: mockFindMany,
      update: mockUpdate,
    },
  })),
  FHIRSubscriptionStatus: {
    ACTIVE: 'ACTIVE',
    PAUSED: 'PAUSED',
    FAILED: 'FAILED',
  },
}));

describe('runSubscriptionHandshake', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marks invalid URLs as failed', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'sub-invalid',
        resourceType: 'Practitioner',
        criteria: 'Practitioner/*',
        callbackUrl: 'http://example.com',
        status: 'PAUSED',
      },
    ]);

    const summary = await runSubscriptionHandshake({ fetchImpl: jest.fn() as any });

    expect(summary.failed).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'sub-invalid' },
      data: { status: 'FAILED' },
    });
  });

  it('updates handshake timestamp on success', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    mockFindMany.mockResolvedValue([
      {
        id: 'sub-1',
        resourceType: 'Practitioner',
        criteria: 'Practitioner/*',
        callbackUrl: 'https://example.com',
        status: 'PAUSED',
      },
    ]);

    const summary = await runSubscriptionHandshake({ fetchImpl: fetchMock });

    expect(summary.succeeded).toBe(1);
    expect(fetchMock).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: expect.objectContaining({
        status: 'ACTIVE',
      }),
    });
  });
});

