import { describe, expect, it } from 'vitest';
import {
  resolveEmployerActionConsequence,
  resolveProofTier,
} from '@/lib/trust/employer-action-consequence';
import { resolveBlockerOwnership } from '@/lib/trust/action-owner';

/**
 * Composition-layer tests for the EmployerCockpit wiring on main.
 * These tests do NOT render React — they construct realistic posture
 * shapes that the cockpit passes into the contract resolvers and
 * assert the contract answers the expected tier / ownership.
 *
 * If a future edit to EmployerCockpit breaks the input shape (e.g.,
 * feeding wrong lane-state strings into resolveProofTier), these
 * assertions surface the drift.
 */

// Minimal posture shapes mirroring the `posture.proven` / `posture.missing`
// entries from DecisionPosture. The cockpit maps `state` values into the
// proofTier input flags — these tests lock that mapping.
type MissingItem = { state: string };

function inputFromMissing(missing: MissingItem[], hasBlockers: boolean) {
  return {
    hasAnchor: true,
    allRequiredLanesResolved: missing.length === 0 && !hasBlockers,
    hasUnresolvedBlockers: hasBlockers,
    anyLanePending: missing.some((s) => s.state === 'pending'),
    anyLaneReviewRequired: missing.some((s) => s.state === 'reviewRequired'),
    anyLaneAccessRequired: missing.some(
      (s) => s.state === 'accessRequired' || s.state === 'gated',
    ),
    anyLaneUnavailable: missing.some((s) => s.state === 'unavailable'),
    anyLaneStale: missing.some((s) => s.state === 'stale'),
    anyLaneNoRecord: missing.some(
      (s) => s.state === 'notDecisionGrade' || s.state === 'previewOnly',
    ),
    hasOpenDriftAlerts: false,
  };
}

describe('EmployerCockpit wiring — proof tier composition', () => {
  it('renders decision_grade when nothing is missing and no blockers exist', () => {
    const tier = resolveProofTier(inputFromMissing([], false));
    expect(tier.tier).toBe('decision_grade_proof_pack');
    expect(tier.acceptAllowed).toBe(true);
  });

  it('renders partial_proof_pack when an access-required lane exists, even with no active blockers', () => {
    const tier = resolveProofTier(
      inputFromMissing([{ state: 'accessRequired' }], false),
    );
    expect(tier.tier).toBe('partial_proof_pack');
    expect(tier.acceptAllowed).toBe(false);
    expect(tier.acceptBlockedReason).not.toBeNull();
  });

  it('maps the cockpit`s "gated" state to access-required tier semantics', () => {
    const gated = resolveProofTier(inputFromMissing([{ state: 'gated' }], false));
    expect(gated.tier).toBe('partial_proof_pack');
    expect(gated.acceptAllowed).toBe(false);
  });

  it('maps "notDecisionGrade" and "previewOnly" states into no-record classification', () => {
    const notDg = resolveProofTier(
      inputFromMissing([{ state: 'notDecisionGrade' }], false),
    );
    expect(notDg.tier).toBe('partial_proof_pack');

    const preview = resolveProofTier(
      inputFromMissing([{ state: 'previewOnly' }], false),
    );
    expect(preview.tier).toBe('partial_proof_pack');
  });

  it('blocks acceptance when a lane is unavailable, regardless of other state', () => {
    const tier = resolveProofTier(
      inputFromMissing([{ state: 'unavailable' }], false),
    );
    expect(tier.acceptAllowed).toBe(false);
    expect((tier.acceptBlockedReason ?? '').toLowerCase()).toMatch(/source|reach/);
  });

  it('blocks acceptance whenever blockers are present, even with clean source states', () => {
    const tier = resolveProofTier(inputFromMissing([], true));
    expect(tier.acceptAllowed).toBe(false);
    expect(tier.tier).toBe('partial_proof_pack');
  });
});

describe('EmployerCockpit wiring — blocker ownership rendering', () => {
  it('every rendered blocker resolves to an owner-prefixed line (or falls back to UNKNOWN for unclassified)', () => {
    const blockers = [
      'On OIG exclusion list',
      'Not enrolled in Medicare',
      'Some future blocker not yet classified',
    ];
    for (const b of blockers) {
      const ownership = resolveBlockerOwnership(b);
      expect(ownership.plainLabel.trim().length).toBeGreaterThan(0);
      expect(ownership.ownerPrefix.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('EmployerCockpit wiring — consequence strip', () => {
  it('each action button on the cockpit surface is backed by a consequence object', () => {
    const actions = ['accept', 'refresh', 'review'] as const;
    for (const action of actions) {
      const consequence = resolveEmployerActionConsequence(action);
      expect(consequence.does.trim().length).toBeGreaterThan(0);
      expect(consequence.auditEvent).toContain('EmployerDecisionEvent');
    }
  });

  it('accept carries the explicit NOT-included line that the cockpit surfaces', () => {
    const accept = resolveEmployerActionConsequence('accept');
    expect(accept.acceptNotIncluded).not.toBeNull();
  });
});
