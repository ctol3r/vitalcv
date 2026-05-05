/**
 * lib/env.ts — minimal env accessor for runtime-time env reads.
 *
 * Centralizes env-var reads that are referenced from multiple modules
 * so defaults and shape are documented in one place.
 */

/**
 * The synthetic NPI used by the seeded demo passport. Defaults to
 * Macie Miller PA-C (1346053246) — the prototype's walking scenario
 * that the marketing pages already advertise.
 *
 * Override with the DEMO_NPI env var if a different demo identity is
 * needed. The value is read at request time so a deployment can flip
 * the demo without rebuilding.
 */
export const DEMO_NPI: string = process.env.DEMO_NPI?.trim() || '1346053246';

export function isDemoNpi(value: string | null | undefined): boolean {
  if (typeof value !== 'string') return false;
  return value.trim() === DEMO_NPI;
}
