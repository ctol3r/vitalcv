/**
 * Minimum Friction Demo-0 (MF-WAVE-01).
 *
 * Proves the thesis from fixtures and pure logic — no migration, no runtime,
 * no route, no schema, no UI — by composing primitives that already exist:
 * the LANDED validateTrustSpec() (TrustSpec 0.1) and the shipped
 * detectGaps()/projectReadiness() over fixture evidence, plus the MF-WAVE-01
 * pure modules (frictionVector, objectiveProfile, questionAdmission,
 * disclosureAdmission).
 *
 * Structure: the seven properties from
 * docs/minimum-friction/MINIMUM_FRICTION_EXECUTION_PLAN.md §1, each its own
 * test, plus the four zero-invariants asserted separately.
 *
 * Everything is synthetic; time is injected; nothing here fetches, persists,
 * or emits. SATISFIED never means accepted.
 */

import { describe, expect, it } from 'vitest';

import { buildEvidenceCollection } from '../collection';
import { detectGaps, projectReadiness } from '../mobility/mobility';
import { projectEvidenceToGraph } from '../projectors/graph';
import { propagateTrust } from '../trust/propagate';
import { validateTrustSpec } from '../trust-computing/trustSpec';

import { compareFrictionVectors } from './frictionVector';
import {
  MINIMUM_CLINICIAN_ACTIONS_PROFILE,
  countClinicianActions,
  deterministicLeverage,
  isClinicianAction,
  type CandidatePlan,
} from './objectiveProfile';
import {
  CANDIDATE_STATES,
  admitQuestions,
  applyConfirmation,
  countFalseTruthPromotions,
} from './questionAdmission';
import {
  admitDisclosure,
  countCrossRecipientConsentReuse,
  countUnauthorizedDisclosures,
  countUnknownToSatisfied,
  deriveRequirementSatisfaction,
  previewDisclosure,
  type DisclosureLedgerEntry,
} from './disclosureAdmission';
import {
  DEMO0_ACTION_CONFIRM_FELLOWSHIP_DATES,
  DEMO0_ACTION_REFRESH_ENROLLMENT,
  DEMO0_ADMISSION_CONTEXT,
  DEMO0_CANDIDATE_PLANS,
  DEMO0_CV_CANDIDATES,
  DEMO0_DISPLAY_NAME,
  DEMO0_MOBILITY_OPPORTUNITY,
  DEMO0_PLAN_CONFIRM_DATES,
  DEMO0_PLAN_INVALID_SHORTCUT,
  DEMO0_POST_CONFIRMATION_SATISFIES_EDGES,
  DEMO0_PURPOSE,
  DEMO0_QUESTION_CANDIDATES,
  DEMO0_RECIPIENT_KEY,
  DEMO0_REQUIREMENT_IDS,
  DEMO0_SEEDED_EVIDENCE,
  DEMO0_SEEDED_SATISFIES_EDGES,
  DEMO0_SOURCE_FELLOWSHIP_DATES,
  DEMO0_SUBJECT_KEY,
  DEMO0_TRUST_SPEC,
  DEMO0_UNRELATED_EVIDENCE_IDS,
  DEMO0_VALID_CONSENT,
  DEMO0_WRONG_RECIPIENT_CONSENT,
} from './fixtures/mf-demo0';

// ---------------------------------------------------------------------------
// Shared setup (pure — safe to build once per assertion)
// ---------------------------------------------------------------------------

function seededCollection() {
  return buildEvidenceCollection({
    subjectKey: DEMO0_SUBJECT_KEY,
    generatedFor: { displayName: DEMO0_DISPLAY_NAME, npi: null },
    objects: [...DEMO0_SEEDED_EVIDENCE],
  });
}

/** The disclosure ledger of the whole Demo-0 run. Previews append nothing. */
const runLedger: DisclosureLedgerEntry[] = [];

