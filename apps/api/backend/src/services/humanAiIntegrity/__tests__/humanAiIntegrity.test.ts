import {
  APPROVAL_BOUNDARY_BY_DOMAIN,
  buildAiRecommendation,
  buildReviewerOverride,
  checkExplainabilityContract,
  checkLineageCompleteness,
  checkRecommendationShape,
  checkReplayConsistency,
  checkReviewStateTransitions,
  emitLineageEvent,
  gateRecommendation,
  isHumanOnly,
  reconstructLineage,
  summarizeReviewerConfidence,
} from '../index';
import type {
  AiRecommendation,
  LineageEvent,
  ReviewerActor,
  ReviewerOverrideRecord,
} from '../index';

const TENANT_A = 'tenant-A';

function makeRec(overrides: Partial<Parameters<typeof buildAiRecommendation>[0]> = {}): AiRecommendation {
  return buildAiRecommendation({
    recommendationId: overrides.recommendationId ?? 'rec-1',
    tenantId: overrides.tenantId ?? TENANT_A,
    subjectId: overrides.subjectId ?? 'subject-1',
    subjectType: overrides.subjectType ?? 'employer_review',
    emittedAt: overrides.emittedAt ?? '2026-05-09T10:00:00.000Z',
    modelId: overrides.modelId ?? 'classifier-v3',
    modelHash: overrides.modelHash ?? 'mhash-1',
    inputHash: overrides.inputHash ?? 'ihash-1',
    outputHash: overrides.outputHash ?? 'ohash-1',
    tier: overrides.tier ?? 'suggestion_only',
    recommendedAction: overrides.recommendedAction ?? 'route_to_review',
    confidence: overrides.confidence ?? 0.6,
    rationaleSummary: overrides.rationaleSummary ?? 'Stale state-board source detected.',
    rationaleTokens: overrides.rationaleTokens ?? ['stale_state_board'],
    ambiguityFlags: overrides.ambiguityFlags ?? [],
  });
}

function actor(id: string, tenantId = TENANT_A): ReviewerActor {
  return { id, role: 'employer_reviewer', tenantId };
}

describe('humanAiIntegrity — recommendation shape', () => {
  it('produces literal decisionGrade=false and proofTier="ai_recommendation"', () => {
    const rec = makeRec();
    expect(rec.decisionGrade).toBe(false);
    expect(rec.proofTier).toBe('ai_recommendation');
  });

  it('rejects empty tenantId', () => {
    expect(() => makeRec({ tenantId: '   ' })).toThrow(/tenantId is required/);
  });

  it('rejects confidence outside [0,1]', () => {
    expect(() => makeRec({ confidence: 1.2 })).toThrow(/confidence/);
    expect(() => makeRec({ confidence: -0.1 })).toThrow(/confidence/);
  });

  it('rejects missing replay hashes', () => {
    expect(() => makeRec({ modelHash: '' })).toThrow(/replay/);
    expect(() => makeRec({ inputHash: '' })).toThrow(/replay/);
    expect(() => makeRec({ outputHash: '' })).toThrow(/replay/);
  });

  it('checkRecommendationShape flags decisionGrade widening attempts', () => {
    const rec = makeRec();
    const tampered = { ...rec, decisionGrade: true } as unknown as AiRecommendation;
    const violations = checkRecommendationShape(tampered);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.invariant).toBe('no_ai_decisionGrade_upgrade');
  });

  it('checkRecommendationShape flags proofTier upgrades', () => {
    const rec = makeRec();
    const tampered = { ...rec, proofTier: 'psv_receipt' } as unknown as AiRecommendation;
    const violations = checkRecommendationShape(tampered);
    expect(violations.some((v) => v.invariant === 'no_ai_decisionGrade_upgrade')).toBe(true);
  });
});

