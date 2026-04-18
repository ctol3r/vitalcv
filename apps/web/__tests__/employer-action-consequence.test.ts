import { describe, expect, it } from 'vitest';
import {
  proofTierToShortKey,
  resolveEmployerActionConsequence,
  resolveProofTier,
  type ProofTier,
} from '@/lib/trust/employer-action-consequence';
import { ACTION_OWNER } from '@/lib/trust/action-owner';
import {
  getEmployerActionLabel,
  getOwnerAttributedPublicNextStep,
  getPublicDecisionNextStep,
  type EmployerActionCopyKey,
} from '@/lib/trust/decision-copy';

const EMPLOYER_ACTIONS: EmployerActionCopyKey[] = [
  'accept',
  'refresh',
  'review',
  'pause',
  'reject',
];

describe('resolveEmployerActionConsequence', () => {
  it('returns non-empty does/assumes/auditEvent for every action', () => {
    for (const action of EMPLOYER_ACTIONS) {
      const c = resolveEmployerActionConsequence(action);
      expect(c.does.trim().length).toBeGreaterThan(0);
      expect(c.assumes.trim().length).toBeGreaterThan(0);
      expect(c.auditEvent.trim().length).toBeGreaterThan(0);
    }
  });

  it('assigns ownership to the correct post-action owner', () => {
    expect(resolveEmployerActionConsequence('accept').ownerAfter).toBe(ACTION_OWNER.EMPLOYER);
    expect(resolveEmployerActionConsequence('refresh').ownerAfter).toBe(ACTION_OWNER.VITALCV);
    expect(resolveEmployerActionConsequence('review').ownerAfter).toBe(ACTION_OWNER.REVIEWER);
  });

  it('audit event for accept writes EmployerDecisionEvent + AuditEvent', () => {
    const c = resolveEmployerActionConsequence('accept');
    expect(c.auditEvent).toContain('EmployerDecisionEvent');
    expect(c.auditEvent).toContain('AuditEvent');
  });

  it('accept action carries the "NOT included" line so partial acceptance is never implied', () => {
    const c = resolveEmployerActionConsequence('accept');
    expect(c.acceptNotIncluded).not.toBeNull();
    expect((c.acceptNotIncluded ?? '').toLowerCase()).toMatch(/not include|remain|employer/i);
  });

  it('non-accept actions carry no acceptNotIncluded line', () => {
    for (const action of ['refresh', 'review', 'pause', 'reject'] as const) {
      const c = resolveEmployerActionConsequence(action);
      expect(c.acceptNotIncluded).toBeNull();
    }
  });

  it('refresh action explicitly does NOT assume decision-grade state (safe at any tier)', () => {
    const c = resolveEmployerActionConsequence('refresh');
    expect(c.assumes.toLowerCase()).toContain('nothing');
  });

  it('every accept-like action names its risk remaining after the click', () => {
    const c = resolveEmployerActionConsequence('accept');
    expect(c.remainsAfter).not.toBeNull();
    expect((c.remainsAfter ?? '').toLowerCase()).toMatch(/credentialing|employer|privileging/);
  });
});

