import type { Prisma } from '@prisma/client';
import type { NormalizedClaim, VerificationReceipt } from '../src/services/identity/evidenceModel';
import { computeClaimId } from '../src/services/identity/evidenceModel';
import prisma from '../src/graphql/prisma_client';
import {
  materializeClaimsToVcvCredentials,
  materializeVerificationArtifactToVcvCredentials,
} from '../src/services/entity/vcvCredentialMaterializer';

const runDbSuite = process.env.DATABASE_URL ? describe : describe.skip;

const TEST_NPI = '1558302470';

async function resetTruthEngineState(): Promise<void> {
  await prisma.bundleShareEvent.deleteMany();
  await prisma.vcvOrgContextStatusEvent.deleteMany();
  await prisma.vcvOrgContextSubject.deleteMany();
  await prisma.vcvOrganizationContext.deleteMany();
  await prisma.vcvEducationRecord.deleteMany();
  await prisma.vcvCredential.deleteMany();
  await prisma.verificationReceiptRecord.deleteMany();
  await prisma.claimRecord.deleteMany();
  await prisma.verificationArtifact.deleteMany();
  await prisma.sourceRun.deleteMany();
  await prisma.ingestEvent.deleteMany();
  await prisma.ingestSourceRun.deleteMany();
  await prisma.ingestRun.deleteMany();
  await prisma.vcvEntityRelationship.deleteMany();
  await prisma.vcvEntityRole.deleteMany();
  await prisma.vcvEntity.deleteMany();
}

async function seedSubjectEntity(): Promise<{ id: string }> {
  return prisma.vcvEntity.create({
    data: {
      entityType: 'PERSON',
      canonicalId: `test:subject:${TEST_NPI}`,
      displayName: 'Ada Lovelace',
      npi: TEST_NPI,
      npiType: 'TYPE_1',
      sourceIds: ['TEST'],
      verifiedAt: new Date('2026-03-22T12:00:00.000Z'),
      metadata: {},
    },
    select: { id: true },
  });
}

async function createArtifact(input: {
  source: string;
  status: string;
  observedAt: string;
  verifiedAt?: string;
  expiresAt?: string | null;
  rawPayload?: Prisma.InputJsonValue;
  trustTier?: string;
  confidenceScore?: number;
}): Promise<{ id: string }> {
  return prisma.verificationArtifact.create({
    data: {
      npi: TEST_NPI,
      source: input.source,
      status: input.status,
      rawPayload: input.rawPayload ?? ({} as Prisma.InputJsonValue),
      checksum: `${input.source}-${input.status}-${input.observedAt}`,
      observedAt: new Date(input.observedAt),
      verifiedAt: new Date(input.verifiedAt ?? input.observedAt),
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      trustTier: input.trustTier ?? 'GOLD',
      confidenceScore: input.confidenceScore ?? 0.97,
      monitoring: false,
      trustState: 'verified',
    },
    select: { id: true },
  });
}

async function createPersistedReceipt(input: {
  receiptId: string;
  claimId: string;
  artifactId: string;
  sourceSystem: string;
  field: string;
  value: Prisma.InputJsonValue;
  observedAt: string;
}): Promise<void> {
  await prisma.verificationReceiptRecord.create({
    data: {
      receiptId: input.receiptId,
      claimId: input.claimId,
      verificationArtifactId: input.artifactId,
      subjectNpi: TEST_NPI,
      entityId: `npi:${TEST_NPI}`,
      field: input.field,
      value: input.value,
      trustTier: 'GOLD',
      confidence: 0.97,
      sourceArtifactId: input.artifactId,
      sourceSystem: input.sourceSystem,
      parserVersion: 'test/v1',
      observedAt: new Date(input.observedAt),
      explanation: 'Persisted receipt for materialization replay',
    },
  });
}

function buildIdentityClaim(artifactId: string): NormalizedClaim {
  const value = {
    _type: 'NPI_IDENTITY' as const,
    npi: TEST_NPI,
    enumerationType: 'NPI-1' as const,
    enumerationDate: '2016-04-01T00:00:00.000Z',
    lastUpdated: '2026-03-22T12:00:00.000Z',
    status: 'A' as const,
    credential: 'MD',
  };

  return {
    claimId: computeClaimId('NPI_IDENTITY', 'NPPES_API', TEST_NPI, value),
    claimType: 'NPI_IDENTITY',
    sourceId: 'NPPES_API',
    artifactId,
    artifactChecksum: `checksum:${artifactId}`,
    parserVersion: 'test/v1',
    derivedAt: '2026-03-22T12:00:00.000Z',
    subjectNpi: TEST_NPI,
    value,
    tier: 'GOLD',
    confidence: 'HIGH',
    confidenceScore: 0.99,
    observedAt: '2026-03-22T12:00:00.000Z',
    validFrom: '2016-04-01T00:00:00.000Z',
    validUntil: null,
    expiresAt: null,
    status: 'ACTIVE',
    supersededBy: null,
    supersedes: null,
    reviewRequired: false,
    reviewReason: null,
    humanReviewAt: null,
  };
}