describe('humanAiIntegrity — lineage events', () => {
  it('emits an EMITTED event with the recommendation tenant', () => {
    const rec = makeRec();
    const event = emitLineageEvent({
      eventId: 'evt-1',
      eventType: 'AI_RECOMMENDATION_EMITTED',
      recommendation: rec,
      occurredAt: '2026-05-09T10:00:01.000Z',
    });
    expect(event.tenantId).toBe(TENANT_A);
    expect(event.recommendationId).toBe('rec-1');
  });

  it('refuses an OVERRIDDEN event without action + reason', () => {
    const rec = makeRec();
    expect(() =>
      emitLineageEvent({
        eventId: 'evt-2',
        eventType: 'AI_RECOMMENDATION_OVERRIDDEN',
        recommendation: rec,
        occurredAt: '2026-05-09T10:00:05.000Z',
        reviewerActor: actor('reviewer-1'),
      }),
    ).toThrow(/humanDecisionAction/);
  });

  it('refuses negative dwellMs', () => {
    const rec = makeRec();
    expect(() =>
      emitLineageEvent({
        eventId: 'evt-3',
        eventType: 'AI_RECOMMENDATION_DISPLAYED',
        recommendation: rec,
        occurredAt: '2026-05-09T10:00:01.000Z',
        reviewerActor: actor('reviewer-1'),
        dwellMs: -1,
      }),
    ).toThrow(/dwellMs/);
  });

  it('reconstructs the lineage in time order with resolution=accepted', () => {
    const rec = makeRec();
    const events: LineageEvent[] = [
      emitLineageEvent({
        eventId: 'evt-acc',
        eventType: 'AI_RECOMMENDATION_ACCEPTED',
        recommendation: rec,
        occurredAt: '2026-05-09T10:00:30.000Z',
        reviewerActor: actor('reviewer-1'),
        ambiguityAcknowledged: true,
        dwellMs: 12_000,
      }),
      emitLineageEvent({
        eventId: 'evt-emit',
        eventType: 'AI_RECOMMENDATION_EMITTED',
        recommendation: rec,
        occurredAt: '2026-05-09T10:00:01.000Z',
      }),
      emitLineageEvent({
        eventId: 'evt-disp',
        eventType: 'AI_RECOMMENDATION_DISPLAYED',
        recommendation: rec,
        occurredAt: '2026-05-09T10:00:05.000Z',
        reviewerActor: actor('reviewer-1'),
      }),
    ];
    const lineage = reconstructLineage(events);
    expect(lineage.events.map((e) => e.eventId)).toEqual(['evt-emit', 'evt-disp', 'evt-acc']);
    expect(lineage.resolution).toBe('accepted');
    expect(lineage.humanInTheLoop).toBe(true);
    expect(lineage.tenantBoundaryConsistent).toBe(true);
    expect(lineage.missingPriorEmission).toBe(false);
  });

  it('flags missing prior EMITTED in reconstruction', () => {
    const rec = makeRec();
    const events: LineageEvent[] = [
      emitLineageEvent({
        eventId: 'evt-disp',
        eventType: 'AI_RECOMMENDATION_DISPLAYED',
        recommendation: rec,
        occurredAt: '2026-05-09T10:00:05.000Z',
        reviewerActor: actor('reviewer-1'),
      }),
    ];
    const lineage = reconstructLineage(events);
    expect(lineage.missingPriorEmission).toBe(true);
    expect(lineage.resolution).toBe('unresolved');
  });
});

describe('humanAiIntegrity — approval boundaries', () => {
  it('marks PSV promotion + policy review + conflict resolution as human_only', () => {
    expect(isHumanOnly('psv_candidate_promotion')).toBe(true);
    expect(isHumanOnly('policy_review_decision')).toBe(true);
    expect(isHumanOnly('conflict_resolution')).toBe(true);
    expect(isHumanOnly('exclusion_override')).toBe(true);
  });

  it('refuses a recommendation in a human_only domain', () => {
    const rec = makeRec();
    const outcome = gateRecommendation('psv_candidate_promotion', rec);
    expect(outcome.admitted).toBe(false);
    expect(outcome.refusalReason).toBe('ai_emission_forbidden_human_only_domain');
  });

  it('refuses a recommendation in an unknown domain (fail-closed)', () => {
    const rec = makeRec();
    const outcome = gateRecommendation('mystery_domain', rec);
    expect(outcome.admitted).toBe(false);
    expect(outcome.refusalReason).toBe('unknown_domain');
  });

  it('refuses pre_screened tier in a human_approves_ai_suggestion domain', () => {
    const rec = makeRec({ tier: 'pre_screened' });
    const outcome = gateRecommendation('issuer_response_intake', rec);
    expect(outcome.admitted).toBe(false);
    expect(outcome.refusalReason).toBe('tier_exceeds_boundary');
  });

  it('admits suggestion_only in employer_review_acceptance', () => {
    const rec = makeRec();
    const outcome = gateRecommendation('employer_review_acceptance', rec);
    expect(outcome.admitted).toBe(true);
    expect(outcome.boundary).toBe('human_approves_ai_suggestion');
  });

  it('every domain in the table maps to exactly one boundary', () => {
    for (const [domain, boundary] of Object.entries(APPROVAL_BOUNDARY_BY_DOMAIN)) {
      expect(typeof boundary).toBe('string');
      expect(['human_only', 'human_approves_ai_suggestion', 'ai_suggests_human_overrides', 'ai_acts_human_can_veto']).toContain(boundary);
      expect(domain.length).toBeGreaterThan(0);
    }
  });
});

