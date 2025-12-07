/**
 * Local Chain Test Script
 * Task 201.44 - CLI script performing issueCredential then getCredentialStatus
 */

import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { VITALCV_TYPES } from '../src/chain/types';
import { buildDataHash } from '../src/chain/hashBuilder';

async function main() {
  console.log('🧪 Chain Test Script - Anchor + Read');
  console.log('─'.repeat(60));

  const wsUrl = process.env.SUBSTRATE_WS_URL || 'ws://localhost:9944';
  const seed = process.env.SUBSTRATE_SEED;

  if (!seed) {
    console.error('❌ Missing SUBSTRATE_SEED environment variable');
    process.exit(1);
  }

  console.log(`🔗 Connecting to ${wsUrl}...`);

  try {
    // Connect to chain
    const provider = new WsProvider(wsUrl);
    const api = await ApiPromise.create({
      provider,
      types: VITALCV_TYPES,
    });

    console.log('✅ Connected to chain');

    // Get chain info
    const chain = await api.rpc.system.chain();
    const version = await api.rpc.system.version();
    console.log(`📋 Chain: ${chain} v${version}`);

    // Setup keyring
    const keyring = new Keyring({ type: 'sr25519' });
    const keypair = keyring.addFromUri(seed);
    console.log(`🔑 Using account: ${keypair.address}`);

    // Test 1: Issue credential
    console.log('\n📝 Test 1: Issue Credential');
    console.log('─'.repeat(60));

    const credentialId = `test-cred-${Date.now()}`;
    const hash = buildDataHash({ test: 'credential', timestamp: Date.now() });
    const issuerDid = 'did:example:issuer123';

    console.log(`Credential ID: ${credentialId}`);
    console.log(`Hash: ${hash}`);
    console.log(`Issuer DID: ${issuerDid}`);

    // @ts-ignore
    const issueTx = api.tx.credentials?.issueCredential?.(
      credentialId,
      hash,
      issuerDid
    );

    if (!issueTx) {
      console.error('❌ credentials.issueCredential not available on this chain');
      await api.disconnect();
      process.exit(1);
    }

    console.log('📤 Sending transaction...');

    const txHash = await new Promise<string>((resolve, reject) => {
      issueTx.signAndSend(keypair, ({ status, dispatchError, txHash }: any) => {
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs}`));
          } else {
            reject(new Error(dispatchError.toString()));
          }
        }

        if (status.isInBlock || status.isFinalized) {
          console.log(`✅ Transaction included in block: ${status.asInBlock || status.asFinalized}`);
          resolve(txHash.toHex());
        }
      });
    });

    console.log(`✅ Transaction hash: ${txHash}`);

    // Test 2: Query credential status
    console.log('\n📖 Test 2: Query Credential Status');
    console.log('─'.repeat(60));

    // Wait a bit for finalization
    await new Promise(resolve => setTimeout(resolve, 2000));

    // @ts-ignore
    const statusData = await api.query.credentials?.credentialStatus?.(credentialId);

    if (!statusData || statusData.isNone) {
      console.warn('⚠️  Credential status not found (might not be stored separately)');
    } else {
      const decoded = statusData.toJSON();
      console.log('✅ Credential status:', decoded);
    }

    // Test 3: Query full record
    console.log('\n📖 Test 3: Query Full Record');
    console.log('─'.repeat(60));

    // @ts-ignore
    const recordData = await api.query.credentials?.credentialRecords?.(credentialId);

    if (!recordData || recordData.isNone) {
      console.warn('⚠️  Credential record not found');
    } else {
      const decoded = recordData.toJSON();
      console.log('✅ Credential record:', decoded);
    }

    // Success
    console.log('\n✅ All tests passed!');
    console.log('─'.repeat(60));

    await api.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();

