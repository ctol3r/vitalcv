jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    auditSnapshot: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    bundleShareEvent: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../../audit/auditLedger', () => ({
  appendAuditEvent: jest.fn(),
}));

jest.mock('../../entity/employerReviewPayload', () => ({
  buildEmployerReviewPayload: jest.fn(),
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import { appendAuditEvent } from '../../audit/auditLedger';
import { buildEmployerReviewPayload } from '../../entity/employerReviewPayload';
import {
  appendSnapshotHistory,
  computeEmployerConfidence,
  computeTrustScore,
  createSnapshot,
  revalidateSnapshot,
  trackApplyEvent,
  trackEmployerAction,
  type TrustHistory,
  type VCVSnapshot,
} from '../vcvSnapshotService';

const prismaMock = prisma as unknown as {
  auditSnapshot: {
    findMany: jest.Mock;
    create: jest.Mock;
  };
  bundleShareEvent: {
    findFirst: jest.Mock;
  };
};

const appendAuditEventMock = appendAuditEvent as jest.MockedFunction<typeof appendAuditEvent>;
const buildEmployerReviewPayloadMock = buildEmployerReviewPayload as jest.MockedFunction<typeof buildEmployerReviewPayload>;

function buildProfileFixture(overrides?: Record<string, unknown>) {
  return {
    schema: 'vitalcv.employer.review.v1',
    identitySummary: {
      entityId: 'entity-1',
      displayName: 'Dr. Jane Doe',
      npi: '1234567890',
      specialty: 'Family Medicine',
      entityType: 'INDIVIDUAL',
    },
    readinessSummary: {
      status: 'READY',
      score: 84,
      readiness_score: 84,
      level: 'L3',
      blockers: ['license_missing'],
      gaps: ['board_certification_optional'],
      nextActions: [],
      estimatedStartDays: 4,
    },
    authorityStanding: {
      exclusionStatus: 'CLEAR',
      exclusionCheckedAt: '2026-04-10T12:00:00.000Z',
      licensureStatus: 'ACTIVE',
      deaStatus: 'ACTIVE',
      pecosStatus: 'ENROLLED',
      negativeFindings: [],
    },
    blockers: ['license_missing'],
    nextActions: [],
    credentialsIncluded: [
      {
        credentialId: 'cred-2',
        domain: 'license',
        credentialType: 'STATE_LICENSE',
        status: 'VERIFIED',
        verificationLevel: 'L2',
        observedAt: '2026-04-10T10:00:00.000Z',
        expiresAt: '2027-04-10T10:00:00.000Z',
        artifactIds: ['artifact-2'],
        receiptIds: ['receipt-2'],
      },
      {
        credentialId: 'cred-1',
        domain: 'identity',
        credentialType: 'NPI',
        status: 'VERIFIED',
        verificationLevel: 'L3',
        observedAt: '2026-04-10T09:00:00.000Z',
        expiresAt: undefined,
        artifactIds: ['artifact-1'],
        receiptIds: ['receipt-1'],
      },
    ],
    receiptReferences: ['receipt-2', 'receipt-1'],
    proofReferences: ['proof-2', 'proof-1'],
    checkedAt: '2026-04-10T12:00:00.000Z',
    truth: {
      identity: { status: 'VERIFIED' },
      safety: { status: 'CLEAR' },
      authority: { status: 'VERIFIED' },
      eligibility: { status: 'ENROLLED' },
    },
    sourceCoverage: {
      checks: [],
      summary: {
        checked: ['NPPES_API'],
        stale: ['STATE_BOARD'],
        pending: ['PECOS'],
        gated: ['NURSYS'],
        unavailable: [],
        accessRequired: ['FSMB'],
        reviewRequired: ['MANUAL_REVIEW'],
        notDecisionGrade: [],
        previewOnly: ['OPENALEX'],
      },
      sources: ['NPPES_API', 'STATE_BOARD'],
      domains: ['identity', 'license'],
      credentialCount: 2,
    },
    shareMetadata: {},
    ...overrides,
  };
}

describe('vcvSnapshotService', () => {
  beforeEach(() => {
    prismaMock.auditSnapshot.findMany.mockReset().mockResolvedValue([]);
    prismaMock.auditSnapshot.create.mockReset().mockResolvedValue({ id: 'audit-snapshot-1' });
    prismaMock.bundleShareEvent.findFirst.mockReset().mockResolvedValue(null);
    appendAuditEventMock.mockReset().mockReturnValue({
      eventId: 'audit-event-1',
      time: '2026-04-10T12:00:00.000Z',
      traceId: 'trace-1',
      category: ['DECISION'],
      actor: 'actor-1',
      resource: 'resource-1',
      requestFields: {},
      resultFields: {},
      severity: 'INFO',
      receiptHash: 'hash-1',
    });
    buildEmployerReviewPayloadMock.mockReset();
  });

  it('creates deterministic snapshots from verified profile data', () => {
    const profile = buildProfileFixture();

    const first = createSnapshot(profile as never, 'APPLY');
    const second = createSnapshot(profile as never, 'APPLY');

    expect(first).toEqual(second);
    expect(first).toEqual(expect.objectContaining({
      providerId: 'entity-1',
      decision: 'APPLY',
      employerConfidence: 0,
      trustScore: 84,
      createdAt: '2026-04-10T12:00:00.000Z',
      lastValidatedAt: '2026-04-10T12:00:00.000Z',
      missingCritical: [
        'license_missing',
        'SOURCE_ACCESS_REQUIRED:FSMB',
        'SOURCE_GATED:NURSYS',
        'SOURCE_STALE:STATE_BOARD',
      ],
      missingNonCritical: [
        'board_certification_optional',
        'SOURCE_PENDING:PECOS',
        'SOURCE_PREVIEW_ONLY:OPENALEX',
        'SOURCE_REVIEW_REQUIRED:MANUAL_REVIEW',
      ],
      history: {
        events: [],
        decisions: [],
        employerActions: [],
      },
    }));
    expect(first.verifiedData.credentials.map((credential) => credential.credentialId)).toEqual(['cred-1', 'cred-2']);
    expect(first.verifiedData.receiptReferences).toEqual(['receipt-1', 'receipt-2']);
    expect(first.verifiedData.proofReferences).toEqual(['proof-1', 'proof-2']);
  });

  it('reuses an unchanged employer-action snapshot and only advances validation time', async () => {
    const storedProfile = buildProfileFixture({
      checkedAt: '2026-04-10T12:00:00.000Z',
    });
    const currentProfile = buildProfileFixture({
      checkedAt: '2026-04-11T09:30:00.000Z',
    });
    const storedSnapshot = createSnapshot(storedProfile as never, 'PROCEED');

    prismaMock.auditSnapshot.findMany.mockResolvedValue([
      { snapshot: storedSnapshot },
    ]);
    buildEmployerReviewPayloadMock.mockResolvedValue(currentProfile as never);

    const result = await trackEmployerAction({
      actorId: 'employer-1',
      providerId: 'entity-1',
      decision: 'PROCEED',
      bundleId: 'bundle-1',
      metadata: { auditEventId: 'audit-1' },
    });

    expect(result.reused).toBe(true);
    expect(result.snapshot).toEqual({
      ...storedSnapshot,
      lastValidatedAt: '2026-04-11T09:30:00.000Z',
    });
    expect(prismaMock.auditSnapshot.create).not.toHaveBeenCalled();
    expect(appendAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
      category: 'DECISION',
      actor: 'employer-1',
      resource: 'entity-1',
      resultFields: expect.objectContaining({
        snapshotId: storedSnapshot.id,
        reused: true,
        auditEventId: 'audit-1',
      }),
    }));
  });

  it('tracks apply events by storing the snapshot and writing an audit signal', async () => {
    const profile = buildProfileFixture();

    const result = await trackApplyEvent({
      actorId: 'clinician-1',
      bundleId: 'bundle-1',
      profile: profile as never,
      metadata: {
        shareId: 'share-1',
        organizationId: 'org-1',
      },
    });

    expect(result.reused).toBe(false);
    expect(prismaMock.auditSnapshot.create).toHaveBeenCalledWith({
      data: {
        artifactId: 'bundle-1',
        snapshot: expect.objectContaining({
          id: result.snapshot.id,
          providerId: 'entity-1',
          decision: 'APPLY',
        }),
      },
    });
    expect(appendAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
      category: ['BUNDLE_EXPORT', 'DECISION'],
      actor: 'clinician-1',
      resource: 'bundle-1',
      requestFields: {
        providerId: 'entity-1',
        decision: 'APPLY',
      },
      resultFields: expect.objectContaining({
        snapshotId: result.snapshot.id,
        reused: false,
        shareId: 'share-1',
        organizationId: 'org-1',
      }),
    }));
  });

  it('revalidates a snapshot against the current provider payload', async () => {
    const originalProfile = buildProfileFixture({
      checkedAt: '2026-04-10T12:00:00.000Z',
    });
    const currentProfile = buildProfileFixture({
      checkedAt: '2026-04-11T12:30:00.000Z',
    });
    const snapshot = createSnapshot(originalProfile as never, 'APPLY');
    buildEmployerReviewPayloadMock.mockResolvedValue(currentProfile as never);

    const revalidated = await revalidateSnapshot(snapshot as VCVSnapshot);

    expect(revalidated.id).toBe(snapshot.id);
    expect(revalidated.createdAt).toBe(snapshot.createdAt);
    expect(revalidated.lastValidatedAt).toBe('2026-04-11T12:30:00.000Z');
  });

  it('accumulates trust from appended decisions and employer actions', () => {
    const snapshot = createSnapshot(buildProfileFixture() as never, 'PROCEED');

    const withHistory = appendSnapshotHistory(snapshot, {
      decisions: [
        {
          id: 'decision-1',
          decisionClass: 'TRUSTED_BUT_STALE_SOON',
          occurredAt: '2026-04-08T10:00:00.000Z',
          confidence: 0.72,
        },
        {
          id: 'decision-2',
          decisionClass: 'TRUSTED_CURRENT',
          occurredAt: '2026-04-10T10:00:00.000Z',
          confidence: 0.94,
        },
      ],
      employerActions: [
        {
          id: 'action-1',
          action: 'proceed',
          occurredAt: '2026-04-09T10:00:00.000Z',
          employerId: 'employer-1',
          organizationId: 'org-1',
        },
        {
          id: 'action-2',
          action: 'accept',
          occurredAt: '2026-04-10T12:00:00.000Z',
          employerId: 'employer-2',
          organizationId: 'org-2',
        },
      ],
    });

    expect(withHistory.history.decisions).toHaveLength(2);
    expect(withHistory.history.employerActions).toHaveLength(2);
    expect(withHistory.employerConfidence).toBeGreaterThan(0.6);
    expect(withHistory.trustScore).toBeGreaterThan(snapshot.trustScore);
  });

  it('scores employer confidence from real employer actions only', () => {
    const positiveHistory: TrustHistory = {
      events: [],
      decisions: [],
      employerActions: [
        {
          id: 'action-1',
          action: 'accept',
          occurredAt: '2026-04-09T10:00:00.000Z',
          employerId: 'employer-1',
          organizationId: 'org-1',
        },
        {
          id: 'action-2',
          action: 'proceed',
          occurredAt: '2026-04-10T10:00:00.000Z',
          employerId: 'employer-2',
          organizationId: 'org-2',
        },
      ],
    };
    const cautionaryHistory: TrustHistory = {
      events: [],
      decisions: [],
      employerActions: [
        ...positiveHistory.employerActions,
        {
          id: 'action-3',
          action: 'request_refresh',
          occurredAt: '2026-04-11T10:00:00.000Z',
          employerId: 'employer-2',
          organizationId: 'org-2',
        },
        {
          id: 'action-4',
          action: 'review',
          occurredAt: '2026-04-11T11:00:00.000Z',
          employerId: 'employer-3',
          organizationId: 'org-3',
        },
      ],
    };

    expect(computeEmployerConfidence(positiveHistory)).toBeGreaterThan(0.6);
    expect(computeEmployerConfidence(cautionaryHistory)).toBeLessThan(computeEmployerConfidence(positiveHistory));
  });

  it('orders history timelines deterministically by timestamp then id', () => {
    const snapshot = createSnapshot(buildProfileFixture() as never, 'APPLY');

    const withHistory = appendSnapshotHistory(snapshot, {
      events: [
        {
          id: 'event-b',
          eventType: 'BUNDLE_SHARED',
          occurredAt: '2026-04-11T10:00:00.000Z',
        },
        {
          id: 'event-a',
          eventType: 'SNAPSHOT_CREATED',
          occurredAt: '2026-04-10T10:00:00.000Z',
        },
      ],
      decisions: [
        {
          id: 'decision-b',
          decisionClass: 'TRUSTED_CURRENT',
          occurredAt: '2026-04-11T08:00:00.000Z',
        },
        {
          id: 'decision-a',
          decisionClass: 'STALE_REVERIFY_REQUIRED',
          occurredAt: '2026-04-09T08:00:00.000Z',
        },
      ],
      employerActions: [
        {
          id: 'action-b',
          action: 'review',
          occurredAt: '2026-04-12T09:00:00.000Z',
        },
        {
          id: 'action-a',
          action: 'accept',
          occurredAt: '2026-04-12T09:00:00.000Z',
        },
      ],
    });

    expect(withHistory.history.events.map((entry) => entry.id)).toEqual(['event-a', 'event-b']);
    expect(withHistory.history.decisions.map((entry) => entry.id)).toEqual(['decision-a', 'decision-b']);
    expect(withHistory.history.employerActions.map((entry) => entry.id)).toEqual(['action-a', 'action-b']);
    expect(computeTrustScore(withHistory.history, snapshot.verifiedData.readiness.score)).toBe(withHistory.trustScore);
  });
});
