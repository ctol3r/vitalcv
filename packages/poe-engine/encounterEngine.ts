import { sha256Hex } from './crypto';
import { buildMerkleTreeFromLeafHashes } from './merkle';

/**
 * A single clinical encounter record. Contains NO patient identifiers.
 * Only procedural metadata needed for volume attestation.
 */
export interface EncounterRecord {
  /** ISO 8601 date string (e.g. "2025-01-15") */
  date: string;
  /** CPT procedure code (e.g. "27447" for total knee replacement) */
  cptCode: string;
  /** Clinical risk category (e.g. "low", "moderate", "high") */
  riskOutcome: string;
  /** Pre-hashed facility identifier — NOT the raw facility name/NPI */
  facilityHash?: string;
}

export interface EncounterRootResult {
  merkleRoot: string;
  volumeCount: number;
  leafHashes: string[];
  computedAt: string;
}

function assertValidEncounter(encounter: EncounterRecord, index: number): void {
  if (typeof encounter.date !== 'string' || encounter.date.trim().length === 0) {
    throw new Error(`encounter[${index}].date is required`);
  }
  if (typeof encounter.cptCode !== 'string' || encounter.cptCode.trim().length === 0) {
    throw new Error(`encounter[${index}].cptCode is required`);
  }
  if (typeof encounter.riskOutcome !== 'string' || encounter.riskOutcome.trim().length === 0) {
    throw new Error(`encounter[${index}].riskOutcome is required`);
  }
}

/**
 * Hash a single encounter into a leaf hash.
 * Uses a pipe-delimited canonical form prefixed with "encounter:" to avoid
 * collisions with the existing claim hash format (type:value).
 */
function hashEncounter(encounter: EncounterRecord): string {
  const canonicalValue = [
    encounter.date.trim(),
    encounter.cptCode.trim(),
    encounter.riskOutcome.trim(),
    encounter.facilityHash?.trim() ?? '',
  ].join('|');

  return sha256Hex(`encounter:${canonicalValue}`);
}

/**
 * Generate a Merkle root from an array of encounter records.
 *
 * PHI ISOLATION: After computing leaf hashes, the raw encounter data
 * is no longer referenced. The caller MUST NOT persist the raw encounters.
 * The returned result contains ONLY the Merkle root, volume count,
 * and leaf hashes (opaque SHA-256 digests).
 */
export function generateEncounterRoot(encounters: readonly EncounterRecord[]): EncounterRootResult {
  if (!Array.isArray(encounters) || encounters.length === 0) {
    throw new Error('encounters array must be non-empty');
  }

  for (let i = 0; i < encounters.length; i++) {
    assertValidEncounter(encounters[i], i);
  }

  const leafHashes = encounters.map((enc) => hashEncounter(enc));
  const tree = buildMerkleTreeFromLeafHashes(leafHashes);

  return {
    merkleRoot: tree.root,
    volumeCount: encounters.length,
    leafHashes: tree.leaves,
    computedAt: new Date().toISOString(),
  };
}
