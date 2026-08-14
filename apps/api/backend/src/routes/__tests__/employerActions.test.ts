import { PassThrough } from 'node:stream';
import express from 'express';
import request from 'supertest';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    vcvEntity: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    employerAcceptance: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    applicationPacket: {
      findFirst: jest.fn(),
    },
    startAttestation: {
      create: jest.fn(),
    },
    auditEvent: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    outboxEvent: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../services/seal/sealEventCapture', () => ({
  captureAdvisoryEvent: jest.fn(),
  captureEmployerDecision: jest.fn(),
  captureStartOutcome: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/activation/applicationStartCommandService', () => ({
  confirmStartByAcceptance: jest.fn(),
}));

jest.mock('../../services/feedback/prismaEventStore', () => ({
  emitLearningEvent: jest.fn(),
}));

jest.mock('../../services/entity/passportService', () => ({
  buildPassport: jest.fn(),
  buildPassportByNpi: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../services/trust/trustScoreV1', () => ({
  computeTrustScoreV1: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../services/entity/employerPacket', () => ({
  buildEmployerEvidencePacket: jest.fn(),
}));

jest.mock('../../services/entity/employerPacketExport', () => ({
  createEmployerEvidencePacketZipStream: jest.fn(),
}));

jest.mock('../../services/trust/container/trustContainerIssuance', () => ({
  issueTrustContainerManifestEntry: jest.fn(),
}));

jest.mock('../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../graphql/prisma_client';
import {
  captureAdvisoryEvent,
  captureEmployerDecision,
} from '../../services/seal/sealEventCapture';
import {
  buildPassport,
} from '../../services/entity/passportService';
import { buildEmployerEvidencePacket } from '../../services/entity/employerPacket';
import { createEmployerEvidencePacketZipStream } from '../../services/entity/employerPacketExport';
import { issueTrustContainerManifestEntry } from '../../services/trust/container/trustContainerIssuance';
import { confirmStartByAcceptance } from '../../services/activation/applicationStartCommandService';
import { registerEmployerActionRoutes } from '../employerActions';
import { sha256ForPayload } from '../../utils/deterministic';

const prismaMock = prisma as unknown as {
  vcvEntity: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
  };
  user: {
    findUnique: jest.Mock;
  };
  employerAcceptance: {
    findFirst: jest.Mock;
    create: jest.Mock;
  };
  applicationPacket: {
    findFirst: jest.Mock;
  };
  startAttestation: {
    create: jest.Mock;
  };
  auditEvent: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  outboxEvent: {
    upsert: jest.Mock;
  };
  $transaction: jest.Mock;
};

const captureAdvisoryEventMock =
  captureAdvisoryEvent as jest.MockedFunction<typeof captureAdvisoryEvent>;
const captureEmployerDecisionMock =
  captureEmployerDecision as jest.MockedFunction<typeof captureEmployerDecision>;
const buildPassportMock =
  buildPassport as jest.MockedFunction<typeof buildPassport>;
const buildEmployerEvidencePacketMock =
  buildEmployerEvidencePacket as jest.MockedFunction<typeof buildEmployerEvidencePacket>;
const createEmployerEvidencePacketZipStreamMock =
  createEmployerEvidencePacketZipStream as jest.MockedFunction<typeof createEmployerEvidencePacketZipStream>;
const issueTrustContainerManifestEntryMock =
  issueTrustContainerManifestEntry as jest.MockedFunction<typeof issueTrustContainerManifestEntry>;
const confirmStartByAcceptanceMock =
  confirmStartByAcceptance as jest.MockedFunction<typeof confirmStartByAcceptance>;

function buildTrustContainerFixture() {
  return {
    status: 'issued' as const,
    trustContainerId: 'mock_vc_route_fixture', credentialEnvelopeId: "audit-hash-fixture",
    provider: 'mock' as const,
    label: 'Mock/dev credential container',
    environment: 'mock-dev' as const,
    issuedAt: '2026-03-23T20:00:00.000Z',
    schemaVersion: '1.0.0' as const,
    artifactHash: 'audit-hash-fixture',
    auditHash: 'audit-hash-fixture',
    proofTier: 'PARTIAL' as const,
    proofStatus: 'PARTIAL' as const,
    limitationNotes: ['Institutional access required'],
    mock: true,
  };
}

function buildApp() {
  const app = express();
  app.use(express.json());
  registerEmployerActionRoutes(app);
  app.use((err: { status?: number; statusCode?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status ?? err.statusCode ?? 500).json({ error: err.message ?? 'error' });
  });
  return app;
}

function wireTransactionClient(options?: { reviewItemId?: string | null }) {
  const tx = {
    employerAcceptance: {
      create: prismaMock.employerAcceptance.create,
    },
    startAttestation: {
      create: prismaMock.startAttestation.create,
    },
    auditEvent: {
      create: prismaMock.auditEvent.create,
    },
    outboxEvent: {
      upsert: prismaMock.outboxEvent.upsert,
    },
    hITLReviewItem: options && 'reviewItemId' in options
      ? {
          create: jest.fn().mockResolvedValue(
            options.reviewItemId ? { id: options.reviewItemId } : null,
          ),
        }
      : undefined,
  };

  prismaMock.$transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));

  return tx;
}

