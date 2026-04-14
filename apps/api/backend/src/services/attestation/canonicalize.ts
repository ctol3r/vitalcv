/**
 * canonicalize.ts — deterministic JSON canonicalization + sha256.
 *
 * Two callers produce the same hash for the same logical payload:
 *   - object key ordering is normalized (alphabetical at every depth)
 *   - `undefined` values are dropped
 *   - `NaN` / +/-Infinity are coerced to null (JSON-safe)
 *   - arrays preserve order (semantic)
 *
 * No external dependencies; uses Node's crypto only.
 */

import { createHash } from 'node:crypto';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function canonicalize(value: unknown): JsonValue {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (typeof value === 'object') {
    const out: { [key: string]: JsonValue } = {};
    const keys = Object.keys(value as Record<string, unknown>).sort();
    for (const key of keys) {
      const v = (value as Record<string, unknown>)[key];
      if (v === undefined) continue;
      out[key] = canonicalize(v);
    }
    return out;
  }
  // functions, symbols → drop
  return null;
}

export function canonicalizeJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function hashAttestation(value: unknown): string {
  return createHash('sha256').update(canonicalizeJson(value)).digest('hex');
}
