import { createHash } from 'node:crypto';

export function canonicalReceiptHash(payload: Record<string, unknown>): string {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(payload, Object.keys(payload).sort()))
    .digest('hex')}`;
}
