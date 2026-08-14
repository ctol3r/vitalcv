import { readHireToStartCase } from '../hireToStartReadService';

const APPLICATION_ID = '11111111-1111-4111-8111-111111111111';
const PACKET_HASH = 'a'.repeat(64);

function packet(overrides: Record<string, unknown> = {}) {
  return {
    applicationId: APPLICATION_ID,
    opportunityId: '22222222-2222-4222-8222-222222222222',
    accessPerspective: 'employer' as const,
    mode: 'sealed' as const,
    submittedPacket: {
      packetVersion: 1,
      packetHash: PACKET_HASH,
      opportunityVersion: '2026-08-14T09:00:00.000Z',
      clinicianNpi: '1558302470',
      integrity: 'valid' as const,
      purpose: 'Apply with VitalCV',
      recipient: 'Hire Start Health',
      consentAt: '2026-08-14T10:00:00.000Z',
      consentReceiptId: 'consent-1',
      consentGrantId: null,
      selectedSections: ['identity'],
      withheldFieldIds: [],
      fields: [],
      sectionAbsences: [],
      unexplainedSectionIds: [],
      methodologyVersion: 'test-v1',
      clinicianNote: null,
      lifecycle: 'active' as const,
    },
    legacyNotice: null,
    ...overrides,
  };
}

function mission(overrides: Record<string, unknown> = {}) {
  return {
    status: 'open' as const,
    accessPerspective: 'employer' as const,
    mission: {
      id: 'activation-1',
      applicationId: APPLICATION_ID,
      clinicianNpi: '1558302470',
      clinicianUserId: 'clinician-1',
      organizationId: 'org-1',
      opportunityId: '22222222-2222-4222-8222-222222222222',
      opportunityTitle: 'Employed hospitalist',
      acceptedPacketId: 'packet-1',
      acceptedPacketHash: PACKET_HASH,
      acceptanceId: 'acceptance-1',
      intendedStartDate: '2026-09-01T08:00:00.000Z',
      urgency: 'priority' as const,
      state: 'requirements_in_progress' as const,
      rawState: 'requirements_in_progress',
      packetBinding: 'bound' as const,
      requirements: [{
        id: 'requirement-1',
        category: 'onboarding',
        label: 'Hospital orientation',
        necessity: 'required',
        status: 'not_started',
        owner: 'both',
        evidenceRule: null,
        dependencyIds: [],
        dueAt: null,
        resolvedBy: null,
        resolvedAt: null,
        policyVersion: 'policy-1',
      }],
      verificationRequests: [],
      recentCommunications: [],
      blockerSummary: [{
        requirementId: 'requirement-1',
        label: 'Hospital orientation',
        status: 'not_started',
        owner: 'both',
        dueAt: null,
      }],
      nextAction: {
        kind: 'clinician_requirement' as const,
        owner: 'clinician' as const,
        label: 'Hospital orientation',
        objectId: 'requirement-1',
      },
      limitations: [],
      createdAt: '2026-08-14T11:00:00.000Z',
      updatedAt: '2026-08-14T11:00:00.000Z',
      ...overrides,
    },
  };
}

function record(overrides: Record<string, unknown> = {}) {
  return {
    application: {
      id: APPLICATION_ID,
      status: 'ACCEPTED',
      createdAt: new Date('2026-08-14T10:00:00.000Z'),
      reviewedAt: new Date('2026-08-14T11:00:00.000Z'),
      opportunity: {
        id: '22222222-2222-4222-8222-222222222222',
        title: 'Employed hospitalist',
        specialty: 'Internal Medicine',
        hiringType: 'permanent',
        state: 'CA',
        organizationId: 'org-1',
        updatedAt: new Date('2026-08-14T09:00:00.000Z'),
      },
    },
    acceptance: {
      id: 'acceptance-1',
      status: 'ACCEPTED',
      packetHash: PACKET_HASH,
      acceptedAt: new Date('2026-08-14T11:00:00.000Z'),
    },
    attestation: null,
    auditEvents: [
      { type: 'APPLICATION_REVIEW_STARTED', createdAt: new Date('2026-08-14T10:30:00.000Z') },
      { type: 'APPLICATION_DECISION_RECORDED', createdAt: new Date('2026-08-14T11:00:00.000Z') },
    ],
    ...overrides,
  };
}

