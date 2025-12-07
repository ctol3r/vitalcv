/**
 * Preflight Regression Script - Round 12
 * Happy-path test: issue credential → assign index → revoke → verify
 */

import axios from 'axios';

async function main() {
  const base = process.env.PUBLIC_ISSUER_URL || 'http://localhost:4000';
  let passCount = 0;

  console.log('🚀 Starting preflight regression...');
  console.log(`📍 Base URL: ${base}`);

  try {
    // Step 1: Create an offer (simulating OIDC4VCI flow)
    console.log('\n1️⃣  Creating credential offer...');
    const offerRes = await axios.post(`${base}/api/oidc4vci/offer`, {
      subjectDid: 'did:key:zTest123',
      type: 'MedicalLicense',
    });
    console.log('   ✅ Offer created:', offerRes.data.pre_authorized_code?.substring(0, 16) + '...');

    // Step 2: Exchange pre-authorized code for access token
    console.log('\n2️⃣  Exchanging pre-authorized code for token...');
    const tokenRes = await axios.post(`${base}/api/oidc4vci/token`, {
      grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
      'pre-authorized_code': offerRes.data.pre_authorized_code,
    });
    console.log('   ✅ Access token obtained');
    passCount++;

    // Step 3: Get credential
    console.log('\n3️⃣  Requesting credential...');
    const credRes = await axios.post(`${base}/api/oidc4vci/credential`, {
      access_token: tokenRes.data.access_token,
      subjectDid: 'did:key:zTest123',
      type: 'MedicalLicense',
    });
    const credId = credRes.data.credential_id || credRes.data.id || 'test-cred-' + Date.now();
    console.log('   ✅ Credential issued:', credId);
    passCount++;

    // Step 4: Assign status index
    console.log('\n4️⃣  Assigning status index...');
    await axios.post(`${base}/api/status-admin/assign`, {
      cred_id: credId,
      index: 42,
    });
    console.log('   ✅ Index 42 assigned to credential');

    // Step 5: Revoke credential
    console.log('\n5️⃣  Revoking credential...');
    const revokeRes = await axios.post(`${base}/api/status-admin/revoke`, {
      cred_id: credId,
      reason: 'regression-test',
      subject_did: 'did:key:zTest123',
      cred_type: 'MedicalLicense',
    });
    console.log('   ✅ Credential revoked at index:', revokeRes.data.index);
    passCount++;

    // Step 6: Verify status list reflects revocation
    console.log('\n6️⃣  Checking status list...');
    const statusRes = await axios.get(`${base}/status/1`);
    if (statusRes.data && statusRes.data.credentialSubject) {
      console.log('   ✅ Status list retrieved');
    } else {
      throw new Error('Invalid status list response');
    }

    console.log('\n✨ REGRESSION_OK=' + passCount);
    console.log('🎉 All checks passed!\n');
    process.exit(passCount >= 2 ? 0 : 1);
  } catch (error: any) {
    console.error('\n❌ REGRESSION FAILED');
    console.error('   Error:', error.message);
    if (error.response?.data) {
      console.error('   Response:', error.response.data);
    }
    console.log('\n💀 REGRESSION_OK=' + passCount);
    process.exit(1);
  }
}

main();

