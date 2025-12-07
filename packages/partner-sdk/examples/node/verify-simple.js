/**
 * Simple Credential Verification Example (Node.js)
 * Tagged: run: next-batch-20251031-2
 *
 * Demonstrates basic usage of the VitalCV Partner SDK
 */

const { verifyCredential } = require('@vitalcv/partner-sdk');

// Example credential proof from VitalCV holder
const proof = {
  credentialId: 'vc:med-license:abc123',
  holderDid: 'did:vitalcv:holder-456',
  signature: 'a1b2c3d4e5f6...', // Ed25519 signature (hex)
  issuedAt: '2025-10-15T10:30:00Z',
  expiresAt: '2026-10-15T10:30:00Z',
  claims: {
    type: 'MedicalLicense',
    npi: '1801921148',
    licenseNumber: 'MD-12345',
    name: 'Dr. Jane Smith',
    specialty: 'Internal Medicine',
    state: 'CA',
  },
};

async function main() {
  console.log('🔍 Verifying credential...\n');

  try {
    // Verify the credential
    const result = await verifyCredential(proof, {
      checkRevocation: true,
      verifierDid: 'did:vitalcv:partner-acme',
    });

    console.log('Result:', result);

    if (result.valid) {
      console.log('\n✅ Credential is VALID');
      console.log('\n📋 Verified Claims:');
      console.log(`   Type: ${result.claims.type}`);
      console.log(`   NPI: ${result.claims.npi}`);
      console.log(`   Name: ${result.claims.name}`);
      console.log(`   License: ${result.claims.licenseNumber}`);
      console.log(`   Specialty: ${result.claims.specialty}`);

      console.log('\n🔐 Verification Details:');
      console.log(`   Holder DID: ${result.holderDid}`);
      console.log(`   Issued: ${result.issuedAt}`);
      console.log(`   Audit Ref: ${result.auditRef}`);

      // Check if revoked
      if (result.revoked) {
        console.log('\n⚠️  WARNING: Credential has been REVOKED');
        console.log(`   Revoked At: ${result.revokedAt}`);
        console.log(`   Reason: ${result.revocationReason}`);
      } else {
        console.log('\n✅ Revocation Status: ACTIVE');
      }

      // Age check
      const age = Date.now() - new Date(result.issuedAt).getTime();
      const daysOld = Math.floor(age / (1000 * 60 * 60 * 24));
      console.log(`\n📅 Credential Age: ${daysOld} days`);

      if (daysOld > 90) {
        console.log('   ⚠️  Credential is older than 90 days - consider requesting refresh');
      }

    } else {
      console.log('\n❌ Credential is INVALID');
      console.log(`   Error: ${result.error}`);
      console.log(`   Error Code: ${result.errorCode}`);
    }

  } catch (error) {
    console.error('\n💥 Verification error:', error.message);
    process.exit(1);
  }
}

// Run the example
main();

