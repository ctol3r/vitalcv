import { PassThrough } from 'node:stream';
import express from 'express';
import request from 'supertest';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    vcvEntity: {
      findUnique: jest.fn(),
    },
    employerAcceptance: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    auditEvent: {
      create: jest.fn(),
      findFirst: jest.fn(),
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
import { registerEmployerActionRoutes } from '../employerActions';

const prismaMock = prisma as unknown as {
  vcvEntity: {
    findUnique: jest.Mock;
  };
  employerAcceptance: {
    findFirst: jest.Mock;
    create: jest.Mock;
  };
  auditEvent: {
    create: jest.Mock;
    findFirst: jest.Mock;
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
    entityId: 'entity-1',
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
      entityId: 'entity-1',
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
    prismaMock.employerAcceptance.findFirst.mockReset();
    prismaMock.employerAcceptance.create.mockReset();
    prismaMock.auditEvent.create.mockReset();
    prismaMock.auditEvent.findFirst.mockReset();
    prismaMock.outboxEvent.upsert.mockReset();
    prismaMock.$transaction.mockReset();
    captureAdvisoryEventMock.mockReset();
    captureEmployerDecisionMock.mockReset();
    buildPassportMock.mockReset();
    buildEmployerEvidencePacketMock.mockReset();
    createEmployerEvidencePacketZipStreamMock.mockReset();

    prismaMock.vcvEntity.findUnique.mockResolvedValue({
      id: 'entity-1',
      npi: '1234567890',
    });
    prismaMock.employerAcceptance.findFirst.mockResolvedValue(null);
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

    wireTransactionClient();
  });

  it('persists accept actions with a durable acceptance record and outbox handoff', async () => {
    const response = await request(buildApp())
      .post('/api/employer-review/entity-1/accept')
      .set('x-clerk-user-id', 'employer-1')
      .send({ role: 'Recruiter', facility: 'Providence', notes: 'Head start only' })
      .expect(201);

    expect(response.body.state).toEqual(expect.objectContaining({
      action: 'accept',
      entityId: 'entity-1',
      clinicianNpi: '1234567890',
      auditEventId: 'audit-1',
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
          }),
        }),
      }),
    }));
    expect(captureEmployerDecisionMock).toHaveBeenCalledWith(expect.objectContaining({
      auditEventId: 'audit-1',
      decision: 'PROCEED',
    }));
  });

  it('persists refresh requests through the outbox and normalizes the refresh payload', async () => {
    const response = await request(buildApp())
      .post('/api/employer-review/entity-1/request-refresh')
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
        referenceId: 'entity-1',
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
    expect(captureAdvisoryEventMock).toHaveBeenCalledWith(expect.objectContaining({
      blockersAtEvent: ['LICENSURE', 'BOARD_CERTIFICATION'],
      sourceCoverageAtEvent: { staleSources: ['CMS PECOS', 'OIG LEIE'] },
    }));
  });

  it('routes to review with both queue persistence and outbox persistence when a review item is created', async () => {
    wireTransactionClient({ reviewItemId: 'review-item-1' });

    const response = await request(buildApp())
      .post('/api/employer-review/entity-1/route-to-review')
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
        referenceId: 'entity-1',
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
      .post('/api/employer-review/entity-1/accept')
      .set('x-clerk-user-id', 'employer-1')
      .send({})
      .expect(409);

    expect(response.body).toEqual({
      error: 'already_accepted',
      error_description: 'An active acceptance already exists for this employer/NPI pair.',
      acceptanceId: 'accept-existing',
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.auditEvent.create).not.toHaveBeenCalled();
    expect(prismaMock.outboxEvent.upsert).not.toHaveBeenCalled();
    expect(captureEmployerDecisionMock).not.toHaveBeenCalled();
  });

  it('keeps status reads backward compatible with legacy audit-only review metadata', async () => {
    prismaMock.employerAcceptance.findFirst.mockResolvedValueOnce(null);
    prismaMock.auditEvent.findFirst.mockResolvedValueOnce({
      id: 'audit-review-1',
      createdAt: new Date('2026-03-23T19:30:00.000Z'),
      metadata: {
        employerReviewAction: {
          action: 'review',
          employerId: 'employer-1',
          entityId: 'entity-1',
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
        },
      },
    });

    const response = await request(buildApp())
      .get('/api/employer-review/entity-1/status')
      .set('x-clerk-user-id', 'employer-1')
      .expect(200);

    expect(response.body).toEqual({
      ok: true,
      state: {
        action: 'review',
        entityId: 'entity-1',
        clinicianNpi: '1234567890',
        auditEventId: 'audit-review-1',
        timestamp: '2026-03-23T19:30:00.000Z',
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
    prismaMock.employerAcceptance.findFirst.mockResolvedValueOnce({
      id: 'accept-1',
      acceptedAt: new Date('2026-03-23T19:45:00.000Z'),
      status: 'ACCEPTED',
    });
    prismaMock.auditEvent.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'audit-accept-1',
        createdAt: new Date('2026-03-23T19:46:00.000Z'),
        metadata: {
          employerReviewAction: {
            action: 'accept',
            employerId: 'employer-1',
            entityId: 'entity-1',
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
      });

    const response = await request(buildApp())
      .get('/api/employer-review/entity-1/status')
      .set('x-clerk-user-id', 'employer-1')
      .expect(200);

    expect(response.body).toEqual({
      ok: true,
      state: {
        action: 'accept',
        entityId: 'entity-1',
        clinicianNpi: '1234567890',
        auditEventId: 'audit-accept-1',
        timestamp: '2026-03-23T19:46:00.000Z',
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
    buildPassportMock.mockResolvedValue({ entityId: 'entity-1' } as never);
    buildEmployerEvidencePacketMock.mockReturnValue(packet as never);

    const response = await request(buildApp())
      .get('/api/employer-review/entity-1/packet?format=json')
      .set('x-clerk-user-id', 'employer-1')
      .expect(200);

    expect(response.body).toEqual(packet);
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'ARTIFACT_EXPORTED',
        referenceId: 'entity-1',
        clinicianId: '1234567890',
      }),
    }));
  });

  it('streams the packet bundle as ZIP when requested', async () => {
    const packet = buildPacketFixture();
    const zipStream = new PassThrough();
    buildPassportMock.mockResolvedValue({ entityId: 'entity-1' } as never);
    buildEmployerEvidencePacketMock.mockReturnValue(packet as never);
    createEmployerEvidencePacketZipStreamMock.mockReturnValue(zipStream);

    setImmediate(() => {
      zipStream.end(Buffer.from('PK\x03\x04mockzip', 'binary'));
    });

    const response = await request(buildApp())
      .get('/api/employer-review/entity-1/packet?format=zip')
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
});
