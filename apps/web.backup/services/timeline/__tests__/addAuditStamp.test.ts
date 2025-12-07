import { TimelineEventSeverity } from '@prisma/client';
import { addAuditStamp, buildCanonicalEventPayload } from '../addAuditStamp';

describe('addAuditStamp', () => {
  const baseInput = {
    clinicianId: 'clin-123',
    eventType: 'LICENSE_VERIFIED' as const,
    severity: TimelineEventSeverity.INFO,
    timestamp: new Date('2025-01-01T00:00:00.000Z'),
    metadata: {
      state: 'CA',
      status: 'ACTIVE',
      nested: { a: 1, b: 2 },
    },
  };

  it('produces deterministic hash and anchors via scrapbook', async () => {
    const scrapbook = {
      anchorEvidenceHash: jest.fn().mockResolvedValue('tx-abc'),
    };

    const result = await addAuditStamp(baseInput, { auditScrapbook: scrapbook });

    expect(result.anchorTxId).toBe('tx-abc');
    expect(result.auditHash).toHaveLength(64);
    expect(scrapbook.anchorEvidenceHash).toHaveBeenCalledWith(result.auditHash, [], {
      clinicianId: 'clin-123',
      eventType: 'LICENSE_VERIFIED',
      severity: TimelineEventSeverity.INFO,
      timestamp: '2025-01-01T00:00:00.000Z',
    });
  });

  it('generates same hash for equivalent payloads regardless of metadata key order', async () => {
    const scrapbook = { anchorEvidenceHash: jest.fn().mockResolvedValue('tx-1') };
    const first = await addAuditStamp(baseInput, { auditScrapbook: scrapbook });
    const scrambled = await addAuditStamp(
      {
        ...baseInput,
        metadata: {
          nested: { b: 2, a: 1 },
          status: 'ACTIVE',
          state: 'CA',
        },
      },
      { auditScrapbook: scrapbook }
    );

    expect(first.auditHash).toBe(scrambled.auditHash);
  });

  it('exposes canonical payload builder for external verification', () => {
    const canonical = buildCanonicalEventPayload(baseInput);
    expect(canonical).toEqual({
      clinicianId: 'clin-123',
      eventType: 'LICENSE_VERIFIED',
      severity: TimelineEventSeverity.INFO,
      timestamp: '2025-01-01T00:00:00.000Z',
      metadata: {
        nested: { a: 1, b: 2 },
        state: 'CA',
        status: 'ACTIVE',
      },
    });
  });

  it('returns hash even when anchoring fails', async () => {
    const scrapbook = {
      anchorEvidenceHash: jest.fn().mockRejectedValue(new Error('anchor failed')),
    };

    const result = await addAuditStamp(baseInput, { auditScrapbook: scrapbook });

    expect(result.auditHash).toHaveLength(64);
    expect(result.anchorTxId).toBeUndefined();
  });
});
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createHash } from 'crypto';
import { addAuditStamp } from '../addAuditStamp';
import { CredentialTimelineEventType, TimelineEventSeverity } from '../models/CredentialTimelineEvent';

describe('addAuditStamp', () => {
  const mockScrapbook = {
    anchorEvidenceHash: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockScrapbook.anchorEvidenceHash.mockResolvedValue('tx-123');
  });

  it('hashes payload deterministically and anchors reviewer hashes', async () => {
    const timestamp = new Date('2025-11-15T00:00:00Z');
    const event = {
      clinicianId: 'clin-1',
      eventType: CredentialTimelineEventType.LICENSE_VERIFIED,
      severity: TimelineEventSeverity.INFO,
      timestamp,
      metadata: {
        source: 'STATE',
        licenseNumber: 'A12345',
      },
    };

    const expectedHash = createHash('sha256')
      .update(
        JSON.stringify({
          clinicianId: event.clinicianId,
          eventType: event.eventType,
          severity: event.severity,
          timestamp: timestamp.toISOString(),
          metadata: event.metadata,
        })
      )
      .digest('hex');

    const result = await addAuditStamp(event, {
      scrapbook: mockScrapbook as any,
      reviewers: ['reviewer-1'],
    });

    expect(result).toEqual({
      auditHash: expectedHash,
      anchorTxId: 'tx-123',
    });
    expect(mockScrapbook.anchorEvidenceHash).toHaveBeenCalledWith(
      expectedHash,
      [
        {
          originalId: 'reviewer-1',
          hash: createHash('sha256').update('reviewer-1').digest('hex'),
        },
      ],
      expect.objectContaining({
        timelineEventType: CredentialTimelineEventType.LICENSE_VERIFIED,
      })
    );
  });

  it('still returns hash when anchoring fails', async () => {
    const timestamp = new Date('2025-11-16T00:00:00Z');
    mockScrapbook.anchorEvidenceHash.mockRejectedValueOnce(new Error('chain down'));

    const result = await addAuditStamp(
      {
        clinicianId: 'clin-2',
        eventType: CredentialTimelineEventType.NPDB_QUERY,
        severity: TimelineEventSeverity.CRITICAL,
        timestamp,
      },
      { scrapbook: mockScrapbook as any }
    );

    const fallbackHash = createHash('sha256')
      .update(
        JSON.stringify({
          clinicianId: 'clin-2',
          eventType: CredentialTimelineEventType.NPDB_QUERY,
          severity: TimelineEventSeverity.CRITICAL,
          timestamp: timestamp.toISOString(),
          metadata: null,
        })
      )
      .digest('hex');

    expect(result.auditHash).toBe(fallbackHash);
    expect(result.anchorTxId).toBeUndefined();
  });
});


