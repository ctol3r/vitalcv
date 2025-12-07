import { offerProvisionalAttestation } from '../src/provisional_attestation';

test('offerProvisionalAttestation returns expected structure', () => {
  const attestation = offerProvisionalAttestation('issuer-123', 1);
  expect(attestation.issuerId).toBe('issuer-123');
  expect(attestation.note).toBe('Provisional attestation for unintegrated issuer');
  expect(attestation.expiresAt.getTime()).toBeGreaterThan(attestation.issuedAt.getTime());
});
