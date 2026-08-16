/**
 * Minimum Friction — Question Admission Gate + AI candidate quarantine
 * (MF-WAVE-01).
 *
 * The deterministic ask-rule from
 * docs/minimum-friction/MINIMUM_FRICTION_USER_JOURNEY.md §0, as a pure
 * predicate ("a form field is work; it must justify its existence"), plus the
 * candidate-claim quarantine the gate's confirmations flow through
 * (USER_JOURNEY §2 / SECURITY §2).
 *
 * Quarantine invariants:
 * - An AI-extracted fact enters as `INFERRED` — a labelled candidate, never
 *   truth.
 * - Clinician confirmation yields `USER_ENTERED` — a DISTINCT state that is
 *   not, and never becomes, `VERIFIED`. `VERIFIED` is deliberately not a
 *   member of the candidate state vocabulary, so the type system itself
 *   forbids the promotion (FALSE_TRUTH_PROMOTION = 0 by construction).
 * - A contradiction with source-backed state is `CONFLICT` — held for review
 *   with both values retained; nothing is silently selected.
 *
 * PURE TRANSFORMS ONLY. No fetch, no DB, no clock, no randomness.
 */

// ---------------------------------------------------------------------------
// AI candidate quarantine
// ---------------------------------------------------------------------------

/**
 * The complete candidate state vocabulary. `VERIFIED` is intentionally absent:
 * verification is a property of source-backed evidence, and no candidate path
 * may mint it. Do not widen this set.
 */
export const CANDIDATE_STATES = ['INFERRED', 'USER_ENTERED', 'CONFLICT'] as const;
export type CandidateState = (typeof CANDIDATE_STATES)[number];

/** One AI-extracted career fact, quarantined as a candidate. */
export interface CandidateClaim {
  readonly candidateId: string;
  /** Dot-separated field key, e.g. 'training.fellowship.dates'. */
  readonly fieldKey: string;
  readonly value: string;
  readonly state: CandidateState;
  /** The artifact (e.g. CV upload) the claim was extracted from. */
  readonly artifactId: string;
  /**
   * When a source-backed value disagrees, it is held here alongside the
   * extracted value. Both survive; silent selection is forbidden.
   */
  readonly conflictingSourceValue: string | null;
}

/**
 * Applies an explicit clinician confirmation to a candidate. The result is
 * `USER_ENTERED` — a user attestation, distinct from `VERIFIED` — carrying the
 * value the clinician actually confirmed (never auto-selected from either
 * side of a conflict). The conflicting source value is retained for
 * provenance. Pure: returns a new claim, mutates nothing.
 */
export function applyConfirmation(
  candidate: CandidateClaim,
  confirmedValue: string,
): CandidateClaim {
  return {
    ...candidate,
    value: confirmedValue,
    state: 'USER_ENTERED',
  };
}

/**
 * FALSE_TRUTH_PROMOTION counter: the number of candidate states that have left
 * the quarantine vocabulary (e.g. reached 'VERIFIED' or any other
 * source-backed word). Demo-0 asserts this is exactly 0. Accepts raw strings
 * so a violation smuggled past the type system is still counted.
 */
export function countFalseTruthPromotions(states: readonly string[]): number {
  const allowed: ReadonlySet<string> = new Set(CANDIDATE_STATES);
  return states.filter((state) => !allowed.has(state)).length;
}

// ---------------------------------------------------------------------------
// Question Admission Gate
// ---------------------------------------------------------------------------

/** A field the product is considering asking the clinician. */
export interface QuestionCandidate {
  readonly questionId: string;
  readonly fieldKey: string;
  readonly label: string;
  /** Collecting this field collects a NEW sensitive attribute (SSN/DOB/visa…). */
  readonly sensitive: boolean;
}

/**
 * The gate's evidence about what is already answerable, expressed as field-key
 * sets. In Demo-0 these are FIXTURED (the real dependency index is NEW-PTC);
 * the ladder itself is the deterministic rule a later wave wires to computed
 * inputs.
 */
