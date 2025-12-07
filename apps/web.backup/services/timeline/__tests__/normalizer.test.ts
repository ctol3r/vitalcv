import { TimelineEventSeverity } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { registerTimelineNormalizers, type EventBusLike } from '../normalizer';

class FakeEventBus implements EventBusLike {
  private handlers = new Map<string, (payload: any) => Promise<void> | void>();

  onEvent(eventType: string, handler: (payload: any) => Promise<void> | void): void {
    this.handlers.set(eventType, handler);
  }

  async emit(eventType: string, payload: any): Promise<void> {
    const handler = this.handlers.get(eventType);
    if (handler) {
      await handler(payload);
    }
  }
}

describe('timeline normalizer', () => {
  let bus: FakeEventBus;
  let prisma: PrismaClient;
  const addAuditStampFn = jest
    .fn()
    .mockResolvedValue({ auditHash: 'hash-1', anchorTxId: 'tx-1' });

  beforeEach(() => {
    bus = new FakeEventBus();
    prisma = {
      credentialTimelineEvent: {
        create: jest.fn().mockResolvedValue({ id: 'evt' }),
      },
    } as unknown as PrismaClient;
    addAuditStampFn.mockClear();
    registerTimelineNormalizers({ eventBus: bus, prisma, addAuditStampFn });
  });

  it('stores NPDB events with warning severity when adverse actions exist', async () => {
    await bus.emit('NPDBQueryCompleted', {
      clinicianId: 'clin-1',
      queryId: 'npdb-1',
      status: 'HIT',
      adverseActionCount: 2,
      checkedAt: '2025-01-01T00:00:00Z',
    });

    expect(prisma.credentialTimelineEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicianId: 'clin-1',
        eventType: 'NPDB_QUERY',
        severity: TimelineEventSeverity.WARNING,
        timestamp: new Date('2025-01-01T00:00:00Z'),
        auditHash: 'hash-1',
        anchorTxId: 'tx-1',
      }),
    });
    expect(addAuditStampFn).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicianId: 'clin-1',
        eventType: 'NPDB_QUERY',
      })
    );
  });

  it('maps PECOS denial to warning severity', async () => {
    await bus.emit('PECOSVerificationCompleted', {
      clinicianId: 'clin-2',
      enrollmentId: 'enr-1',
      status: 'DENIED',
      checkedAt: '2025-01-05T00:00:00Z',
    });

    expect(prisma.credentialTimelineEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicianId: 'clin-2',
        eventType: 'PECOS_VERIFIED',
        severity: TimelineEventSeverity.WARNING,
      }),
    });
  });

  it('maps active license checks to info severity', async () => {
    await bus.emit('LicenseVerificationCompleted', {
      clinicianId: 'clin-3',
      state: 'CA',
      licenseNumber: 'A1234',
      status: 'ACTIVE',
      checkedAt: '2025-01-10T00:00:00Z',
      source: 'state_board',
    });

    expect(prisma.credentialTimelineEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicianId: 'clin-3',
        eventType: 'LICENSE_VERIFIED',
        severity: TimelineEventSeverity.INFO,
      }),
    });
  });

  it('captures privilege grant metadata', async () => {
    await bus.emit('PrivilegeGranted', {
      clinicianId: 'clin-4',
      privilegeGrantedId: 'priv-1',
      privilegeSetName: 'Cardiology',
      grantedAt: '2025-01-15T00:00:00Z',
      expiresAt: '2025-06-15T00:00:00Z',
      severity: TimelineEventSeverity.NOTICE,
      metadata: { orgId: 'org-9' },
    });

    expect(prisma.credentialTimelineEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicianId: 'clin-4',
        eventType: 'PRIVILEGE_GRANTED',
        severity: TimelineEventSeverity.NOTICE,
        metadata: expect.objectContaining({
          privilegeGrantedId: 'priv-1',
          privilegeSetName: 'Cardiology',
          orgId: 'org-9',
          expiresAt: new Date('2025-06-15T00:00:00Z').toISOString(),
        }),
      }),
    });
  });
});
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { eventBus } from '../../../backend/src/services/notifications/eventBus';
import {
  CredentialTimelineEventType,
  TimelineEventSeverity,
} from '../models/CredentialTimelineEvent';

jest.mock('../models/CredentialTimelineEvent', () => {
  const actual = jest.requireActual('../models/CredentialTimelineEvent');
  return {
    ...actual,
    createCredentialTimelineEvent: jest.fn(),
  };
});

const { createCredentialTimelineEvent } = jest.requireMock('../models/CredentialTimelineEvent');

import '../normalizer';

describe('timeline normalizer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes NPDB events', async () => {
    await eventBus.publish('NPDBQueryCompleted', {
      npdbQueryId: 'npdb-1',
      clinicianId: 'clin-1',
      state: 'CA',
      hasAdverseAction: true,
      summary: 'Adverse action found',
      completedAt: '2025-11-15T00:00:00Z',
      metadata: { docket: '123' },
    });

    expect(createCredentialTimelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicianId: 'clin-1',
        eventType: CredentialTimelineEventType.NPDB_QUERY,
        severity: TimelineEventSeverity.CRITICAL,
        metadata: expect.objectContaining({
          state: 'CA',
          details: expect.objectContaining({ hasAdverseAction: true }),
        }),
      })
    );
  });

  it('normalizes PECOS events with warning severity for denied status', async () => {
    await eventBus.publish('PecosVerificationCompleted', {
      clinicianId: 'clin-2',
      pecosId: 'pecos-9',
      status: 'DENIED',
      cycle: 'STANDARD',
    });

    expect(createCredentialTimelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicianId: 'clin-2',
        eventType: CredentialTimelineEventType.PECOS_VERIFIED,
        severity: TimelineEventSeverity.WARNING,
      })
    );
  });

  it('normalizes license verification events', async () => {
    await eventBus.publish('LicenseVerificationCompleted', {
      clinicianId: 'clin-3',
      licenseNumber: 'A12345',
      state: 'WA',
      status: 'ACTIVE',
      boardName: 'WA Medical Board',
      verifiedAt: '2025-11-10T00:00:00Z',
    });

    expect(createCredentialTimelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicianId: 'clin-3',
        eventType: CredentialTimelineEventType.LICENSE_VERIFIED,
        severity: TimelineEventSeverity.INFO,
        metadata: expect.objectContaining({
          licenseNumber: 'A12345',
        }),
      })
    );
  });

  it('normalizes privilege approvals into privilege granted events', async () => {
    await eventBus.publish('PrivilegeApproved', {
      privilegeRequestId: 'req-1',
      orgId: 'org-1',
      clinicianDid: 'did:example:123',
      privilegeSetName: 'ICU',
      status: 'APPROVED',
    } as any);

    expect(createCredentialTimelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicianId: 'did:example:123',
        eventType: CredentialTimelineEventType.PRIVILEGE_GRANTED,
      })
    );
  });
});