function buildPacketFixture() {
  return {
    schema: 'vitalcv.employer.packet.v1',
    exportedAt: '2026-03-23T20:00:00.000Z',
    exportedBy: 'employer-1',
    entityId: '11111111-1111-4111-8111-111111111111',
    clinicianNpi: '1234567890',
    displayName: 'Dr. Jane Doe',
    truth: {
      identity: { status: 'VERIFIED' },
      safety: { status: 'CLEAR' },
      authority: { status: 'VERIFIED' },
      eligibility: { status: 'ENROLLED' },
    },
    manifest: {
      schema: 'vitalcv.employer.packet-manifest.v1',
      packetSchema: 'vitalcv.employer.packet.v1',
      exportedAt: '2026-03-23T20:00:00.000Z',
      exportedBy: 'employer-1',
      entityId: '11111111-1111-4111-8111-111111111111',
      clinicianNpi: '1234567890',
      bundleFiles: [
        'packet.json',
        'manifest.json',
        'source-coverage.json',
        'status.json',
        'README.txt',
      ],
      receiptReferences: [{ sourceId: 'NPPES_API', receiptId: 'receipt-1' }],
      artifactReferences: [{ sourceId: 'NPPES_API', artifactId: 'artifact-1', checksum: 'checksum-1', parserVersion: 'v1.2.0', sourceUrl: 'https://example.com', rawArtifactRef: 'artifact-1' }],
      sourceCoverage: {
        checks: [],
        summary: {
          checked: [],
          stale: [],
          pending: [],
          gated: [],
          unavailable: [],
          accessRequired: [],
          reviewRequired: [],
          notDecisionGrade: [],
          previewOnly: [],
        },
      },
      sourceCoverageSummary: {
        checked: ['NPPES_API'],
        stale: [],
        pending: [],
        gated: [],
        unavailable: [],
        accessRequired: [],
        reviewRequired: [],
        notDecisionGrade: [],
        previewOnly: [],
      },
      freshness: {
        state: 'current',
        label: 'Current attached checks',
        items: [],
      },
      status: {
        truth: {
          identity: { status: 'VERIFIED' },
          safety: { status: 'CLEAR' },
          authority: { status: 'VERIFIED' },
          eligibility: { status: 'ENROLLED' },
        },
        freshness: {
          state: 'current',
          label: 'Current attached checks',
          items: [],
        },
        readiness: {
          status: 'READY',
          score: 90,
          readiness_score: 90,
          level: 'L3',
          blockers: [],
        },
        sourceCoverageSummary: {
          checked: ['NPPES_API'],
          stale: [],
          pending: [],
          gated: [],
          unavailable: [],
          accessRequired: [],
          reviewRequired: [],
          notDecisionGrade: [],
          previewOnly: [],
        },
      },
      sources: [{
        sourceId: 'NPPES_API',
        truthStatus: 'VERIFIED',
        state: 'checked',
        reason: 'NPPES identity checked',
        checkedAt: '2026-03-23T19:00:00.000Z',
        observedAt: '2026-03-23T19:00:00.000Z',
        expiresAt: '2026-03-30T19:00:00.000Z',
        freshness: {
          status: 'current',
          checkedAt: '2026-03-23T19:00:00.000Z',
          observedAt: '2026-03-23T19:00:00.000Z',
          expiresAt: '2026-03-30T19:00:00.000Z',
          freshnessWindowHours: 168,
        },
        provenance: {
          artifactId: 'artifact-1',
          artifactIds: ['artifact-1'],
          receiptIds: ['receipt-1'],
          sourceUrl: 'https://example.com',
          rawArtifactRef: 'artifact-1',
          checksum: 'checksum-1',
          parserVersion: 'v1.2.0',
        },
        parserVersion: 'v1.2.0',
        checksum: 'checksum-1',
        sourceUrl: 'https://example.com',
        rawArtifactRef: 'artifact-1',
        freshnessWindowHours: 168,
        confidenceLabel: 'HIGH',
        reviewRequired: false,
        artifactId: 'artifact-1',
        artifactIds: ['artifact-1'],
        receiptIds: ['receipt-1'],
      }],
    },
    receiptReferences: [{ sourceId: 'NPPES_API', receiptId: 'receipt-1' }],
    artifactReferences: [{ sourceId: 'NPPES_API', artifactId: 'artifact-1', checksum: 'checksum-1', parserVersion: 'v1.2.0', sourceUrl: 'https://example.com', rawArtifactRef: 'artifact-1' }],
    sourceCoverageSummary: {
      checked: ['NPPES_API'],
      stale: [],
      pending: [],
      gated: [],
      unavailable: [],
      accessRequired: [],
      reviewRequired: [],
      notDecisionGrade: [],
      previewOnly: [],
    },
    freshness: {
      state: 'current',
      label: 'Current attached checks',
      items: [],
    },
    identity: {
      npi: '1234567890',
      displayName: 'Dr. Jane Doe',
      specialty: 'Family Medicine',
      source: 'CMS NPPES',
      checkedAt: '2026-03-23T19:00:00.000Z',
      status: 'confirmed',
      truthStatus: 'VERIFIED',
    },
    safety: {
      exclusionStatus: 'CLEAR',
      exclusionCheckedAt: '2026-03-23T19:00:00.000Z',
      exclusionConfidence: 'HIGH',
      source: 'OIG LEIE',
      isClear: true,
      negativeFindings: [],
      truthStatus: 'CLEAR',
    },
    authority: {
      truthStatus: 'VERIFIED',
      credentials: [],
      summary: { active: 1, missing: [] },
    },
    eligibility: {
      pecosEnrollmentStatus: 'ENROLLED',
      enrollmentNote: 'Enrolled',
      enrollmentDataVersion: '2026-Q1',
      enrollmentDataFreshness: 'Quarterly',
      enrollmentCheckedAt: '2026-03-23T19:00:00.000Z',
      enrollmentConfidence: 'HIGH',
      source: 'CMS PECOS',
      truthStatus: 'ENROLLED',
    },
    readiness: {
      status: 'READY',
      score: 90,
      readiness_score: 90,
      level: 'L3',
      estimatedStartDays: 3,
      blockers: [],
      nextActions: [],
    },
    sourceCoverage: {
      checks: [],
      summary: {
        checked: [],
        stale: [],
        pending: [],
        gated: [],
        unavailable: [],
        accessRequired: [],
        reviewRequired: [],
        notDecisionGrade: [],
        previewOnly: [],
      },
    },
  };
}