export interface QuestionAdmissionContext {
  /** Rung 1 — already known (registry bootstrap, prior profile, prior application). */
  readonly knownFieldKeys: ReadonlySet<string>;
  /** Rung 2 — an integrated source read can answer it. */
  readonly sourceAnswerableFieldKeys: ReadonlySet<string>;
  /** Rung 3 — refreshing an aging source can answer it. */
  readonly refreshableFieldKeys: ReadonlySet<string>;
  /** Rung 4 — a valid prior answer can be reused. */
  readonly reusablePriorAnswerFieldKeys: ReadonlySet<string>;
  /** Rung 5 — a less-sensitive substitute (proof instead of raw value) suffices. */
  readonly substituteAvailableFieldKeys: ReadonlySet<string>;
  /** Rung 6 — required for the CURRENT goal (everything else defers). */
  readonly requiredForGoalFieldKeys: ReadonlySet<string>;
  /** Rung 7 — needs answering NOW (everything else defers to point-of-need). */
  readonly neededNowFieldKeys: ReadonlySet<string>;
}

export const QUESTION_SUPPRESSION_REASONS = [
  'already_known',
  'source_answerable',
  'source_refreshable',
  'prior_answer_reusable',
  'less_sensitive_substitute',
  'not_required_for_goal',
  'deferred_to_point_of_need',
] as const;
export type QuestionSuppressionReason =
  (typeof QUESTION_SUPPRESSION_REASONS)[number];

export type QuestionAdmissionDecision =
  | {
      readonly admitted: false;
      readonly questionId: string;
      readonly fieldKey: string;
      readonly reason: QuestionSuppressionReason;
    }
  | {
      readonly admitted: true;
      readonly questionId: string;
      readonly fieldKey: string;
      readonly reason: 'irreducible';
    };

/**
 * The deterministic ask-ladder (USER_JOURNEY §0). The first matching rung
 * wins; a question is asked only when every rung fails to answer it and it is
 * both required for the current goal and needed now.
 */
export function admitQuestion(
  question: QuestionCandidate,
  context: QuestionAdmissionContext,
): QuestionAdmissionDecision {
  const { questionId, fieldKey } = question;
  const suppressed = (reason: QuestionSuppressionReason) =>
    ({ admitted: false, questionId, fieldKey, reason }) as const;

  if (context.knownFieldKeys.has(fieldKey)) return suppressed('already_known');
  if (context.sourceAnswerableFieldKeys.has(fieldKey)) {
    return suppressed('source_answerable');
  }
  if (context.refreshableFieldKeys.has(fieldKey)) {
    return suppressed('source_refreshable');
  }
  if (context.reusablePriorAnswerFieldKeys.has(fieldKey)) {
    return suppressed('prior_answer_reusable');
  }
  if (context.substituteAvailableFieldKeys.has(fieldKey)) {
    return suppressed('less_sensitive_substitute');
  }
  if (!context.requiredForGoalFieldKeys.has(fieldKey)) {
    return suppressed('not_required_for_goal');
  }
  if (!context.neededNowFieldKeys.has(fieldKey)) {
    return suppressed('deferred_to_point_of_need');
  }
  return { admitted: true, questionId, fieldKey, reason: 'irreducible' };
}

export interface QuestionAdmissionReport {
  /** Questions that survived the ladder, in deterministic questionId order. */
  readonly asked: readonly QuestionCandidate[];
  /** Every decision, in deterministic questionId order. */
  readonly decisions: readonly QuestionAdmissionDecision[];
  /** Admitted questions that collect a NEW sensitive attribute. */
  readonly sensitiveAttributesCollected: number;
}

/** Runs the ladder over a candidate set. Deterministic: ordered by questionId. */
export function admitQuestions(
  questions: readonly QuestionCandidate[],
  context: QuestionAdmissionContext,
): QuestionAdmissionReport {
  const ordered = [...questions].sort((a, b) =>
    a.questionId.localeCompare(b.questionId),
  );
  const decisions = ordered.map((question) => admitQuestion(question, context));
  const askedIds = new Set(
    decisions.filter((d) => d.admitted).map((d) => d.questionId),
  );
  const asked = ordered.filter((q) => askedIds.has(q.questionId));
  return {
    asked,
    decisions,
    sensitiveAttributesCollected: asked.filter((q) => q.sensitive).length,
  };
}
