import { TimelineEventSeverity } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import {
  createCredentialTimelineEvent,
  findTimelineEventByAuditHash,
  listTimelineEventsForClinician,
} from '../models/CredentialTimelineEvent';

describe('CredentialTimelineEvent model helpers', () => {
  const mockPrisma = {
    credentialTimelineEvent: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  } as unknown as PrismaClient;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates timeline events with serialized metadata and defaults', async () => {
    const timestamp = new Date('2025-01-01T00:00:00Z');
    const mockRecord = { id: 'evt-1' };
    (mockPrisma.credentialTimelineEvent.create as jest.Mock).mockResolvedValue(mockRecord);

    const result = await createCredentialTimelineEvent(mockPrisma, {
      clinicianId: 'clinician-1',
      eventType: 'LICENSE_VERIFIED',
      timestamp,
      metadata: { state: 'CA', status: 'ACTIVE' },
      auditHash: 'hash-123',
    });

    expect(result).toBe(mockRecord);
    expect(mockPrisma.credentialTimelineEvent.create).toHaveBeenCalledWith({
      data: {
        clinicianId: 'clinician-1',
        eventType: 'LICENSE_VERIFIED',
        severity: TimelineEventSeverity.INFO,
        timestamp,
        metadata: { state: 'CA', status: 'ACTIVE' },
        auditHash: 'hash-123',
        anchorTxId: null,
      },
    });
  });

  it('finds events by audit hash', async () => {
    (mockPrisma.credentialTimelineEvent.findUnique as jest.Mock).mockResolvedValue({ id: 'evt-2' });

    const record = await findTimelineEventByAuditHash(mockPrisma, 'hash-xyz');

    expect(record).toEqual({ id: 'evt-2' });
    expect(mockPrisma.credentialTimelineEvent.findUnique).toHaveBeenCalledWith({
      where: { auditHash: 'hash-xyz' },
    });
  });

  it('lists events for clinician with filters applied', async () => {
    const from = new Date('2025-01-01T00:00:00Z');
    const to = new Date('2025-02-01T00:00:00Z');

    await listTimelineEventsForClinician(mockPrisma, {
      clinicianId: 'clinician-2',
      from,
      to,
      severity: [TimelineEventSeverity.INFO, TimelineEventSeverity.WARNING],
      eventTypes: ['NPDB_QUERY'],
      limit: 10,
      sortDirection: 'asc',
    });

    expect(mockPrisma.credentialTimelineEvent.findMany).toHaveBeenCalledWith({
      where: {
        clinicianId: 'clinician-2',
        timestamp: { gte: from, lte: to },
        eventType: { in: ['NPDB_QUERY'] },
        severity: { in: [TimelineEventSeverity.INFO, TimelineEventSeverity.WARNING] },
      },
      orderBy: { timestamp: 'asc' },
      take: 10,
    });
  });
});
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  createCredentialTimelineEvent,
  CredentialTimelineEventType,
  TimelineEventSeverity,
} from '../models/CredentialTimelineEvent';

const mockPrisma = {
  credentialTimelineEvent: {
    create: jest.fn(),
  },
} as any;

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

jest.mock('../addAuditStamp', () => ({
  addAuditStamp: jest.fn().mockResolvedValue({ auditHash: 'hash-123', anchorTxId: 'tx-abc' }),
}));

const { addAuditStamp } = jest.requireMock('../addAuditStamp');

describe('createCredentialTimelineEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists validated events with audit hash and anchor id', async () => {
    const timestamp = new Date('2025-11-15T12:00:00Z');
    mockPrisma.credentialTimelineEvent.create.mockResolvedValue({
      id: 'evt-1',
      clinicianId: 'clin-1',
    });

    const result = await createCredentialTimelineEvent({
      clinicianId: 'clin-1',
      eventType: CredentialTimelineEventType.NPDB_QUERY,
      timestamp,
      metadata: {
        source: 'NPDB',
        referenceId: 'npdb-123',
      },
    });

    expect(addAuditStamp).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicianId: 'clin-1',
        eventType: CredentialTimelineEventType.NPDB_QUERY,
        severity: TimelineEventSeverity.INFO,
        timestamp,
      }),
      undefined
    );
    expect(mockPrisma.credentialTimelineEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicianId: 'clin-1',
        eventType: CredentialTimelineEventType.NPDB_QUERY,
        auditHash: 'hash-123',
        anchorTxId: 'tx-abc',
      }),
    });
    expect(result.id).toBe('evt-1');
  });
});


