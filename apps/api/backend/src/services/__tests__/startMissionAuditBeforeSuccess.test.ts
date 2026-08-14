import {
  createConsentGrantInTransaction,
  type ConsentGrantTransaction,
} from '../consent/consentGrantService';
import {
  appendCommunicationEventInTransaction,
  type CommunicationEventTransaction,
} from '../communications/communicationEventService';
import {
  issueHandoffReceiptInTransaction,
  type HandoffReceiptTransaction,
} from '../handoffs/handoffReceiptService';

const IDS = {
  org: '4b6f0000-0000-4000-8000-000000000001',
  app: '4b6f0000-0000-4000-8000-000000000002',
  grant: '4b6f0000-0000-4000-8000-000000000003',
  audit: '4b6f0000-0000-4000-8000-000000000004',
  handoff: '4b6f0000-0000-4000-8000-000000000005',
};

describe('Start Mission audit-before-success writes', () => {
  it('creates the consent audit before the grant row', async () => {
    const order: string[] = [];
    const tx: ConsentGrantTransaction = {
      auditEvent: {
        async create() {
          order.push('audit');
          return { id: IDS.audit };
        },
      },
      consentGrant: {
        async create(args) {
          order.push('grant');
          expect(args.data.auditEventId).toBe(IDS.audit);
          return {
            id: IDS.grant,
            grantHash: String(args.data.grantHash),
            auditEventId: IDS.audit,
            grantedAt: new Date('2026-07-30T12:00:00.000Z'),
            validUntil: null,
            revokedAt: null,
          };
        },
      },
    };

    await createConsentGrantInTransaction(tx, {
      clinicianUserId: 'user_1',
      clinicianNpi: '1558302470',
      organizationId: IDS.org,
      recipient: 'Example Health',
      purpose: 'employment consideration',
      action: 'share_packet',
      scope: { fields: ['identity.npi'] },
      applicationId: IDS.app,
      authenticationMethod: 'passkey',
      grantedAt: new Date('2026-07-30T12:00:00.000Z'),
    });

    expect(order).toEqual(['audit', 'grant']);
  });

  it('does not attempt a consent grant when the audit write fails', async () => {
    let grantCalled = false;
    const tx: ConsentGrantTransaction = {
      auditEvent: { async create() { throw new Error('audit unavailable'); } },
      consentGrant: {
        async create() {
          grantCalled = true;
          throw new Error('must not run');
        },
      },
    };

    await expect(createConsentGrantInTransaction(tx, {
      clinicianUserId: 'user_1',
      clinicianNpi: '1558302470',
      organizationId: IDS.org,
      recipient: 'Example Health',
      purpose: 'application',
      action: 'share_packet',
      scope: { fields: ['identity.npi'] },
      authenticationMethod: 'session',
    })).rejects.toThrow('audit unavailable');
    expect(grantCalled).toBe(false);
  });

  it('creates the communication audit before the append-only event', async () => {
    const order: string[] = [];
    const tx: CommunicationEventTransaction = {
      auditEvent: {
        async create() {
          order.push('audit');
          return { id: IDS.audit };
        },
      },
      communicationEvent: {
        async create(args) {
          order.push('communication');
          expect(args.data.auditEventId).toBe(IDS.audit);
          return {
            id: '4b6f0000-0000-4000-8000-000000000006',
            auditEventId: IDS.audit,
            channel: 'fax',
            providerMessageId: 'fax-1',
            occurredAt: new Date('2026-07-30T12:01:00.000Z'),
          };
        },
      },
    };

    await appendCommunicationEventInTransaction(tx, {
      applicationId: IDS.app,
      organizationId: IDS.org,
      direction: 'outbound',
      channel: 'fax',
      eventType: 'sent',
      status: 'accepted_by_provider',
      providerMessageId: 'fax-1',
      occurredAt: new Date('2026-07-30T12:01:00.000Z'),
    });

    expect(order).toEqual(['audit', 'communication']);
  });

  it('does not append communication when its audit fails', async () => {
    let eventCalled = false;
    const tx: CommunicationEventTransaction = {
      auditEvent: { async create() { throw new Error('audit unavailable'); } },
      communicationEvent: {
        async create() {
          eventCalled = true;
          throw new Error('must not run');
        },
      },
    };

    await expect(appendCommunicationEventInTransaction(tx, {
      direction: 'internal',
      channel: 'portal',
      eventType: 'draft_created',
      status: 'draft',
    })).rejects.toThrow('audit unavailable');
    expect(eventCalled).toBe(false);
  });

  it('creates the handoff audit before the immutable receipt', async () => {
    const order: string[] = [];
    const tx: HandoffReceiptTransaction = {
      auditEvent: {
        async create() {
          order.push('audit');
          return { id: IDS.audit };
        },
      },
      handoffReceipt: {
        async create(args) {
          order.push('receipt');
          expect(args.data.auditEventId).toBe(IDS.audit);
          return {
            id: '4b6f0000-0000-4000-8000-000000000007',
            handoffId: IDS.handoff,
            attemptNumber: 1,
            receiptHash: String(args.data.receiptHash),
            auditEventId: IDS.audit,
            status: 'delivered',
            issuedAt: new Date('2026-07-30T12:02:00.000Z'),
          };
        },
      },
      outboxEvent: {
        async upsert() {
          order.push('outbox');
          return { id: '4b6f0000-0000-4000-8000-000000000008' };
        },
      },
    };

    await issueHandoffReceiptInTransaction(tx, {
      handoffId: IDS.handoff,
      attemptNumber: 1,
      applicationId: IDS.app,
      consentGrantId: IDS.grant,
      payloadHash: 'payload-hash',
      recipientOrganizationId: IDS.org,
      recipient: 'Example Health',
      purpose: 'application',
      channel: 'webhook',
      status: 'delivered',
      deliveredAt: new Date('2026-07-30T12:02:00.000Z'),
      issuedAt: new Date('2026-07-30T12:02:00.000Z'),
    });

    expect(order).toEqual(['audit', 'receipt', 'outbox']);
  });

  it('does not issue a handoff receipt when its audit fails', async () => {
    let receiptCalled = false;
    const tx: HandoffReceiptTransaction = {
      auditEvent: { async create() { throw new Error('audit unavailable'); } },
      handoffReceipt: {
        async create() {
          receiptCalled = true;
          throw new Error('must not run');
        },
      },
      outboxEvent: {
        async upsert() {
          throw new Error('must not run');
        },
      },
    };

    await expect(issueHandoffReceiptInTransaction(tx, {
      handoffId: IDS.handoff,
      attemptNumber: 1,
      consentGrantId: IDS.grant,
      payloadHash: 'payload-hash',
      recipient: 'Example Health',
      purpose: 'application',
      channel: 'secure_link',
      status: 'logged_only',
    })).rejects.toThrow('audit unavailable');
    expect(receiptCalled).toBe(false);
  });
});
