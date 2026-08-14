import { assertNoRestrictedCredentialOpsData } from '../restrictedData';

describe('credential-operations restricted-data boundary', () => {
  it('accepts external references and receipt identifiers', () => {
    expect(() => assertNoRestrictedCredentialOpsData({
      externalRef: 'partner-record-42',
      receiptRef: 'receipt:sha256:abc',
      source: { id: 'state-board-ca', observedAt: '2026-08-14T00:00:00.000Z' },
    })).not.toThrow();
  });

  it.each(['ssn', 'social_security_number', 'dateOfBirth', 'health_disclosure', 'peerReviewMaterial'])(
    'rejects the restricted key %s',
    (key) => {
      expect(() => assertNoRestrictedCredentialOpsData({ [key]: 'restricted' }))
        .toThrow(/restricted/);
    },
  );

  it('rejects SSN-like values even under an otherwise safe key', () => {
    expect(() => assertNoRestrictedCredentialOpsData({ note: 'value 123-45-6789' }))
      .toThrow(/raw SSN-like values/);
  });
});
