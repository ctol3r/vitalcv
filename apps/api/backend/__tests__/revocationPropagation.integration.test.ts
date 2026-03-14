import { randomUUID } from 'node:crypto';

jest.mock('../src/services/trust/trustStateEngine', () => ({
  refreshTrustState: jest.fn(),
}));

jest.mock('../src/services/graph/bidirectional', () => ({
  propagateRevocation: jest.fn(),
}));

import prisma from '../src/graphql/prisma_client';
import { propagateRevocation } from '../src/services/graph/bidirectional';
import { propagateCredentialLifecycleChange } from '../src/services/revocation/propagationEngine';
import {
  refreshTrustState,
  type ClinicianTrustState,
} from '../src/services/trust/trustStateEngine';

const suite = process.env.DATABASE_URL ? describe : describe.skip;

const refreshTrustStateMock = refreshTrustState as jest.MockedFunction<typeof refreshTrustState>;
const propagateBidirectionalMock = propagateRevocation as jest.Mock;

type Fixture = {
  npi: string;
  artifactId: string;
  capsuleId: string;
  recognitionId: string;
  acceptanceId: string;
};

let fixtureCounter = 0;
const createdFixtures: Fixture[] = [];
let verificationArtifactSchemaReady = true;

function nextNpi(): string {
  fixtureCounter += 1;
  return String(9000000000 + fixtureCounter);
}

function makeTrustState(npi: string): ClinicianTrustState {
  return {
    npi,
    identityVerified: true,
    licensureStatus: 'verified',
    exclusionClear: true,
    credentialCount: 1,
    readiness_level: 'L1',
    readiness_status: 'Mostly ready',
    readiness_score: 62,
    gap_summary: ['credential status changed'],
    methodology_version: '243.1',
    computed_at: '2026-03-14T15:00:00.000Z',
    trustBand: 'L1',
    trustScore: 62,
    facts: [],
    gaps: ['credential status changed'],
    computedAt: '2026-03-14T15:00:00.000Z',
  };
}

async function seedFixture(capsuleStatus = 'VALID'): Promise<Fixture> {
  const npi = nextNpi();
  const subjectDid = `did:vitalcv:npi:${npi}`;
  const recognitionId = `rec-${randomUUID()}`;
  const acceptanceId = `acc-${randomUUID()}`;

  const artifact = await prisma.verificationArtifact.create({
    data: {
      npi,
      source: 'NURSYS',
      status: 'VERIFIED',
      rawPayload: {
        kind: 'state-license',
      },
      checksum: `checksum-${randomUUID()}`,
      lifecycleState: 'active',
      statusLastChecked: new Date('2026-03-14T09:00:00.000Z'),
      verifiedAt: new Date('2026-03-01T00:00:00.000Z'),
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      monitoring: true,
      trustState: 'verified',
    },
  });

  await prisma.recognition.create({
    data: {
      recognitionId,
      subjectId: npi,
      employerId: 'employer-wave259',
      recognizedAt: new Date('2026-03-10T00:00:00.000Z'),
      verifiedAt: new Date('2026-03-10T00:00:00.000Z'),
      verificationRef: `verification-${randomUUID()}`,
      eventHash: `hash-${randomUUID()}`,
    },
  });

  await prisma.acceptance.create({
    data: {
      acceptanceId,
      recognitionId,
      subjectId: npi,
      employerId: 'employer-wave259',
      facilityId: 'facility-alpha',
      acceptedAt: new Date('2026-03-10T01:00:00.000Z'),
      psvReportId: `psv-${randomUUID()}`,
      eventHash: `hash-${randomUUID()}`,
    },
  });

  const capsule = await prisma.decisionCapsule.create({
    data: {
      subjectDid,
      subjectNpi: npi,
      decisionType: 'HIRING',
      decisionTimestamp: new Date('2026-03-10T02:00:00.000Z'),
      credentialIds: [artifact.id],
      issuerIds: ['issuer-wave259'],
      artifactHash: `artifact-${randomUUID()}`,
      status: capsuleStatus,
      metadata: {
        trust_state_snapshot: {
          readiness_level: 'L3',
        },
      },
    },
  });

  const fixture = {
    npi,
    artifactId: artifact.id,
    capsuleId: capsule.id,
    recognitionId,
    acceptanceId,
  };
  createdFixtures.push(fixture);
  return fixture;
}

