import { signCredential, verifyCredential, VerifiableCredential } from '../src/blockchain/post_quantum_signing';

describe('Post Quantum Signing', () => {
  test('should sign and verify credentials', () => {
    const secret = 'test-secret';
    
    const credential: VerifiableCredential = {
      id: 'urn:uuid:123',
      issuer: 'did:example:issuer',
      subject: 'did:example:subject',
      issuanceDate: new Date().toISOString(),
      credentialSubject: { name: 'Alice' }
    };
    
    const signed = signCredential(credential, secret);
    expect(verifyCredential(signed, secret)).toBe(true);
  });
});
