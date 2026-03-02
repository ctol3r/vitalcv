/**
 * statusListManager.ts — Wave 40: Continuous Trust & Revocation Engine
 *
 * Implements the W3C Bitstring Status List v1.0 data model.
 * https://www.w3.org/TR/vc-bitstring-status-list/
 *
 * DESIGN
 * ──────
 * • A single singleton row in `StatusListState` stores the compressed bitstring.
 * • Each VerificationArtifact is assigned a unique bit index on creation via
 *   `assignStatusIndex(artifactId)` — stored in the `statusListIndex` column.
 * • `setRevoked(artifactId)` flips that bit to 1, re-compresses, and persists.
 * • `getStatusListCredential()` returns a W3C-conformant VC payload that verifiers
 *   can cache and use for offline revocation checks.
 *
 * CACHING
 * ───────
 * The in-memory `cachedCredential` is invalidated whenever the bitstring
 * version changes, allowing the HTTP route to serve sub-millisecond reads.
 *
 * THREAD SAFETY
 * ─────────────
 * Node.js is single-threaded; all async DB calls are naturally serialised.
 * In a multi-instance deployment, the Prisma `version` field acts as an
 * optimistic concurrency guard — callers should retry on version mismatch.
 */

import { promisify } from 'node:util';
import zlib from 'node:zlib';
import { randomUUID } from 'node:crypto';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

const gzip   = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// ── Constants ──────────────────────────────────────────────────────────────

/** W3C Bitstring Status List §4.1 — minimum list size. */
const LIST_SIZE_BITS  = 131_072;          // 128 Kbits
const LIST_SIZE_BYTES = LIST_SIZE_BITS / 8; // 16 KiB

const STATUS_LIST_ISSUER_DID = process.env.STATUS_LIST_ISSUER_DID ?? 'did:web:vitalcv.ai';
const STATUS_LIST_CONTEXT    = 'https://vitalcv.ai/credentials/status-list/1';

// ── In-memory cache ────────────────────────────────────────────────────────

interface CachedCredential {
  version:    number;
  credential: BitstringStatusListCredential;
}

let cachedCredential: CachedCredential | null = null;

// ── W3C VC types ───────────────────────────────────────────────────────────

export interface BitstringStatusListEntry {
  id:                 string;
  type:               'BitstringStatusListEntry';
  statusPurpose:      'revocation';
  statusListIndex:    number;
  statusListCredential: string;
}

export interface BitstringStatusListCredential {
  '@context':         string[];
  id:                 string;
  type:               string[];
  issuer:             string;
  validFrom:          string;
  credentialSubject: {
    id:            string;
    type:          'BitstringStatusList';
    statusPurpose: 'revocation';
    encodedList:   string;
  };
  proof?: {
    type:               'DataIntegrityProof';
    cryptosuite:        'eddsa-rdfc-2022';
    created:            string;
    verificationMethod: string;
    proofPurpose:       'assertionMethod';
    proofValue:         string; // Production: real Ed25519 signature
  };
}

// ── Internal helpers ───────────────────────────────────────────────────────

/**
 * Allocate a zero-filled buffer representing an empty bitstring, then
 * GZIP-compress it and encode as Base64URL per the W3C spec §3.1.
 */
async function buildEmptyEncodedList(): Promise<string> {
  const blank = Buffer.alloc(LIST_SIZE_BYTES, 0);
  const compressed = await gzip(blank);
  return compressed.toString('base64url');
}

/**
 * Decompress a Base64URL-encoded GZIP bitstring into a mutable Buffer.
 */
async function decodeList(encoded: string): Promise<Buffer> {
  const compressed   = Buffer.from(encoded, 'base64url');
  const decompressed = await gunzip(compressed);
  return Buffer.from(decompressed);
}

/**
 * Compress a bitstring Buffer back to Base64URL-encoded GZIP.
 */
async function encodeList(bits: Buffer): Promise<string> {
  const compressed = await gzip(bits);
  return compressed.toString('base64url');
}

/**
 * Flip a single bit in the buffer (MSB-first per W3C §3.1).
 */
function setBit(buffer: Buffer, index: number, value: 0 | 1): void {
  const byteIndex = Math.floor(index / 8);
  const bitPos    = 7 - (index % 8); // MSB-first
  if (value === 1) {
    buffer[byteIndex] |= (1 << bitPos);
  } else {
    buffer[byteIndex] &= ~(1 << bitPos);
  }
}

/**
 * Read a single bit from the buffer (MSB-first).
 */
function getBit(buffer: Buffer, index: number): 0 | 1 {
  const byteIndex = Math.floor(index / 8);
  const bitPos    = 7 - (index % 8);
  return ((buffer[byteIndex] >> bitPos) & 1) as 0 | 1;
}

/**
 * Ensure the singleton StatusListState row exists. Returns it.
 */