function buildLicenseClaim(input: {
  artifactId: string;
  observedAt: string;
  expiresAt: string;
  claimIdSuffix: string;
}): NormalizedClaim {
  const value = {
    _type: 'LICENSE' as const,
    state: 'CA',
    licenseNumber: 'CA-MD-12345',
    issueDate: '2020-01-01T00:00:00.000Z',
    expiryDate: input.expiresAt,
    licenseStatus: 'ACTIVE' as const,
    disciplinaryActions: [],
    source: 'STATE_BOARD',
  };

  return {
    claimId: computeClaimId('LICENSE', 'STATE_BOARD', TEST_NPI, {
      ...value,
      claimIdSuffix: input.claimIdSuffix,
    } as unknown as typeof value),
    claimType: 'LICENSE',
    sourceId: 'STATE_BOARD',
    artifactId: input.artifactId,
    artifactChecksum: `checksum:${input.artifactId}`,
    parserVersion: 'test/v1',
    derivedAt: input.observedAt,
    subjectNpi: TEST_NPI,
    value,
    tier: 'GOLD',
    confidence: 'HIGH',
    confidenceScore: 0.96,
    observedAt: input.observedAt,
    validFrom: '2020-01-01T00:00:00.000Z',
    validUntil: input.expiresAt,
    expiresAt: input.expiresAt,
    status: 'ACTIVE',
    supersededBy: null,
    supersedes: null,
    reviewRequired: false,
    reviewReason: null,
    humanReviewAt: null,
  };
}

function buildReceipt(
  claim: NormalizedClaim,
  receiptId: string,
  field = 'identity',
): VerificationReceipt {
  return {
    receipt_id: receiptId,
    claim_id: claim.claimId,
    entity_id: `npi:${TEST_NPI}`,
    field,
    value: claim.value,
    tier: claim.tier,
    confidence: claim.confidenceScore,
    source_artifact_id: claim.artifactId,
    source_system: claim.sourceId,
    observed_at: claim.observedAt,
    parser_version: claim.parserVersion,
    expires_at: claim.expiresAt,
    explanation: 'Test receipt',
  };
}

