jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
    vcvOrganizationContext: {
      findUnique: jest.fn(),
    },
    vcvOrgContextSubject: {
      findUnique: jest.fn(),
    },
    bundleShareEvent: {
      findFirst: jest.fn(),
    },
    employerAcceptance: {
      create: jest.fn(),
    },
    auditEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    outboxEvent: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../passportService', () => ({
  buildPassportByNpi: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../trust/trustScoreV1', () => ({
  computeTrustScoreV1: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import {
  loadEmployerAcceptanceHistory,
  loadEmployerReviewStatus,
  recordEmployerReviewAcceptance,
  resolveReviewerAcceptanceIdentity,
} from '../employerReviewActions';

const prismaMock = prisma as unknown as {
  user: {
    findUnique: jest.Mock;
  };
  vcvOrganizationContext: {
    findUnique: jest.Mock;
  };
  vcvOrgContextSubject: {
    findUnique: jest.Mock;
  };
  bundleShareEvent: {
    findFirst: jest.Mock;
  };
  employerAcceptance: {
    create: jest.Mock;
  };
  auditEvent: {
    create: jest.Mock;
    findMany: jest.Mock;
  };
  outboxEvent: {
    upsert: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe('employerReviewActions service', () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockReset();
    // Default: reviewer with no organization binding (legacy semantics).
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.vcvOrganizationContext.findUnique.mockReset();
    prismaMock.vcvOrgContextSubject.findUnique.mockReset();
    prismaMock.bundleShareEvent.findFirst.mockReset();
    prismaMock.employerAcceptance.create.mockReset();
    prismaMock.auditEvent.create.mockReset();
    prismaMock.auditEvent.findMany.mockReset();
    prismaMock.outboxEvent.upsert.mockReset();
    prismaMock.$transaction.mockReset();

    prismaMock.vcvOrganizationContext.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === 'ctx-1') {
        return {
          id: 'ctx-1',
          requestorId: 'org-entity-1',
          contextType: 'EMPLOYMENT_REVIEW',
          status: 'PENDING',
          title: 'Employment review',
          description: null,
          webhookUrl: null,
          requestor: {
            id: 'org-entity-1',
            displayName: 'Providence',
          },
        };
      }

      return null;
    });
    prismaMock.vcvOrgContextSubject.findUnique.mockResolvedValue({
      id: 'ctx-subject-1',
    });
    prismaMock.bundleShareEvent.findFirst.mockResolvedValue({
      id: 'share-1',
      bundleId: 'bundle-1',
      subjectEntityId: 'entity-1',
      organizationContextId: 'ctx-1',
      organizationId: 'org-entity-1',
      organizationName: 'Providence',
      purposeOfUse: 'Employment review',
    });
    prismaMock.employerAcceptance.create.mockResolvedValue({
      id: 'accept-1',
      acceptedAt: new Date('2026-03-23T18:00:00.000Z'),
    });
    prismaMock.auditEvent.create.mockResolvedValue({
      id: 'audit-1',
      createdAt: new Date('2026-03-23T18:00:00.000Z'),
    });
    prismaMock.outboxEvent.upsert.mockResolvedValue({
      id: 'outbox-1',
    });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
  });

  it('persists explicit organization-context attribution onto acceptance audit events', async () => {
    const state = await recordEmployerReviewAcceptance({
      entityId: 'entity-1',
      employerId: 'employer-1',
      clinicianNpi: '1234567890',
      organizationContextId: 'ctx-1',
    });

    expect(state.attribution).toEqual({
      source: 'organization_context',
      organizationContextId: 'ctx-1',
      bundleShareEventId: null,
      bundleId: null,
      requestorEntityId: 'org-entity-1',
      organizationId: 'org-entity-1',
      organizationName: 'Providence',
      purposeOfUse: 'Employment review',
    });
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'EMPLOYER_REVIEW_ACCEPTED',
        referenceId: 'accept-1',
        organizationId: 'org-entity-1',
        metadata: expect.objectContaining({
          employerReviewAction: expect.objectContaining({
            acceptance: {
              acceptedByOrgId: 'org-entity-1',
              acceptedAt: expect.any(String),
              acceptanceScope: 'pilot',
              acceptanceReason: 'Accepted as head start using VitalCV verification.',
            },
            correlationId: expect.any(String),
            mutationFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
            actor: {
              actorId: 'employer-1',
              actorType: 'human',
              attributionSource: 'x-clerk-user-id',
            },
            mutationClassification: 'TRUST_ACCEPTANCE',
            replayCategory: 'R-CAT-1',
            payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
            attribution: expect.objectContaining({
              source: 'organization_context',
              organizationContextId: 'ctx-1',
              organizationId: 'org-entity-1',
            }),
          }),
        }),
      }),
    }));
  });

  it('writes the required entityId and organization onto the acceptance row', async () => {
    // Regression guard. entityId and organization are NOT NULL in the DDL, and
    // this create used to omit them under a // @ts-nocheck — so every accept
    // threw at Prisma validation and the transaction rolled back. No test
    // asserted on the create args, so nothing caught it. This asserts them.
    await recordEmployerReviewAcceptance({
      entityId: 'entity-1',
      employerId: 'employer-1',
      clinicianNpi: '1234567890',
      organizationContextId: 'ctx-1',
    });

    expect(prismaMock.employerAcceptance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityId: 'entity-1',
          organization: 'employer-1',
          employerId: 'employer-1',
          clinicianNpi: '1234567890',
        }),
      }),
    );
  });

  it('writes employerId as the reviewer ORGANIZATION id and acceptedBy as the Clerk user id when bound (ADR 0007)', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ organizationId: 'org-uuid-1' });

    await recordEmployerReviewAcceptance({
      entityId: 'entity-1',
      employerId: 'employer-1',
      clinicianNpi: '1234567890',
      organizationContextId: 'ctx-1',
    });

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { clerkUserId: 'employer-1' },
      select: { organizationId: true },
    });
    expect(prismaMock.employerAcceptance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          // The row is keyed by the ORGANIZATION, matching door A's readers.
          employerId: 'org-uuid-1',
          // The acting human moves to acceptedBy.
          acceptedBy: 'employer-1',
          metadata: expect.objectContaining({
            acceptedByClerkUserId: 'employer-1',
            employerIdSemantics: 'organization',
          }),
        }),
      }),
    );
  });

  it('preserves clerk-id employerId for an org-less reviewer and marks the row legacy_clerk_user', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ organizationId: null });

    await recordEmployerReviewAcceptance({
      entityId: 'entity-1',
      employerId: 'employer-1',
      clinicianNpi: '1234567890',
      organizationContextId: 'ctx-1',
    });

    expect(prismaMock.employerAcceptance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employerId: 'employer-1',
          acceptedBy: 'employer-1',
          metadata: expect.objectContaining({
            acceptedByClerkUserId: 'employer-1',
            employerIdSemantics: 'legacy_clerk_user',
          }),
        }),
      }),
    );
  });

  it('resolveReviewerAcceptanceIdentity returns both lookup ids for an org-bound reviewer and one for the rest', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ organizationId: 'org-uuid-1' });
    await expect(resolveReviewerAcceptanceIdentity('employer-1')).resolves.toEqual({
      clerkUserId: 'employer-1',
      organizationId: 'org-uuid-1',
      acceptanceEmployerIds: ['org-uuid-1', 'employer-1'],
    });

    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    await expect(resolveReviewerAcceptanceIdentity('employer-2')).resolves.toEqual({
      clerkUserId: 'employer-2',
      organizationId: null,
      acceptanceEmployerIds: ['employer-2'],
    });
  });

  it('links the acceptance to the sealed packet when applicationId + packetHash are supplied (ACT-1.2)', async () => {
    await recordEmployerReviewAcceptance({
      entityId: 'entity-1',
      employerId: 'employer-1',
      clinicianNpi: '1234567890',
      applicationId: 'app-42',
      packetHash: 'sha256:seal',
    });

    expect(prismaMock.employerAcceptance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ applicationId: 'app-42', packetHash: 'sha256:seal' }),
      }),
    );
  });

  it('leaves the linkage null on the NPI-keyed path (no application in hand)', async () => {
    await recordEmployerReviewAcceptance({
      entityId: 'entity-1',
      employerId: 'employer-1',
      clinicianNpi: '1234567890',
    });

    expect(prismaMock.employerAcceptance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ applicationId: null, packetHash: null }),
      }),
    );
  });

  it('builds portable acceptance history with anonymized pilot organization labels', async () => {
    prismaMock.auditEvent.findMany.mockResolvedValue([
      {
        id: 'audit-accept-2',
        createdAt: new Date('2026-03-24T20:00:00.000Z'),
        metadata: {
          employerReviewAction: {
            action: 'accept',
            employerId: 'employer-2',
            entityId: 'entity-1',
            clinicianNpi: '1234567890',
            requestId: 'req-accept-2',
            attribution: {
              source: 'organization_context',
              organizationContextId: 'ctx-2',
              bundleShareEventId: null,
              bundleId: null,
              requestorEntityId: 'org-entity-2',
              organizationId: 'org-entity-2',
              organizationName: 'Second Org',
              purposeOfUse: 'Employment review',
            },
            persistence: {
              mode: 'durable_record',
              target: 'employer_acceptance',
              acceptanceId: 'accept-2',
              reviewItemId: null,
              outboxEventId: 'outbox-2',
              reviewItemCreated: false,
            },
            summary: {
              title: 'Head start accepted',
              description: 'The employer acceptance was persisted and linked to an audit event.',
            },
            details: {
              staleSources: [],
              missingDomains: [],
              reason: null,
              priority: null,
            },
            context: {
              role: null,
              facility: null,
              notes: null,
            },
            acceptance: {
              acceptedByOrgId: 'org-entity-2',
              acceptedAt: '2026-03-24T20:00:00.000Z',
              acceptanceScope: 'pilot',
              acceptanceReason: 'Accepted as head start using VitalCV verification.',
            },
          },
        },
      },
      {
        id: 'audit-accept-1',
        createdAt: new Date('2026-03-23T18:00:00.000Z'),
        metadata: {
          employerReviewAction: {
            action: 'accept',
            employerId: 'employer-1',
            entityId: 'entity-1',
            clinicianNpi: '1234567890',
            requestId: 'req-accept-1',
            attribution: {
              source: 'organization_context',
              organizationContextId: 'ctx-1',
              bundleShareEventId: null,
              bundleId: null,
              requestorEntityId: 'org-entity-1',
              organizationId: 'org-entity-1',
              organizationName: 'First Org',
              purposeOfUse: 'Employment review',
            },
            persistence: {
              mode: 'durable_record',
              target: 'employer_acceptance',
              acceptanceId: 'accept-1',
              reviewItemId: null,
              outboxEventId: 'outbox-1',
              reviewItemCreated: false,
            },
            summary: {
              title: 'Head start accepted',
              description: 'The employer acceptance was persisted and linked to an audit event.',
            },
            details: {
              staleSources: [],
              missingDomains: [],
              reason: null,
              priority: null,
            },
            context: {
              role: null,
              facility: null,
              notes: null,
            },
            acceptance: {
              acceptedByOrgId: 'org-entity-1',
              acceptedAt: '2026-03-23T18:00:00.000Z',
              acceptanceScope: 'pilot',
              acceptanceReason: 'Accepted as head start using VitalCV verification.',
            },
          },
        },
      },
    ]);

    const history = await loadEmployerAcceptanceHistory({
      entityId: 'entity-1',
      clinicianNpi: '1234567890',
    });

    expect(history.summary).toEqual({
      acceptedOrganizationCount: 2,
      hasPriorAcceptances: true,
      headline: 'Accepted by 2 organizations',
      trustCopy: 'This clinician has already been accepted using VitalCV verification. Each acceptance remains scoped to the organization and scope shown below.',
    });
    expect(history.history).toEqual([
      expect.objectContaining({
        acceptanceId: 'accept-2',
        orgLabel: 'Pilot organization 1',
        acceptanceScope: 'pilot',
        isAnonymized: true,
      }),
      expect.objectContaining({
        acceptanceId: 'accept-1',
        orgLabel: 'Pilot organization 2',
        acceptanceScope: 'pilot',
        isAnonymized: true,
      }),
    ]);
  });

  it('never copies private review notes into the stored acceptance reason', async () => {
    await recordEmployerReviewAcceptance({
      entityId: 'entity-1',
      employerId: 'employer-1',
      clinicianNpi: '1234567890',
      organizationContextId: 'ctx-1',
      notes: 'Internal fit assessment — do not circulate.',
    });

    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          employerReviewAction: expect.objectContaining({
            acceptance: expect.objectContaining({
              acceptanceReason: 'Accepted as head start using VitalCV verification.',
            }),
            context: expect.objectContaining({
              notes: 'Internal fit assessment — do not circulate.',
            }),
          }),
        }),
      }),
    }));
  });

  it('suppresses private notes from the public acceptance history read', async () => {
    const buildAcceptanceEvent = (input: {
      id: string;
      acceptanceId: string;
      notes: string;
      acceptanceReason?: string;
      acceptanceScope?: string;
      acceptedAt?: string;
    }) => ({
      id: input.id,
      createdAt: new Date(input.acceptedAt ?? '2026-03-23T18:00:00.000Z'),
      metadata: {
        employerReviewAction: {
          action: 'accept',
          employerId: 'employer-1',
          entityId: 'entity-1',
          clinicianNpi: '1234567890',
          requestId: `req-${input.id}`,
          attribution: {
            source: 'organization_context',
            organizationContextId: 'ctx-1',
            bundleShareEventId: null,
            bundleId: null,
            requestorEntityId: 'org-entity-1',
            organizationId: 'org-entity-1',
            organizationName: 'First Org',
            purposeOfUse: 'Employment review',
          },
          persistence: {
            mode: 'durable_record',
            target: 'employer_acceptance',
            acceptanceId: input.acceptanceId,
            reviewItemId: null,
            outboxEventId: null,
            reviewItemCreated: false,
          },
          summary: {
            title: 'Head start accepted',
            description: 'The employer acceptance was persisted and linked to an audit event.',
          },
          details: {
            staleSources: [],
            missingDomains: [],
            reason: null,
            priority: null,
          },
          context: {
            role: null,
            facility: null,
            notes: input.notes,
          },
          acceptance: {
            acceptedByOrgId: 'org-entity-1',
            acceptedAt: input.acceptedAt ?? '2026-03-23T18:00:00.000Z',
            acceptanceScope: input.acceptanceScope ?? 'pilot',
            ...(input.acceptanceReason !== undefined
              ? { acceptanceReason: input.acceptanceReason }
              : {}),
          },
        },
      },
    });

    // Legacy record: the old write path copied context.notes into
    // acceptanceReason when the employer gave no explicit reason.
    const legacyNotesCopy = buildAcceptanceEvent({
      id: 'audit-legacy',
      acceptanceId: 'accept-legacy',
      notes: 'Great culture fit — internal only.',
      acceptanceReason: 'Great culture fit — internal only.',
    });
    // Record with no stored reason at all: history must not fall back to notes.
    const reasonAbsent = buildAcceptanceEvent({
      id: 'audit-absent',
      acceptanceId: 'accept-absent',
      notes: 'Budget approved internally.',
    });
    // Named, non-pilot acceptance: org identity is deliberately public, so the
    // org id stays. Anonymized entries above must ship acceptedByOrgId: null.
    const namedScope = buildAcceptanceEvent({
      id: 'audit-named',
      acceptanceId: 'accept-named',
      notes: 'Panel review complete.',
      acceptanceReason: 'Accepted for full credentialing head start.',
      acceptanceScope: 'full',
      acceptedAt: '2026-03-25T18:00:00.000Z',
    });

    prismaMock.auditEvent.findMany.mockResolvedValue([legacyNotesCopy, reasonAbsent, namedScope]);

    const history = await loadEmployerAcceptanceHistory({
      entityId: 'entity-1',
      clinicianNpi: '1234567890',
    });

    expect(history.history).toEqual([
      expect.objectContaining({
        acceptanceId: 'accept-named',
        orgLabel: 'First Org',
        isAnonymized: false,
        acceptedByOrgId: 'org-entity-1',
        acceptanceReason: 'Accepted for full credentialing head start.',
      }),
      expect.objectContaining({
        acceptanceId: 'accept-legacy',
        acceptanceReason: 'Accepted as head start using VitalCV verification.',
        acceptedByOrgId: null,
      }),
      expect.objectContaining({
        acceptanceId: 'accept-absent',
        acceptanceReason: null,
        acceptedByOrgId: null,
      }),
    ]);

    const serialized = JSON.stringify(history);
    expect(serialized).not.toContain('Great culture fit');
    expect(serialized).not.toContain('Budget approved internally');
    expect(serialized).not.toContain('Panel review complete');
  });

  it('persists bundle fallback attribution onto acceptance audit events using the canonical organization context', async () => {
    const state = await recordEmployerReviewAcceptance({
      entityId: 'entity-1',
      employerId: 'employer-1',
      clinicianNpi: '1234567890',
      bundleId: 'bundle-1',
    });

    expect(state.attribution).toEqual({
      source: 'bundle_share',
      organizationContextId: 'ctx-1',
      bundleShareEventId: 'share-1',
      bundleId: 'bundle-1',
      requestorEntityId: 'org-entity-1',
      organizationId: 'org-entity-1',
      organizationName: 'Providence',
      purposeOfUse: 'Employment review',
    });
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'EMPLOYER_REVIEW_ACCEPTED',
        referenceId: 'accept-1',
        organizationId: 'org-entity-1',
        metadata: expect.objectContaining({
          employerReviewAction: expect.objectContaining({
            attribution: expect.objectContaining({
              source: 'bundle_share',
              organizationContextId: 'ctx-1',
              bundleShareEventId: 'share-1',
              bundleId: 'bundle-1',
              organizationId: 'org-entity-1',
            }),
            mutationClassification: 'TRUST_ACCEPTANCE',
            replayCategory: 'R-CAT-1',
            payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          }),
        }),
      }),
    }));
  });

  it('keeps review continuity between bundle fallback and employer-request context', async () => {
    prismaMock.bundleShareEvent.findFirst
      .mockResolvedValueOnce({
        id: 'share-1',
        bundleId: 'bundle-1',
        subjectEntityId: 'entity-1',
        organizationContextId: 'ctx-1',
        organizationId: 'legacy-org',
        organizationName: 'Legacy Providence',
        purposeOfUse: 'Legacy employment review',
      })
      .mockResolvedValueOnce({
        id: 'share-1',
      });
    prismaMock.auditEvent.findMany.mockResolvedValue([{
      id: 'audit-accept-1',
      createdAt: new Date('2026-03-23T19:46:00.000Z'),
      metadata: {
        employerReviewAction: {
          action: 'accept',
          employerId: 'employer-1',
          entityId: 'entity-1',
          clinicianNpi: '1234567890',
          requestId: 'req-accept-1',
          attribution: {
            source: 'organization_context',
            organizationContextId: 'ctx-1',
            bundleShareEventId: null,
            bundleId: null,
            requestorEntityId: 'org-entity-1',
            organizationId: 'org-entity-1',
            organizationName: 'Providence',
            purposeOfUse: 'Employment review',
          },
          persistence: {
            mode: 'durable_record',
            target: 'employer_acceptance',
            acceptanceId: 'accept-1',
            reviewItemId: null,
            outboxEventId: 'outbox-1',
            reviewItemCreated: false,
          },
          summary: {
            title: 'Head start accepted',
            description: 'The employer acceptance was persisted and linked to an audit event.',
          },
          details: {
            staleSources: [],
            missingDomains: [],
            reason: null,
            priority: null,
          },
          context: {
            role: null,
            facility: null,
            notes: null,
          },
        },
      },
    }]);

    const state = await loadEmployerReviewStatus({
      entityId: 'entity-1',
      employerId: 'employer-1',
      clinicianNpi: '1234567890',
      bundleId: 'bundle-1',
    });

    expect(state).toEqual(expect.objectContaining({
      action: 'accept',
      auditEventId: 'audit-accept-1',
      attribution: expect.objectContaining({
        source: 'organization_context',
        organizationContextId: 'ctx-1',
        organizationId: 'org-entity-1',
      }),
      persistence: expect.objectContaining({
        outboxEventId: 'outbox-1',
      }),
    }));
  });

  it('keeps review continuity when a stored bundle-share attribution is reopened by organization context', async () => {
    prismaMock.auditEvent.findMany.mockResolvedValue([{
      id: 'audit-accept-2',
      createdAt: new Date('2026-03-23T20:10:00.000Z'),
      metadata: {
        employerReviewAction: {
          action: 'accept',
          employerId: 'employer-1',
          entityId: 'entity-1',
          clinicianNpi: '1234567890',
          requestId: 'req-accept-2',
          attribution: {
            source: 'bundle_share',
            organizationContextId: 'ctx-1',
            bundleShareEventId: 'share-1',
            bundleId: 'bundle-1',
            requestorEntityId: 'org-entity-1',
            organizationId: 'org-entity-1',
            organizationName: 'Providence',
            purposeOfUse: 'Employment review',
          },
          persistence: {
            mode: 'durable_record',
            target: 'employer_acceptance',
            acceptanceId: 'accept-1',
            reviewItemId: null,
            outboxEventId: 'outbox-1',
            reviewItemCreated: false,
          },
          summary: {
            title: 'Head start accepted',
            description: 'The employer acceptance was persisted and linked to an audit event.',
          },
          details: {
            staleSources: [],
            missingDomains: [],
            reason: null,
            priority: null,
          },
          context: {
            role: null,
            facility: null,
            notes: null,
          },
        },
      },
    }]);

    const state = await loadEmployerReviewStatus({
      entityId: 'entity-1',
      employerId: 'employer-1',
      clinicianNpi: '1234567890',
      organizationContextId: 'ctx-1',
    });

    expect(state).toEqual(expect.objectContaining({
      action: 'accept',
      auditEventId: 'audit-accept-2',
      attribution: expect.objectContaining({
        source: 'bundle_share',
        organizationContextId: 'ctx-1',
        bundleShareEventId: 'share-1',
        organizationId: 'org-entity-1',
      }),
      persistence: expect.objectContaining({
        acceptanceId: 'accept-1',
        outboxEventId: 'outbox-1',
      }),
    }));
  });
});