async function cleanupFixture(fixture: Fixture): Promise<void> {
  const nodes = await prisma.knowledgeNode.findMany({
    where: {
      entityId: {
        in: [fixture.artifactId, fixture.capsuleId],
      },
    },
    select: { id: true },
  });
  const nodeIds = nodes.map((node) => node.id);

  if (nodeIds.length > 0) {
    await prisma.authorityEdge.deleteMany({
      where: {
        OR: [
          { sourceNodeId: { in: nodeIds } },
          { targetNodeId: { in: nodeIds } },
        ],
      },
    });
    await prisma.knowledgeNode.deleteMany({
      where: {
        id: { in: nodeIds },
      },
    });
  }

  await prisma.revocationOutboxEvent.deleteMany({
    where: {
      artifactId: fixture.artifactId,
    },
  });
  await prisma.auditEvent.deleteMany({
    where: {
      OR: [
        { referenceId: fixture.capsuleId },
        { clinicianId: fixture.npi },
      ],
    },
  });
  await prisma.decisionCapsule.deleteMany({
    where: { id: fixture.capsuleId },
  });
  await prisma.acceptance.deleteMany({
    where: { acceptanceId: fixture.acceptanceId },
  });
  await prisma.recognition.deleteMany({
    where: { recognitionId: fixture.recognitionId },
  });
  await prisma.verificationArtifact.deleteMany({
    where: { npi: fixture.npi },
  });
}

