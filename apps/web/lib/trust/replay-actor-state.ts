/**
 * ReplayActorState — formalized replay attribution states.
 *
 * Replaces ad-hoc "anonymous vs. authenticated" boolean checks with
 * an explicit typed union. Replay lineage becomes structurally
 * inspectable: any consumer reading a replay event can branch on
 * `actorState` and know exactly which trust posture applies.
 *
 * Doctrine:
 *   - Every replay event has an actorState. There is no implicit
 *     default — the producer must choose one.
 *   - `anonymous_exploration` is a FIRST-CLASS state, not an absence.
 *     Public readiness preview (NPI lookup, /passport without auth)
 *     intentionally allows anonymous reads and they ARE attributable
 *     to "exploration with no actor binding". This preserves the
 *     frictionless exploration brief while keeping replay integrity
 *     legible.
 *   - `authenticated_holder` covers a clinician acting on their own
 *     credentials (Clerk session + owned NPI binding).
 *   - `verifier_actor` covers an external party validating a
 *     credential (status check, JWKS fetch, OID4VP roundtrip).
 *   - `system_actor` covers cron jobs, scheduled re-verifications,
 *     and any non-human-driven write (e.g., revocation cascade
 *     from a state board signal).
 *
 * Truth contract:
 *   - The union is closed. New states require an explicit code change
 *     plus a lockdown-test update — never silently widened.
 *   - `narrowReplayActorState` returns null on unknown input rather
 *     than coercing to a default. Producers must always choose.
 *   - `isWriteAllowedForActor` encodes the write policy: only
 *     `authenticated_holder` and `system_actor` may produce durable
 *     writes. `anonymous_exploration` and `verifier_actor` are
 *     read-only by policy. Enforcement at the route boundary;
 *     this module is the typed source of truth.
 */

export const REPLAY_ACTOR_STATES = [
  'anonymous_exploration',
  'authenticated_holder',
  'verifier_actor',
  'system_actor',
] as const;

export type ReplayActorState = (typeof REPLAY_ACTOR_STATES)[number];

/**
 * Structural narrowing for an unknown value (e.g., from JSON parse,
 * env var, or upstream API response). Returns null when the input
 * is not a valid state — callers MUST handle this rather than
 * defaulting silently.
 */
export function narrowReplayActorState(value: unknown): ReplayActorState | null {
  if (typeof value !== 'string') return null;
  return (REPLAY_ACTOR_STATES as readonly string[]).includes(value)
    ? (value as ReplayActorState)
    : null;
}

/**
 * Write-policy gate. Encodes the doctrine that anonymous exploration
 * and verifier validation are read-only paths; durable writes
 * require an authenticated holder OR an explicit system actor.
 *
 * Route handlers consult this AT the auth boundary, alongside the
 * Clerk session.userId check. Returning true here is necessary but
 * not sufficient — the route must ALSO verify the actorState matches
 * what the request actually presented (e.g., a Clerk session is
 * required for `authenticated_holder`).
 */
export function isWriteAllowedForActor(state: ReplayActorState): boolean {
  switch (state) {
    case 'authenticated_holder':
    case 'system_actor':
      return true;
    case 'anonymous_exploration':
    case 'verifier_actor':
      return false;
  }
}

/**
 * Human-readable description per state. Used by surfaces that need
 * to render the attribution to a compliance officer or director
 * (see /truth-boundary, PR #325 doctrine).
 */
export const REPLAY_ACTOR_STATE_DESCRIPTION: Readonly<Record<ReplayActorState, string>> = Object.freeze({
  anonymous_exploration:
    'Anonymous exploration. No actor binding. Read-only public surfaces (readiness preview, NPI inspection).',
  authenticated_holder:
    'Authenticated clinician acting on their own credentials. Clerk session present; NPI ownership bound.',
  verifier_actor:
    'External verifier validating a credential. Read-only access to public verification surfaces (JWKS, status list, /api/receipts/verify).',
  system_actor:
    'System-driven write. Cron job, scheduled re-verification, or cascade from upstream source signal. No human actor.',
});
