/**
 * Chain Pallet Introspection Script
 * Task 201.25 - Print pallet calls, events, constants for debugging
 */

import { ApiPromise, WsProvider } from '@polkadot/api';
import { VITALCV_TYPES } from '../src/chain/types';
import {
  introspectPallet,
  printPalletInfo,
  printAllPallets,
} from '../src/chain/palletIntrospection';

async function main() {
  const wsUrl = process.env.SUBSTRATE_WS_URL || 'ws://localhost:9944';
  const palletName = process.argv[2];

  console.log('🔍 Chain Pallet Introspection Tool');
  console.log('─'.repeat(60));
  console.log(`Connecting to ${wsUrl}...`);

  try {
    const provider = new WsProvider(wsUrl);
    const api = await ApiPromise.create({
      provider,
      types: VITALCV_TYPES,
    });

    console.log('✅ Connected');

    const chain = await api.rpc.system.chain();
    const version = await api.rpc.system.version();
    console.log(`Chain: ${chain} v${version}\n`);

    if (!palletName) {
      // List all pallets
      printAllPallets(api);
      console.log('Usage: npm run chain:introspect <pallet-name>');
    } else {
      // Introspect specific pallet
      const info = await introspectPallet(api, palletName);

      if (info) {
        printPalletInfo(info);
      }
    }

    await api.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();

