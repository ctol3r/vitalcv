const mockOutboxUpsert = jest.fn();

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    outboxEvent: {
      upsert: mockOutboxUpsert,
    },
  },
}));

import { enqueueDecisionCapsuleCreatedEvent } from '../decisionOutbox';

describe('enqueueDecisionCapsuleCreatedEvent', () => {
  beforeEach(() => {
    mockOutboxUpsert.mockReset();
    mockOutboxUpsert.mockResolvedValue({ id: 'outbox-1' });
  });

  test('persists verifier decision payloads into outbox_events', async () => {
    const outboxId = await enqueueDecisionCapsuleCreatedEvent({
      capsuleId: 'capsule-1',
      subjectDid: 'did:vitalcv:1003000126',
      subjectNpi: '1003000126',
      trustStateHash: 'a'.repeat(64),
      verifierOrg: 'org-1',
      decisionType: 'HIRING',
      decisionAction: 'APPROVE',
      triggerEvent: 'verifier_decision',
      sourceReferenceId: 'app-1',
      artifactHash: 'b'.repeat(64),
      decisionTimestamp: '2026-03-14T12:00:00.000Z',
      methodologyVersion: 'decision_capsule.v262',
      credentialIds: ['cred-1'],
      issuerIds: ['issuer-1'],
    });

    expect(outboxId).toBe('outbox-1');
    expect(mockOutboxUpsert).toHaveBeenCalledWith({
      where: {
        dedupeKey: `DECISION_CAPSULE_CREATED:capsule-1:${'b'.repeat(64)}`,
      },
      create: expect.objectContaining({
        eventType: 'DECISION_CAPSULE_CREATED',
        aggregateType: 'DECISION_CAPSULE',
        aggregateId: 'capsule-1',
        dedupeKey: `DECISION_CAPSULE_CREATED:capsule-1:${'b'.repeat(64)}`,
        payload: expect.objectContaining({
          subjectDid: 'did:vitalcv:1003000126',
          subjectNpi: '1003000126',
          trustStateHash: 'a'.repeat(64),
          verifierOrg: 'org-1',
          decisionType: 'HIRING',
          decisionAction: 'APPROVE',
          credentialIds: ['cred-1'],
          artifactHash: 'b'.repeat(64),
          decisionTimestamp: '2026-03-14T12:00:00.000Z',
        }),
      }),
      update: expect.objectContaining({
        status: 'PENDING',
        lastError: null,
      }),
      select: { id: true },
    });
  });
});
