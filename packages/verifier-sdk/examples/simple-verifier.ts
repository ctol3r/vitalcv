/**
 * Simple Node.js Verifier Example
 *
 * Minimal example: check an NPI's trust band and revocation status.
 */

import { createVerifier } from '@vitalcv/verifier-sdk';

async function main() {
  const verifier = createVerifier({
    baseUrl: process.env.VITALCV_API_URL ?? 'https://api.vitalcv.com',
    apiKey: process.env.VITALCV_API_KEY,
  });

  const npi = process.argv[2] ?? '1234567890';

  console.log(`\n🔍 Verifying NPI: ${npi}\n`);

  // Trust band (fast path)
  const band = await verifier.getTrustBand(npi);
  console.log(`Trust Band: ${band.band} (${band.bandLabel})`);
  console.log(`HAIP Compliant: ${band.haipCompliant ? '✅' : '❌'}`);

  // Full substrate state
  const state = await verifier.getSubstrateTrustState(npi);
  console.log(`\nCredentials: ${state.credentialRisk.length}`);
  console.log(`Revoked: ${state.revocationState.revokedCount}`);
  console.log(`Federation Health: ${state.federationTrustHealth.healthScore}%`);
  console.log(`\nExplanation: ${state.explanation}`);

  // Check a specific credential if available
  if (state.credentialRisk.length > 0) {
    const credId = state.credentialRisk[0].credentialId;
    const revStatus = await verifier.checkRevocation(credId);
    console.log(`\nRevocation check for ${credId}:`);
    console.log(`  Revoked: ${revStatus.revoked ? '🚫 Yes' : '✅ No'}`);
  }

  // Federation peers
  const peers = await verifier.listFederationPeers();
  console.log(`\nFederated Peers: ${peers.length}`);
  for (const peer of peers.slice(0, 3)) {
    console.log(`  - ${peer.networkName} (${peer.status})`);
  }
}

main().catch(console.error);
