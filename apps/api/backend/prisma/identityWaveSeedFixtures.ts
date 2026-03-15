import { createHash } from 'node:crypto'
import prisma from '../src/graphql/prisma_client'
import type { NormalizedClaim, VerificationReceipt } from '../src/services/identity/evidenceModel'
import { buildIdentitySummary } from '../src/services/identity/evidenceModel'

function hex(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function uuid(seed: string): string {
  const digest = hex(seed)
  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    `4${digest.slice(13, 16)}`,
    `a${digest.slice(17, 20)}`,
    digest.slice(20, 32),
  ].join('-')
}

function buildSeedClaim(input: {
  claimType: NormalizedClaim['claimType']
  value: NormalizedClaim['value']
  sourceId: string
  artifactId: string
  checksum: string
  observedAt: string
  tier?: NormalizedClaim['tier']
  confidence?: NormalizedClaim['confidence']
  confidenceScore?: number
}): NormalizedClaim {
  const claimId = `claim_${hex({
    claimType: input.claimType,
    sourceId: input.sourceId,
    value: input.value,
  }).slice(0, 32)}`

  return {
    claimId,
    claimType: input.claimType,
    subjectNpi: '1992992991',
    value: input.value,
    tier: input.tier ?? 'GOLD',
    confidence: input.confidence ?? 'HIGH',
    confidenceScore: input.confidenceScore ?? 0.98,
    sourceId: input.sourceId,
    artifactId: input.artifactId,
    artifactChecksum: input.checksum,
    parserVersion: 'seed-fixture/v1',
    derivedAt: input.observedAt,
    observedAt: input.observedAt,
    validFrom: null,
    validUntil: null,
    expiresAt: null,
    status: 'ACTIVE',
    supersededBy: null,
    supersedes: null,
    reviewRequired: false,
    reviewReason: null,
    humanReviewAt: null,
  }
}

function buildSeedReceipt(claim: NormalizedClaim, field: string, explanation: string): VerificationReceipt {
  return {
    receipt_id: hex({ claimId: claim.claimId, field }).slice(0, 32),
    claim_id: claim.claimId,
    entity_id: `npi:${claim.subjectNpi}`,
    field,
    value: (claim.value as Record<string, unknown>)[field] ?? claim.value,
    tier: claim.tier,
    confidence: claim.confidenceScore,
    source_artifact_id: claim.artifactId,
    source_system: claim.sourceId,
    observed_at: claim.observedAt,
    parser_version: claim.parserVersion,
    expires_at: claim.expiresAt,
    explanation,
  }
}

