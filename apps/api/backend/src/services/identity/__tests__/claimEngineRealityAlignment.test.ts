import {
  parseNppesResult,
  parseOigResult,
  parsePecosRecord,
} from '../claimEngine';

describe('claimEngine reality alignment', () => {
  it('marks NPPES identity claims as identity-only registration evidence', () => {
    const { claims } = parseNppesResult(
      '1234567890',
      {
        number: '1234567890',
        enumeration_type: 'NPI-1',
        basic: {
          first_name: 'Ada',
          middle_name: 'M',
          last_name: 'Lovelace',
          status: 'A',
          credential: 'MD',
          enumeration_date: '2016-04-01',
          last_updated: '2026-03-01',
        },
      },
      'artifact-0',
      'checksum-0',
      '2026-03-22T12:00:00.000Z',
    );

    const identityClaim = claims.find((claim) => claim.claimType === 'NPI_IDENTITY');
    expect(identityClaim).toBeDefined();
    expect((identityClaim?.value as Record<string, unknown>).identityOnly).toBe(true);
    expect((identityClaim?.value as Record<string, unknown>).label).toBe('Registered with CMS NPPES');
    expect((identityClaim?.value as Record<string, unknown>).claimType).toBe('IDENTITY');
  });

  it('preserves NPPES v2 location and endpoint fields without truncation or gender loss', () => {
    const longEndpoint = `https://example.org/fhir/${'a'.repeat(180)}`;
    const { claims } = parseNppesResult(
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
          gender: 'F',
        },
        addresses: [
          {
            address_purpose: 'LOCATION',
            address_1: 'A'.repeat(180),
            address_2: 'Suite '.padEnd(190, 'B'),
            city: 'San Francisco',
            state: 'CA',
            postal_code: '94105',
            telephone_number: '41555501010101010101',
          },
        ],
        endpoints: [
          {
            endpointTypeDescription: 'FHIR',
            endpoint: longEndpoint,
          },
        ],
      },
      'artifact-0',
      'checksum-0',
      '2026-03-22T12:00:00.000Z',
    );

    const personalIdentity = claims.find((claim) => claim.claimType === 'PERSONAL_IDENTITY');
    const practiceLocation = claims.find((claim) => claim.claimType === 'PRACTICE_LOCATION');
    const endpoint = claims.find((claim) => claim.claimType === 'ENDPOINT');

    expect((personalIdentity?.value as Record<string, unknown>).sex).toBe('F');
    expect((practiceLocation?.value as Record<string, unknown>).address1).toHaveLength(180);
    expect((practiceLocation?.value as Record<string, unknown>).address2).toHaveLength(190);
    expect((practiceLocation?.value as Record<string, unknown>).phone).toBe('41555501010101010101');
    expect((endpoint?.value as Record<string, unknown>).endpoint).toBe(longEndpoint);
  });

  it('keeps fuzzy LEIE matches out of verified excluded state', () => {
    const { claims } = parseOigResult(
      '1234567890',
      {
        excluded: false,
        verdict: 'POSSIBLE_MATCH',
        matchType: 'NAME_MATCH',
        matchConfidence: 'MEDIUM',
        matchScore: 0.78,
        exclusionType: '1128(a)(1)',
        exclusionDate: '2025-12-01',
        leieVersionDate: '2026-03-10',
      },
      'artifact-1',
      'checksum-1',
      '2026-03-22T12:00:00.000Z',
    );

    expect(claims).toHaveLength(1);
    expect(claims[0]?.status).toBe('UNVERIFIED');
    expect(claims[0]?.reviewRequired).toBe(true);
    expect((claims[0]?.value as Record<string, unknown>).verdict).toBe('POSSIBLE_MATCH');
    expect((claims[0]?.value as Record<string, unknown>).excluded).toBe(false);
    expect((claims[0]?.value as Record<string, unknown>).leieVersionDate).toBe('2026-03-10');
  });

  it('stamps PECOS claims as quarterly point-in-time data', () => {
    const { claims } = parsePecosRecord(
      '1234567890',
      {
        enrolled: true,
        enrollmentType: 'INDIVIDUAL',
        eligibleToOrderRefer: true,
        source: 'PECOS',
        observedAt: '2026-01-15T00:00:00.000Z',
        dataVersion: '2026-Q1',
        sourceLatency: 'QUARTERLY',
        dataFreshness: 'QUARTERLY',
      },
      'artifact-2',
      'checksum-2',
      '2026-03-22T12:00:00.000Z',
    );

    expect(claims).toHaveLength(1);
    expect((claims[0]?.value as Record<string, unknown>).dataFreshness).toBe('QUARTERLY');
    expect((claims[0]?.value as Record<string, unknown>).dataVersion).toBe('2026-Q1');
    expect((claims[0]?.value as Record<string, unknown>).revalidationDue).toBe('2026-04-15T00:00:00.000Z');
    expect((claims[0]?.value as Record<string, unknown>).label).toBe('Medicare enrolled — as of Q1 2026');
    expect(
      String((claims[0]?.value as Record<string, unknown>).sourceDisclaimer ?? '').toLowerCase(),
    ).toContain('point-in-time');
    expect(claims[0]?.freshnessWindowHours).toBe(2160);
  });

  it('distinguishes quarterly not-found enrollment from unknown enrollment status', () => {
    const notFound = parsePecosRecord(
      '1234567890',
      {
        claimState: 'NOT_FOUND',
        enrolled: false,
        source: 'PECOS',
        observedAt: '2026-01-15T00:00:00.000Z',
        dataVersion: '2026-Q1',
      },
      'artifact-not-found',
      'checksum-not-found',
      '2026-03-22T12:00:00.000Z',
    );
    const unknown = parsePecosRecord(
      '1234567890',
      {
        claimState: 'UNKNOWN',
        enrolled: null,
        source: 'PECOS_UNAVAILABLE',
        observedAt: '2026-01-15T00:00:00.000Z',
        dataVersion: '2026-Q1',
      },
      'artifact-unknown',
      'checksum-unknown',
      '2026-03-22T12:00:00.000Z',
    );

    expect((notFound.claims[0]?.value as Record<string, unknown>).claimState).toBe('NOT_FOUND');
    expect((notFound.claims[0]?.value as Record<string, unknown>).label).toBe(
      'Medicare enrollment not found in quarterly PECOS snapshot — as of Q1 2026',
    );
    expect(notFound.claims[0]?.confidence).toBe('HIGH');

    expect((unknown.claims[0]?.value as Record<string, unknown>).claimState).toBe('UNKNOWN');
    expect((unknown.claims[0]?.value as Record<string, unknown>).label).toBe(
      'Medicare enrollment unresolved — as of Q1 2026',
    );
    expect(unknown.claims[0]?.confidence).toBe('UNCERTAIN');
  });
});
