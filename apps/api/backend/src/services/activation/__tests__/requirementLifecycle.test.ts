import {
  canTransition,
  deriveActivationReadiness,
  isRequirementResolved,
  type ActivationRequirementStatus,
  type RequirementView,
} from '../requirementLifecycle';

function req(necessity: 'required' | 'preferred', status: ActivationRequirementStatus, id: string = status): RequirementView {
  return { id, necessity, status };
}

describe('isRequirementResolved', () => {
  it('treats only met / waived / not_applicable as resolved', () => {
    expect(isRequirementResolved('met')).toBe(true);
    expect(isRequirementResolved('waived')).toBe(true);
    expect(isRequirementResolved('not_applicable')).toBe(true);
    for (const s of ['not_started', 'requested', 'submitted', 'under_review', 'blocked', 'expired'] as const) {
      expect(isRequirementResolved(s)).toBe(false);
    }
  });
});

describe('canTransition — a requirement can only move along the machine', () => {
  it('permits sensible forward moves', () => {
    expect(canTransition('not_started', 'requested')).toBe(true);
    expect(canTransition('requested', 'submitted')).toBe(true);
    expect(canTransition('submitted', 'under_review')).toBe(true);
    expect(canTransition('under_review', 'met')).toBe(true);
    expect(canTransition('met', 'expired')).toBe(true);
    expect(canTransition('expired', 'requested')).toBe(true);
  });

  it('rejects a no-op and impossible jumps', () => {
    expect(canTransition('met', 'met')).toBe(false);
    expect(canTransition('not_started', 'met')).toBe(false); // must be submitted/reviewed first
    expect(canTransition('waived', 'requested')).toBe(false); // waived is terminal
    expect(canTransition('not_applicable', 'blocked')).toBe(false);
  });
});

describe('deriveActivationReadiness — the qualified-start predicate', () => {
  it('is start-ready only when every REQUIRED requirement is resolved', () => {
    const r = deriveActivationReadiness([
      req('required', 'met', 'a'),
      req('required', 'waived', 'b'),
      req('required', 'not_applicable', 'c'),
    ]);
    expect(r.startReady).toBe(true);
    expect(r.blocking).toHaveLength(0);
  });

  it('blocks on an unresolved required requirement and names it', () => {
    const r = deriveActivationReadiness([req('required', 'met', 'a'), req('required', 'submitted', 'b')]);
    expect(r.startReady).toBe(false);
    expect(r.blocking.map((x) => x.id)).toEqual(['b']);
  });

  it('never blocks on a preferred requirement, however unresolved', () => {
    const r = deriveActivationReadiness([req('required', 'met', 'a'), req('preferred', 'blocked', 'b')]);
    expect(r.startReady).toBe(true);
    expect(r.blocking).toHaveLength(0);
  });

  it('flags a hard blocker distinctly from ordinary open work (unknown is not a blocker)', () => {
    const open = deriveActivationReadiness([req('required', 'requested', 'a')]);
    expect(open.startReady).toBe(false);
    expect(open.hasHardBlocker).toBe(false); // requested = open work, not a blocker

    const blocked = deriveActivationReadiness([req('required', 'blocked', 'a')]);
    expect(blocked.hasHardBlocker).toBe(true);
  });

  it('is start-ready for an application with no requirements', () => {
    expect(deriveActivationReadiness([]).startReady).toBe(true);
  });
});
