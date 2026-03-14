import {
  buildEvidenceHash,
  calculateFreshUntil,
  createCredentialArtifactRecord,
} from '../src/services/credentials/credentialIngestionArtifacts';

describe('credential ingestion artifact helpers', () => {
  test('evidence hash is stable across payload key order', () => {
    const left = {
      checked_at: '2026-03-13T12:00:00.000Z',
      excluded: false,
      details: {
        source_url: 'https://oig.hhs.gov/exclusions/exclusions_list.asp',
        waiver_state: null,
      },
    };
    const right = {
      details: {
        waiver_state: null,
        source_url: 'https://oig.hhs.gov/exclusions/exclusions_list.asp',
      },
      excluded: false,
      checked_at: '2026-03-13T12:00:00.000Z',
    };

    expect(buildEvidenceHash(left)).toBe(buildEvidenceHash(right));
  });

  test('credential hash changes when artifact content changes', () => {
    const base = createCredentialArtifactRecord({
      subject_npi: '1234567893',
      source_name: 'npi-registry',
      credential_type: 'NPI_ENROLLMENT',
      issuer_org_id: 'cms:nppes',
      issued_at: '2026-03-13T12:00:00.000Z',
      expires_at: null,
      status: 'ACTIVE',
      metadata: {
        practice_state: 'CA',
      },
    });
    const changed = createCredentialArtifactRecord({
      subject_npi: '1234567893',
      source_name: 'npi-registry',
      credential_type: 'NPI_ENROLLMENT',
      issuer_org_id: 'cms:nppes',
      issued_at: '2026-03-13T12:00:00.000Z',
      expires_at: null,
      status: 'ACTIVE',
      metadata: {
        practice_state: 'NY',
      },
    });

    expect(base.credential_hash).not.toBe(changed.credential_hash);
  });

  test('applies source freshness windows deterministically', () => {
    const verifiedAt = '2026-03-13T12:00:00.000Z';

    expect(calculateFreshUntil('NPPES', verifiedAt, 90)).toBe('2026-04-12T12:00:00.000Z');
    expect(calculateFreshUntil('OIG', verifiedAt, 90)).toBe('2026-03-14T12:00:00.000Z');
    expect(calculateFreshUntil('STATE_BOARD', verifiedAt, 45)).toBe('2026-04-27T12:00:00.000Z');
  });
});
