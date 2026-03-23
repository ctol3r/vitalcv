import {
  computeReceiptIntegrityHash,
  normalizeEvidenceBundle,
  type NormalizedClaim,
} from '../evidenceModel';

function makeClaim(overrides: Partial<NormalizedClaim> = {}): NormalizedClaim {
  return {
    claimId: 'claim-1',
    claimType: 'NPI_IDENTITY',
    subjectNpi: '1234567890',
    value: {
      _type: 'NPI_IDENTITY',
      npi: '1234567890',
      enumerationType: 'NPI-1',
      enumerationDate: '2016-04-01',
      lastUpdated: '2026-03-01',
      status: 'A',
      credential: 'MD',
    },
    tier: 'GOLD',
    confidence: 'HIGH',
    confidenceScore: 0.99,
    sourceId: 'NPPES_API',
    artifactId: 'artifact-1',
    artifactChecksum: 'checksum-1',
    parserVersion: 'parser-v1',
    derivedAt: '2026-03-23T12:05:00.000Z',
    observedAt: '2026-03-23T12:00:00.000Z',
    validFrom: null,
    validUntil: null,
    expiresAt: null,
    status: 'ACTIVE',
    supersededBy: null,
    supersedes: null,
    reviewRequired: false,
    reviewReason: null,
    humanReviewAt: null,
    source_id: 'NPPES_API',
    source_url: 'https://npiregistry.cms.hhs.gov/api/?number=1234567890&version=2.1',
    retrieved_at: '2026-03-23T11:59:00.000Z',
    raw_artifact_ref: 'artifact-1',
    checksum: 'checksum-1',
    claim_type: 'NPI_IDENTITY',
    match_confidence: 'HIGH',
    ...overrides,
  };
}

describe('evidenceModel traceability hardening', () => {
  it('generates replayable trust-critical receipts with integrity hashes when a gold claim lacks one', () => {
    const bundle = normalizeEvidenceBundle({
      claims: [makeClaim()],
      receipts: [],
    });

    expect(bundle.claims[0]).toMatchObject({
      explanation: expect.stringContaining('NPI_IDENTITY from NPPES_API observed at'),
      freshnessWindowHours: 168,
    });
    expect(bundle.receipts).toHaveLength(1);
    expect(bundle.receipts[0]).toMatchObject({
      claim_id: 'claim-1',
      source_artifact_id: 'artifact-1',
      checksum: 'checksum-1',
      parser_version: 'parser-v1',
      observed_at: '2026-03-23T12:00:00.000Z',
      freshness_window_hours: 168,
      integrity_hash: expect.any(String),
    });
    expect(
      computeReceiptIntegrityHash({
        ...bundle.receipts[0]!,
        explanation: 'tampered explanation',
      }),
    ).not.toBe(bundle.receipts[0]!.integrity_hash);
  });

  it('preserves explicit review-required flags in claim and generated receipt explanations', () => {
    const bundle = normalizeEvidenceBundle({
      claims: [makeClaim({
        claimId: 'claim-review',
        claimType: 'EXCLUSION_STATUS',
        value: {
          _type: 'EXCLUSION_STATUS',
          excluded: false,
          verdict: 'POSSIBLE_MATCH',
          exclusionType: null,
          exclusionDate: null,
          reinstatementDate: null,
          waiverState: null,
          matchType: 'NAME_MATCH',
          matchConfidence: 'MEDIUM',
          source: 'OIG_LEIE',
        },
        sourceId: 'OIG_LEIE',
        source_id: 'OIG_LEIE',
        claim_type: 'EXCLUSION_STATUS',
        confidence: 'MEDIUM',
        confidenceScore: 0.72,
        status: 'UNVERIFIED',
        reviewRequired: true,
        reviewReason: 'Possible LEIE match needs human adjudication',
      })],
      receipts: [],
    });

    expect(bundle.claims[0]).toMatchObject({
      reviewRequired: true,
      reviewReason: 'Possible LEIE match needs human adjudication',
      explanation: expect.stringContaining('manual review required: Possible LEIE match needs human adjudication'),
    });
    expect(bundle.receipts[0]?.explanation).toContain('Possible LEIE match needs human adjudication');
  });
});