describe('readHireToStartCase', () => {
  it('joins the exact packet, decision, requirements, next action, and milestones', async () => {
    const readPacket = jest.fn().mockResolvedValue(packet());
    const result = await readHireToStartCase({
      applicationId: APPLICATION_ID,
      clerkUserId: 'employer-1',
    }, {
      readPacket,
      readMission: jest.fn().mockResolvedValue(mission()),
      load: jest.fn().mockResolvedValue(record()),
    } as never);

    expect(readPacket).toHaveBeenCalledWith({ applicationId: APPLICATION_ID, clerkUserId: 'employer-1' });
    expect(result.accessPerspective).toBe('employer');
    expect(result.packetBinding).toMatchObject({
      state: 'bound',
      packetVersion: 1,
      packetHash: PACKET_HASH,
      integrity: 'valid',
    });
    expect(result.decision).toMatchObject({
      state: 'accepted_as_head_start',
      acceptanceId: 'acceptance-1',
      institutionReviewRemains: true,
    });
    expect(result.currentStage).toBe('requirements_in_progress');
    expect(result.requirements).toHaveLength(1);
    expect(result.primaryNextAction.owner).toBe('clinician');
    expect(result.milestones.map(({ type }) => type)).toEqual([
      'application_submitted',
      'employer_first_review',
      'decision_recorded',
      'head_start_accepted',
    ]);
    expect(result.externalSystemSync).toEqual({
      state: 'not_configured',
      lastEventAt: null,
      limitations: ['No external ATS or credentialing event source is configured for this case.'],
    });
    expect(result).not.toHaveProperty('reviewNote');
  });

  it('reports an employer-confirmed actual first day while surfacing event divergence', async () => {
    const result = await readHireToStartCase({
      applicationId: APPLICATION_ID,
      clerkUserId: 'clinician-1',
    }, {
      readPacket: jest.fn().mockResolvedValue(packet({ accessPerspective: 'clinician' })),
      readMission: jest.fn().mockResolvedValue(mission({ state: 'started', rawState: 'started' })),
      load: jest.fn().mockResolvedValue(record({
        attestation: {
          id: 'start-1',
          acceptanceId: 'acceptance-1',
          startedAt: new Date('2026-09-02T15:00:00.000Z'),
          createdAt: new Date('2026-09-02T16:00:00.000Z'),
        },
      })),
    } as never);

    expect(result.currentStage).toBe('started');
    expect(result.actualStart).toEqual({
      attestationId: 'start-1',
      actualFirstDay: '2026-09-02T15:00:00.000Z',
      recordedAt: '2026-09-02T16:00:00.000Z',
      employerConfirmed: true,
    });
    expect(result.limitations).toContain('An employer start attestation exists without an application start event.');
  });

  it('keeps legacy submissions visibly unbound', async () => {
    const legacy = packet({
      mode: 'legacy',
      submittedPacket: null,
      legacyNotice: 'Legacy application — no immutable disclosure record was captured at submission.',
    });
    const legacyRecord = record({ acceptance: null });
    legacyRecord.application.status = 'REVIEWED';
    const result = await readHireToStartCase({
      applicationId: APPLICATION_ID,
      clerkUserId: 'clinician-1',
    }, {
      readPacket: jest.fn().mockResolvedValue(legacy),
      readMission: jest.fn().mockResolvedValue({
        status: 'not_opened',
        applicationId: APPLICATION_ID,
        opportunityId: legacy.opportunityId,
        accessPerspective: 'clinician',
        packetHash: null,
        notice: 'No Start Mission has been explicitly opened for this application.',
      }),
      load: jest.fn().mockResolvedValue(legacyRecord),
    } as never);

    expect(result.packetBinding.state).toBe('legacy_unbound');
    expect(result.packetBinding.integrity).toBe('legacy_unavailable');
    expect(result.packetBinding.limitations[0]).toContain('Legacy application');
    expect(result.currentStage).toBe('employer_review');
  });

  it('fails closed when acceptance and submitted packet hashes disagree', async () => {
    await expect(readHireToStartCase({
      applicationId: APPLICATION_ID,
      clerkUserId: 'employer-1',
    }, {
      readPacket: jest.fn().mockResolvedValue(packet()),
      readMission: jest.fn().mockResolvedValue(mission()),
      load: jest.fn().mockResolvedValue(record({
        acceptance: {
          id: 'acceptance-1',
          status: 'ACCEPTED',
          packetHash: 'b'.repeat(64),
          acceptedAt: new Date('2026-08-14T11:00:00.000Z'),
        },
      })),
    } as never)).rejects.toThrow(/binding is inconsistent/i);
  });
});
