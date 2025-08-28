"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const provisional_attestation_1 = require("../src/provisional_attestation");
test('offerProvisionalAttestation returns expected structure', () => {
    const attestation = (0, provisional_attestation_1.offerProvisionalAttestation)('issuer-123', 1);
    expect(attestation.issuerId).toBe('issuer-123');
    expect(attestation.note).toBe('Provisional attestation for unintegrated issuer');
    expect(attestation.expiresAt.getTime()).toBeGreaterThan(attestation.issuedAt.getTime());
});
