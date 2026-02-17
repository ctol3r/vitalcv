import { createHash } from 'crypto';

/**
 * SHA-256 hash of a string input. Returns lowercase hex digest.
 */
export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}