export async function seedIdentityWaveFixtures(): Promise<{ seededRunCount: number }> {
  const idempotencyKey = 'seed_identity_wave_fixture_v1'
  const existing = await prisma.sourceRun.findFirst({
    where: { idempotencyKey },
    select: { id: true },
  })

  if (existing) {
    return { seededRunCount: 0 }
  }

  const observedAt = '2026-03-14T12:00:00.000Z'
  const nppesArtifactId = uuid('seed:nppes:artifact')
  const oigArtifactId = uuid('seed:oig:artifact')
  const nppesChecksum = hex('seed:nppes:raw')
  const oigChecksum = hex('seed:oig:raw')

  const identityClaim = buildSeedClaim({
    claimType: 'NPI_IDENTITY',
    value: {
      _type: 'NPI_IDENTITY',
      npi: '1992992991',
      enumerationType: 'NPI-1',
      enumerationDate: '2016-04-01',
      lastUpdated: '2026-03-01',
      status: 'A',
      credential: 'MD',
    },
    sourceId: 'NPPES_API',
    artifactId: nppesArtifactId,
    checksum: nppesChecksum,
    observedAt,
  })

  const specialtyClaim = buildSeedClaim({
    claimType: 'SPECIALTY',
    value: {
      _type: 'SPECIALTY',
      taxonomyCode: '207Q00000X',
      taxonomyDescription: 'Family Medicine',
      isPrimary: true,
      state: 'CA',
      licenseNumber: 'CA-1992992',
    },
    sourceId: 'NPPES_API',
    artifactId: nppesArtifactId,
    checksum: nppesChecksum,
    observedAt,
  })

  const exclusionClaim = buildSeedClaim({
    claimType: 'EXCLUSION_STATUS',
    value: {
      _type: 'EXCLUSION_STATUS',
      excluded: false,
      exclusionType: null,
      exclusionDate: null,
      reinstatementDate: null,
      matchType: 'NO_MATCH',
      waiverState: null,
      source: 'OIG_LEIE',
    },
    sourceId: 'OIG_LEIE',
    artifactId: oigArtifactId,
    checksum: oigChecksum,
    observedAt,
  })

  const claims = [identityClaim, specialtyClaim, exclusionClaim]
  const receipts = [
    buildSeedReceipt(identityClaim, 'npi', 'Seeded official NPPES identity receipt'),
    buildSeedReceipt(exclusionClaim, 'excluded', 'Seeded official OIG exclusion receipt'),
  ]
  const summary = buildIdentitySummary('1992992991', claims)

  const sourceRun = await prisma.sourceRun.create({
    data: {
      sourceId: 'IDENTITY_SEED',
      subjectNpi: '1992992991',
      idempotencyKey,
      status: 'VERIFIED',
      runSummary: {
        fixture: true,
        claimCount: claims.length,
      },
      startedAt: new Date(observedAt),
      completedAt: new Date(observedAt),
    },
  })

  const sourceRecord = await prisma.sourceRecord.create({
    data: {
      sourceRunId: sourceRun.id,
      sourceId: 'NPPES_API',
      subjectNpi: '1992992991',
      sourceRecordKey: '1992992991',
      sourceUrl: 'https://npiregistry.cms.hhs.gov/api/?number=1992992991&version=2.1',
      fetchHeaders: {
        'content-type': 'application/json',
      },
      checksum: nppesChecksum,
      trustTier: 'GOLD',
      fetchedAt: new Date(observedAt),
      observedAt: new Date(observedAt),
      expiresAt: new Date('2026-03-21T12:00:00.000Z'),
      parserVersion: 'seed-fixture/v1',
      matchingStrategy: 'NPI_EXACT',
      schemaVersion: 'seed-v1',
      status: 'FETCHED',
      metadata: {
        fixture: true,
      },
    },
  })

  await prisma.verificationArtifact.create({
    data: {
      id: nppesArtifactId,
      npi: '1992992991',
      source: 'NPPES_API',
      status: 'ACTIVE',
      artifactType: 'SOURCE_CAPTURE',
      parserVersion: 'seed-fixture/v1',
      matchingStrategy: 'NPI_EXACT',
      trustTier: 'GOLD',
      sourceRunId: sourceRun.id,
      sourceRecordId: sourceRecord.id,
      sourceUrl: 'https://npiregistry.cms.hhs.gov/api/?number=1992992991&version=2.1',
      fetchHeaders: {
        'content-type': 'application/json',
      },
      fetchedAt: new Date(observedAt),
      observedAt: new Date(observedAt),
      rawPayload: {
        fixture: true,
        _claims: [identityClaim, specialtyClaim],
        _receipts: [receipts[0]],
      },
      checksum: nppesChecksum,
      verifiedAt: new Date(observedAt),
    },
  })

  await prisma.verificationArtifact.create({
    data: {
      id: oigArtifactId,
      npi: '1992992991',
      source: 'OIG_LEIE',
      status: 'ACTIVE',
      artifactType: 'SOURCE_CAPTURE',
      parserVersion: 'seed-fixture/v1',
      matchingStrategy: 'NPI_EXACT',
      trustTier: 'GOLD',
      sourceRunId: sourceRun.id,
      sourceRecordId: sourceRecord.id,
      sourceUrl: 'https://oig.hhs.gov/exclusions/api/?npi=1992992991',
      fetchHeaders: {
        'content-type': 'application/json',
      },
      fetchedAt: new Date(observedAt),
      observedAt: new Date(observedAt),
      rawPayload: {
        fixture: true,
        _claims: [exclusionClaim],
        _receipts: [receipts[1]],
      },
      checksum: oigChecksum,
      verifiedAt: new Date(observedAt),
    },
  })

  for (const claim of claims) {
    await prisma.claimRecord.create({
      data: {
        claimId: claim.claimId,
        sourceRunId: sourceRun.id,
        sourceRecordId: sourceRecord.id,
        verificationArtifactId: claim.artifactId,
        subjectNpi: claim.subjectNpi,
        claimType: claim.claimType,
        value: claim.value,
        trustTier: claim.tier,
        confidenceLabel: claim.confidence,
        confidenceScore: claim.confidenceScore,
        sourceId: claim.sourceId,
        parserVersion: claim.parserVersion,
        matchingStrategy: 'NPI_EXACT',
        status: claim.status,
        observedAt: new Date(claim.observedAt),
        derivedAt: new Date(claim.derivedAt),
      },
    })
  }

  for (const receipt of receipts) {
    const claimRecord = await prisma.claimRecord.findFirstOrThrow({
      where: { claimId: receipt.claim_id },
      select: { id: true },
    })

    await prisma.verificationReceiptRecord.create({
      data: {
        receiptId: receipt.receipt_id,
        claimRecordId: claimRecord.id,
        claimId: receipt.claim_id,
        sourceRunId: sourceRun.id,
        sourceRecordId: sourceRecord.id,
        verificationArtifactId: receipt.source_artifact_id,
        subjectNpi: '1992992991',
        entityId: receipt.entity_id,
        field: receipt.field,
        value: receipt.value,
        trustTier: receipt.tier,
        confidence: receipt.confidence,
        sourceArtifactId: receipt.source_artifact_id,
        sourceSystem: receipt.source_system,
        parserVersion: receipt.parser_version,
        matchingStrategy: 'NPI_EXACT',
        observedAt: new Date(receipt.observed_at),
        explanation: receipt.explanation,
      },
    })
  }

  const identityIndexArtifact = await prisma.verificationArtifact.create({
    data: {
      id: uuid('seed:identity-index:artifact'),
      npi: '1992992991',
      source: 'IDENTITY_INDEX',
      status: 'ACTIVE',
      artifactType: 'IDENTITY_INDEX',
      parserVersion: 'seed-fixture/v1',
      matchingStrategy: 'CANONICAL_AGGREGATION',
      trustTier: summary.highestTier,
      confidenceScore: 0.98,
      sourceRunId: sourceRun.id,
      rawPayload: {
        fixture: true,
        _identityIndex: true,
        generatedAt: observedAt,
        previousArtifactId: null,
        claimRefs: claims.map((claim) => claim.claimId),
        sourceRecordIds: [sourceRecord.id],
        summary,
      },
      checksum: hex({ summary, claims: claims.map((claim) => claim.claimId) }),
      verifiedAt: new Date(observedAt),
      observedAt: new Date(observedAt),
      generation: 1,
    },
  })

  await prisma.identityResolutionDecision.create({
    data: {
      subjectNpi: '1992992991',
      sourceRunId: sourceRun.id,
      sourceRecordId: sourceRecord.id,
      verificationArtifactId: identityIndexArtifact.id,
      decisionType: 'MERGE',
      resolutionKey: hex(['1992992991', sourceRecord.id]),
      matchingStrategy: 'NPI_EXACT',
      confidenceScore: 0.98,
      mergeReason: 'Seeded conservative merge across authoritative source evidence',
      payload: {
        fixture: true,
        sourceRecordIds: [sourceRecord.id],
      },
    },
  })

  return { seededRunCount: 1 }
}