suite('revocation propagation integration', () => {
  beforeAll(async () => {
    const rows = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'VerificationArtifact'
          AND column_name = 'statusListIndex'
      `,
    );
    verificationArtifactSchemaReady = rows.length > 0;
    if (!verificationArtifactSchemaReady) {
      console.warn(
        'Skipping revocation propagation DB assertions because VerificationArtifact.statusListIndex is missing from the test schema.',
      );
    }
  });

  beforeEach(() => {
    refreshTrustStateMock.mockReset();
    propagateBidirectionalMock.mockReset();

    refreshTrustStateMock.mockImplementation(async (npi: string) => {
      const state = makeTrustState(npi);
      await prisma.verificationArtifact.create({
        data: {
          npi,
          source: 'TRUST_STATE_ENGINE',
          status: 'ACTIVE',
          rawPayload: {
            readiness_level: state.readiness_level,
            computed_at: state.computed_at,
          },
          checksum: `trust-state-${npi}-${randomUUID()}`,
          verifiedAt: new Date(state.computed_at),
          monitoring: false,
          trustState: state.readiness_level,
        },
      });
      return state;
    });

    propagateBidirectionalMock.mockResolvedValue({
      totalFlagged: 2,
      flaggedAcceptances: ['acceptance-1'],
      flaggedStarts: ['start-1'],
      traversalHash: 'traversal-wave259',
    });
  });

  afterEach(async () => {
    while (createdFixtures.length > 0) {
      const fixture = createdFixtures.pop();
      if (fixture) {
        await cleanupFixture(fixture);
      }
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it.each([
    ['credential.revoked', 'REVOKED', 'revoked', 'INVALID'],
    ['credential.expired', 'EXPIRED', 'expired', 'INVALID'],
    ['verification.invalidated', 'INVALIDATED', 'needs_review', 'AT_RISK'],
  ] as const)(
    'updates artifacts, capsules, trust snapshots, and outbox rows for %s',
    async (trigger, expectedArtifactStatus, expectedTrustState, expectedCapsuleStatus) => {
      if (!verificationArtifactSchemaReady) {
        return;
      }

      const fixture = await seedFixture();
      const occurredAt = new Date('2026-03-14T14:00:00.000Z');

      const result = await propagateCredentialLifecycleChange({
        credentialId: fixture.artifactId,
        trigger,
        occurredAt,
        reason: `${trigger} integration test`,
      });

      const artifact = await prisma.verificationArtifact.findUnique({
        where: { id: fixture.artifactId },
        select: {
          status: true,
          trustState: true,
          lifecycleState: true,
          statusLastChecked: true,
        },
      });
      const capsule = await prisma.decisionCapsule.findUnique({
        where: { id: fixture.capsuleId },
        select: {
          status: true,
          metadata: true,
        },
      });
      const outboxRows = await prisma.revocationOutboxEvent.findMany({
        where: { artifactId: fixture.artifactId },
        orderBy: { createdAt: 'asc' },
      });
      const trustSnapshot = await prisma.verificationArtifact.findFirst({
        where: {
          npi: fixture.npi,
          source: 'TRUST_STATE_ENGINE',
        },
        orderBy: { createdAt: 'desc' },
      });
      const credentialNode = await prisma.knowledgeNode.findUnique({
        where: {
          entityType_entityId: {
            entityType: 'CREDENTIAL',
            entityId: fixture.artifactId,
          },
        },
      });
      const capsuleNode = await prisma.knowledgeNode.findUnique({
        where: {
          entityType_entityId: {
            entityType: 'DECISION_CAPSULE',
            entityId: fixture.capsuleId,
          },
        },
      });
      const edge = credentialNode && capsuleNode
        ? await prisma.authorityEdge.findFirst({
          where: {
            sourceNodeId: capsuleNode.id,
            targetNodeId: credentialNode.id,
            relationType: 'DEPENDS_ON',
          },
        })
        : null;

      expect(artifact).toEqual(expect.objectContaining({
        status: expectedArtifactStatus,
        trustState: expectedTrustState,
        statusLastChecked: occurredAt,
      }));
      if (trigger === 'credential.revoked') {
        expect(artifact?.lifecycleState).toBe('revoked');
      }
      if (trigger === 'credential.expired') {
        expect(artifact?.lifecycleState).toBe('expired');
      }
      if (trigger === 'verification.invalidated') {
        expect(artifact?.lifecycleState).toBe('active');
      }

      const capsuleMetadata = (capsule?.metadata ?? {}) as Record<string, unknown>;
      expect(capsule?.status).toBe(expectedCapsuleStatus);
      expect(capsuleMetadata.trust_state_snapshot).toEqual({
        readiness_level: 'L3',
      });
      expect(capsuleMetadata.trust_state_snapshot_invalidated).toBe(true);
      expect(capsuleMetadata.revocation_trigger).toBe(trigger);
      expect(capsuleMetadata.revocation_artifact_id).toBe(fixture.artifactId);
      expect(capsuleMetadata).toHaveProperty('revocation_recomputed_trust_state');
      expect(capsuleMetadata.revocation_recomputed_at).toBe('2026-03-14T15:00:00.000Z');

      expect(trustSnapshot).not.toBeNull();
      expect(result.trustState?.snapshotArtifactId).toBe(trustSnapshot?.id ?? null);
      expect(outboxRows).toHaveLength(1);
      expect(outboxRows[0]?.eventType).toBe(trigger);
      expect(outboxRows[0]?.status).toBe('PENDING');
      expect(result.outbox.totalEnqueued).toBe(1);
      expect(edge).not.toBeNull();

      if (trigger === 'verification.invalidated') {
        expect(result.bidirectionalFlagged).toBe(0);
      } else {
        expect(result.bidirectionalFlagged).toBe(2);
      }
    },
  );
});
