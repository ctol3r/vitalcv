"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const post_quantum_signing_1 = require("../src/blockchain/post_quantum_signing");
const secret = 'test-secret';
const credential = {
    id: 'urn:uuid:123',
    issuer: 'did:example:issuer',
    subject: 'did:example:subject',
    issuanceDate: new Date().toISOString(),
    credentialSubject: { name: 'Alice' }
};
const signed = (0, post_quantum_signing_1.signCredential)(credential, secret);
if (!(0, post_quantum_signing_1.verifyCredential)(signed, secret)) {
    throw new Error('Post quantum credential verification failed');
}
console.log('Post quantum signing test passed');
