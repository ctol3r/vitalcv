/**
 * verifierSdkDemo.ts — Wave 107: Verifier SDK Usage Examples
 *
 * Demonstrates how hospitals, ATS systems, and third-party verifiers
 * can integrate with VitalCV using the VerifierSDK.
 *
 * Run with: npx ts-node src/sdk/examples/verifierSdkDemo.ts
 */

import { VerifierSDK } from '../verifierSdk';
import type { VerifiableCredential } from '../../services/credentials/credentialModel';

// ── Sample Data (placeholder — replace with real credentials in production) ───

const sampleCredential: VerifiableCredential = {
  credentialId: 'vc:vitalcv:demo:12345',
  issuer: 'did:vitalcv:issuer:ca-medical-board',
  subject: 'npi:1234567890',
  issuedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  claims: {
    specialty: 'Internal Medicine',
    certificationNumber: 'ABIM-2024-78901',
    boardName: 'American Board of Internal Medicine',
  },
  status: 'ACTIVE',
  signature: 'eyJhbGciOiJFUzI1NiJ9.PLACEHOLDER.SIGNATURE',
  schemaVersion: '1.0',
};

const samplePresentation = {
  presentationId: 'vp:demo:99999',
  holder: 'did:vitalcv:holder:npi:1234567890',
  credentials: [sampleCredential],
  createdAt: new Date().toISOString(),
};

// ── Demo Runner ───────────────────────────────────────────────────────────────

export async function runDemo(): Promise<void> {
  console.log('\n═══════════════════════════════════════════');
  console.log('  VitalCV Verifier SDK — Demo');
  console.log('═══════════════════════════════════════════\n');

  // 1. Verify a single credential
  console.log('1️⃣  verifyCredential()');
  console.log('   Input: VC for ABIM board certification');
  const vcResult = await VerifierSDK.verifyCredential(sampleCredential);
  console.log('   Result:', JSON.stringify(vcResult, null, 2));
  console.log();

  // 2. Verify a presentation bundle
  console.log('2️⃣  verifyPresentation()');
  console.log('   Input: VP bundle with 1 credential');
  const vpResult = await VerifierSDK.verifyPresentation(samplePresentation);
  console.log('   Result:', JSON.stringify(vpResult, null, 2));
  console.log();

  // 3. Check revocation status
  console.log('3️⃣  checkRevocation()');
  console.log('   Input: credential ID "vc:vitalcv:demo:12345"');
  const revResult = await VerifierSDK.checkRevocation('vc:vitalcv:demo:12345');
  console.log('   Result:', JSON.stringify(revResult, null, 2));
  console.log();

  console.log('═══════════════════════════════════════════');
  console.log('  Demo complete.');
  console.log('═══════════════════════════════════════════\n');
}

// Run if executed directly
if (require.main === module) {
  runDemo().catch(console.error);
}
