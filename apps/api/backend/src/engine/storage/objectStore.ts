import { writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { canonicalize } from '../utils/canonicalize';

const DEFAULT_STORAGE_ROOT = path.resolve(
  process.cwd(),
  'storage',
);

/**
 * Stores a raw payload blob immutably on disk.
 *
 * Layout:  {storageRoot}/{artifactId}/raw.json
 *
 * Write-once: throws if the file already exists. This guarantees
 * the raw API response cannot be tampered with after artifact creation.
 */
export async function storeRawPayload(
  artifactId: string,
  payload: unknown,
  storageRoot: string = DEFAULT_STORAGE_ROOT,
): Promise<string> {
  const artifactDir = path.join(storageRoot, artifactId);
  const filePath = path.join(artifactDir, 'raw.json');

  // Enforce immutability — refuse to overwrite
  if (await fileExists(filePath)) {
    throw new ImmutableBlobError(artifactId, filePath);
  }

  await mkdir(artifactDir, { recursive: true });
  const canonical = canonicalize(payload);
  await writeFile(filePath, canonical, { encoding: 'utf-8', flag: 'wx' });

  return filePath;
}

// ── Helpers ──────────────────────────────────────────────────

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export class ImmutableBlobError extends Error {
  constructor(
    public readonly artifactId: string,
    public readonly filePath: string,
  ) {
    super(
      `Blob already exists for artifact ${artifactId} at ${filePath}. ` +
      'Raw payloads are immutable and cannot be overwritten.',
    );
    this.name = 'ImmutableBlobError';
  }
}
