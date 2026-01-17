/**
 * E2E Test: Complete Credential Lifecycle
 *
 * Tests the full flow:
 * 1. Issue a credential with status allocation
 * 2. Verify the credential is VALID
 * 3. Revoke the credential
 * 4. Verify the credential is REVOKED
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { generateKeyPair, exportJWK } from 'jose';
import { issueClinicianIdentityVC, verifyClinicianIdentityVC, type ClinicianProfile } from '../services/clinicianIdentityIssuer';
import { clearInMemoryAllocations, revokeCredential, isCredentialRevoked } from '../services/statusList';

// Set up test environment
process.env.NODE_ENV = 'test';

beforeAll(async () => {
  // Set up signing key
  if (!process.env.VC_SIGNING_KEY_JWK) {
    const { privateKey } = await generateKeyPair('EdDSA', { extractable: true });
    const jwk = await exportJWK(privateKey);
    jwk.kid = 'test-issuer-key';
    process.env.VC_SIGNING_KEY_JWK = JSON.stringify(jwk);
  }
});

beforeEach(() => {
  clearInMemoryAllocations();
});

describe('E2E: Credential Lifecycle', () => {
  it('should complete full lifecycle: issue → verify → revoke → verify-fails', async () => {
    // STEP 1: Issue a credential
    const profile: ClinicianProfile = {
      name: 'Dr. E2E Test',
      npi: '9999999999',
      specialty: 'E2E Testing',
    };

    const vcJws = await issueClinicianIdentityVC(profile);
    expect(vcJws).toBeTruthy();
    expect(typeof vcJws).toBe('string');

    // Verify and get credential details
    const vc = await verifyClinicianIdentityVC(vcJws);

    expect(vc.id).toBeTruthy();
    expect(vc.credentialStatus).toBeTruthy();

    const credentialId = vc.id as string;
    console.log(`[E2E] Issued credential: ${credentialId}`);

    // STEP 2: Verify credential is NOT revoked initially
    const isRevokedBefore = isCredentialRevoked(credentialId);
    console.log(`[E2E] Is revoked before revocation: ${isRevokedBefore}`);

    expect(isRevokedBefore).toBe(false);

    // STEP 3: Revoke the credential
    const revocationResult = await revokeCredential(credentialId);
    console.log(`[E2E] Revocation result:`, revocationResult);

    expect(revocationResult.success).toBe(true);
    expect(revocationResult.already_revoked).toBe(false);

    // STEP 4: Verify credential is now REVOKED
    const isRevokedAfter = isCredentialRevoked(credentialId);
    console.log(`[E2E] Is revoked after revocation: ${isRevokedAfter}`);

    expect(isRevokedAfter).toBe(true);

    // STEP 5: Try revoking again (idempotency test)
    const secondRevocation = await revokeCredential(credentialId);
    console.log(`[E2E] Second revocation (idempotency):`, secondRevocation);

    expect(secondRevocation.success).toBe(true);
    expect(secondRevocation.already_revoked).toBe(true);

    // Final verification: still revoked
    expect(isCredentialRevoked(credentialId)).toBe(true);
  });

  it('should handle multiple credentials independently', async () => {
    // Issue two credentials
    const profile1: ClinicianProfile = {
      name: 'Dr. Test 1',
      npi: '1111111111',
      specialty: 'Testing',
    };

    const profile2: ClinicianProfile = {
      name: 'Dr. Test 2',
      npi: '2222222222',
      specialty: 'Testing',
    };

    const vc1Jws = await issueClinicianIdentityVC(profile1);
    const vc2Jws = await issueClinicianIdentityVC(profile2);

    const vc1 = await verifyClinicianIdentityVC(vc1Jws);
    const vc2 = await verifyClinicianIdentityVC(vc2Jws);

    const cred1Id = vc1.id as string;
    const cred2Id = vc2.id as string;

    // Both should be active initially (not revoked)
    expect(isCredentialRevoked(cred1Id)).toBe(false);
    expect(isCredentialRevoked(cred2Id)).toBe(false);

    // Revoke only the first credential
    await revokeCredential(cred1Id);

    // First should be revoked, second still active
    expect(isCredentialRevoked(cred1Id)).toBe(true);
    expect(isCredentialRevoked(cred2Id)).toBe(false);
  });
});