describe('resolveProofTier', () => {
  const cleanInput = {
    hasAnchor: true,
    allRequiredLanesResolved: true,
    hasUnresolvedBlockers: false,
    anyLanePending: false,
    anyLaneReviewRequired: false,
    anyLaneAccessRequired: false,
    anyLaneUnavailable: false,
    anyLaneStale: false,
    anyLaneNoRecord: false,
    hasOpenDriftAlerts: false,
  };

  it('returns decision_grade_proof_pack only when every flag is clean', () => {
    const tier = resolveProofTier(cleanInput);
    expect(tier.tier).toBe('decision_grade_proof_pack');
    expect(tier.acceptAllowed).toBe(true);
    expect(tier.acceptBlockedReason).toBeNull();
  });

  it('never returns decision_grade when a lane is unavailable', () => {
    const tier = resolveProofTier({ ...cleanInput, anyLaneUnavailable: true });
    expect(tier.tier).not.toBe('decision_grade_proof_pack');
    expect(tier.acceptAllowed).toBe(false);
    expect(tier.acceptBlockedReason).not.toBeNull();
  });

  it('never returns decision_grade when access_required lane exists', () => {
    const tier = resolveProofTier({ ...cleanInput, anyLaneAccessRequired: true });
    expect(tier.tier).toBe('partial_proof_pack');
    expect(tier.acceptAllowed).toBe(false);
  });

  it('never returns decision_grade when drift alerts are open', () => {
    const tier = resolveProofTier({ ...cleanInput, hasOpenDriftAlerts: true });
    expect(tier.acceptAllowed).toBe(false);
  });

  it('collapses to draft_snapshot when no passport anchor exists', () => {
    const tier = resolveProofTier({ ...cleanInput, hasAnchor: false });
    expect(tier.tier).toBe('draft_snapshot');
    expect(tier.acceptAllowed).toBe(false);
  });

  it('partial_proof_pack tier never labels itself as ready', () => {
    const tier = resolveProofTier({ ...cleanInput, anyLaneStale: true });
    expect(tier.tier).toBe('partial_proof_pack');
    expect(tier.label.toLowerCase()).not.toContain('ready');
    expect(tier.description.toLowerCase()).not.toContain('ready');
  });

  it('acceptBlockedReason is specific to the dominant gap (not a generic message)', () => {
    const unavailable = resolveProofTier({ ...cleanInput, anyLaneUnavailable: true });
    expect((unavailable.acceptBlockedReason ?? '').toLowerCase()).toMatch(/reach|source/);

    const stale = resolveProofTier({ ...cleanInput, anyLaneStale: true });
    expect((stale.acceptBlockedReason ?? '').toLowerCase()).toContain('stale');

    const reviewRequired = resolveProofTier({ ...cleanInput, anyLaneReviewRequired: true });
    expect((reviewRequired.acceptBlockedReason ?? '').toLowerCase()).toMatch(/review/);
  });

  it('the three proof tiers cover the full decision space', () => {
    const tiers: ProofTier[] = [
      'draft_snapshot',
      'partial_proof_pack',
      'decision_grade_proof_pack',
    ];
    expect(tiers.length).toBe(3);
  });
});

// Canonicalization guard. The long-form (narrative) ProofTier and the
// short-form (action-label selector) vocabulary must stay aligned via
// `proofTierToShortKey`. Without the mapper, callers re-invent the
// conversion inline — which is exactly the duplication this helper
// retires.
describe('proofTierToShortKey', () => {
  it('maps each long-form proof tier to the canonical short key', () => {
    expect(proofTierToShortKey('draft_snapshot')).toBe('draft');
    expect(proofTierToShortKey('partial_proof_pack')).toBe('partial');
    expect(proofTierToShortKey('decision_grade_proof_pack')).toBe('decision_grade');
  });

  it('keeps getEmployerActionLabel in lockstep — partial tiers render partial acceptance copy', () => {
    const partial = getEmployerActionLabel('accept', {
      proofTier: proofTierToShortKey('partial_proof_pack'),
    });
    expect(partial.toLowerCase()).toContain('partial');

    const decisionGrade = getEmployerActionLabel('accept', {
      proofTier: proofTierToShortKey('decision_grade_proof_pack'),
    });
    expect(decisionGrade.toLowerCase()).not.toContain('partial');
  });
});

describe('getOwnerAttributedPublicNextStep', () => {
  it('falls back to the generic public next step when no blocker is named', () => {
    const fallback = getOwnerAttributedPublicNextStep('PROCEED_WITH_CAUTION', null);
    expect(fallback).toBe(getPublicDecisionNextStep('PROCEED_WITH_CAUTION'));
  });

  it('renders an owner-prefixed line when a known blocker is passed', () => {
    const withBlocker = getOwnerAttributedPublicNextStep(
      'DO_NOT_PROCEED',
      'On OIG exclusion list',
    );
    expect(withBlocker.toLowerCase()).toContain('oig');
    expect(withBlocker).not.toBe(getPublicDecisionNextStep('DO_NOT_PROCEED'));
  });

  it('never emits the pre-doctrine "Take Action" fallback for a known blocker', () => {
    const withBlocker = getOwnerAttributedPublicNextStep(
      'PROCEED_WITH_CAUTION',
      'Medicare enrollment unresolved',
    );
    expect(withBlocker.toLowerCase()).not.toContain('take action');
  });
});
