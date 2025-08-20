import { signCredential, verifyCredential, VerifiableCredential } from '../src/blockchain/post_quantum_signing';

const secret = 'test-secret';

const credential: VerifiableCredential = {
    id: 'urn:uuid:123',
    issuer: 'did:example:issuer',
    subject: 'did:example:subject',
    issuanceDate: new Date().toISOString(),
    credentialSubject: { name: 'Alice' }
};

const signed = signCredential(credential, secret);
if (!verifyCredential(signed, secret)) {
    throw new Error('Post quantum credential verification failed');
}
console.log('Post quantum signing test passed');
