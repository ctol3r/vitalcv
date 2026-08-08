/**
 * Deterministic identity for plans and actions.
 *
 * Plan generation must be idempotent: the same consumed context through the
 * same policy version yields byte-identical plans, so concurrent generations
 * converge instead of forking (START-Bench scenario: concurrent repeated plan
 * generation). Nothing here reads a clock or RNG.
 */
import { createHash } from 'node:crypto';

/** Stable stringify: object keys sorted recursively so hashing is order-safe. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([k, v]) => [k, sortValue(v)]));
  }
  return value;
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Fingerprint of a consumed context (subject + truth snapshot). */
export function contextFingerprint(context: unknown): string {
  return sha256Hex(stableStringify(context)).slice(0, 32);
}

/** Deterministic plan id: same subject + policy + context ⇒ same plan id. */
export function planId(subjectRef: string, policyVersion: string, fingerprint: string): string {
  return `plan_${sha256Hex(`${subjectRef}|${policyVersion}|${fingerprint}`).slice(0, 24)}`;
}

/**
 * Deterministic action id. The discriminator carries what makes the action
 * unique within a plan (lane id, field name, requirement id).
 */
export function actionId(type: string, discriminator: string): string {
  return `act_${type}_${sha256Hex(discriminator).slice(0, 12)}`;
}

/** Deterministic blocker id, same construction as actions. */
export function blockerId(type: string, discriminator: string): string {
  return `blk_${type}_${sha256Hex(discriminator).slice(0, 12)}`;
}
