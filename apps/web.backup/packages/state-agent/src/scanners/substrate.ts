/**
 * Substrate pallets scanner
 * Scans for Substrate blockchain runtime pallets and configuration
 */

import * as fs from 'fs';
import * as path from 'path';
import type { BlockchainMetadata } from '../types';

const MONOREPO_ROOT = path.resolve(__dirname, '../../../..');
const CHAIN_DIR = path.join(MONOREPO_ROOT, 'chain');
const CONTRACTS_DIR = path.join(MONOREPO_ROOT, 'contracts');

export async function scanSubstratePallets(): Promise<BlockchainMetadata> {
  const pallets: string[] = [];
  let runtime = 'unknown';
  let validators = 0;
  let chainId: string | undefined;

  // Scan chain directory for pallets
  if (fs.existsSync(CHAIN_DIR)) {
    await scanForPallets(CHAIN_DIR, pallets);
  }

  // Scan contracts directory
  if (fs.existsSync(CONTRACTS_DIR)) {
    await scanForPallets(CONTRACTS_DIR, pallets);
  }

  // Look for runtime configuration
  const runtimeFiles = [
    path.join(CHAIN_DIR, 'runtime', 'src', 'lib.rs'),
    path.join(CHAIN_DIR, 'runtime', 'Cargo.toml'),
  ];

  for (const file of runtimeFiles) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('runtime')) {
        runtime = 'substrate';
      }
      // Try to extract chain ID
      const chainIdMatch = content.match(/chain[_-]?id['":\s]*[:=]\s*['"]?([^'"\s]+)['"]?/i);
      if (chainIdMatch) {
        chainId = chainIdMatch[1];
      }
    }
  }

  // Look for validator configuration
  const configFiles = [
    path.join(CHAIN_DIR, 'node', 'src', 'chain_spec.rs'),
    path.join(CHAIN_DIR, 'docker-compose.yml'),
  ];

  for (const file of configFiles) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf-8');
      const validatorMatches = content.match(/validator[s]?['":\s]*[:=]\s*(\d+)/i);
      if (validatorMatches) {
        validators = parseInt(validatorMatches[1], 10) || 0;
      }
    }
  }

  return {
    pallets: [...new Set(pallets)],
    runtime,
    validators,
    chainId,
  };
}

async function scanForPallets(dir: string, pallets: string[]): Promise<void> {
  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true, recursive: true });

  for (const entry of entries) {
    if (entry.isFile() && (entry.name.endsWith('.rs') || entry.name === 'Cargo.toml')) {
      const fullPath = path.join(entry.path || dir, entry.name);
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');

        // Look for pallet declarations
        const palletMatches = content.match(/pallet[_-]?(\w+)/gi);
        if (palletMatches) {
          pallets.push(...palletMatches.map(m => m.replace(/pallet[_-]?/i, '').toLowerCase()));
        }

        // Look for construct_runtime! macro
        if (content.includes('construct_runtime!')) {
          const runtimeMatches = content.match(/(\w+):\s*(\w+)::/g);
          if (runtimeMatches) {
            pallets.push(...runtimeMatches.map(m => m.split(':')[0].trim().toLowerCase()));
          }
        }
      } catch (e) {
        // Skip files that can't be read
      }
    }
  }
}

