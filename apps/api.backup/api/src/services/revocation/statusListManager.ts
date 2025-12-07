/**
 * StatusList Manager - Round 12
 * Maintains in-memory StatusList for quick revocation bit flips
 */

import { Pool } from 'pg';
import StatusList, { StatusListCredential } from './statusList';

let globalStatusList: StatusList | null = null;
let pool: Pool | null = null;

/**
 * Initialize the status list manager with a DB pool
 */
export function initStatusListManager(dbPool: Pool) {
  pool = dbPool;
  globalStatusList = new StatusList(131072, 'revocation', '1', process.env.ISSUER_DID || 'did:chai:issuer');
}

/**
 * Mark a credential as revoked by flipping the bit at the given index
 */
export function markRevoked(index: number): void {
  if (!globalStatusList) {
    throw new Error('StatusList not initialized');
  }
  globalStatusList.setBit(index, true);
}

/**
 * Check if an index is revoked
 */
export function isRevoked(index: number): boolean {
  if (!globalStatusList) {
    throw new Error('StatusList not initialized');
  }
  return globalStatusList.getBit(index);
}

/**
 * Get the current status list credential (for /status/1 endpoint)
 */
export async function getStatusListCredential(): Promise<StatusListCredential> {
  if (!globalStatusList) {
    throw new Error('StatusList not initialized');
  }
  return globalStatusList.toCredential();
}

/**
 * Get statistics about the status list
 */
export function getStats() {
  if (!globalStatusList) {
    throw new Error('StatusList not initialized');
  }
  return globalStatusList.getStats();
}

export default {
  initStatusListManager,
  markRevoked,
  isRevoked,
  getStatusListCredential,
  getStats,
};

