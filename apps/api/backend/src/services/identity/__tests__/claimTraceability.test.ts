import {
  parseNppesResult,
  parseOigResult,
  parsePecosRecord,
} from '../claimEngine';

describe('claim traceability', () => {
  it('stamps artifact trace fields onto NPPES claims and receipts', () => {
    const sourceUrl = 'https://npiregistry.cms.hhs.gov/api/?number=1234567890&version=2.1';
    const retrievedAt = '2026-03-23T12:00:00.000Z';

    const { claims, receipts } = parseNppesResult(
      '1234567890',
      {
        number: '1234567890',
        enumeration_type: 'NPI-1',
        basic: {
          first_name: 'Ada',
          last_name: 'Lovelace',
          status: 'A',
          credential: 'MD',
          enumeration_date: '2016-04-01',
          last_updated: '2026-03-01',
        },
      },
      'artifact-nppes',
      'checksum-nppes',
      '2026-03-23T12:05:00.000Z',
      { sourceUrl, retrievedAt },
    );

    expect(claims[0]).toMatchObject({
      source_id: 'NPPES_API',
      source_url: sourceUrl,
      retrieved_at: retrievedAt,
      raw_artifact_ref: 'artifact-nppes',
      checksum: 'checksum-nppes',
      claim_type: 'NPI_IDENTITY',
      match_confidence: 'HIGH',
    });
    expect(receipts[0]).toMatchObject({
      source_artifact_id: 'artifact-nppes',
      source_url: sourceUrl,
      retrieved_at: retrievedAt,
      raw_artifact_ref: 'artifact-nppes',
      checksum: 'checksum-nppes',
      claim_type: 'NPI_IDENTITY',
      match_confidence: 'HIGH',
    });
  });

  it('keeps LEIE possible matches traceable and human-gated', () => {
    const { claims, receipts } = parseOigResult(
      '1234567890',
      {
        verdict: 'POSSIBLE_MATCH',
        matchType: 'NAME_MATCH',
        matchConfidence: 'MEDIUM',
        matchScore: 0.78,
        excluded: false,
        exclusionType: '1128(a)(1)',
        exclusionDate: '2026-03-01',
      },
      'artifact-oig',
      'checksum-oig',
      '2026-03-23T12:05:00.000Z',
      {
        sourceUrl: 'https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv',
        retrievedAt: '2026-03-23T12:00:00.000Z',
      },
    );

    expect(claims[0]).toMatchObject({
      reviewRequired: true,
      match_confidence: 'MEDIUM',
      raw_artifact_ref: 'artifact-oig',
      checksum: 'checksum-oig',
    });
    expect(receipts[0]).toMatchObject({
      claim_type: 'EXCLUSION_STATUS',
      match_confidence: 'MEDIUM',
      raw_artifact_ref: 'artifact-oig',
    });
  });

  it('preserves PECOS quarterly truth metadata with trace fields', () => {
    const { claims } = parsePecosRecord(
      '1234567890',
      {
        enrolled: true,
        enrollmentType: 'INDIVIDUAL',
        eligibleToOrderRefer: true,
        observedAt: '2026-01-15T00:00:00.000Z',
        dataVersion: '2026-Q1',
      },
      'artifact-pecos',
      'checksum-pecos',
      '2026-03-23T12:05:00.000Z',
      {
        sourceUrl: 'https://data.cms.gov/provider-characteristics/medicare-provider-supplier-enrollment/',
        retrievedAt: '2026-03-23T12:00:00.000Z',
      },
    );

    expect(claims[0]).toMatchObject({
      source_id: 'PECOS_PUBLIC',
      raw_artifact_ref: 'artifact-pecos',
      checksum: 'checksum-pecos',
      claim_type: 'ENROLLMENT_STATUS',
    });
    expect((claims[0]?.value as Record<string, unknown>).claimState).toBe('ENROLLED');
    expect((claims[0]?.value as Record<string, unknown>).sourceLatency).toBe('QUARTERLY');
    expect((claims[0]?.value as Record<string, unknown>).revalidationDue).toBe('2026-04-15T00:00:00.000Z');
    expect((claims[0]?.value as Record<string, unknown>).label).toBe('Medicare enrolled — as of Q1 2026');
    expect(claims[0]?.freshnessWindowHours).toBe(2160);
  });
});