describe('humanAiIntegrity — reviewer confidence + override', () => {
  it('refuses cross-tenant override', () => {
    const rec = makeRec({ tenantId: 'tenant-X' });
    expect(() =>
      buildReviewerOverride({
        recommendation: rec,
        reviewerActor: actor('reviewer-A', 'tenant-Y'),
        overrideKind: 'rejected_with_reason',
        confidence: 'high',
        reason: 'Different jurisdiction',
        recordedAt: '2026-05-09T10:00:00.000Z',
      }),
    ).toThrow(/tenant/);
  });

  it('refuses empty reason', () => {
    const rec = makeRec();
    expect(() =>
      buildReviewerOverride({
        recommendation: rec,
        reviewerActor: actor('reviewer-A'),
        overrideKind: 'rejected_with_reason',
        confidence: 'medium',
        reason: '   ',
        recordedAt: '2026-05-09T10:00:00.000Z',
      }),
    ).toThrow(/reason is required/);
  });

  it('refuses accepted_with_dissent + high (contradictory)', () => {
    const rec = makeRec();
    expect(() =>
      buildReviewerOverride({
        recommendation: rec,
        reviewerActor: actor('reviewer-A'),
        overrideKind: 'accepted_with_dissent',
        confidence: 'high',
        reason: 'I disagree but accept',
        recordedAt: '2026-05-09T10:00:00.000Z',
      }),
    ).toThrow(/contradictory/);
  });

  it('summarizeReviewerConfidence aggregates distribution and dissent rate', () => {
    const rec = makeRec();
    const records: ReviewerOverrideRecord[] = [
      buildReviewerOverride({
        recommendation: rec,
        reviewerActor: actor('reviewer-A'),
        overrideKind: 'rejected_with_reason',
        confidence: 'high',
        reason: 'Wrong source',
        recordedAt: '2026-05-09T10:00:00.000Z',
      }),
      buildReviewerOverride({
        recommendation: rec,
        reviewerActor: actor('reviewer-A'),
        overrideKind: 'accepted_with_dissent',
        confidence: 'high_with_caveat',
        reason: 'Borderline',
        ambiguityNote: 'evidence_conflict observed',
        recordedAt: '2026-05-09T10:01:00.000Z',
      }),
      buildReviewerOverride({
        recommendation: rec,
        reviewerActor: actor('reviewer-A'),
        overrideKind: 'override_with_alternate',
        confidence: 'medium',
        reason: 'Alternate path applies',
        recordedAt: '2026-05-09T10:02:00.000Z',
      }),
    ];
    const summary = summarizeReviewerConfidence(records);
    expect(summary.windowSize).toBe(3);
    expect(summary.distribution.high).toBe(1);
    expect(summary.distribution.high_with_caveat).toBe(1);
    expect(summary.distribution.medium).toBe(1);
    expect(summary.dissentRate).toBeCloseTo(1, 5);
    expect(summary.ambiguityNoteRate).toBeCloseTo(1 / 3, 5);
  });
});

