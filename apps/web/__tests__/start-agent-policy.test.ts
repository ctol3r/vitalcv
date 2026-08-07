/**
 * Start Agent A0 — policy tests: ranking tiers, dependency holds, consent
 * semantics, idempotence, and honest suppression of completed/failed work.
 */
import { describe, expect, it } from 'vitest';
import { actionId, stableStringify } from '@/lib/agent/ids';
import { generateStartPlan, START_POLICY_VERSION } from '@/lib/agent/policy/start-policy-v1';
import type { SourceObservationState, StartAgentContext } from '@/lib/agent/types';

const NOW = '2026-08-07T00:00:00.000Z';

function lane(laneId: string, status: SourceObservationState['status']): SourceObservationState {
  return {
    laneId,
    authority: `${laneId} authority`,
    status,
    observedAt: NOW,
    evidenceRefs: [{ kind: 'source_observation', ref: `coverage:${laneId}`, provenance: 'public_source' }],
  };
}

function ctx(overrides: Partial<StartAgentContext> = {}): StartAgentContext {
  return {
    subject: { profileRef: 'subject-1', npi: '1234567893' },
    identity: { status: 'resolved', evidenceRefs: [{ kind: 'source_observation', ref: 'nppes:r', provenance: 'public_source' }] },
    profile: { status: 'saved', missingRequiredFields: [], corrections: [], evidenceRefs: [] },
    ownership: {
      status: 'verified',
      evidenceRefs: [{ kind: 'ownership_record', ref: 'ownership:1', provenance: 'ownership_verified' }],
    },
    observations: [lane('nppes_identity', 'current')],
    readiness: { status: 'unknown', determinedBy: 'unavailable', evidenceRefs: [] },
    opportunities: { status: 'unknown', matches: [] },
    consents: [],
    actionHistory: [],
    collectedAt: NOW,
    contextClass: 'test',
    ...overrides,
  };
}