describe('employer action routes', () => {
  beforeEach(() => {
    prismaMock.vcvEntity.findUnique.mockReset();
    prismaMock.vcvEntity.findFirst.mockReset();
    prismaMock.user.findUnique.mockReset();
    prismaMock.employerAcceptance.findFirst.mockReset();
    prismaMock.employerAcceptance.create.mockReset();
    prismaMock.applicationPacket.findFirst.mockReset();
    prismaMock.startAttestation.create.mockReset();
    prismaMock.auditEvent.create.mockReset();
    prismaMock.auditEvent.findFirst.mockReset();
    prismaMock.auditEvent.findMany.mockReset();
    prismaMock.outboxEvent.upsert.mockReset();
    prismaMock.$transaction.mockReset();
    captureAdvisoryEventMock.mockReset();
    captureEmployerDecisionMock.mockReset();
    buildPassportMock.mockReset();
    buildEmployerEvidencePacketMock.mockReset();
    createEmployerEvidencePacketZipStreamMock.mockReset();
    issueTrustContainerManifestEntryMock.mockReset();
    confirmStartByAcceptanceMock.mockReset().mockResolvedValue({
      state: 'started',
      duplicate: false,
      applicationId: '33333333-3333-4333-8333-333333333333',
      organizationId: '44444444-4444-4444-8444-444444444444',
      attestation: {
        id: 'attestation-1',
        acceptanceId: 'accept-1',
        role: 'RN',
        facility: 'Providence',
        startedAt: new Date('2026-03-25T18:00:00.000Z'),
      } as never,
      lifecycleAuditEventId: 'lifecycle-audit-1',
      attestationAuditEventId: 'attestation-audit-1',
    });

    buildPassportMock.mockResolvedValue({ entityId: "11111111-1111-4111-8111-111111111111", decisionPosture: { status: "READY", blockers: [], missing: [] } } as never);
    issueTrustContainerManifestEntryMock.mockResolvedValue(buildTrustContainerFixture());

    prismaMock.vcvEntity.findUnique.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      npi: '1234567890',
    });
    prismaMock.vcvEntity.findFirst.mockResolvedValue(null);
    // The RBAC gate resolves the caller's User row; an active VERIFIER is
    // allowed in both shadow and enforced modes, so these route tests stay
    // focused on the per-route contracts.
    prismaMock.user.findUnique.mockResolvedValue({
      role: 'VERIFIER',
      status: 'ACTIVE',
      organizationId: '44444444-4444-4444-8444-444444444444',
    });
    prismaMock.employerAcceptance.findFirst.mockResolvedValue(null);
    prismaMock.applicationPacket.findFirst.mockResolvedValue(null);
    prismaMock.employerAcceptance.create.mockResolvedValue({
      id: 'accept-1',
      acceptedAt: new Date('2026-03-23T18:00:00.000Z'),
    });
    prismaMock.startAttestation.create.mockResolvedValue({
      id: 'attestation-1',
      acceptanceId: 'accept-1',
      startedAt: new Date('2026-03-25T18:00:00.000Z'),
    });
    prismaMock.auditEvent.create.mockResolvedValue({
      id: 'audit-1',
      createdAt: new Date('2026-03-23T18:00:00.000Z'),
    });
    prismaMock.auditEvent.findMany.mockResolvedValue([]);
    prismaMock.outboxEvent.upsert.mockResolvedValue({
      id: 'outbox-1',
    });

    wireTransactionClient();
  });

  it('persists accept actions with a durable acceptance record and outbox handoff', async () => {
    const response = await request(buildApp())
      .post('/api/employer-review/11111111-1111-4111-8111-111111111111/accept')
      .set('x-clerk-user-id', 'employer-1')
      .send({ role: 'Recruiter', facility: 'Providence', notes: 'Head start only' })
      .expect(201);

    expect(response.body.state).toEqual(expect.objectContaining({
      action: 'accept',
      entityId: '11111111-1111-4111-8111-111111111111',
      clinicianNpi: '1234567890',
      auditEventId: 'audit-1',
      acceptance: {
        acceptedByOrgId: null,
        acceptedAt: expect.any(String),
        acceptanceScope: 'pilot',
        // Private notes no longer stand in for a missing acceptance reason.
        acceptanceReason: 'Accepted as head start using VitalCV verification.',
      },
      persistence: expect.objectContaining({
        mode: 'durable_record',
        target: 'employer_acceptance',
        acceptanceId: 'accept-1',
        outboxEventId: 'outbox-1',
      }),
      summary: {
        title: 'Head start accepted',
        description: 'The employer acceptance was persisted and linked to an audit event.',
      },
    }));

    expect(prismaMock.outboxEvent.upsert).toHaveBeenCalled();
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        referenceId: 'accept-1',
        type: 'EMPLOYER_REVIEW_ACCEPTED',
        metadata: expect.objectContaining({
          employerReviewAction: expect.objectContaining({
            persistence: expect.objectContaining({
              target: 'employer_acceptance',
              acceptanceId: 'accept-1',
              outboxEventId: 'outbox-1',
            }),
            trustSnapshot: expect.objectContaining({
              snapshotHash: expect.any(String),
              truthStatuses: expect.objectContaining({
                identity: 'PENDING',
                safety: 'PENDING',
                authority: 'PENDING',
                eligibility: 'PENDING',
              }),
            }),
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
          }),
        }),
      }),
    }));
    expect(captureEmployerDecisionMock).toHaveBeenCalledWith(expect.objectContaining({
      auditEventId: 'audit-1',
      decision: 'PROCEED',
      metadata: expect.objectContaining({
        acceptanceScope: 'pilot',
        acceptanceReason: 'Accepted as head start using VitalCV verification.',
      }),
    }));
  });

  it('fails closed with packet_subject_mismatch when the referenced packet belongs to another clinician', async () => {
    // A verifier who knows a foreign applicationId + its packetHash must not be
    // able to attach that packet reference to an acceptance for a different
    // clinician — the subject binding is checked before hash/lifecycle state.
    prismaMock.applicationPacket.findFirst.mockResolvedValue({
      packetHash: 'sha256:foreign',
      packetVersion: 1,
      opportunityVersion: 'v1',
      clinicianNpi: '9999999999',
      employerOrgId: 'org-other-tenant',
      revokedAt: null,
      supersededByPacketId: null,
    });

    const response = await request(buildApp())
      .post('/api/employer-review/11111111-1111-4111-8111-111111111111/accept')
      .set('x-clerk-user-id', 'employer-1')
      .send({
        applicationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        packetHash: 'sha256:foreign',
      })
      .expect(409);

    expect(response.body.error).toContain('packet_subject_mismatch');
    expect(prismaMock.employerAcceptance.create).not.toHaveBeenCalled();
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'EMPLOYER_REVIEW_MUTATION_DENIED',
        metadata: expect.objectContaining({
          denialReason: 'packet_subject_mismatch',
        }),
      }),
    }));
  });

  it('accepts by application when the packet subject matches, persisting linkage and the accept-time source snapshot', async () => {
    buildPassportMock.mockResolvedValue({
      entityId: '11111111-1111-4111-8111-111111111111',
      decisionPosture: { status: 'READY', blockers: [], missing: [] },
      sourceCoverage: {
        checks: [
          { sourceId: 'OIG_LEIE', state: 'checked', checkedAt: '2026-03-20T00:00:00.000Z', reason: 'clear' },
          { sourceId: 'NPPES_API', state: 'checked', checkedAt: '2026-03-21T00:00:00.000Z', reason: 'checked' },
        ],
      },
    } as never);
    prismaMock.applicationPacket.findFirst.mockResolvedValue({
      packetHash: 'sha256:reviewed',
      packetVersion: 3,
      opportunityVersion: 'v2',
      clinicianNpi: '1234567890',
      employerOrgId: 'org-good-health',
      revokedAt: null,
      supersededByPacketId: null,
    });

    await request(buildApp())
      .post('/api/employer-review/11111111-1111-4111-8111-111111111111/accept')
      .set('x-clerk-user-id', 'employer-1')
      .send({
        applicationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        packetHash: 'sha256:reviewed',
      })
      .expect(201);

    expect(prismaMock.employerAcceptance.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        applicationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        packetHash: 'sha256:reviewed',
        metadata: {
          schema: 'vitalcv.employer-acceptance.metadata.v1',
          acceptedSourceSnapshot: {
            capturedAt: expect.any(String),
            checks: [
              {
                sourceId: 'NPPES_API',
                label: 'CMS NPI Registry API',
                state: 'checked',
                checkedAt: '2026-03-21T00:00:00.000Z',
              },
              {
                sourceId: 'OIG_LEIE',
                label: 'HHS OIG List of Excluded Individuals/Entities (LEIE)',
                state: 'checked',
                checkedAt: '2026-03-20T00:00:00.000Z',
              },
            ],
          },
        },
      }),
    }));
  });

  it('leaves acceptance metadata NULL when the passport exposes no source coverage', async () => {
    // Default buildPassport mock has no sourceCoverage — the row must keep a
    // NULL metadata column, not an empty snapshot that would later diff as
    // "everything is new".
    await request(buildApp())
      .post('/api/employer-review/11111111-1111-4111-8111-111111111111/accept')
      .set('x-clerk-user-id', 'employer-1')
      .send({})
      .expect(201);

    const createArgs = prismaMock.employerAcceptance.create.mock.calls[0][0] as {
      data: { metadata?: unknown };
    };
    expect(createArgs.data.metadata).toBeUndefined();
  });

  it('returns anonymized portable acceptance history without requiring employer auth', async () => {
    prismaMock.auditEvent.findMany.mockResolvedValue([
      {
        id: 'audit-accept-1',
        createdAt: new Date('2026-03-23T18:00:00.000Z'),
        metadata: {
          employerReviewAction: {
            action: 'accept',
            employerId: 'employer-1',
            entityId: '11111111-1111-4111-8111-111111111111',
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

    const response = await request(buildApp())
      .get('/api/employer-review/11111111-1111-4111-8111-111111111111/acceptance-history')
      .expect(200);

    expect(response.body).toEqual({
      ok: true,
      summary: {
        acceptedOrganizationCount: 1,
        hasPriorAcceptances: true,
        headline: 'Accepted by 1 organization',
        trustCopy: 'This clinician has already been accepted using VitalCV verification. Each acceptance remains scoped to the organization and scope shown below.',
      },
      history: [
        {
          acceptanceId: 'accept-1',
          orgLabel: 'Pilot organization 1',
          isAnonymized: true,
          // Raw org id withheld whenever the label is anonymized.
          acceptedByOrgId: null,
          acceptedAt: '2026-03-23T18:00:00.000Z',
          acceptanceScope: 'pilot',
          acceptanceReason: 'Accepted as head start using VitalCV verification.',
        },
      ],
    });
  });

  it('resolves a 10-digit acceptance-history key as a clinician NPI without touching the uuid lookup', async () => {
    prismaMock.vcvEntity.findFirst.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      npi: '1234567890',
    });

    const response = await request(buildApp())
      .get('/api/employer-review/1234567890/acceptance-history')
      .expect(200);

    expect(response.body).toEqual({
      ok: true,
      summary: {
        acceptedOrganizationCount: 0,
        hasPriorAcceptances: false,
        headline: 'No prior acceptances',
        trustCopy: null,
      },
      history: [],
    });

    expect(prismaMock.vcvEntity.findFirst).toHaveBeenCalledWith({
      where: { npi: '1234567890' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, npi: true },
    });
    expect(prismaMock.vcvEntity.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.auditEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        type: 'EMPLOYER_REVIEW_ACCEPTED',
        clinicianId: '1234567890',
      },
    }));
  });

  it('returns 404 for an NPI-shaped acceptance-history key with no known entity', async () => {
    prismaMock.vcvEntity.findFirst.mockResolvedValue(null);

    await request(buildApp())
      .get('/api/employer-review/9999999999/acceptance-history')
      .expect(404);

    expect(prismaMock.vcvEntity.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.auditEvent.findMany).not.toHaveBeenCalled();
  });

  it('404s a malformed entity id before it can reach the uuid-typed lookup', async () => {
    // VcvEntity.id is a Postgres uuid column — an unguarded non-uuid string
    // makes Prisma throw (a 500) instead of returning null.
    await request(buildApp())
      .get('/api/employer-review/not-a-uuid/acceptance-history')
      .expect(404);

    expect(prismaMock.vcvEntity.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.vcvEntity.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.auditEvent.findMany).not.toHaveBeenCalled();
  });

  it('404s a malformed packet entity id before buildPassport runs', async () => {
    await request(buildApp())
      .get('/api/employer-review/not-a-uuid/packet?format=json')
      .set('x-clerk-user-id', 'employer-1')
      .expect(404);

    expect(buildPassportMock).not.toHaveBeenCalled();
    expect(prismaMock.vcvEntity.findUnique).not.toHaveBeenCalled();
  });

  it('never serves private review notes on the anonymous acceptance-history read', async () => {
    prismaMock.vcvEntity.findFirst.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      npi: '1234567890',
    });
    prismaMock.auditEvent.findMany.mockResolvedValue([
      {
        id: 'audit-accept-legacy',
        createdAt: new Date('2026-03-23T18:00:00.000Z'),
        metadata: {
          employerReviewAction: {
            action: 'accept',
            employerId: 'employer-1',
            entityId: '11111111-1111-4111-8111-111111111111',
            clinicianNpi: '1234567890',
            requestId: 'req-accept-legacy',
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
              acceptanceId: 'accept-legacy',
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
              role: 'Hospitalist',
              facility: 'Main campus',
              // Old write path copied these notes into acceptanceReason.
              notes: 'Salary band flexible for this candidate — internal only.',
            },
            acceptance: {
              acceptedByOrgId: 'org-entity-1',
              acceptedAt: '2026-03-23T18:00:00.000Z',
              acceptanceScope: 'pilot',
              acceptanceReason: 'Salary band flexible for this candidate — internal only.',
            },
          },
        },
      },
    ]);

    // No x-clerk-user-id, no x-org-id: this is the anonymous /verify/[npi] read.
    const response = await request(buildApp())
      .get('/api/employer-review/1234567890/acceptance-history')
      .expect(200);

    expect(response.body.history).toEqual([
      expect.objectContaining({
        acceptanceId: 'accept-legacy',
        acceptanceReason: 'Accepted as head start using VitalCV verification.',
        acceptedByOrgId: null,
      }),
    ]);
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('Salary band flexible');
    expect(serialized).not.toContain('Hospitalist');
    expect(serialized).not.toContain('Main campus');
    expect(serialized).not.toContain('org-entity-1');
  });

  it('persists refresh requests through the outbox and normalizes the refresh payload', async () => {
    const response = await request(buildApp())
      .post('/api/employer-review/11111111-1111-4111-8111-111111111111/request-refresh')
      .set('x-clerk-user-id', 'employer-1')
      .send({
        staleSources: ['CMS PECOS', 'CMS PECOS', '  OIG LEIE  ', '', 12],
        missingDomains: ['LICENSURE', 'LICENSURE', 'BOARD_CERTIFICATION', null],
        message: 'Need fresher source data.',
      })
      .expect(201);

    expect(response.body.state).toEqual(expect.objectContaining({
      action: 'refresh',
      persistence: expect.objectContaining({
        mode: 'durable_record',
        target: 'outbox_event',
        reviewItemCreated: false,
        outboxEventId: 'outbox-1',
      }),
      details: {
        staleSources: ['CMS PECOS', 'OIG LEIE'],
        missingDomains: ['LICENSURE', 'BOARD_CERTIFICATION'],
        reason: 'Need fresher source data.',
        priority: null,
      },
      summary: {
        title: 'Refresh request recorded',
        description: 'The refresh request was persisted and queued for downstream processing.',
      },
    }));

    expect(prismaMock.outboxEvent.upsert).toHaveBeenCalled();
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'EMPLOYER_REVIEW_REFRESH_REQUESTED',
        referenceId: '11111111-1111-4111-8111-111111111111',
        metadata: expect.objectContaining({
          employerReviewAction: expect.objectContaining({
            persistence: expect.objectContaining({
              target: 'outbox_event',
              outboxEventId: 'outbox-1',
            }),
            details: {
              staleSources: ['CMS PECOS', 'OIG LEIE'],
              missingDomains: ['LICENSURE', 'BOARD_CERTIFICATION'],
              reason: 'Need fresher source data.',
              priority: null,
            },
          }),
        }),
      }),
    }));
    expect(captureEmployerDecisionMock).toHaveBeenCalledWith(expect.objectContaining({
      decision: 'REQUEST_REFRESH',
      auditEventId: 'audit-1',
      organizationContextId: null,
      blockersAtDecision: ['LICENSURE', 'BOARD_CERTIFICATION'],
      trustSnapshotAtDecision: expect.objectContaining({
        staleSources: ['CMS PECOS', 'OIG LEIE'],
        missingDomains: ['LICENSURE', 'BOARD_CERTIFICATION'],
      }),
      metadata: expect.objectContaining({
        eventName: 'employer_decision_recorded',
      }),
    }));
    expect(captureAdvisoryEventMock).not.toHaveBeenCalled();
  });

  it('routes to review with both queue persistence and outbox persistence when a review item is created', async () => {
    wireTransactionClient({ reviewItemId: 'review-item-1' });

    const response = await request(buildApp())
      .post('/api/employer-review/11111111-1111-4111-8111-111111111111/route-to-review')
      .set('x-clerk-user-id', 'employer-1')
      .send({ reason: 'Manual check required', priority: 'high' })
      .expect(201);

    expect(response.body.state).toEqual(expect.objectContaining({
      action: 'review',
      persistence: {
        mode: 'durable_record',
        target: 'review_queue_item',
        acceptanceId: null,
        reviewItemId: 'review-item-1',
        outboxEventId: 'outbox-1',
        reviewItemCreated: true,
      },
      details: {
        staleSources: [],
        missingDomains: [],
        reason: 'Manual check required',
        priority: 'HIGH',
      },
      summary: {
        title: 'Routed to review',
        description: 'The routing decision and manual review queue item were both persisted.',
      },
    }));
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'EMPLOYER_REVIEW_ROUTED_TO_REVIEW',
        referenceId: '11111111-1111-4111-8111-111111111111',
        metadata: expect.objectContaining({
          employerReviewAction: expect.objectContaining({
            persistence: expect.objectContaining({
              reviewItemId: 'review-item-1',
              outboxEventId: 'outbox-1',
            }),
            details: {
              staleSources: [],
              missingDomains: [],
              reason: 'Manual check required',
              priority: 'HIGH',
            },
          }),
        }),
      }),
    }));
  });

  it('fails closed on duplicate accept attempts without creating new persistence side effects', async () => {
    prismaMock.employerAcceptance.findFirst.mockResolvedValueOnce({ id: 'accept-existing' });

    const response = await request(buildApp())
      .post('/api/employer-review/11111111-1111-4111-8111-111111111111/accept')
      .set('x-clerk-user-id', 'employer-1')
      .send({})
      .expect(409);

    expect(response.body).toEqual({
      error: 'already_accepted',
      error_description: 'An active acceptance already exists for this employer/NPI pair.',
      acceptanceId: 'accept-existing',
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'EMPLOYER_REVIEW_MUTATION_DENIED',
        referenceId: '11111111-1111-4111-8111-111111111111',
        clinicianId: '1234567890',
        metadata: expect.objectContaining({
          runtimeTrust: expect.objectContaining({
            outcome: 'denied',
            denialReason: 'already_accepted',
            mutationClassification: 'DENIED_MUTATION',
            replayCategory: 'R-CAT-5',
            payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
            readonly: {
              attemptedByReadonly: false,
              source: null,
            },
          }),
        }),
      }),
    }));
    expect(prismaMock.outboxEvent.upsert).not.toHaveBeenCalled();
    expect(captureEmployerDecisionMock).not.toHaveBeenCalled();
  });

  it('fails closed when a BLOCKED passport is accepted from the action route', async () => {
    buildPassportMock.mockResolvedValueOnce({
      entityId: '11111111-1111-4111-8111-111111111111',
      decisionPosture: {
        status: 'BLOCKED',
        blockers: ['OIG exclusion requires review'],
        missing: [{ sourceId: 'OIG_LEIE' }],
      },
    } as never);

    const response = await request(buildApp())
      .post('/api/employer-review/11111111-1111-4111-8111-111111111111/accept')
      .set('x-clerk-user-id', 'employer-1')
      .send({})
      .expect(422);

    expect(response.body).toEqual({
      error: 'acceptance_blocked',
      error_description: 'Cannot accept: one or more critical source checks are blocking readiness.',
      blockers: ['OIG exclusion requires review'],
      missingSources: ['OIG_LEIE'],
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'EMPLOYER_REVIEW_MUTATION_DENIED',
        referenceId: '11111111-1111-4111-8111-111111111111',
        clinicianId: '1234567890',
        metadata: expect.objectContaining({
          runtimeTrust: expect.objectContaining({
            outcome: 'denied',
            denialReason: 'acceptance_blocked',
            mutationClassification: 'DENIED_MUTATION',
            replayCategory: 'R-CAT-5',
          }),
        }),
      }),
    }));
  });

  it('generates share-packet bearer tokens with crypto randomness and stores only the token hash', async () => {
    const response = await request(buildApp())
      .post('/api/employer-review/11111111-1111-4111-8111-111111111111/share-packet')
      .set('x-clerk-user-id', 'employer-1')
      .send({ npi: '1234567890', organizationContextId: 'ctx-1', bundleId: 'bundle-1' })
      .expect(201);

    expect(response.body).toEqual({
      ok: true,
      shareUrl: expect.stringMatching(/^https:\/\/app\.vitalcv\.com\/review\/chk_[A-Za-z0-9_-]{43}$/),
      expiresAt: expect.any(String),
      auditEventId: 'audit-1',
    });

    const token = new URL(response.body.shareUrl).pathname.split('/').at(-1);
    const metadata = prismaMock.auditEvent.create.mock.calls[0]?.[0].data.metadata as Record<string, unknown>;

    expect(token).toMatch(/^chk_[A-Za-z0-9_-]{43}$/);
    expect(metadata).toEqual(expect.objectContaining({
      schema: 'vitalcv.employer.packet-shared.v1',
      clinicianNpi: '1234567890',
      organizationContextId: 'ctx-1',
      bundleId: 'bundle-1',
      shareTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      expiresAt: expect.any(String),
      correlationId: expect.any(String),
      mutationFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      mutationClassification: 'TRUST_PACKET_SHARE',
      replayCategory: 'R-CAT-3',
      payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(metadata.shareToken).toBeUndefined();
    expect(metadata.shareUrl).toBeUndefined();
    expect(JSON.stringify(metadata)).not.toContain(token ?? 'missing-token');
  });

  it('rejects share-packet requests when the body NPI does not match the reviewed entity', async () => {
    await request(buildApp())
      .post('/api/employer-review/11111111-1111-4111-8111-111111111111/share-packet')
      .set('x-clerk-user-id', 'employer-1')
      .send({ npi: '9999999999' })
      .expect(400);

    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'EMPLOYER_REVIEW_MUTATION_DENIED',
        referenceId: '11111111-1111-4111-8111-111111111111',
        clinicianId: '1234567890',
        metadata: expect.objectContaining({
          runtimeTrust: expect.objectContaining({
            outcome: 'denied',
            denialReason: 'npi_mismatch',
            mutationClassification: 'DENIED_MUTATION',
            replayCategory: 'R-CAT-5',
          }),
        }),
      }),
    }));
  });

  it('resolves valid share tokens to scoped review targets', async () => {
    const token = `chk_${'A'.repeat(43)}`;
    const shareTokenHash = sha256ForPayload({
      schema: 'vitalcv.employer.share-token-hash.v1',
      token,
    });
    prismaMock.auditEvent.findFirst.mockResolvedValueOnce({
      id: 'audit-share-1',
      createdAt: new Date('2026-03-23T18:00:00.000Z'),
      metadata: {
        schema: 'vitalcv.employer.packet-shared.v1',
        employerId: 'employer-1',
        entityId: '11111111-1111-4111-8111-111111111111',
        clinicianNpi: '1234567890',
        organizationContextId: 'ctx-1',
        bundleId: 'bundle-1',
        shareTokenHash,
        sharedAt: '2026-03-23T18:00:00.000Z',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    const response = await request(buildApp())
      .get(`/api/employer-review/share-token/${token}`)
      .expect(200);

    expect(prismaMock.auditEvent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        type: 'EMPLOYER_PACKET_SHARED',
        metadata: {
          path: ['shareTokenHash'],
          equals: shareTokenHash,
        },
      }),
    }));
    expect(response.body).toEqual(expect.objectContaining({
      ok: true,
      entityId: '11111111-1111-4111-8111-111111111111',
      clinicianNpi: '1234567890',
      organizationContextId: 'ctx-1',
      bundleId: 'bundle-1',
      reviewHref: '/review/11111111-1111-4111-8111-111111111111?contextId=ctx-1&bundleId=bundle-1',
      shareEventAuditId: 'audit-share-1',
    }));
  });

  it('fails closed for missing share tokens', async () => {
    const token = `chk_${'B'.repeat(43)}`;
    prismaMock.auditEvent.findFirst.mockResolvedValueOnce(null);

    await request(buildApp())
      .get(`/api/employer-review/share-token/${token}`)
      .expect(404);
  });

  it('fails closed for expired share tokens', async () => {
    const token = `chk_${'C'.repeat(43)}`;
    const shareTokenHash = sha256ForPayload({
      schema: 'vitalcv.employer.share-token-hash.v1',
      token,
    });
    prismaMock.auditEvent.findFirst.mockResolvedValueOnce({
      id: 'audit-share-expired',
      createdAt: new Date('2026-03-23T18:00:00.000Z'),
      metadata: {
        schema: 'vitalcv.employer.packet-shared.v1',
        employerId: 'employer-1',
        entityId: '11111111-1111-4111-8111-111111111111',
        clinicianNpi: '1234567890',
        organizationContextId: null,
        bundleId: null,
        shareTokenHash,
        sharedAt: '2026-03-23T18:00:00.000Z',
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      },
    });

    const response = await request(buildApp())
      .get(`/api/employer-review/share-token/${token}`)
      .expect(410);

    expect(response.body).toEqual({
      error: 'share_token_expired',
      error_description: 'This review link has expired. Ask the clinician to generate a fresh share link.',
    });
  });

  it('requires an ACCEPTED employer acceptance before confirm-start can attest a start', async () => {
    prismaMock.employerAcceptance.findFirst.mockResolvedValueOnce(null);

    const response = await request(buildApp())
      .post('/api/employer-review/11111111-1111-4111-8111-111111111111/confirm-start')
      .set('x-clerk-user-id', 'employer-1')
      .send({
        startedAt: '2026-03-24',
        role: 'Attending',
        facility: 'Main Campus',
      })
      .expect(409);

    expect(response.body).toEqual({
      error: 'No active acceptance found for this employer/clinician pair. Accept first before recording a start.',
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('scopes explicit confirm-start acceptance IDs to the reviewed clinician NPI', async () => {
    prismaMock.employerAcceptance.findFirst.mockResolvedValueOnce(null);

    await request(buildApp())
      .post('/api/employer-review/11111111-1111-4111-8111-111111111111/confirm-start')
      .set('x-clerk-user-id', 'employer-1')
      .send({
        acceptanceId: 'accept-other-npi',
        startedAt: '2026-03-24',
        role: 'Attending',
        facility: 'Main Campus',
      })
      .expect(409);

    expect(prismaMock.employerAcceptance.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'accept-other-npi',
        employerId: { in: ['employer-1', '44444444-4444-4444-8444-444444444444'] },
        clinicianNpi: '1234567890',
        status: 'ACCEPTED',
      },
      select: { id: true, clinicianNpi: true },
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('keeps status reads backward compatible with legacy audit-only review metadata', async () => {
    prismaMock.employerAcceptance.findFirst.mockResolvedValueOnce(null);
    prismaMock.auditEvent.findMany.mockResolvedValueOnce([{
      id: 'audit-review-1',
      createdAt: new Date('2026-03-23T19:30:00.000Z'),
      metadata: {
        employerReviewAction: {
          action: 'review',
          employerId: 'employer-1',
          entityId: '11111111-1111-4111-8111-111111111111',
          clinicianNpi: '1234567890',
          requestId: 'req-1',
          persistence: {
            mode: 'audit_only',
            target: 'audit_event',
            acceptanceId: null,
            reviewItemId: null,
            reviewItemCreated: false,
          },
          summary: {
            title: 'Review routing recorded',
            description: 'The routing decision was persisted in the audit trail, but no durable manual review queue item was created in this environment.',
          },
          details: {
            staleSources: [],
            missingDomains: [],
            reason: 'Manual review still needed',
            priority: 'HIGH',
          },
          context: {
            role: null,
            facility: null,
            notes: null,
          },
          attribution: {
            source: 'unscoped',
            organizationContextId: null,
            bundleShareEventId: null,
            bundleId: null,
            requestorEntityId: null,
            organizationId: null,
            organizationName: null,
            purposeOfUse: null,
          },
        },
      },
    }]);

    const response = await request(buildApp())
      .get('/api/employer-review/11111111-1111-4111-8111-111111111111/status')
      .set('x-clerk-user-id', 'employer-1')
      .expect(200);

    expect(response.body).toEqual({
      ok: true,
      state: {
        action: 'review',
        entityId: '11111111-1111-4111-8111-111111111111',
        clinicianNpi: '1234567890',
        auditEventId: 'audit-review-1',
        timestamp: '2026-03-23T19:30:00.000Z',
        attribution: {
          source: 'unscoped',
          organizationContextId: null,
          bundleShareEventId: null,
          bundleId: null,
          requestorEntityId: null,
          organizationId: null,
          organizationName: null,
          purposeOfUse: null,
        },
        persistence: {
          mode: 'audit_only',
          target: 'audit_event',
          acceptanceId: null,
          reviewItemId: null,
          outboxEventId: null,
          reviewItemCreated: false,
        },
        summary: {
          title: 'Review routing recorded',
          description: 'The routing decision was persisted in the audit trail, but no durable manual review queue item was created in this environment.',
        },
        details: {
          staleSources: [],
          missingDomains: [],
          reason: 'Manual review still needed',
          priority: 'HIGH',
        },
      },
    });
  });

  it('loads persisted acceptance state with the linked outbox and audit metadata', async () => {
    prismaMock.auditEvent.findMany.mockResolvedValueOnce([{
        id: 'audit-accept-1',
        createdAt: new Date('2026-03-23T19:46:00.000Z'),
        metadata: {
          employerReviewAction: {
            action: 'accept',
            employerId: 'employer-1',
            entityId: '11111111-1111-4111-8111-111111111111',
            clinicianNpi: '1234567890',
            requestId: 'req-accept-1',
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
              role: 'Recruiter',
              facility: 'Providence',
              notes: 'Head start only',
            },
            attribution: {
              source: 'unscoped',
              organizationContextId: null,
              bundleShareEventId: null,
              bundleId: null,
              requestorEntityId: null,
              organizationId: null,
              organizationName: null,
              purposeOfUse: null,
            },
            trustSnapshot: {
              snapshotHash: 'snapshot-hash-1',
              capturedAt: '2026-03-23T19:45:00.000Z',
              npi: '1234567890',
              readinessStatus: 'UNKNOWN',
              readinessScore: 0,
              readinessLevel: 'L0',
              trustBand: 'L0',
              trustBandLabel: 'UNVERIFIED',
              trustScore: 0,
              trustScoreConfidence: 0,
              exclusionStatus: 'UNCHECKED',
              exclusionCheckedAt: null,
              pecosEnrollmentStatus: 'UNKNOWN',
              verifiedCredentialCount: 0,
              staleCredentialCount: 0,
              reviewRequiredCount: 0,
              blockerCount: 0,
              topBlockers: [],
              missingDomains: [],
              gatedDomains: [],
              truthStatuses: {
                identity: 'PENDING',
                safety: 'PENDING',
                authority: 'PENDING',
                eligibility: 'PENDING',
              },
              sourceCoverageSummary: {
                checked: [],
                stale: [],
                pending: [],
                gated: [],
                unavailable: [],
                accessRequired: [],
                reviewRequired: [],
                notDecisionGrade: [],
                previewOnly: [],
              },
              lastCheckedAt: null,
            },
          },
        },
      },
    ]);

    const response = await request(buildApp())
      .get('/api/employer-review/11111111-1111-4111-8111-111111111111/status')
      .set('x-clerk-user-id', 'employer-1')
      .expect(200);

    expect(response.body).toEqual({
      ok: true,
      state: {
        action: 'accept',
        entityId: '11111111-1111-4111-8111-111111111111',
        clinicianNpi: '1234567890',
        auditEventId: 'audit-accept-1',
        timestamp: '2026-03-23T19:46:00.000Z',
        attribution: {
          source: 'unscoped',
          organizationContextId: null,
          bundleShareEventId: null,
          bundleId: null,
          requestorEntityId: null,
          organizationId: null,
          organizationName: null,
          purposeOfUse: null,
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
        trustSnapshot: expect.objectContaining({
          snapshotHash: 'snapshot-hash-1',
          truthStatuses: expect.objectContaining({
            identity: 'PENDING',
            safety: 'PENDING',
            authority: 'PENDING',
            eligibility: 'PENDING',
          }),
        }),
      },
    });
  });

  it('emits an audit event when exporting the packet as JSON', async () => {
    const packet = buildPacketFixture();
    buildPassportMock.mockResolvedValue({ entityId: "11111111-1111-4111-8111-111111111111", decisionPosture: { status: "READY", blockers: [], missing: [] } } as never);
    buildEmployerEvidencePacketMock.mockReturnValue(packet as never);

    const response = await request(buildApp())
      .get('/api/employer-review/11111111-1111-4111-8111-111111111111/packet?format=json')
      .set('x-clerk-user-id', 'employer-1')
      .expect(200);

    expect(response.body).toEqual(packet);
    expect(buildEmployerEvidencePacketMock).toHaveBeenCalledWith(expect.objectContaining({
      trustContainer: expect.objectContaining({
        trustContainerId: 'mock_vc_route_fixture', credentialEnvelopeId: "audit-hash-fixture",
        environment: 'mock-dev',
        proofTier: 'PARTIAL',
      }),
    }));
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'ARTIFACT_EXPORTED',
        referenceId: '11111111-1111-4111-8111-111111111111',
        clinicianId: '1234567890',
        metadata: expect.objectContaining({
          correlationId: expect.any(String),
          mutationFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
          mutationClassification: 'TRUST_PACKET_EXPORT',
          replayCategory: 'R-CAT-3',
          payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          trustContainer: expect.objectContaining({
            trustContainerId: 'mock_vc_route_fixture', credentialEnvelopeId: "audit-hash-fixture",
            provider: 'mock',
            environment: 'mock-dev',
            proofTier: 'PARTIAL',
            proofStatus: 'PARTIAL',
            mock: true,
          }),
        }),
      }),
    }));
  });

  it('streams the packet bundle as ZIP when requested', async () => {
    const packet = buildPacketFixture();
    const zipStream = new PassThrough();
    buildPassportMock.mockResolvedValue({ entityId: "11111111-1111-4111-8111-111111111111", decisionPosture: { status: "READY", blockers: [], missing: [] } } as never);
    buildEmployerEvidencePacketMock.mockReturnValue(packet as never);
    createEmployerEvidencePacketZipStreamMock.mockReturnValue(zipStream);

    setImmediate(() => {
      zipStream.end(Buffer.from('PK\x03\x04mockzip', 'binary'));
    });

    const response = await request(buildApp())
      .get('/api/employer-review/11111111-1111-4111-8111-111111111111/packet?format=zip')
      .set('x-clerk-user-id', 'employer-1')
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(response.header['content-type']).toContain('application/zip');
    expect(createEmployerEvidencePacketZipStreamMock).toHaveBeenCalledWith(packet);
    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect((response.body as Buffer).subarray(0, 2).toString('binary')).toBe('PK');
  });

  it('blocks employer accept when the passport is in BLOCKED posture', async () => {
    buildPassportMock.mockResolvedValueOnce({
      entityId: '11111111-1111-4111-8111-111111111111',
      decisionPosture: {
        status: 'BLOCKED',
        blockers: ['STATE_BOARD access required'],
        missing: [{ sourceId: 'STATE_BOARD' }],
      },
    } as never);

    const response = await request(buildApp())
      .post('/api/employer-review/11111111-1111-4111-8111-111111111111/accept')
      .set('x-clerk-user-id', 'employer-1')
      .send({})
      .expect(422);

    expect(response.body).toEqual({
      error: 'acceptance_blocked',
      error_description: 'Cannot accept: one or more critical source checks are blocking readiness.',
      blockers: ['STATE_BOARD access required'],
      missingSources: ['STATE_BOARD'],
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'EMPLOYER_REVIEW_MUTATION_DENIED',
        referenceId: '11111111-1111-4111-8111-111111111111',
        clinicianId: '1234567890',
        metadata: expect.objectContaining({
          runtimeTrust: expect.objectContaining({
            outcome: 'denied',
            denialReason: 'acceptance_blocked',
            mutationClassification: 'DENIED_MUTATION',
            replayCategory: 'R-CAT-5',
          }),
        }),
      }),
    }));
  });

  it('generates secure share tokens without storing the raw token in audit metadata', async () => {
    process.env.APP_ORIGIN = 'https://app.vitalcv.test';

    const response = await request(buildApp())
      .post('/api/employer-review/11111111-1111-4111-8111-111111111111/share-packet')
      .set('x-clerk-user-id', 'employer-1')
      .send({ npi: '1234567890', organizationContextId: 'ctx-1', bundleId: 'bundle-1' })
      .expect(201);

    const shareUrl = new URL(response.body.shareUrl);
    const token = shareUrl.pathname.split('/').pop() ?? '';
    expect(token).toMatch(/^chk_[A-Za-z0-9_-]{43}$/);
    expect(response.body).toEqual({
      ok: true,
      shareUrl: `https://app.vitalcv.test/review/${token}`,
      auditEventId: 'audit-1',
      expiresAt: expect.any(String),
    });

    const createCall = prismaMock.auditEvent.create.mock.calls[0]?.[0];
    const metadata = createCall.data.metadata;
    expect(metadata).toEqual(expect.objectContaining({
      schema: 'vitalcv.employer.packet-shared.v1',
      employerId: 'employer-1',
      entityId: '11111111-1111-4111-8111-111111111111',
      clinicianNpi: '1234567890',
      organizationContextId: 'ctx-1',
      bundleId: 'bundle-1',
      shareTokenHash: expect.any(String),
      sharedAt: expect.any(String),
      expiresAt: expect.any(String),
      correlationId: expect.any(String),
      mutationFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      mutationClassification: 'TRUST_PACKET_SHARE',
      replayCategory: 'R-CAT-3',
      payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(JSON.stringify(metadata)).not.toContain(token);
    expect(JSON.stringify(metadata)).not.toContain(response.body.shareUrl);
  });

  it('rejects share-packet requests for an NPI that does not match the reviewed entity', async () => {
    await request(buildApp())
      .post('/api/employer-review/11111111-1111-4111-8111-111111111111/share-packet')
      .set('x-clerk-user-id', 'employer-1')
      .send({ npi: '1111111111' })
      .expect(400);

    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'EMPLOYER_REVIEW_MUTATION_DENIED',
        referenceId: '11111111-1111-4111-8111-111111111111',
        clinicianId: '1234567890',
        metadata: expect.objectContaining({
          runtimeTrust: expect.objectContaining({
            outcome: 'denied',
            denialReason: 'npi_mismatch',
            mutationClassification: 'DENIED_MUTATION',
            replayCategory: 'R-CAT-5',
          }),
        }),
      }),
    }));
  });

  it('resolves a valid share token to the review target and scoped context', async () => {
    prismaMock.auditEvent.findFirst.mockResolvedValueOnce({
      id: 'share-audit-1',
      referenceId: '11111111-1111-4111-8111-111111111111',
      clinicianId: '1234567890',
      createdAt: new Date('2026-03-23T18:00:00.000Z'),
      metadata: {
        schema: 'vitalcv.employer.packet-shared.v1',
        organizationContextId: 'ctx-1',
        bundleId: 'bundle-1',
        shareTokenHash: 'hash-1',
        expiresAt: '2099-03-24T18:00:00.000Z',
      },
    });

    const response = await request(buildApp())
      .get('/api/employer-review/share-token/chk_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12')
      .expect(200);

    expect(prismaMock.auditEvent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        type: 'EMPLOYER_PACKET_SHARED',
        metadata: expect.objectContaining({
          path: ['shareTokenHash'],
          equals: expect.any(String),
        }),
      }),
    }));
    expect(response.body).toEqual({
      ok: true,
      entityId: '11111111-1111-4111-8111-111111111111',
      clinicianNpi: '1234567890',
      organizationContextId: 'ctx-1',
      bundleId: 'bundle-1',
      reviewHref: '/review/11111111-1111-4111-8111-111111111111?contextId=ctx-1&bundleId=bundle-1',
      shareEventAuditId: 'share-audit-1',
      sharedAt: '2026-03-23T18:00:00.000Z',
      expiresAt: '2099-03-24T18:00:00.000Z',
    });
  });

  it('fails closed for missing and expired share tokens', async () => {
    await request(buildApp())
      .get('/api/employer-review/share-token/not-a-token')
      .expect(404);

    prismaMock.auditEvent.findFirst.mockResolvedValueOnce(null);
    await request(buildApp())
      .get('/api/employer-review/share-token/chk_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12')
      .expect(404);

    prismaMock.auditEvent.findFirst.mockResolvedValueOnce({
      id: 'share-audit-1',
      referenceId: '11111111-1111-4111-8111-111111111111',
      clinicianId: '1234567890',
      createdAt: new Date('2026-03-23T18:00:00.000Z'),
      metadata: {
        expiresAt: '2020-01-01T00:00:00.000Z',
      },
    });
    await request(buildApp())
      .get('/api/employer-review/share-token/chk_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12')
      .expect(410);
  });

  it('requires an ACCEPTED employer acceptance before confirm-start can write an attestation', async () => {
    prismaMock.employerAcceptance.findFirst.mockResolvedValueOnce(null);

    await request(buildApp())
      .post('/api/employer-review/11111111-1111-4111-8111-111111111111/confirm-start')
      .set('x-clerk-user-id', 'employer-1')
      .send({
        startedAt: '2026-03-25T18:00:00.000Z',
        role: 'RN',
        facility: 'Providence',
      })
      .expect(409);

    expect(prismaMock.startAttestation.create).not.toHaveBeenCalled();
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'EMPLOYER_REVIEW_MUTATION_DENIED',
        referenceId: '11111111-1111-4111-8111-111111111111',
        clinicianId: '1234567890',
        metadata: expect.objectContaining({
          runtimeTrust: expect.objectContaining({
            outcome: 'denied',
            denialReason: 'missing_acceptance',
            mutationClassification: 'DENIED_MUTATION',
            replayCategory: 'R-CAT-5',
          }),
        }),
      }),
    }));
  });

  it('scopes explicit confirm-start acceptance IDs to the reviewed clinician NPI', async () => {
    prismaMock.employerAcceptance.findFirst.mockResolvedValueOnce({
      id: 'accept-1',
      clinicianNpi: '1234567890',
    });

    const response = await request(buildApp())
      .post('/api/employer-review/11111111-1111-4111-8111-111111111111/confirm-start')
      .set('x-clerk-user-id', 'employer-1')
      .send({
        startedAt: '2026-03-25T18:00:00.000Z',
        role: 'RN',
        facility: 'Providence',
        acceptanceId: 'accept-1',
      })
      .expect(201);

    expect(prismaMock.employerAcceptance.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'accept-1',
        employerId: { in: ['employer-1', '44444444-4444-4444-8444-444444444444'] },
        clinicianNpi: '1234567890',
        status: 'ACCEPTED',
      },
    }));
    expect(confirmStartByAcceptanceMock).toHaveBeenCalledWith(expect.objectContaining({
      acceptanceId: 'accept-1',
      actorId: 'employer-1',
      expectedClinicianNpi: '1234567890',
      expectedOrganizationId: '44444444-4444-4444-8444-444444444444',
      role: 'RN',
      facility: 'Providence',
    }));
    expect(response.body).toEqual({
      ok: true,
      duplicate: false,
      attestationId: 'attestation-1',
      auditEventId: 'attestation-audit-1',
      startedAt: '2026-03-25T18:00:00.000Z',
    });
  });
});
