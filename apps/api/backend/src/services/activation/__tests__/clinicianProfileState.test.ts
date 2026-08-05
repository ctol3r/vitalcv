/**
 * The activation state model — Wave 1076 B1.
 *
 * These exist because every state in this model is one the product could claim
 * falsely. "Resolved" could be read as proof of ownership; a save could be read
 * as verification; an employer opening a profile could be read as approval.
 * Each test below is one of those lies, refused.
 */



import {
  TRUTH_CLASSES,
  TRUTH_CLASS_LABEL,
  activationState,
  isActivationComplete,
  permissions,
  shouldEmitActivation,
  stateDisclosure,
  type ActivationRecord,
} from '../clinicianProfileState';

const T = new Date('2026-08-05T00:00:00Z');
const rec = (over: Partial<ActivationRecord> = {}): ActivationRecord => ({
  reviewedAt: null, sharingConfirmedAt: null, savedAt: null, activatedAt: null, ...over,
});

describe('15–18 · activation requires all three conditions, exactly once', () => {
  it('15. a raw save without review does not activate', () => {
    const r = rec({ savedAt: T, sharingConfirmedAt: T });
    expect(isActivationComplete(r)).toBe(false);
    expect(shouldEmitActivation(r)).toBe(false);
  });

  it('16. review plus save without sharing-control confirmation does not activate', () => {
    const r = rec({ reviewedAt: T, savedAt: T });
    expect(isActivationComplete(r)).toBe(false);
    expect(shouldEmitActivation(r)).toBe(false);
  });

  it('a review alone does not activate', () => {
    expect(shouldEmitActivation(rec({ reviewedAt: T }))).toBe(false);
  });

  it('17. activation emits when all three become true', () => {
    const r = rec({ reviewedAt: T, sharingConfirmedAt: T, savedAt: T });
    expect(isActivationComplete(r)).toBe(true);
    expect(shouldEmitActivation(r)).toBe(true);
  });

  it('18. repeated saves do not duplicate the event', () => {
    const alreadyEmitted = rec({
      reviewedAt: T, sharingConfirmedAt: T, savedAt: T, activatedAt: T,
    });
    expect(isActivationComplete(alreadyEmitted)).toBe(true);
    // must not emit a second time
    expect(shouldEmitActivation(alreadyEmitted)).toBe(false);

    // A later save re-stamps savedAt but must not re-emit.
    const savedAgain = { ...alreadyEmitted, savedAt: new Date('2026-09-01T00:00:00Z') };
    expect(shouldEmitActivation(savedAgain)).toBe(false);
  });
});

describe('20–21 · resolution is not ownership, and ownership is not required to activate', () => {
  it('20. a resolved profile is not ownership-verified', () => {
    expect(activationState(rec())).toBe('resolved');
    expect(permissions('resolved').privateCredentialHoldings).toBe(false);
    expect(stateDisclosure('resolved')).toMatch(/does not confirm it is yours/i);
  });

  it('21. a saved profile is reachable without ownership verification', () => {
    const saved = rec({ reviewedAt: T, sharingConfirmedAt: T, savedAt: T });
    const state = activationState(saved, { ownershipVerified: false });
    expect(state).toBe('profile_saved');
    const p = permissions(state);
    expect(p.reusableProfile).toBe(true);
    expect(p.opportunityDiscovery).toBe(true);
    expect(p.selfAttestedSharing).toBe(true);
  });

  it('22. a saved profile does NOT unlock private credential holdings', () => {
    const saved = rec({ reviewedAt: T, sharingConfirmedAt: T, savedAt: T });
    expect(permissions(activationState(saved)).privateCredentialHoldings).toBe(false);
  });

  it('only ownership unlocks private holdings', () => {
    const saved = rec({ reviewedAt: T, sharingConfirmedAt: T, savedAt: T });
    const owned = activationState(saved, { ownershipVerified: true });
    expect(owned).toBe('ownership_verified');
    expect(permissions(owned).privateCredentialHoldings).toBe(true);
  });
});

describe('26 · downstream states are never inferred', () => {
  const complete = rec({ reviewedAt: T, sharingConfirmedAt: T, savedAt: T });

  it('26. employer review does not produce ready-to-start', () => {
    const reviewed = activationState(complete, { employerReviewed: true });
    expect(reviewed).toBe('employer_reviewed');
    expect(reviewed).not.toBe('ready_to_start');
    expect(stateDisclosure('employer_reviewed')).toMatch(/not approval|not.*hiring/i);
  });

  it('ownership verification does not produce ready-to-start', () => {
    expect(activationState(complete, { ownershipVerified: true })).not.toBe('ready_to_start');
  });

  it('a complete profile does not produce ready-to-start', () => {
    expect(activationState(complete)).not.toBe('ready_to_start');
  });

  it('ready-to-start is only ever asserted explicitly', () => {
    expect(activationState(complete, { readyToStart: true })).toBe('ready_to_start');
  });

  it('ownership verification never claims credential verification', () => {
    expect(stateDisclosure('ownership_verified')).toMatch(/does not verify any individual credential/i);
  });

  it('a saved profile never claims independent checking', () => {
    expect(stateDisclosure('profile_saved')).toMatch(/not independently checked/i);
  });
});

describe('truth classes stay four, and stay distinct', () => {
  it('19. public-source and clinician-provided are different classes', () => {
    expect(TRUTH_CLASSES).toContain('public_source');
    expect(TRUTH_CLASSES).toContain('clinician_provided');
    expect(TRUTH_CLASS_LABEL.public_source).not.toBe(TRUTH_CLASS_LABEL.clinician_provided);
  });

  it('no class is labelled with a bare "verified"', () => {
    for (const c of TRUTH_CLASSES) {
      const label = TRUTH_CLASS_LABEL[c];
      expect({ c, bare: label.trim().toLowerCase() === 'verified' }).toEqual({ c, bare: false });
    }
  });

  it('every class has its own distinct label — none collapse', () => {
    const labels = TRUTH_CLASSES.map((c) => TRUTH_CLASS_LABEL[c]);
    expect(new Set(labels).size).toBe(TRUTH_CLASSES.length);
  });

  it('clinician-provided never reads as independently checked', () => {
    expect(TRUTH_CLASS_LABEL.clinician_provided.toLowerCase()).not.toMatch(/verif|confirm|check/);
  });
});