describe('generateStartPlan', () => {
  it('is idempotent: identical context and clock produce byte-identical plans', () => {
    const context = ctx({ ownership: { status: 'none', evidenceRefs: [] } });
    const a = generateStartPlan(context, { now: NOW });
    const b = generateStartPlan(context, { now: NOW });
    expect(stableStringify(a)).toBe(stableStringify(b));
    expect(a.planId).toBe(b.planId);
  });

  it('stamps policy and toolset versions', () => {
    const plan = generateStartPlan(ctx(), { now: NOW });
    expect(plan.policyVersion).toBe(START_POLICY_VERSION);
    expect(plan.toolsetVersion).toBe('start-toolset-v1');
  });

  it('ranks VitalCV-doable work above clinician asks when nothing blocks an application', () => {
    const plan = generateStartPlan(
      ctx({
        ownership: { status: 'none', evidenceRefs: [] },
        profile: {
          status: 'partial',
          missingRequiredFields: [{ field: 'contact_email', requiredFor: [] }],
          corrections: [],
          evidenceRefs: [],
        },
        observations: [lane('nppes_identity', 'current'), lane('state_license:VA', 'stale')],
      }),
      { now: NOW },
    );
    const rankedTypes = plan.rankedActionIds.map(
      (id) => plan.actions.find((a) => a.id === id)!.type,
    );
    expect(rankedTypes[0]).toBe('refresh_source_observation'); // tier 2
    expect(rankedTypes.indexOf('verify_ownership')).toBeLessThan(
      rankedTypes.indexOf('collect_profile_field'),
    ); // tier 4 before tier 6
  });

  it('puts application-blocking work first even when it is human-only', () => {
    const plan = generateStartPlan(
      ctx({
        role: { roleRef: 'r1', employerRef: 'e1', applicationState: 'submitted', requirements: [] },
        employerReview: { status: 'shared', evidenceRefs: [] },
        observations: [lane('nppes_identity', 'current'), lane('state_license:VA', 'stale')],
      }),
      { now: NOW },
    );
    const top = plan.actions.find((a) => a.id === plan.rankedActionIds[0])!;
    expect(top.type).toBe('await_employer_decision');
    expect(top.permission).toBe('human_only');
    expect(top.owner).toBe('employer');
  });

  it('holds consent-gated prepared work behind the dependency chain and never assumes consent', () => {
    const plan = generateStartPlan(
      ctx({
        ownership: { status: 'pending', evidenceRefs: [{ kind: 'ownership_record', ref: 'ownership:1', provenance: 'platform_record' }] },
        role: { roleRef: 'r1', employerRef: 'e1', applicationState: 'in_progress', requirements: [] },
        consents: [{ scope: 'share_packet:e1', granted: false, evidenceRefs: [] }],
      }),
      { now: NOW },
    );
    const prep = plan.actions.find((a) => a.type === 'prepare_share_packet')!;
    expect(prep.status).toBe('blocked_on_dependency');
    expect(prep.consentScope).toBe('share_packet:e1');
    expect(plan.rankedActionIds).not.toContain(prep.id);
    const consentBlocker = plan.blockers.find((b) => b.type === 'clinician_consent_required')!;
    expect(consentBlocker.dependsOnBlockerIds.length).toBeGreaterThan(0);
  });

  it('keeps consent-gated work presentable as awaiting_consent once ownership is settled', () => {
    const plan = generateStartPlan(
      ctx({
        role: { roleRef: 'r1', employerRef: 'e1', applicationState: 'in_progress', requirements: [] },
        consents: [{ scope: 'share_packet:e1', granted: false, evidenceRefs: [] }],
      }),
      { now: NOW },
    );
    const prep = plan.actions.find((a) => a.type === 'prepare_share_packet')!;
    expect(prep.status).toBe('awaiting_consent');
    expect(plan.rankedActionIds).toContain(prep.id);
  });

  it('never re-recommends completed work and pauses repeated failures', () => {
    const refreshId = actionId('refresh_source_observation', 'lane:state_license:VA');
    const completed = generateStartPlan(
      ctx({
        observations: [lane('nppes_identity', 'current'), lane('state_license:VA', 'stale')],
        actionHistory: [{ actionId: refreshId, type: 'refresh_source_observation', outcome: 'completed', at: NOW }],
      }),
      { now: NOW },
    );
    expect(completed.rankedActionIds).not.toContain(refreshId);
    expect(completed.actions.find((a) => a.id === refreshId)!.status).toBe('completed');

    const failing = generateStartPlan(
      ctx({
        observations: [lane('nppes_identity', 'current'), lane('state_license:VA', 'stale')],
        actionHistory: [
          { actionId: refreshId, type: 'refresh_source_observation', outcome: 'failed', at: NOW, failureCount: 3 },
        ],
      }),
      { now: NOW },
    );
    expect(failing.rankedActionIds).not.toContain(refreshId);
    expect(failing.blockers.some((b) => b.type === 'repeated_action_failure')).toBe(true);
    const review = failing.actions.find((a) => a.type === 'review_repeated_failure')!;
    expect(failing.rankedActionIds).toContain(review.id);
  });

  it('answers every blocker question structurally', () => {
    const plan = generateStartPlan(
      ctx({
        ownership: { status: 'none', evidenceRefs: [] },
        observations: [lane('nppes_identity', 'current'), lane('state_license:VA', 'unavailable')],
      }),
      { now: NOW },
    );
    for (const blocker of plan.blockers) {
      expect(blocker.what.length).toBeGreaterThan(0); // 1. what
      expect(blocker.whyItMatters.length).toBeGreaterThan(0); // 2. why
      expect(blocker.controlledBy.length).toBeGreaterThan(0); // 3. who controls
      expect(blocker.evidenceRefs.length).toBeGreaterThan(0); // 4. evidence
      expect(blocker.resolvableByActionIds.length).toBeGreaterThan(0); // 5. removable by
      expect(typeof blocker.vitalcvCanActNow).toBe('boolean'); // 6. can VitalCV act now
    }
    const unavailable = plan.blockers.find((b) => b.type === 'source_unavailable')!;
    expect(unavailable.vitalcvCanActNow).toBe(false);
    expect(unavailable.controlledBy).toBe('source');
  });
});
