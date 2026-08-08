/**
 * statusListRegistry.ts — in-memory revocation registry backing the
 * W3C VC 2.0 Bitstring Status List credential this service serves.
 *
 * Port of the StatusList2021 predecessor (launch blocker #11):
 *  - explicit, stable `statusListIndex` per credential (the predecessor
 *    derived indexes from Map insertion order, which shifted as entries
 *    were added),
 *  - fixed spec-minimum list size (131,072 bits) instead of a list that
 *    grew with entry count,
 *  - GZIP + base64url (no padding) `encodedList` per spec §4.1.
 *
 * Storage remains in-memory, matching the predecessor. The durable,
 * database-backed implementation lives in
 * apps/api/backend/src/services/ledger/statusListManager.ts.
 */

import {
  LIST_SIZE_BITS,
  LIST_SIZE_BYTES,
  encodeBitstring,
  getBit,
  setBit,
} from './bitstring';
import {
  BitstringStatusListCredential,
  BitstringStatusListEntry,
  VC_V2_CONTEXT,
} from './types';

const STATUS_API_URL =
  process.env.PUBLIC_STATUS_URL || process.env.STATUS_URL || 'https://status.vitalcv.ai';
const ISSUER_DID = process.env.ISSUER_DID || 'did:web:vitalcv.ai';

export const STATUS_LIST_CREDENTIAL_URL = `${STATUS_API_URL}/status-list/bitstring`;

export interface RegistryEntry {
  credentialId: string;
  statusListIndex: number;
  revoked: boolean;
  revokedAt?: number;
  reason?: string;
}

interface RegistryState {
  bits: Buffer;
  byCredentialId: Map<string, RegistryEntry>;
  nextIndex: number;
}

function freshState(): RegistryState {
  return {
    bits: Buffer.alloc(LIST_SIZE_BYTES, 0),
    byCredentialId: new Map(),
    nextIndex: 0,
  };
}

let state: RegistryState = freshState();

/**
 * Assign a stable bit index to a credential id (idempotent).
 * Throws when the fixed-size list is exhausted.
 */
export function ensureEntry(credentialId: string): RegistryEntry {
  const existing = state.byCredentialId.get(credentialId);
  if (existing) return existing;

  if (state.nextIndex >= LIST_SIZE_BITS) {
    throw new Error('Status list exhausted — provision a new list.');
  }

  const entry: RegistryEntry = {
    credentialId,
    statusListIndex: state.nextIndex,
    revoked: false,
  };
  state.nextIndex += 1;
  state.byCredentialId.set(credentialId, entry);
  return entry;
}

export function getEntry(credentialId: string): RegistryEntry | undefined {
  return state.byCredentialId.get(credentialId);
}

/**
 * Flip the credential's bit to 1 (revoked). Idempotent.
 */
export function revoke(credentialId: string, reason?: string): RegistryEntry {
  const entry = ensureEntry(credentialId);
  entry.revoked = true;
  entry.revokedAt = entry.revokedAt ?? Date.now();
  entry.reason = reason || entry.reason || 'Revoked by issuer';
  setBit(state.bits, entry.statusListIndex, 1);
  return entry;
}

/**
 * Flip the credential's bit back to 0 (not revoked).
 * Returns null when the credential was never registered.
 */
export function restore(credentialId: string): RegistryEntry | null {
  const entry = state.byCredentialId.get(credentialId);
  if (!entry) return null;
  entry.revoked = false;
  entry.revokedAt = undefined;
  entry.reason = undefined;
  setBit(state.bits, entry.statusListIndex, 0);
  return entry;
}

/** Read the raw bit for an assigned index. */
export function isBitSet(index: number): boolean {
  return getBit(state.bits, index) === 1;
}

export function summary(): {
  entry_count: number;
  revoked_count: number;
  list_size_bits: number;
} {
  let revoked = 0;
  for (const entry of state.byCredentialId.values()) {
    if (entry.revoked) revoked += 1;
  }
  return {
    entry_count: state.byCredentialId.size,
    revoked_count: revoked,
    list_size_bits: LIST_SIZE_BITS,
  };
}

/**
 * Build the W3C VC 2.0 BitstringStatusListCredential (spec §4.1).
 */
export async function buildStatusListCredential(): Promise<BitstringStatusListCredential> {
  const encodedList = await encodeBitstring(state.bits);
  return {
    '@context': [VC_V2_CONTEXT],
    id: STATUS_LIST_CREDENTIAL_URL,
    type: ['VerifiableCredential', 'BitstringStatusListCredential'],
    issuer: ISSUER_DID,
    validFrom: new Date().toISOString(),
    credentialSubject: {
      id: `${STATUS_LIST_CREDENTIAL_URL}#list`,
      type: 'BitstringStatusList',
      statusPurpose: 'revocation',
      encodedList,
    },
  };
}

/**
 * Build the `credentialStatus` entry (spec §4.2) for embedding in an
 * issued VC. Assigns an index if the credential has none yet.
 */
export function buildStatusListEntry(credentialId: string): BitstringStatusListEntry {
  const entry = ensureEntry(credentialId);
  return {
    id: `${STATUS_LIST_CREDENTIAL_URL}#${entry.statusListIndex}`,
    type: 'BitstringStatusListEntry',
    statusPurpose: 'revocation',
    statusListIndex: entry.statusListIndex,
    statusListCredential: STATUS_LIST_CREDENTIAL_URL,
  };
}

/** Test-only: wipe all registry state. */
export function resetRegistryForTests(): void {
  state = freshState();
}
