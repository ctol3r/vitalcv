/**
 * Pallet Metadata Introspection Tool
 * Task 201.25 - CLI tool to print pallet calls, events, constants
 */

import { ApiPromise } from '@polkadot/api';

export interface PalletInfo {
  name: string;
  calls: string[];
  events: string[];
  constants: Array<{ name: string; value: any; docs: string[] }>;
  storage: string[];
  errors: string[];
}

/**
 * Task 201.25 - Print pallet metadata for debugging
 */
export async function introspectPallet(
  api: ApiPromise,
  palletName: string
): Promise<PalletInfo | null> {
  try {
    const metadata = api.runtimeMetadata.asLatest;

    const pallet = metadata.pallets.find(
      (p: any) => p.name.toString().toLowerCase() === palletName.toLowerCase()
    );

    if (!pallet) {
      console.error(`❌ Pallet '${palletName}' not found`);
      return null;
    }

    const info: PalletInfo = {
      name: pallet.name.toString(),
      calls: [],
      events: [],
      constants: [],
      storage: [],
      errors: [],
    };

    // Extract calls
    if (pallet.calls.isSome) {
      const calls = pallet.calls.unwrap();
      // @ts-ignore
      for (const call of calls.toArray()) {
        info.calls.push(call.name.toString());
      }
    }

    // Extract events
    if (pallet.events.isSome) {
      const events = pallet.events.unwrap();
      // @ts-ignore
      for (const event of events.toArray()) {
        info.events.push(event.name.toString());
      }
    }

    // Extract constants
    if (pallet.constants) {
      for (const constant of pallet.constants) {
        info.constants.push({
          name: constant.name.toString(),
          value: constant.value.toHex(),
          docs: constant.docs.map((d: any) => d.toString()),
        });
      }
    }

    // Extract storage
    if (pallet.storage.isSome) {
      const storage = pallet.storage.unwrap();
      // @ts-ignore
      for (const item of storage.items) {
        info.storage.push(item.name.toString());
      }
    }

    // Extract errors
    if (pallet.errors.isSome) {
      const errors = pallet.errors.unwrap();
      // @ts-ignore
      for (const error of errors.toArray()) {
        info.errors.push(error.name.toString());
      }
    }

    return info;
  } catch (error) {
    console.error('Failed to introspect pallet:', error);
    return null;
  }
}

/**
 * Print pallet info in readable format
 */
export function printPalletInfo(info: PalletInfo): void {
  console.log(`\n📦 Pallet: ${info.name}`);
  console.log('─'.repeat(60));

  if (info.calls.length > 0) {
    console.log('\n🔧 Calls:');
    info.calls.forEach(call => console.log(`  - ${call}`));
  }

  if (info.events.length > 0) {
    console.log('\n📣 Events:');
    info.events.forEach(event => console.log(`  - ${event}`));
  }

  if (info.storage.length > 0) {
    console.log('\n💾 Storage:');
    info.storage.forEach(storage => console.log(`  - ${storage}`));
  }

  if (info.constants.length > 0) {
    console.log('\n⚙️  Constants:');
    info.constants.forEach(constant => {
      console.log(`  - ${constant.name}: ${constant.value}`);
      if (constant.docs.length > 0) {
        console.log(`    ${constant.docs.join(' ')}`);
      }
    });
  }

  if (info.errors.length > 0) {
    console.log('\n❌ Errors:');
    info.errors.forEach(error => console.log(`  - ${error}`));
  }

  console.log('\n' + '─'.repeat(60));
}

/**
 * List all available pallets
 */
export function listAllPallets(api: ApiPromise): string[] {
  const metadata = api.runtimeMetadata.asLatest;
  return metadata.pallets.map((p: any) => p.name.toString());
}

/**
 * Print all pallets
 */
export function printAllPallets(api: ApiPromise): void {
  const pallets = listAllPallets(api);

  console.log('\n📚 Available Pallets:');
  console.log('─'.repeat(60));
  pallets.forEach((pallet, i) => {
    console.log(`  ${(i + 1).toString().padStart(2, ' ')}. ${pallet}`);
  });
  console.log('─'.repeat(60));
  console.log(`Total: ${pallets.length} pallets\n`);
}