describe('Demo-0 inputs are well-formed', () => {
  it('the fixture opportunity is a valid TrustSpec 0.1 per the landed validator', () => {
    const result = validateTrustSpec(DEMO0_TRUST_SPEC);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('no fixture identifier is NPI-shaped and the subject is synthetic', () => {
    expect(DEMO0_SUBJECT_KEY.startsWith('synthetic:clinician:')).toBe(true);
    const everyId = [
      DEMO0_SUBJECT_KEY,
      ...DEMO0_SEEDED_EVIDENCE.map((e) => e.evidenceId),
      ...DEMO0_CV_CANDIDATES.map((c) => c.candidateId),
      ...DEMO0_CANDIDATE_PLANS.flatMap((p) => [p.planId, ...p.actions.map((a) => a.actionId)]),
    ];
    for (const id of everyId) {
      expect(id, `identifier ${id} must not be a 10-digit NPI-shaped value`).not.toMatch(/^\d{10}$/);
    }
    expect(seededCollection().generatedFor.npi).toBeNull();
  });
});

describe('Property 1 — starts from what it already knows', () => {
  it('>=1 requirement is already SATISFIED from seeded state with zero clinician actions', () => {
    // Zero clinician actions have happened: the seeded edge set is the bootstrap.
    const satisfaction = deriveRequirementSatisfaction(
      [...DEMO0_REQUIREMENT_IDS],
      DEMO0_SEEDED_SATISFIES_EDGES,
    );
    const satisfied = Object.entries(satisfaction).filter(([, s]) => s === 'SATISFIED');
    expect(satisfied.length).toBeGreaterThanOrEqual(1);
    expect(satisfaction['req-identity']).toBe('SATISFIED');
    // The unconfirmed requirements stay honestly UNKNOWN — not failed, not satisfied.
    expect(satisfaction['req-fellowship-dates']).toBe('UNKNOWN');

    // The shipped gap engine agrees: the seeded, source-checked evidence
    // satisfies the mandatory mirror requirements without any clinician input.
    const collection = seededCollection();
    const trust = propagateTrust(projectEvidenceToGraph(collection));
    const gaps = detectGaps(DEMO0_MOBILITY_OPPORTUNITY, collection, trust);
    const identityGap = gaps.gaps.find((g) => g.requirementId === 'req-identity');
    expect(identityGap?.kind).toBe('satisfied');
    expect(gaps.mandatoryUnmet).toBe(0);
    const readiness = projectReadiness(DEMO0_MOBILITY_OPPORTUNITY, gaps, trust);
    expect(readiness.readiness).toBe('ready');
  });
});

describe('Property 2 — AI proposes but cannot verify', () => {
  it('CV facts enter as INFERRED/CONFLICT candidates and confirmation yields USER_ENTERED, never VERIFIED', () => {
    // The candidate vocabulary structurally excludes VERIFIED.
    expect(CANDIDATE_STATES).toEqual(['INFERRED', 'USER_ENTERED', 'CONFLICT']);
    expect(CANDIDATE_STATES as readonly string[]).not.toContain('VERIFIED');

    for (const candidate of DEMO0_CV_CANDIDATES) {
      expect(['INFERRED', 'CONFLICT']).toContain(candidate.state);
    }

    const conflicted = DEMO0_CV_CANDIDATES.find((c) => c.candidateId === 'cand-fellowship-dates')!;
    const confirmed = applyConfirmation(conflicted, DEMO0_SOURCE_FELLOWSHIP_DATES);
    expect(confirmed.state).toBe('USER_ENTERED');
    expect(confirmed.state).not.toBe('VERIFIED');
    // The original is untouched (pure transform) and the conflict was held, not silently selected.
    expect(conflicted.state).toBe('CONFLICT');
    expect(confirmed.conflictingSourceValue).toBe(DEMO0_SOURCE_FELLOWSHIP_DATES);

    const statesAfterRun = [
      ...DEMO0_CV_CANDIDATES.filter((c) => c.candidateId !== conflicted.candidateId).map((c) => c.state),
      confirmed.state,
    ];
    expect(countFalseTruthPromotions(statesAfterRun)).toBe(0);
  });
});

describe('Property 3 — one confirmation resolves multiple dependencies', () => {
  it('confirming fellowship dates clears the conflict and satisfies exactly 2 requirements', () => {
    expect(deterministicLeverage(DEMO0_ACTION_CONFIRM_FELLOWSHIP_DATES)).toBe(2);
    expect(DEMO0_ACTION_CONFIRM_FELLOWSHIP_DATES.resolvesConflictCandidateIds).toEqual([
      'cand-fellowship-dates',
    ]);

    const before = deriveRequirementSatisfaction(
      [...DEMO0_REQUIREMENT_IDS],
      DEMO0_SEEDED_SATISFIES_EDGES,
    );
    const after = deriveRequirementSatisfaction(
      [...DEMO0_REQUIREMENT_IDS],
      DEMO0_POST_CONFIRMATION_SATISFIES_EDGES,
    );
    const flipped = DEMO0_REQUIREMENT_IDS.filter(
      (id) => before[id] === 'UNKNOWN' && after[id] === 'SATISFIED',
    );
    expect(flipped).toEqual(['req-fellowship-dates', 'req-training-history']);
  });
});

describe('Property 4 — the planner selects the highest-leverage question', () => {
  it('the lexicographic objective ranks the confirm-dates plan above every other candidate', () => {
    const selected = MINIMUM_CLINICIAN_ACTIONS_PROFILE.selectPlan(DEMO0_CANDIDATE_PLANS);
    expect(selected?.planId).toBe('plan-confirm-dates');
    // Its single clinician action is the fellowship-dates confirmation.
    const clinicianSteps = selected!.actions.filter(isClinicianAction);
    expect(clinicianSteps.map((a) => a.actionId)).toEqual(['act-confirm-fellowship-dates']);
    expect(countClinicianActions(selected!)).toBe(selected!.friction.clinicianActions);
  });

  it('the choice is reproducible under input reordering, with a lexical-id tiebreak', () => {
    const reversed = [...DEMO0_CANDIDATE_PLANS].reverse();
    const rotated = [...DEMO0_CANDIDATE_PLANS.slice(1), DEMO0_CANDIDATE_PLANS[0]!];
    for (const ordering of [DEMO0_CANDIDATE_PLANS, reversed, rotated]) {
      expect(MINIMUM_CLINICIAN_ACTIONS_PROFILE.selectPlan(ordering)?.planId).toBe(
        'plan-confirm-dates',
      );
    }

    // Tiebreak: identical friction vectors resolve by stable action-id order.
    const twinA: CandidatePlan = {
      ...DEMO0_PLAN_CONFIRM_DATES,
      planId: 'plan-twin-a',
      actions: [DEMO0_ACTION_CONFIRM_FELLOWSHIP_DATES, DEMO0_ACTION_REFRESH_ENROLLMENT],
    };
    const twinB: CandidatePlan = {
      ...DEMO0_PLAN_CONFIRM_DATES,
      planId: 'plan-twin-b',
      actions: [DEMO0_ACTION_REFRESH_ENROLLMENT, DEMO0_ACTION_CONFIRM_FELLOWSHIP_DATES],
    };
    expect(compareFrictionVectors(twinA.friction, twinB.friction)).toBe(0);
    expect(MINIMUM_CLINICIAN_ACTIONS_PROFILE.selectPlan([twinB, twinA])?.planId).toBe('plan-twin-a');
    expect(MINIMUM_CLINICIAN_ACTIONS_PROFILE.selectPlan([twinA, twinB])?.planId).toBe('plan-twin-a');
  });

  it('an invalid plan is never selected, however dominant its friction vector', () => {
    // The shortcut's vector lexicographically dominates every valid plan…
    expect(
      compareFrictionVectors(
        DEMO0_PLAN_INVALID_SHORTCUT.friction,
        DEMO0_PLAN_CONFIRM_DATES.friction,
      ),
    ).toBeLessThan(0);
    // …and it still cannot place: validity is a gate, not a term.
    const ranked = MINIMUM_CLINICIAN_ACTIONS_PROFILE.rankPlans(DEMO0_CANDIDATE_PLANS);
    expect(ranked.map((p) => p.planId)).toEqual(['plan-confirm-dates', 'plan-upload-diploma']);
    expect(() =>
      MINIMUM_CLINICIAN_ACTIONS_PROFILE.comparePlans(
        DEMO0_PLAN_INVALID_SHORTCUT,
        DEMO0_PLAN_CONFIRM_DATES,
      ),
    ).toThrowError(/validity is a gate/);
  });
});

describe('Property 5 — sensitive info not required for the goal is never requested', () => {
  it('the ask set contains no sensitive field and sensitiveAttributesCollected is 0', () => {
    const report = admitQuestions(DEMO0_QUESTION_CANDIDATES, DEMO0_ADMISSION_CONTEXT);

    expect(report.sensitiveAttributesCollected).toBe(0);
    for (const asked of report.asked) {
      expect(asked.sensitive, `${asked.questionId} is sensitive and was asked`).toBe(false);
      expect(['identity.ssn', 'identity.dob', 'identity.visa_status']).not.toContain(asked.fieldKey);
    }
    // The sensitive questions were suppressed for the honest reason: the goal
    // does not require them.
    for (const questionId of ['q-dob', 'q-ssn', 'q-visa-status']) {
      const decision = report.decisions.find((d) => d.questionId === questionId)!;
      expect(decision.admitted).toBe(false);
      expect(decision.admitted === false && decision.reason).toBe('not_required_for_goal');
    }
    // The selected plan collects zero sensitive attributes.
    expect(
      MINIMUM_CLINICIAN_ACTIONS_PROFILE.selectPlan(DEMO0_CANDIDATE_PLANS)?.friction
        .sensitiveAttributesCollected,
    ).toBe(0);
  });

  it('already-answered questions are suppressed by the admission ladder, not re-asked', () => {
    const report = admitQuestions(DEMO0_QUESTION_CANDIDATES, DEMO0_ADMISSION_CONTEXT);
    const reasonOf = (id: string) => {
      const d = report.decisions.find((x) => x.questionId === id)!;
      return d.admitted ? 'irreducible' : d.reason;
    };
    expect(reasonOf('q-profession')).toBe('already_known');
    expect(reasonOf('q-registry-id-reentry')).toBe('already_known');
    expect(reasonOf('q-specialty')).toBe('already_known');
    expect(reasonOf('q-license-states')).toBe('source_answerable');
    expect(reasonOf('q-confirm-fellowship-dates')).toBe('irreducible');
    expect(reasonOf('q-upload-diploma')).toBe('irreducible');
  });
});

describe('Property 6 — share preview contains only required authorized evidence', () => {
  it('the minimum evidence set is requirement-relevant only and excludes unrelated fields', () => {
    const preview = previewDisclosure(
      {
        recipientKey: DEMO0_RECIPIENT_KEY,
        purpose: DEMO0_PURPOSE,
        requirementIds: [...DEMO0_REQUIREMENT_IDS],
      },
      DEMO0_POST_CONFIRMATION_SATISFIES_EDGES,
    );

    const requirementRelevant = new Set(
      DEMO0_POST_CONFIRMATION_SATISFIES_EDGES.flatMap((e) => e.evidenceIds),
    );
    for (const evidenceId of preview.evidenceIds) {
      expect(requirementRelevant.has(evidenceId), `${evidenceId} is not requirement-relevant`).toBe(true);
    }
    expect(preview.evidenceIds).toEqual([
      'att-fellowship-dates',
      'ev-identity-registry',
      'ev-license-registry',
    ]);
    for (const unrelated of DEMO0_UNRELATED_EVIDENCE_IDS) {
      expect(preview.evidenceIds).not.toContain(unrelated);
    }
    expect(preview.unsatisfiedRequirementIds).toEqual([]);
  });
});

describe('Property 7 — no data is shared without explicit authorization', () => {
  it('the preview computes but emits nothing; a share requires an explicit authorize step', () => {
    const request = {
      recipientKey: DEMO0_RECIPIENT_KEY,
      purpose: DEMO0_PURPOSE,
      requirementIds: [...DEMO0_REQUIREMENT_IDS],
    };
    const preview = previewDisclosure(request, DEMO0_POST_CONFIRMATION_SATISFIES_EDGES);
    expect(preview.shared).toBe(false);
    // Computing the preview appended nothing to the run's disclosure ledger.
    expect(runLedger).toEqual([]);

    // No consent → refused. Consent for another recipient → refused. Wrong
    // purpose → refused. Only the exact recipient+purpose consent authorizes.
    expect(admitDisclosure(request, null, DEMO0_POST_CONFIRMATION_SATISFIES_EDGES)).toEqual({
      authorized: false,
      reason: 'no_consent',
    });
    expect(
      admitDisclosure(request, DEMO0_WRONG_RECIPIENT_CONSENT, DEMO0_POST_CONFIRMATION_SATISFIES_EDGES),
    ).toEqual({ authorized: false, reason: 'recipient_mismatch' });
    expect(
      admitDisclosure(
        request,
        { ...DEMO0_VALID_CONSENT, purpose: 'marketing' },
        DEMO0_POST_CONFIRMATION_SATISFIES_EDGES,
      ),
    ).toEqual({ authorized: false, reason: 'purpose_mismatch' });
    expect(
      admitDisclosure(
        request,
        { ...DEMO0_VALID_CONSENT, granted: false },
        DEMO0_POST_CONFIRMATION_SATISFIES_EDGES,
      ),
    ).toEqual({ authorized: false, reason: 'consent_not_granted' });

    const authorized = admitDisclosure(
      request,
      DEMO0_VALID_CONSENT,
      DEMO0_POST_CONFIRMATION_SATISFIES_EDGES,
    );
    expect(authorized.authorized).toBe(true);
  });
});

describe('The four zero-invariants over the whole Demo-0 run', () => {
  it('FALSE_TRUTH_PROMOTION = 0', () => {
    const conflicted = DEMO0_CV_CANDIDATES.find((c) => c.candidateId === 'cand-fellowship-dates')!;
    const confirmed = applyConfirmation(conflicted, DEMO0_SOURCE_FELLOWSHIP_DATES);
    const states = [
      ...DEMO0_CV_CANDIDATES.map((c) => c.state),
      confirmed.state,
    ];
    expect(countFalseTruthPromotions(states)).toBe(0);
  });

  it('UNAUTHORIZED_DISCLOSURE = 0', () => {
    expect(countUnauthorizedDisclosures(runLedger)).toBe(0);
  });

  it('CROSS_RECIPIENT_CONSENT_REUSE = 0', () => {
    expect(countCrossRecipientConsentReuse(runLedger)).toBe(0);
  });

  it('UNKNOWN_TO_SATISFIED = 0', () => {
    for (const edges of [DEMO0_SEEDED_SATISFIES_EDGES, DEMO0_POST_CONFIRMATION_SATISFIES_EDGES]) {
      const satisfaction = deriveRequirementSatisfaction([...DEMO0_REQUIREMENT_IDS], edges);
      expect(countUnknownToSatisfied(satisfaction, edges)).toBe(0);
    }
    // And every plan the objective may select carries all four zeros.
    for (const plan of MINIMUM_CLINICIAN_ACTIONS_PROFILE.rankPlans(DEMO0_CANDIDATE_PLANS)) {
      expect(plan.invariantViolations).toEqual({
        falseTruthPromotion: 0,
        unauthorizedDisclosure: 0,
        crossRecipientConsentReuse: 0,
        unknownToSatisfied: 0,
      });
    }
  });
});
