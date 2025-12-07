import { TimelineEventSeverity } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { searchTimelineEvents } from '../search';

describe('Timeline search service', () => {
  const mockPrisma = {
    credentialTimelineEvent: {
      findMany: jest.fn(),
    },
  } as unknown as PrismaClient;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds Prisma query with range and filters', async () => {
    const from = new Date('2025-01-01T00:00:00Z');
    const to = new Date('2025-02-01T00:00:00Z');
    (mockPrisma.credentialTimelineEvent.findMany as jest.Mock).mockResolvedValue([]);

    await searchTimelineEvents(mockPrisma, {
      clinicianId: 'clin-001',
      from,
      to,
      eventTypes: ['LICENSE_VERIFIED', 'NPDB_QUERY'],
      severity: TimelineEventSeverity.WARNING,
      limit: 20,
      sortDirection: 'asc',
    });

    expect(mockPrisma.credentialTimelineEvent.findMany).toHaveBeenCalledWith({
      where: {
        clinicianId: 'clin-001',
        timestamp: { gte: from, lte: to },
        eventType: { in: ['LICENSE_VERIFIED', 'NPDB_QUERY'] },
        severity: { in: [TimelineEventSeverity.WARNING] },
      },
      orderBy: { timestamp: 'asc' },
      take: 20,
    });
  });

  it('supports severity array and cursor pagination', async () => {
    (mockPrisma.credentialTimelineEvent.findMany as jest.Mock).mockResolvedValue([]);

    await searchTimelineEvents(mockPrisma, {
      clinicianId: 'clin-002',
      severity: [TimelineEventSeverity.INFO, TimelineEventSeverity.NOTICE],
      cursorId: 'evt-10',
    });

    expect(mockPrisma.credentialTimelineEvent.findMany).toHaveBeenCalledWith({
      where: {
        clinicianId: 'clin-002',
      severity: { in: [TimelineEventSeverity.INFO, TimelineEventSeverity.NOTICE] },
      },
      orderBy: { timestamp: 'desc' },
      cursor: { id: 'evt-10' },
      skip: 1,
    });
  });
});
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { searchTimelineEvents } from '../search';
import {
  CredentialTimelineEventType,
  TimelineEventSeverity,
} from '../models/CredentialTimelineEvent';

const mockPrisma = {
  credentialTimelineEvent: {
    findMany: jest.fn(),
  },
} as any;

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

describe('searchTimelineEvents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds filters for date range, type, and severity', async () => {
    mockPrisma.credentialTimelineEvent.findMany.mockResolvedValue([]);
    const from = new Date('2025-11-01T00:00:00Z');
    const to = new Date('2025-11-30T00:00:00Z');

    await searchTimelineEvents({
      clinicianId: 'clin-77',
      from,
      to,
      eventTypes: [CredentialTimelineEventType.NPDB_QUERY],
      severity: TimelineEventSeverity.WARNING,
      limit: 5,
    });

    expect(mockPrisma.credentialTimelineEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          clinicianId: 'clin-77',
          eventType: { in: [CredentialTimelineEventType.NPDB_QUERY] },
          severity: { in: [TimelineEventSeverity.WARNING] },
          timestamp: { gte: from, lte: to },
        }),
        take: 5,
      })
    );
  });

  it('throws when clinicianId missing', async () => {
    await expect(
      searchTimelineEvents({
        clinicianId: '',
      } as any)
    ).rejects.toThrow('clinicianId is required');
  });
});


