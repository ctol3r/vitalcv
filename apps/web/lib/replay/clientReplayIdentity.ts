/**
 * Browser-compatible mirror of the canonical replay-identity algorithm.
 *
 * The backend module (`apps/api/backend/src/services/replay/replayIdentity.ts`
 * — shipped in PR #343) uses `node:crypto` synchronously, which is not
 * available in the browser. This module re-implements the SAME
 * algorithm using `crypto.subtle.digest('SHA-256', …)`, which IS
 * available in every modern browser and in Node's webcrypto.
 *
 * The cross-validation test (`__tests__/replay-identity-parity.test.ts`)
 * pins that this module produces byte-identical output to the backend
 * module for the same input. Any future algorithm change MUST update
 * BOTH modules and BOTH must bump the scheme version (`v1` → `v2`).
 *
 * Why duplicate instead of shared package: the backend module imports
 * from `node:crypto` directly. Lifting it to a shared package would
 * either force the same dependency on browser bundles or require an
 * abstraction layer. A small parity-tested mirror is the least
 * invasive way to get the math into the UI today; consolidation can
 * follow a future package-extraction PR.
 */

const LINEAGE_PREFIX = 'lin_v1_';
const RUN_PREFIX = 'run_v1_';
const HASH_DIGEST_LENGTH = 16;

async function sha256Hex(input: string): Promise<string> {
  const subtle = (globalThis.crypto as Crypto | undefined)?.subtle;
  if (!subtle) {
    throw new Error('crypto.subtle.digest is required for replay identity');
  }
  const encoded = new TextEncoder().encode(input);
  const digest = await subtle.digest('SHA-256', encoded);
  const bytes = new Uint8Array(digest);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * Same contract as backend `computeLineageKey`: hash over the trimmed
 * lower-cased entity id. Returns `lin_v1_<sha256[0:16]>`.
 */
export async function computeLineageKey(entityId: string): Promise<string> {
  const canonical = entityId.trim().toLowerCase();
  if (!canonical) {
    throw new Error('computeLineageKey: entityId is required');
  }
  const digest = await sha256Hex(`entity|${canonical}`);
  return `${LINEAGE_PREFIX}${digest.slice(0, HASH_DIGEST_LENGTH)}`;
}

export interface ClientReplayRunInput {
  entityId: string;
  lastCheckedAt: string | null;
  artifactChecksums?: readonly string[];
  channel?: string | null;
}

/**
 * Same contract as backend `computeRunId`. Returns `run_v1_<sha256[0:16]>`.
 * Input normalization (trim, sort, drop-empty, lowercase) is identical
 * to the backend so byte-for-byte parity holds.
 */
export async function computeRunId(input: ClientReplayRunInput): Promise<string> {
  const canonicalEntity = input.entityId.trim().toLowerCase();
  if (!canonicalEntity) {
    throw new Error('computeRunId: entityId is required');
  }
  const sortedChecksums = [...(input.artifactChecksums ?? [])]
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
    .sort((a, b) => a.localeCompare(b));
  const channel = (input.channel ?? '').trim().toLowerCase();

  const payload = [
    'entity', canonicalEntity,
    'checkedAt', input.lastCheckedAt ?? 'never',
    'channel', channel,
    'artifacts', sortedChecksums.join(','),
  ].join('|');

  const digest = await sha256Hex(payload);
  return `${RUN_PREFIX}${digest.slice(0, HASH_DIGEST_LENGTH)}`;
}

export interface ClientReplayIdentity {
  lineageKey: string;
  runId: string;
  schemeVersion: 'v1';
}

export async function computeReplayIdentity(
  input: ClientReplayRunInput,
): Promise<ClientReplayIdentity> {
  const [lineageKey, runId] = await Promise.all([
    computeLineageKey(input.entityId),
    computeRunId(input),
  ]);
  return { lineageKey, runId, schemeVersion: 'v1' };
}
