import { storeDecisionCapsule } from '../decisionCapsuleStorage';

describe('decisionCapsuleStorage', () => {
  it('stores an append-only decision capsule with the canonical storage shape', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'capsule-1',
      subjectNpi: '1234567890',
      organizationId: '550e8400-e29b-41d4-a716-446655440000',
      decisionTimestamp: new Date('2026-04-15T20:00:00.000Z'),
      metadata: {
        schema: 'vitalcv.decision-capsule.storage.v1',
        role: 'Recruiter',
        blockers: ['DEA registration missing'],
        outcome: 'ACCEPTED',
      },
    });

    const capsule = await storeDecisionCapsule(
      {
        decisionCapsule: { create },
      },
      {
        clinicianId: '1234567890',
        orgId: '550e8400-e29b-41d4-a716-446655440000',
        role: 'Recruiter',
        blockers: ['DEA registration missing', 'DEA registration missing'],
        outcome: 'ACCEPTED',
        timestamp: '2026-04-15T20:00:00.000Z',
        auditEventId: 'audit-1',
        entityId: 'entity-1',
      },
    );

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        subjectDid: 'did:vitalcv:1234567890',
        subjectNpi: '1234567890',
        decisionType: 'HIRING',
        methodology: 'decision_capsule_storage.v1',
        status: 'VALID',
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        metadata: expect.objectContaining({
          schema: 'vitalcv.decision-capsule.storage.v1',
          appendOnly: true,
          auditFirst: true,
          triggerEvent: 'employment_acceptance',
          sourceReferenceId: 'audit-1',
          clinicianId: '1234567890',
          orgId: '550e8400-e29b-41d4-a716-446655440000',
          role: 'Recruiter',
          blockers: ['DEA registration missing'],
          outcome: 'ACCEPTED',
          timestamp: '2026-04-15T20:00:00.000Z',
          entityId: 'entity-1',
        }),
      }),
    }));

    expect(capsule).toEqual({
      id: 'capsule-1',
      clinicianId: '1234567890',
      orgId: '550e8400-e29b-41d4-a716-446655440000',
      role: 'Recruiter',
      blockers: ['DEA registration missing'],
      outcome: 'ACCEPTED',
      timestamp: '2026-04-15T20:00:00.000Z',
    });
  });

  it('fails closed on an invalid clinician id', async () => {
    await expect(storeDecisionCapsule(
      {
        decisionCapsule: { create: jest.fn() },
      },
      {
        clinicianId: 'not-an-npi',
        orgId: null,
        role: null,
        blockers: [],
        outcome: 'ACCEPTED',
        timestamp: '2026-04-15T20:00:00.000Z',
        auditEventId: 'audit-1',
        entityId: 'entity-1',
      },
    )).rejects.toThrow('DecisionCapsule clinicianId must be a 10-digit NPI.');
  });
});
