import { parseNppesResult } from '../claimEngine';

describe('NPPES reported license evidence', () => {
  test('adds a separate unverified claim without changing the legacy specialty claim ID', () => {
    const parsed = parseNppesResult(
      '1234567893',
      {
        enumeration_type: 'NPI-1',
        basic: {
          first_name: 'Example',
          last_name: 'Clinician',
          status: 'A',
          enumeration_date: '2010-01-01',
          last_updated: '2026-07-30',
        },
        taxonomies: [{
          code: '207Q00000X',
          desc: 'Family Medicine',
          primary: true,
          state: 'ca',
          license: 'A12345',
        }],
      },
      'artifact-1',
      'checksum-1',
      '2026-07-31T07:00:00.000Z',
    );

    const specialty = parsed.claims.find(
      (claim) => claim.claimType === 'SPECIALTY',
    );
    const reported = parsed.claims.find(
      (claim) => claim.claimType === 'LICENSE_REPORTED',
    );

    // This is the deterministic ID emitted by the pre-E0 SPECIALTY claim for
    // this exact fixture. LICENSE_REPORTED must be additive and may not alter it.
    expect(specialty?.claimId).toBe(
      'claim_10d8558e492ec56aad703eb6d8cfa4fa',
    );
    expect(reported).toMatchObject({
      claimType: 'LICENSE_REPORTED',
      status: 'UNVERIFIED',
      reviewRequired: true,
      parserVersion: 'v1.3.0',
      value: {
        _type: 'LICENSE_REPORTED',
        state: 'CA',
        licenseNumber: 'A12345',
        authorityConfirmed: false,
      },
    });
    expect(reported?.claimId).not.toBe(specialty?.claimId);
    expect(
      parsed.receipts.find((receipt) => receipt.claim_id === reported?.claimId)
        ?.explanation,
    ).toContain('licensing-authority confirmation has not been completed');
  });

  test('does not manufacture a reported-license claim when NPPES omits state or number', () => {
    const parsed = parseNppesResult(
      '1234567893',
      {
        enumeration_type: 'NPI-1',
        basic: { last_name: 'Clinician', status: 'A' },
        taxonomies: [{
          code: '207Q00000X',
          desc: 'Family Medicine',
          primary: true,
        }],
      },
      'artifact-2',
      'checksum-2',
      '2026-07-31T07:00:00.000Z',
    );

    expect(
      parsed.claims.some((claim) => claim.claimType === 'LICENSE_REPORTED'),
    ).toBe(false);
  });
});
