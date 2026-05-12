/**
 * STRUCTURED-CORS-REJECTION + REPLAY-ACTOR-STATE lockdown.
 *
 * Pins two truth-contract changes:
 *
 * 1. CORS rejection body — middleware.ts now emits structured JSON
 *    with `error`, `reason`, `retryable` fields so the client can
 *    distinguish CORS rejection from auth/source/rate-limit failures.
 *
 * 2. ReplayActorState — typed union of 4 states with:
 *    - narrowReplayActorState(unknown) → state | null (no silent default)
 *    - isWriteAllowedForActor — encodes the write-policy gate
 *    - Description map for human-readable surfacing
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  REPLAY_ACTOR_STATES,
  REPLAY_ACTOR_STATE_DESCRIPTION,
  isWriteAllowedForActor,
  narrowReplayActorState,
  type ReplayActorState,
} from '../lib/trust/replay-actor-state';

// ─────── Structured CORS rejection ────────────────────────────────

describe('STRUCTURED-CORS-REJECTION — middleware emits structured JSON', () => {
  const MIDDLEWARE = readFileSync(resolve(__dirname, '../middleware.ts'), 'utf8');

  it('CORS rejection branch emits a JSON body (not empty)', () => {
    expect(MIDDLEWARE).toContain('JSON.stringify({');
    expect(MIDDLEWARE).toContain("error: 'origin_blocked'");
  });

  it('rejection body includes reason field with discriminator value', () => {
    expect(MIDDLEWARE).toContain("reason: reasonByCheck[cors.reason]");
  });

  it('rejection body includes retryable: false (allowlist drift is config, not transient)', () => {
    expect(MIDDLEWARE).toContain('retryable: false');
  });

  it('rejection sets content-type: application/json (so clients parse correctly)', () => {
    expect(MIDDLEWARE).toContain("'content-type': 'application/json'");
  });

  it('preserves x-cors-blocked: 1 header for cheap header-only diagnostics', () => {
    expect(MIDDLEWARE).toContain("'x-cors-blocked': '1'");
  });

  it('three reason values map to three discriminators', () => {
    expect(MIDDLEWARE).toContain('no_origin_header');
    expect(MIDDLEWARE).toContain('allowlist_not_configured');
    expect(MIDDLEWARE).toContain('origin_not_allowlisted');
  });

  it('HTTP status remains 403', () => {
    // The 403 in the CORS branch — there are other 403s elsewhere in
    // middleware; pin specifically that this branch returns 403.
    expect(MIDDLEWARE).toMatch(/JSON\.stringify\(\{[\s\S]*?error: 'origin_blocked'[\s\S]*?\}\)[\s\S]*?status:\s*403/);
  });
});

// ─────── ReplayActorState ─────────────────────────────────────────

describe('REPLAY-ACTOR-STATE — union shape', () => {
  it('exports exactly 4 states', () => {
    expect(REPLAY_ACTOR_STATES).toHaveLength(4);
  });

  it('contains all 4 documented states in canonical order', () => {
    expect([...REPLAY_ACTOR_STATES]).toEqual([
      'anonymous_exploration',
      'authenticated_holder',
      'verifier_actor',
      'system_actor',
    ]);
  });

  it('union has a description for every state', () => {
    for (const state of REPLAY_ACTOR_STATES) {
      expect(REPLAY_ACTOR_STATE_DESCRIPTION[state]).toBeDefined();
      expect(REPLAY_ACTOR_STATE_DESCRIPTION[state].length).toBeGreaterThan(0);
    }
  });

  it('descriptions explicitly mark anonymous_exploration as a first-class state', () => {
    expect(REPLAY_ACTOR_STATE_DESCRIPTION.anonymous_exploration.toLowerCase()).toContain(
      'no actor binding',
    );
  });

  it('description for authenticated_holder references Clerk session + NPI', () => {
    const d = REPLAY_ACTOR_STATE_DESCRIPTION.authenticated_holder;
    expect(d).toContain('Clerk');
    expect(d).toContain('NPI');
  });
});

describe('REPLAY-ACTOR-STATE — narrowReplayActorState', () => {
  it('returns the state for every valid string', () => {
    for (const state of REPLAY_ACTOR_STATES) {
      expect(narrowReplayActorState(state)).toBe(state);
    }
  });

  it('returns null for unknown string (no silent default)', () => {
    expect(narrowReplayActorState('rogue_state')).toBeNull();
    expect(narrowReplayActorState('')).toBeNull();
    expect(narrowReplayActorState('AUTHENTICATED_HOLDER')).toBeNull(); // case-sensitive
  });

  it('returns null for non-string input', () => {
    expect(narrowReplayActorState(null)).toBeNull();
    expect(narrowReplayActorState(undefined)).toBeNull();
    expect(narrowReplayActorState(123)).toBeNull();
    expect(narrowReplayActorState({})).toBeNull();
    expect(narrowReplayActorState([])).toBeNull();
  });
});

describe('REPLAY-ACTOR-STATE — isWriteAllowedForActor write-policy gate', () => {
  it('authenticated_holder: writes allowed', () => {
    expect(isWriteAllowedForActor('authenticated_holder')).toBe(true);
  });

  it('system_actor: writes allowed', () => {
    expect(isWriteAllowedForActor('system_actor')).toBe(true);
  });

  it('anonymous_exploration: writes BLOCKED (read-only public surface)', () => {
    expect(isWriteAllowedForActor('anonymous_exploration')).toBe(false);
  });

  it('verifier_actor: writes BLOCKED (read-only verification path)', () => {
    expect(isWriteAllowedForActor('verifier_actor')).toBe(false);
  });
});

describe('REPLAY-ACTOR-STATE — typed union is exhaustive', () => {
  it('switch over ReplayActorState is structurally exhaustive', () => {
    // Compile-time test: this would fail TypeScript narrowing if a
    // state were added without updating isWriteAllowedForActor's
    // switch. We assert at runtime by exercising every state.
    const seen = new Set<ReplayActorState>();
    for (const state of REPLAY_ACTOR_STATES) {
      const ok = isWriteAllowedForActor(state);
      expect(typeof ok).toBe('boolean');
      seen.add(state);
    }
    expect(seen.size).toBe(REPLAY_ACTOR_STATES.length);
  });

  it('description map is frozen (prevents downstream mutation)', () => {
    expect(Object.isFrozen(REPLAY_ACTOR_STATE_DESCRIPTION)).toBe(true);
  });
});

describe('REPLAY-ACTOR-STATE + STRUCTURED-CORS — banned strings', () => {
  const REPLAY_SRC = readFileSync(
    resolve(__dirname, '../lib/trust/replay-actor-state.ts'),
    'utf8',
  );
  const MIDDLEWARE = readFileSync(resolve(__dirname, '../middleware.ts'), 'utf8');
  const BANNED = [
    ['automatically', 'verified'].join(' '),
    ['guaranteed', 'verification'].join(' '),
    ['HIPAA', 'compliant'].join(' '),
    ['SOC2', 'certified'].join(' '),
    ['certified', 'compliant'].join(' '),
  ];
  for (const phrase of BANNED) {
    it(`replay-actor-state.ts does not contain banned phrase: ${phrase}`, () => {
      expect(REPLAY_SRC).not.toContain(phrase);
    });
    it(`middleware.ts CORS branch does not contain banned phrase: ${phrase}`, () => {
      expect(MIDDLEWARE).not.toContain(phrase);
    });
  }
});
