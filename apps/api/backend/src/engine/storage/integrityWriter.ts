import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { EvidenceIntegrity } from '../types/psv';

/**
 * Writes a human-readable integrity.txt alongside the raw blob.
 *
 * Contains the critical fields that allow independent verification
 * of the stored payload against the signed artifact.
 */
export async function writeIntegrityFile(
  artifactDir: string,
  integrity: EvidenceIntegrity,
): Promise<string> {
  const filePath = path.join(artifactDir, 'integrity.txt');

  const lines = [
    `rawPayloadHash=${integrity.rawPayloadHash}`,
    `artifactHash=${integrity.artifactHash}`,
    `signatureAlgorithm=${integrity.signatureAlgorithm}`,
    `signedAt=${integrity.signedAt}`,
  ];

  await writeFile(filePath, lines.join('\n') + '\n', 'utf-8');
  return filePath;
}
