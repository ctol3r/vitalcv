#!/usr/bin/env ts-node
/**
 * Key Rotation CLI
 * Tagged: cursor-batch-1104-backend-0001
 * Agent: CODEX • BACKEND • chai-vc-platform
 *
 * Usage:
 *   ts-node src/cli/rotate-keys.ts preview       # Show next JWK without applying
 *   ts-node src/cli/rotate-keys.ts apply         # Perform rotation
 *   ts-node src/cli/rotate-keys.ts status        # Show current rotation status
 *   ts-node src/cli/rotate-keys.ts revoke <kid>  # Revoke specific key
 */

import { initializeKeyManager, getKeyManager } from '../services/keyManager';
import { publicKeyToJWK } from '../crypto/ed25519';

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  const keyManager = await initializeKeyManager();

  switch (command) {
    case 'preview':
      await previewNextKey(keyManager);
      break;
    case 'apply':
      await applyRotation(keyManager);
      break;
    case 'status':
      await showStatus(keyManager);
      break;
    case 'revoke':
      if (!args[0]) {
        console.error('Error: kid required');
        console.error('Usage: rotate-keys revoke <kid>');
        process.exit(1);
      }
      await revokeKey(keyManager, args[0]);
      break;
    default:
      showHelp();
      process.exit(1);
  }
}

/**
 * Preview the next key that would be generated
 */
async function previewNextKey(keyManager: any) {
  console.log('🔍 Previewing Next Key (not applied)\n');

  // Generate a preview key (don't set as current)
  const previewKey = await keyManager.generateNewKey(false);
  const jwk = publicKeyToJWK(previewKey.publicKey, previewKey.kid);

  console.log('Next JWK:');
  console.log(JSON.stringify(jwk, null, 2));
  console.log();
  console.log(`kid: ${previewKey.kid}`);
  console.log(`Created: ${previewKey.createdAt.toISOString()}`);
  console.log(`Expires: ${previewKey.expiresAt?.toISOString()}`);
  console.log();
  console.log('⚠️  Preview only - run "apply" to perform actual rotation');

  // Remove preview key from store (we don't want to keep it)
  const store = (keyManager as any).keyStore;
  store.keys = store.keys.filter((k: any) => k.kid !== previewKey.kid);
  await (keyManager as any).saveKeyStore();
}

/**
 * Apply key rotation atomically
 */
async function applyRotation(keyManager: any) {
  const currentKey = keyManager.getCurrentKey();

  console.log('🔄 Applying Key Rotation\n');

  if (!currentKey) {
    console.log('No current key found. Generating initial key...');
    const newKey = await keyManager.generateNewKey(true);
    console.log(`✅ Initial key generated: ${newKey.kid}`);
    return;
  }

  console.log(`Current key: ${currentKey.kid}`);
  console.log(`  Status: ${currentKey.status}`);
  console.log(`  Created: ${currentKey.createdAt.toISOString()}`);
  console.log(`  Expires: ${currentKey.expiresAt?.toISOString() || 'N/A'}`);
  console.log();

  // Perform atomic rotation
  const newKey = await keyManager.rotateKey();

  console.log('✅ Rotation Complete\n');
  console.log(`New active key: ${newKey.kid}`);
  console.log(`Old key ${currentKey.kid} status: rotated (retained for verification)`);
  console.log();

  // Show JWKS with both keys
  const jwks = keyManager.getJWKS();
  console.log('Updated JWKS:');
  console.log(JSON.stringify(jwks, null, 2));
  console.log();
  console.log(`Active keys: ${jwks.keys.length}`);
  console.log('Old keys retained for grace period verification ✓');
}

/**
 * Show current key status
 */
async function showStatus(keyManager: any) {
  const rotationInfo = keyManager.getRotationInfo();
  const currentKey = keyManager.getCurrentKey();
  const allKeys = (keyManager as any).keyStore.keys;

  console.log('🔐 Key Rotation Status\n');
  console.log('Current Active Key:');
  if (currentKey) {
    console.log(`  kid: ${currentKey.kid}`);
    console.log(`  Created: ${currentKey.createdAt.toISOString()}`);
    console.log(`  Expires: ${currentKey.expiresAt?.toISOString() || 'Never'}`);

    if (currentKey.expiresAt) {
      const daysUntilExpiry = Math.ceil(
        (currentKey.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      console.log(`  Time until expiry: ${daysUntilExpiry} days`);
    }
  } else {
    console.log('  None (need to generate initial key)');
  }

  console.log();
  console.log('Key Statistics:');
  console.log(`  Total keys: ${rotationInfo.totalKeys}`);
  console.log(`  Active: ${rotationInfo.activeKeys}`);
  console.log(`  Rotated: ${rotationInfo.rotatedKeys}`);
  console.log(`  Revoked: ${rotationInfo.revokedKeys}`);
  console.log(`  Rotation interval: ${Math.floor(rotationInfo.rotationInterval / (1000 * 60 * 60 * 24))} days`);

  console.log();
  console.log('All Keys:');
  allKeys.forEach((key: any) => {
    const statusIcon = key.status === 'active' ? '🟢' : key.status === 'rotated' ? '🟡' : '🔴';
    console.log(`  ${statusIcon} ${key.kid} - ${key.status} (created: ${new Date(key.createdAt).toISOString()})`);
  });

  console.log();
  console.log('JWKS Endpoint:');
  const jwks = keyManager.getJWKS();
  console.log(JSON.stringify(jwks, null, 2));
}

/**
 * Revoke a specific key
 */
async function revokeKey(keyManager: any, kid: string) {
  const key = keyManager.getKeyById(kid);

  if (!key) {
    console.error(`❌ Key not found: ${kid}`);
    process.exit(1);
  }

  console.log(`⚠️  Revoking key: ${kid}`);
  console.log(`  Status: ${key.status}`);
  console.log(`  Created: ${new Date(key.createdAt).toISOString()}`);
  console.log();

  await keyManager.revokeKey(kid);

  console.log('✅ Key revoked');

  if (kid === keyManager.keyStore.currentKeyId) {
    const newKey = keyManager.getCurrentKey();
    console.log(`🔄 Current key was revoked, new active key: ${newKey?.kid}`);
  }
}

/**
 * Show help
 */
function showHelp() {
  console.log('Key Rotation CLI\n');
  console.log('Usage:');
  console.log('  rotate-keys preview       Show next JWK without applying');
  console.log('  rotate-keys apply         Perform key rotation atomically');
  console.log('  rotate-keys status        Show current rotation status');
  console.log('  rotate-keys revoke <kid>  Revoke specific key');
  console.log();
  console.log('Examples:');
  console.log('  ts-node src/cli/rotate-keys.ts preview');
  console.log('  ts-node src/cli/rotate-keys.ts apply');
  console.log('  ts-node src/cli/rotate-keys.ts status');
  console.log('  ts-node src/cli/rotate-keys.ts revoke 14425890b84692bb');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

