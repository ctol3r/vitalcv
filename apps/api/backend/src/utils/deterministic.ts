import { createHash } from 'node:crypto';
import { canonicalizeJson } from './canonicalizeJson';

export function stableStringify(value: unknown): string {
  return canonicalizeJson(value as object);
}

export function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function sha256ForPayload(payload: unknown): string {
  return sha256Hex(canonicalizeJson(payload as object));
}

export function hashDeterministicPayload(payload: unknown): string {
  return sha256ForPayload(payload);
}

export function createHashChain(parts: Record<string, unknown>): string {
  return sha256ForPayload(parts);
}
