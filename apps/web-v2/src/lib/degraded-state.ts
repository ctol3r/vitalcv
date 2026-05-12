/**
 * DegradedState — typed union for the 5 distinct UI failure modes.
 *
 * Today, surfaces conflate these states: an unreachable source, an
 * anonymous-user restriction, an infra outage, a clean result with
 * no adverse findings, and a missing issuer all render with similar
 * "Unknown" / "Not available" / "—" affordances. Users (clinicians +
 * compliance directors + verifiers) cannot tell WHAT failed, which
 * means they cannot tell WHO to escalate to.
 *
 * Doctrine:
 *   - The 5 states are MUTUALLY EXCLUSIVE. A surface MUST pick one.
 *   - `no_adverse_findings` is NOT a failure state — it's a clean
 *     positive result that's often visually confused with failure
 *     ("nothing to show" looks like "we couldn't check"). It's
 *     included in this union explicitly so renderers can mark it
 *     as a positive outcome, not an empty cell.
 *   - The other 4 are all degraded states but each has a different
 *     remediation path:
 *       * `source_unreachable`   → external dependency; retry later
 *       * `anonymous_restriction` → caller needs to sign in / get auth
 *       * `infra_outage`         → VitalCV internal; we own the fix
 *       * `issuer_unavailable`   → signing key not configured; ops issue
 *   - Each state has a distinct `actionableBy` field telling the user
 *     who can resolve it. This is what makes the typing valuable.
 *
 * Truth contract:
 *   - Closed union. New states require an explicit code change AND a
 *     lockdown-test update — never silently widened by a producer.
 *   - `narrowDegradedState` returns null on unknown input (no silent
 *     default). Producers must always choose.
 *   - `isPositive` distinguishes the clean-result state from the
 *     four real failures, so badge color/glyph encoding is correct.
 */

export const DEGRADED_STATES = [
  'source_unreachable',
  'anonymous_restriction',
  'infra_outage',
  'no_adverse_findings',
  'issuer_unavailable',
] as const;

export type DegradedState = (typeof DEGRADED_STATES)[number];

export type ActionableBy = 'caller' | 'source-operator' | 'vitalcv-ops' | 'no-action-needed';

export interface DegradedStateMetadata {
  /** Short human-readable label suitable for badge text. Compound forms only. */
  readonly label: string;
  /** One-sentence operational meaning. */
  readonly meaning: string;
  /** Who can resolve this state. */
  readonly actionableBy: ActionableBy;
  /**
   * Whether this state is a POSITIVE outcome (true) vs. a degraded
   * one (false). `no_adverse_findings` is the only positive entry.
   */
  readonly isPositive: boolean;
}

/**
 * Description map. Each entry is the authoritative explanation of a
 * single state — paired with the renderer in DegradedStateRow.tsx
 * and the legend on the TruthBoundary surface (PR #325).
 */
export const DEGRADED_STATE_METADATA: Readonly<
  Record<DegradedState, DegradedStateMetadata>
> = Object.freeze({
  source_unreachable: {
    label: 'Source unreachable',
    meaning:
      'The external source authority did not respond within the configured timeout. The check was attempted; the result is unknown until the source recovers.',
    actionableBy: 'source-operator',
    isPositive: false,
  },
  anonymous_restriction: {
    label: 'Sign-in required',
    meaning:
      'The caller is not authenticated. Some surfaces require a Clerk session for actor attribution before the check is permitted.',
    actionableBy: 'caller',
    isPositive: false,
  },
  infra_outage: {
    label: 'VitalCV infrastructure degraded',
    meaning:
      'A VitalCV-owned subsystem (backend, database, signing) is unavailable. The check was not attempted because we cannot honor the truth contract right now.',
    actionableBy: 'vitalcv-ops',
    isPositive: false,
  },
  no_adverse_findings: {
    label: 'No adverse findings',
    meaning:
      'The check completed successfully against the source authority and returned no flagging or concerning records. This is a POSITIVE result, not an empty one.',
    actionableBy: 'no-action-needed',
    isPositive: true,
  },
  issuer_unavailable: {
    label: 'Issuer unavailable',
    meaning:
      'VitalCV cannot sign credentials right now — signing key, kid, or issuer route is not configured. Existing credentials remain verifiable; new issuance is paused.',
    actionableBy: 'vitalcv-ops',
    isPositive: false,
  },
});

export function narrowDegradedState(value: unknown): DegradedState | null {
  if (typeof value !== 'string') return null;
  return (DEGRADED_STATES as readonly string[]).includes(value)
    ? (value as DegradedState)
    : null;
}

export function isPositiveDegradedState(state: DegradedState): boolean {
  return DEGRADED_STATE_METADATA[state].isPositive;
}

export function actionableBy(state: DegradedState): ActionableBy {
  return DEGRADED_STATE_METADATA[state].actionableBy;
}