runDbSuite('vcvCredentialMaterializer', () => {
  beforeEach(async () => {
    await resetTruthEngineState();
    await seedSubjectEntity();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('materializes an identity credential from an NPPES artifact and links the issuer entity', async () => {
    const artifact = await createArtifact({
      source: 'NPPES',
      status: 'ACTIVE',
      observedAt: '2026-03-22T12:00:00.000Z',
      rawPayload: {
        dataVersion: '2026-03-22',
        payload_json: {
          provider_name: 'Ada Lovelace',
          provider_type: 'Physician',
          taxonomy_code: '207Q00000X',
          practice_state: 'CA',
        },
      },
    });
    await createPersistedReceipt({
      receiptId: 'receipt-nppes-artifact',
      claimId: 'artifact-identity',
      artifactId: artifact.id,
      sourceSystem: 'NPPES_API',
      field: 'identity',
      value: { npi: TEST_NPI },
      observedAt: '2026-03-22T12:00:00.000Z',
    });

    const result = await materializeVerificationArtifactToVcvCredentials(artifact.id);
    expect(result.credentialIds).toHaveLength(1);

    const credential = await prisma.vcvCredential.findUniqueOrThrow({
      where: { id: result.credentialIds[0] },
      include: {
        issuer: {
          select: {
            displayName: true,
            sourceIds: true,
          },
        },
      },
    });

    expect(credential.domain).toBe('IDENTITY');
    expect(credential.credentialType).toBe('NPI_IDENTITY');
    expect(credential.status).toBe('ACTIVE');
    expect(credential.issuer?.displayName).toBe('CMS NPPES');
    expect(credential.issuer?.sourceIds).toContain('cms:nppes');
  });

  it('materializes fail-closed OIG statuses from artifacts', async () => {
    const cases = [
      { status: 'CLEAR', expected: 'CLEAR' },
      { status: 'EXCLUDED', expected: 'EXCLUDED' },
      { status: 'UNCERTAIN', expected: 'UNCERTAIN' },
      { status: 'REVIEW_REQUIRED', expected: 'REVIEW_REQUIRED' },
    ] as const;

    for (const testCase of cases) {
      const artifact = await createArtifact({
        source: 'OIG',
        status: testCase.status,
        observedAt: `2026-03-22T12:00:0${cases.indexOf(testCase)}.000Z`,
        rawPayload: {
          dataVersion: '2026-03',
          payload_json: {
            verdict: testCase.status,
            exclusion_type: testCase.status === 'EXCLUDED' ? '1128(a)(1)' : null,
            exclusion_date: testCase.status === 'EXCLUDED' ? '2025-01-05' : null,
            reinstatement_date: null,
            waiver_state: null,
            source_url: 'https://oig.hhs.gov/exclusions/exclusions_list.asp',
          },
        },
      });
      await createPersistedReceipt({
        receiptId: `receipt-oig-${testCase.status.toLowerCase()}`,
        claimId: `artifact-oig-${testCase.status.toLowerCase()}`,
        artifactId: artifact.id,
        sourceSystem: 'OIG_LEIE',
        field: 'exclusion',
        value: { verdict: testCase.status },
        observedAt: `2026-03-22T12:00:0${cases.indexOf(testCase)}.000Z`,
      });

      const result = await materializeVerificationArtifactToVcvCredentials(artifact.id);
      const credential = await prisma.vcvCredential.findUniqueOrThrow({
        where: { id: result.credentialIds[0] },
      });
      expect(credential.status).toBe(testCase.expected);
      expect(credential.domain).toBe('EXCLUSION_CHECK');
      expect(credential.credentialType).toBe('OIG_LEIE');
    }
  });

  it('reruns the same claim materialization by updating a single credential and unioning receipt lineage', async () => {
    const artifact = await createArtifact({
      source: 'NPPES_API',
      status: 'ACTIVE',
      observedAt: '2026-03-22T12:00:00.000Z',
    });
    const claim = buildIdentityClaim(artifact.id);

    const first = await materializeClaimsToVcvCredentials({
      subjectNpi: TEST_NPI,
      verificationArtifactId: artifact.id,
      claims: [claim],
      receipts: [buildReceipt(claim, 'receipt-1')],
    });
    const second = await materializeClaimsToVcvCredentials({
      subjectNpi: TEST_NPI,
      verificationArtifactId: artifact.id,
      claims: [claim],
      receipts: [buildReceipt(claim, 'receipt-2')],
    });

    expect(first.credentialIds).toEqual(second.credentialIds);

    const credentials = await prisma.vcvCredential.findMany({
      where: { subject: { npi: TEST_NPI } },
      orderBy: { createdAt: 'asc' },
    });
    expect(credentials).toHaveLength(1);
    expect(credentials[0]?.receiptIds).toEqual(['receipt-1', 'receipt-2']);
    expect(credentials[0]?.artifactIds).toEqual([artifact.id]);
  });

  it('supersedes older observations and refuses to revive stale claims on replay', async () => {
    const olderArtifact = await createArtifact({
      source: 'STATE_BOARD',
      status: 'ACTIVE',
      observedAt: '2026-03-01T00:00:00.000Z',
      expiresAt: '2027-03-01T00:00:00.000Z',
      rawPayload: {
        payload_json: {
          state: 'CA',
          license_number: 'CA-MD-12345',
          board_name: 'Medical Board of California',
        },
      },
    });
    const newerArtifact = await createArtifact({
      source: 'STATE_BOARD',
      status: 'ACTIVE',
      observedAt: '2026-04-01T00:00:00.000Z',
      expiresAt: '2028-03-01T00:00:00.000Z',
      rawPayload: {
        payload_json: {
          state: 'CA',
          license_number: 'CA-MD-12345',
          board_name: 'Medical Board of California',
        },
      },
    });

    const olderClaim = buildLicenseClaim({
      artifactId: olderArtifact.id,
      observedAt: '2026-03-01T00:00:00.000Z',
      expiresAt: '2027-03-01T00:00:00.000Z',
      claimIdSuffix: 'older',
    });
    const newerClaim = buildLicenseClaim({
      artifactId: newerArtifact.id,
      observedAt: '2026-04-01T00:00:00.000Z',
      expiresAt: '2028-03-01T00:00:00.000Z',
      claimIdSuffix: 'newer',
    });

    await materializeClaimsToVcvCredentials({
      subjectNpi: TEST_NPI,
      verificationArtifactId: olderArtifact.id,
      claims: [olderClaim],
      receipts: [buildReceipt(olderClaim, 'receipt-license-older', 'license')],
    });
    await materializeClaimsToVcvCredentials({
      subjectNpi: TEST_NPI,
      verificationArtifactId: newerArtifact.id,
      claims: [newerClaim],
      receipts: [buildReceipt(newerClaim, 'receipt-license-newer', 'license')],
    });
    await materializeClaimsToVcvCredentials({
      subjectNpi: TEST_NPI,
      verificationArtifactId: olderArtifact.id,
      claims: [olderClaim],
      receipts: [buildReceipt(olderClaim, 'receipt-license-older', 'license')],
    });

    const credentials = await prisma.vcvCredential.findMany({
      where: { subject: { npi: TEST_NPI }, domain: 'LICENSURE' },
      orderBy: { createdAt: 'asc' },
    });

    expect(credentials).toHaveLength(2);
    expect(credentials[0]?.status).toBe('SUPERSEDED');
    expect(credentials[1]?.status).toBe('ACTIVE');
    expect(credentials[0]?.supersededByCredentialId).toBe(credentials[1]?.id);
    expect(credentials[1]?.supersedesCredentialId).toBe(credentials[0]?.id);
  });
});
