/**
 * @vitalcv/core — cross-app shared services.
 */

// Ledger / hash chain (WAVE C75)
export {
  CHAIN_GENESIS_MARKER,
  CHAIN_HASH_ALGORITHM,
  calculateNextHash,
  canonicalizePayload,
  verifyChainSegment,
} from './services/ledger/HashChainService';
export type { ChainSegmentEntry } from './services/ledger/HashChainService';

export { createAuditEventWithChain } from './services/ledger/createAuditEventWithChain';
export type {
  MinimalAuditPrismaClient,
  AuditEventCreateData,
  ChainedAuditEventInput,
  ChainedAuditEventResult,
} from './services/ledger/createAuditEventWithChain';
