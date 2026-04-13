import prisma from '../../../graphql/prisma_client';
import { createGraphNodeId } from '../ids';
import {
  syncClaimRecord,
  syncDecisionCapsule,
  syncOpportunityNode,
  syncOrganizationNode,
  syncProviderDecisionSnapshot,
  syncVerificationArtifact,
} from '../graphSyncEngine';
import { traverseActiveGraph } from '../graphTraversalHelpers';
import { Prisma } from '@prisma/client';

const NPI = '1234567890';

async function resetFixture(): Promise<void> {
  const safeDeleteMany = async (operation: () => Promise<unknown>): Promise<void> => {
    try {
      await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
        return;
      }
      throw error;
    }
  };

  await prisma.graphEdge.deleteMany({});
  await prisma.graphNode.deleteMany({});
  await safeDeleteMany(() => prisma.employerDecisionEvent.deleteMany({}));
  await safeDeleteMany(() => prisma.vcvOrganizationContext.deleteMany({}));
  await safeDeleteMany(() => prisma.vcvEntity.deleteMany({}));
  await prisma.decisionCapsule.deleteMany({});
  await prisma.providerDecisionHistory.deleteMany({});
  await prisma.providerDecisionState.deleteMany({});
  await prisma.anomalyHistory.deleteMany({});
  await prisma.claimRecord.deleteMany({});
  await prisma.verificationArtifact.deleteMany({});
  await prisma.opportunity.deleteMany({});
  await prisma.organizationProfile.deleteMany({});
  await prisma.organization.deleteMany({});
  await prisma.provider.deleteMany({});
  await prisma.personProfile.deleteMany({});
  await prisma.user.deleteMany({});
}

async function seedFixture(): Promise<{
  organizationId: string;
  opportunityId: string;
  artifactId: string;
  claimRecordId: string;
  decisionCapsuleId: string;
  divergenceKey: string;
}> {
  const user = await prisma.user.create({
    data: {
      clerkUserId: 'clerk_graph_sync',
      email: 'graph-sync@example.com',
    },
  });

  await prisma.personProfile.create({
    data: {
      userId: user.id,
      npi: NPI,
      firstName: 'Avery',
      lastName: 'Stone',
      specialty: 'Cardiology',
      stateOfPractice: 'CA',
    },
  });

  await prisma.provider.create({
    data: {
      npi: NPI,
      fullName: 'Avery Stone',
      providerType: 'INDIVIDUAL',
      taxonomyCode: '207RC0000X',
      stateOfPractice: 'CA',
    },
  });

  const organization = await prisma.organization.create({
    data: {
      name: 'Pacific General',
      slug: 'pacific-general-sync',
    },
  });

  await prisma.organizationProfile.create({
    data: {
      organizationId: organization.id,
      specialties: ['Cardiology'],
      statesCovered: ['CA'],
      verified: true,
    },
  });

  const opportunity = await prisma.opportunity.create({
    data: {
      organizationId: organization.id,
      title: 'Cardiology Staff Physician',
      specialty: 'Cardiology',
      hiringType: 'perm',
      state: 'CA',
      status: 'ACTIVE',
    },
  });

  const artifact = await prisma.verificationArtifact.create({
    data: {
      id: '00000000-0000-0000-0000-000000000991',
      npi: NPI,
      source: 'NPPES',
      status: 'ACTIVE',
      artifactType: 'LICENSE',
      checksum: 'artifact-sync-checksum',
      verifiedAt: new Date('2026-04-10T12:00:00.000Z'),
      statusLastChecked: new Date('2026-04-10T12:00:00.000Z'),
      rawPayload: {
        credentialType: 'Primary License',
        specialty: 'Cardiology',
        state: 'CA',
      },
    },
  });

  const claim = await prisma.claimRecord.create({
    data: {
      claimId: 'claim-sync-license',
      subjectNpi: NPI,
      claimType: 'LICENSE',
      value: {
        state: 'CA',
        licenseStatus: 'ACTIVE',
      },
      trustTier: 'GOLD',
      confidenceLabel: 'HIGH',
      confidenceScore: 0.94,
      sourceId: 'NPPES',
      parserVersion: 'graph-sync-test',
      status: 'ACTIVE',
      observedAt: new Date('2026-04-10T12:00:00.000Z'),
      derivedAt: new Date('2026-04-10T12:00:00.000Z'),
      verificationArtifactId: artifact.id,
    },
  });

  await prisma.providerDecisionState.create({
    data: {
      npi: NPI,
      decisionClass: 'TRUSTED_CURRENT',
      aggregateConfidence: 0.91,
      context: 'credentialing',
      methodologyVersion: 'TRUST_v1',
      evaluatedAt: new Date('2026-04-10T13:00:00.000Z'),
      expiresAt: new Date('2026-05-10T13:00:00.000Z'),
      claimCount: 1,
      goldClaimCount: 1,
      silverClaimCount: 0,
      freshnessEvals: [],
      negativeFindings: [],
      conflicts: [{
        ruleId: 'LICENSE_STATUS_CONTRADICTION',
        description: 'Licensure status conflicts across sources.',
      }],
      explanation: 'Snapshot prepared for trust graph sync testing.',
      claimIds: [claim.claimId],
    },
  });

  const divergenceKey = 'div_license_status_conflict_sync';
  await prisma.anomalyHistory.create({
    data: {
      anomalyKey: divergenceKey,
      anomalyType: 'DIVERGENCE',
      subjectType: 'NPI',
      subjectId: NPI,
      sourceIds: ['NPPES', 'STATE_BOARD'],
      severity: 'HIGH',
      status: 'OPEN',
      confidence: 0.88,
      lastFingerprint: 'divergence-fingerprint-sync',
      metadata: {
        description: 'Licensure status for CA conflicts across sources.',
      },
      lastDetectedAt: new Date('2026-04-10T13:00:00.000Z'),
    },
  });

  const decisionCapsule = await prisma.decisionCapsule.create({
    data: {
      subjectDid: 'did:web:vitalcv:test:avery-stone',
      subjectNpi: NPI,
      decisionType: 'HIRING',
      decisionTimestamp: new Date('2026-04-10T14:00:00.000Z'),
      credentialIds: [artifact.id],
      issuerIds: ['NPPES'],
      artifactHash: 'decision-sync-artifact-hash',
      metadata: {
        organizationId: organization.id,
        organizationName: organization.name,
        opportunityId: opportunity.id,
      },
    },
  });

  return {
    organizationId: organization.id,
    opportunityId: opportunity.id,
    artifactId: artifact.id,
    claimRecordId: claim.id,
    decisionCapsuleId: decisionCapsule.id,
    divergenceKey,
  };
}