describe('humanAiIntegrity — explainability invariants', () => {
  it('I2: flags missing emission when interaction events exist', () => {
    const rec = makeRec();
    const displayed = emitLineageEvent({
      eventId: 'evt-disp',
      eventType: 'AI_RECOMMENDATION_DISPLAYED',
      recommendation: rec,
      occurredAt: '2026-05-09T10:00:05.000Z',
      reviewerActor: actor('reviewer-1'),
    });
    const violations = checkLineageCompleteness(rec, [displayed]);
    expect(violations.some((v) => v.invariant === 'no_silent_recommendation')).toBe(true);
  });

  it('I3: flags accept that ignores ambiguity', () => {
    const rec = makeRec({ ambiguityFlags: ['evidence_conflict'] });
    const events = [
      emitLineageEvent({
        eventId: 'evt-emit',
        eventType: 'AI_RECOMMENDATION_EMITTED',
        recommendation: rec,
        occurredAt: '2026-05-09T10:00:01.000Z',
      }),
      emitLineageEvent({
        eventId: 'evt-acc',
        eventType: 'AI_RECOMMENDATION_ACCEPTED',
        recommendation: rec,
        occurredAt: '2026-05-09T10:00:05.000Z',
        reviewerActor: actor('reviewer-1'),
        ambiguityAcknowledged: false,
      }),
    ];
    const violations = checkLineageCompleteness(rec, events);
    expect(violations.some((v) => v.invariant === 'no_ambiguity_collapse')).toBe(true);
  });

  it('I4: flags AI-driven jump from review_required to ready_for_policy_review', () => {
    const violations = checkReviewStateTransitions([
      {
        recommendationId: 'rec-1',
        tenantId: TENANT_A,
        fromState: 'review_required',
        toState: 'ready_for_policy_review',
        drivenBy: 'ai',
      },
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.invariant).toBe('no_review_state_jump');
  });

  it('I4: flags human jump without reason', () => {
    const violations = checkReviewStateTransitions([
      {
        recommendationId: 'rec-1',
        tenantId: TENANT_A,
        fromState: 'review_required',
        toState: 'ready_for_policy_review',
        drivenBy: 'human',
        humanReason: '   ',
      },
    ]);
    expect(violations).toHaveLength(1);
  });

  it('I4: admits human jump with non-empty reason', () => {
    const violations = checkReviewStateTransitions([
      {
        recommendationId: 'rec-1',
        tenantId: TENANT_A,
        fromState: 'review_required',
        toState: 'ready_for_policy_review',
        drivenBy: 'human',
        humanReason: 'Issuer reconfirmed via phone with named responder',
      },
    ]);
    expect(violations).toHaveLength(0);
  });

  it('I6: flags replay divergence (same model+input → different output)', () => {
    const violations = checkReplayConsistency([
      { modelHash: 'M1', inputHash: 'I1', outputHash: 'O-A', recommendationId: 'r1', tenantId: TENANT_A },
      { modelHash: 'M1', inputHash: 'I1', outputHash: 'O-B', recommendationId: 'r2', tenantId: TENANT_A },
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.invariant).toBe('replay_safe_lineage');
  });

  it('I6: clean replay (same model+input+output) is a non-violation', () => {
    const violations = checkReplayConsistency([
      { modelHash: 'M1', inputHash: 'I1', outputHash: 'O-A', recommendationId: 'r1', tenantId: TENANT_A },
      { modelHash: 'M1', inputHash: 'I1', outputHash: 'O-A', recommendationId: 'r2', tenantId: TENANT_A },
    ]);
    expect(violations).toHaveLength(0);
  });

  it('checkExplainabilityContract aggregates all sub-checks', () => {
    const rec = makeRec({ ambiguityFlags: ['low_confidence'] });
    const events = [
      emitLineageEvent({
        eventId: 'evt-emit',
        eventType: 'AI_RECOMMENDATION_EMITTED',
        recommendation: rec,
        occurredAt: '2026-05-09T10:00:01.000Z',
      }),
      emitLineageEvent({
        eventId: 'evt-acc',
        eventType: 'AI_RECOMMENDATION_ACCEPTED',
        recommendation: rec,
        occurredAt: '2026-05-09T10:00:05.000Z',
        reviewerActor: actor('reviewer-1'),
        ambiguityAcknowledged: false,
      }),
    ];
    const violations = checkExplainabilityContract({
      recommendation: rec,
      events,
      transitions: [
        {
          recommendationId: 'rec-1',
          tenantId: TENANT_A,
          fromState: 'review_required',
          toState: 'ready_for_policy_review',
          drivenBy: 'ai',
        },
      ],
      replaySamples: [
        { modelHash: 'M1', inputHash: 'I1', outputHash: 'O-A', recommendationId: 'r1', tenantId: TENANT_A },
        { modelHash: 'M1', inputHash: 'I1', outputHash: 'O-B', recommendationId: 'r2', tenantId: TENANT_A },
      ],
    });
    const invariants = violations.map((v) => v.invariant);
    expect(invariants).toContain('no_ambiguity_collapse');
    expect(invariants).toContain('no_review_state_jump');
    expect(invariants).toContain('replay_safe_lineage');
  });
});
