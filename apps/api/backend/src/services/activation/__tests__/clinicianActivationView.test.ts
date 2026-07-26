import {
  deriveClinicianActivationView,
  type ActivationRequirementRow,
} from '../clinicianActivationView';

const row = (over: Partial<ActivationRequirementRow>): ActivationRequirementRow => ({
  id: over.id ?? 'r1',
  label: over.label ?? 'Requirement',
  category: over.category ?? 'evidence',
  necessity: over.necessity ?? 'required',
  status: over.status ?? 'not_started',
  owner: over.owner ?? 'clinician',
  dueAt: over.dueAt ?? null,
  resolvedAt: over.resolvedAt ?? null,
});

describe('deriveClinicianActivationView — the honesty gate', () => {
  it('an EMPTY ledger is not_started, never a vacuous requirements_met', () => {
    const v = deriveClinicianActivationView('app-1', [], 'not_ready');
    // deriveActivationReadiness([]) is vacuously startReady:true — this must NOT
    // surface as "ready". A clinician with no requirements has not-started.
    expect(v.phase).toBe('not_started');
    expect(v.summary.requiredMet).toBe(false);
    expect(v.summary.total).toBe(0);
    expect(v.requirements).toHaveLength(0);
  });

  it('is requirements_met only when requirements exist AND every required one is resolved', () => {
    const v = deriveClinicianActivationView(
      'app-1',
      [row({ id: 'a', status: 'met' }), row({ id: 'b', status: 'waived' })],
      'not_ready',
    );
    expect(v.phase).toBe('requirements_met');
    expect(v.summary.requiredMet).toBe(true);
    expect(v.summary.requiredOpen).toBe(0);
  });

  it('a preferred requirement never blocks the met state', () => {
    const v = deriveClinicianActivationView(
      'app-1',
      [row({ id: 'a', status: 'met' }), row({ id: 'b', necessity: 'preferred', status: 'not_started' })],
      'not_ready',
    );
    expect(v.phase).toBe('requirements_met');
    expect(v.requirements.find((r) => r.id === 'b')?.isBlocking).toBe(false);
  });

  it('an open required item is in_progress and is marked blocking', () => {
    const v = deriveClinicianActivationView(
      'app-1',
      [row({ id: 'a', status: 'met' }), row({ id: 'b', status: 'submitted' })],
      'not_ready',
    );
    expect(v.phase).toBe('in_progress');
    expect(v.summary.requiredOpen).toBe(1);
    expect(v.requirements.find((r) => r.id === 'b')?.isBlocking).toBe(true);
  });

  it('a required blocked item is a hard blocker', () => {
    const v = deriveClinicianActivationView('app-1', [row({ id: 'a', status: 'blocked' })], 'not_ready');
    expect(v.phase).toBe('in_progress');
    expect(v.summary.hasHardBlocker).toBe(true);
  });

  it('carries the recorded start state through untouched', () => {
    expect(deriveClinicianActivationView('a', [row({ status: 'met' })], 'started').startState).toBe('started');
  });
});