describe('graphSyncEngine integration', () => {
  beforeEach(async () => {
    await resetFixture();
  });

  afterAll(async () => {
    await resetFixture();
    await prisma.$disconnect();
  });

  it('syncs trust graph nodes and edges idempotently across provider, evidence, decision, employer, and job records', async () => {
    const fixture = await seedFixture();

    const runSync = async () => {
      await syncOrganizationNode(fixture.organizationId, prisma);
      await syncOpportunityNode(fixture.opportunityId, prisma);
      await syncVerificationArtifact(fixture.artifactId, prisma);
      await syncClaimRecord(fixture.claimRecordId, prisma);
      await syncProviderDecisionSnapshot(NPI, prisma);
      await syncDecisionCapsule(fixture.decisionCapsuleId, prisma);
    };

    await runSync();
    const firstCounts = await Promise.all([
      prisma.graphNode.count({ where: { active: true } }),
      prisma.graphEdge.count({ where: { status: 'ACTIVE' } }),
    ]);

    await runSync();
    const secondCounts = await Promise.all([
      prisma.graphNode.count({ where: { active: true } }),
      prisma.graphEdge.count({ where: { status: 'ACTIVE' } }),
    ]);

    expect(secondCounts).toEqual(firstCounts);

    const activeNodes = await prisma.graphNode.findMany({
      where: { active: true },
      select: { type: true },
    });
    expect(activeNodes.map((node) => node.type)).toEqual(expect.arrayContaining([
      'clinician',
      'organization',
      'program',
      'artifact',
      'claim',
      'snapshot',
      'decision',
      'divergence',
      'source',
    ]));

    const decisionNodeId = createGraphNodeId({
      type: 'decision',
      sourceKind: 'decision_capsule',
      sourceId: fixture.decisionCapsuleId,
    });
    const decisionEdges = await prisma.graphEdge.findMany({
      where: {
        sourceNodeId: decisionNodeId,
        status: 'ACTIVE',
      },
      select: { edgeType: true },
    });
    expect(decisionEdges.map((edge) => edge.edgeType)).toEqual(expect.arrayContaining([
      'references',
      'depends_on',
      'related_to',
    ]));
  });

  it('traverses the mirrored trust chain from clinician to snapshot, divergence, decision, employer, and job nodes', async () => {
    const fixture = await seedFixture();
    await syncOrganizationNode(fixture.organizationId, prisma);
    await syncOpportunityNode(fixture.opportunityId, prisma);
    await syncVerificationArtifact(fixture.artifactId, prisma);
    await syncClaimRecord(fixture.claimRecordId, prisma);
    await syncProviderDecisionSnapshot(NPI, prisma);
    await syncDecisionCapsule(fixture.decisionCapsuleId, prisma);

    const clinicianNodeId = createGraphNodeId({
      type: 'clinician',
      sourceKind: 'npi',
      sourceId: NPI,
    });

    const traversal = await traverseActiveGraph(prisma, {
      startNodeId: clinicianNodeId,
      depth: 3,
    });

    expect(traversal.nodes.map((node) => node.type)).toEqual(expect.arrayContaining([
      'snapshot',
      'divergence',
      'decision',
      'organization',
      'program',
      'artifact',
      'claim',
    ]));
    expect(traversal.edges.some((edge) => edge.edgeType === 'depends_on')).toBe(true);
    expect(traversal.edges.some((edge) => edge.edgeType === 'child_of')).toBe(true);
  });

  it('deactivates divergence nodes and supersedes their edges when the source divergence is resolved', async () => {
    const fixture = await seedFixture();
    await syncProviderDecisionSnapshot(NPI, prisma);

    const divergenceNodeId = createGraphNodeId({
      type: 'divergence',
      sourceKind: 'divergence',
      sourceId: fixture.divergenceKey,
    });

    const before = await prisma.graphNode.findUniqueOrThrow({
      where: { id: divergenceNodeId },
      select: { active: true },
    });
    expect(before.active).toBe(true);

    await prisma.anomalyHistory.update({
      where: { anomalyKey: fixture.divergenceKey },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date('2026-04-11T10:00:00.000Z'),
      },
    });

    await syncProviderDecisionSnapshot(NPI, prisma);

    const after = await prisma.graphNode.findUniqueOrThrow({
      where: { id: divergenceNodeId },
      select: { active: true },
    });
    expect(after.active).toBe(false);

    const divergenceEdges = await prisma.graphEdge.findMany({
      where: {
        sourceNodeId: divergenceNodeId,
      },
      select: { status: true },
    });
    expect(divergenceEdges.every((edge) => edge.status === 'SUPERSEDED')).toBe(true);
  });
});