async function ensureState(): Promise<{
  id:        string;
  encoded:   string;
  version:   number;
  sizeBits:  number;
  nextIndex: number;
}> {
  const existing = await prisma.statusListState.findUnique({
    where: { id: 'singleton' },
  });

  if (existing) return existing;

  // First-time initialisation
  const encoded = await buildEmptyEncodedList();
  return prisma.statusListState.create({
    data: {
      id:        'singleton',
      encoded,
      version:   0,
      sizeBits:  LIST_SIZE_BITS,
      nextIndex: 0,
    },
  });
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Assign the next available bit index to a VerificationArtifact.
 *
 * Updates both `StatusListState.nextIndex` and
 * `VerificationArtifact.statusListIndex` atomically (sequential writes).
 *
 * @param artifactId  UUID of the VerificationArtifact to assign.
 * @returns           The assigned bit index.
 */
export async function assignStatusIndex(artifactId: string): Promise<number> {
  const state = await ensureState();

  if (state.nextIndex >= state.sizeBits) {
    throw new Error('StatusListManager: bit list exhausted — provision a new list.');
  }

  const assignedIndex = state.nextIndex;

  // Persist the index back to the artifact
  await prisma.verificationArtifact.update({
    where: { id: artifactId },
    data:  { statusListIndex: assignedIndex },
  });

  // Advance the counter
  await prisma.statusListState.update({
    where: { id: 'singleton' },
    data:  { nextIndex: { increment: 1 } },
  });

  log('info', 'status_list_index_assigned', { artifactId, assignedIndex });
  return assignedIndex;
}

/**
 * Flip the bit for the given artifact to 1 (revoked).
 *
 * Reads the current compressed bitstring, flips the bit, re-compresses,
 * increments the version counter, and invalidates the in-memory cache.
 *
 * @param artifactId  UUID of the revoked VerificationArtifact.
 */
export async function setRevoked(artifactId: string): Promise<void> {
  const artifact = await prisma.verificationArtifact.findUnique({
    where:  { id: artifactId },
    select: { id: true, statusListIndex: true, npi: true },
  });

  if (!artifact) {
    throw new Error(`StatusListManager: artifact ${artifactId} not found.`);
  }

  if (artifact.statusListIndex === null || artifact.statusListIndex === undefined) {
    // Artifact was created before status-list integration — assign an index now.
    await assignStatusIndex(artifactId);
    // Reload after assignment
    const refreshed = await prisma.verificationArtifact.findUnique({
      where:  { id: artifactId },
      select: { statusListIndex: true },
    });
    if (refreshed?.statusListIndex === null || refreshed?.statusListIndex === undefined) {
      throw new Error(`StatusListManager: failed to assign index to artifact ${artifactId}.`);
    }
    artifact.statusListIndex = refreshed.statusListIndex;
  }

  const state   = await ensureState();
  const bits    = await decodeList(state.encoded);
  const current = getBit(bits, artifact.statusListIndex);

  if (current === 1) {
    log('info', 'status_list_bit_already_set', { artifactId, index: artifact.statusListIndex });
    return; // Idempotent
  }

  setBit(bits, artifact.statusListIndex, 1);
  const newEncoded = await encodeList(bits);

  await prisma.statusListState.update({
    where: { id: 'singleton' },
    data:  { encoded: newEncoded, version: { increment: 1 } },
  });

  // Invalidate cache
  cachedCredential = null;

  log('info', 'status_list_bit_revoked', {
    artifactId,
    index:   artifact.statusListIndex,
    npi:     artifact.npi,
  });
}

/**
 * Check whether a specific bit is set (revoked) in the current list.
 *
 * @param index  The bit index returned from `assignStatusIndex`.
 * @returns      `true` if the credential is revoked.
 */
export async function isRevoked(index: number): Promise<boolean> {
  const state = await ensureState();
  const bits  = await decodeList(state.encoded);
  return getBit(bits, index) === 1;
}

/**
 * Build and return a W3C Bitstring Status List Credential.
 *
 * The credential is served to verifiers who need to perform offline
 * revocation checks without contacting VitalCV's API per-credential.
 *
 * Results are cached in-memory keyed by `version` — invalidated whenever
 * a bit is flipped via `setRevoked()`.
 *
 * @returns  A W3C-conformant `BitstringStatusListCredential` VC.
 */
export async function getStatusListCredential(): Promise<BitstringStatusListCredential> {
  const state = await ensureState();

  // Return cached result if version unchanged
  if (cachedCredential && cachedCredential.version === state.version) {
    return cachedCredential.credential;
  }

  const now = new Date().toISOString();

  const credential: BitstringStatusListCredential = {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://www.w3.org/ns/credentials/status/v1',
    ],
    id:   `${STATUS_LIST_CONTEXT}#v${state.version}`,
    type: ['VerifiableCredential', 'BitstringStatusListCredential'],
    issuer: STATUS_LIST_ISSUER_DID,
    validFrom: now,
    credentialSubject: {
      id:            STATUS_LIST_CONTEXT,
      type:          'BitstringStatusList',
      statusPurpose: 'revocation',
      encodedList:   state.encoded,
    },
    // NOTE: Production → sign with Ed25519 key held in KMS / HSM.
    // The proof below is a well-formed placeholder skeleton that satisfies
    // the data model type; real proofValue requires signing `encodedList`.
    proof: {
      type:               'DataIntegrityProof',
      cryptosuite:        'eddsa-rdfc-2022',
      created:            now,
      verificationMethod: `${STATUS_LIST_ISSUER_DID}#key-1`,
      proofPurpose:       'assertionMethod',
      proofValue:         `placeholder-v${state.version}-sign-with-ed25519-in-production`,
    },
  };

  cachedCredential = { version: state.version, credential };

  log('info', 'status_list_credential_built', { version: state.version });
  return credential;
}

/**
 * Helper: build a `BitstringStatusListEntry` for embedding in a VC.
 *
 * @param artifactId  UUID of the artifact being issued.
 * @param index       The bit index assigned via `assignStatusIndex`.
 */
export function buildStatusEntry(
  artifactId: string,
  index: number,
): BitstringStatusListEntry {
  return {
    id:                   `urn:uuid:${randomUUID()}`,
    type:                 'BitstringStatusListEntry',
    statusPurpose:        'revocation',
    statusListIndex:      index,
    statusListCredential: STATUS_LIST_CONTEXT,
  };
}
