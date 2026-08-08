/**
 * START-Bench temporal suite — A2.2.
 *
 * A0/A1 scenarios evaluate ONE state. A2's behavior is about transitions, so
 * these are pairs: a prior context and a next context, with hand-labeled
 * expectations for which deltas should appear and which of them are material.
 *
 * The single most important scenario is the first: advance only the clock and
 * expect zero deltas. `contextFingerprint` and `planId` both change in that
 * case, so anything built on them reports a change every tick.
 *
 * Everything runs on an injected clock, which A0 already supports because no
 * policy code reads one. That decision pays off here.
 */
import { actionId } from '../ids';
import type { PlanDeltaKind } from '../delta/diff';
import type {
  EvidenceRef,
  OwnershipStatus,
  SourceObservationState,
  StartAgentContext,
} from '../types';

const T1 = '2026-08-08T00:00:00.000Z';
const T2 = '2026-08-09T00:00:00.000Z';
const NPI = '1234567893';

function publicRef(ref: string, observedAt: string): EvidenceRef {
  return { kind: 'source_observation', ref, provenance: 'public_source', observedAt };
}
function platformRef(ref: string, at: string): EvidenceRef {
  return { kind: 'system_record', ref, provenance: 'platform_record', observedAt: at };
}

function ownership(status: OwnershipStatus, at: string): StartAgentContext['ownership'] {
  if (status === 'none' || status === 'unknown') return { status, evidenceRefs: [] };
  return {
    status,
    evidenceRefs: [
      {
        kind: 'ownership_record',
        ref: `ownership:${NPI}`,
        provenance: status === 'verified' ? 'ownership_verified' : 'platform_record',
        observedAt: at,
      },
    ],
  };
}

export function lane(
  laneId: string,
  status: SourceObservationState['status'],
  observedAt: string,
): SourceObservationState {
  return {
    laneId,
    authority: `${laneId} authority`,
    status,
    observedAt,
    freshnessWindowDays: 90,
    evidenceRefs: [publicRef(`coverage:${laneId}`, observedAt)],
  };
}

export function ctx(at: string, overrides: Partial<StartAgentContext> = {}): StartAgentContext {
  return {
    subject: { profileRef: 'subject-temporal-1', npi: NPI },
    identity: { status: 'resolved', evidenceRefs: [publicRef('nppes:registry_record', at)] },
    profile: { status: 'saved', missingRequiredFields: [], corrections: [], evidenceRefs: [] },
    ownership: ownership('verified', at),
    // Pinned to T1 deliberately: the base fixture holds observations still so
    // advancing the run clock does not implicitly "refresh" every lane. A
    // scenario moves only the one variable it is about.
    observations: [lane('nppes_identity', 'current', T1)],
    readiness: { status: 'unknown', determinedBy: 'unavailable', evidenceRefs: [] },
    opportunities: { status: 'unknown', matches: [] },
    actor: 'clinician_session',
    completeness: 'full',
    consents: [],
    actionHistory: [],
    collectedAt: at,
    contextClass: 'temporal_bench',
    ...overrides,
  };
}

export interface TemporalExpectation {
  /** Delta kinds that must appear. */
  requiredKinds: PlanDeltaKind[];
  /** When true (default), the produced kind set must EQUAL requiredKinds. */
  exactKinds?: boolean;
  /** Exact number of deltas whose `material` is true. */
  materialCount: number;
  /** Set when the pair must NOT be comparable at all. */
  notComparable?: 'completeness_mismatch' | 'no_prior_run' | 'projection_version_mismatch';
}

export interface TemporalScenario {
  id: string;
  title: string;
  description: string;
  prior: StartAgentContext;
  next: StartAgentContext;
  expect: TemporalExpectation;
}

export const TEMPORAL_SCENARIOS: TemporalScenario[] = [
  {
    id: 'tb01_clock_only',
    title: 'Clock advances, nothing else',
    description:
      'The fingerprint trap. contextFingerprint and planId both change here; the decision content does not, so there must be zero deltas — not one, and certainly not a notification.',
    prior: ctx(T1),
    next: ctx(T2, { observations: [lane('nppes_identity', 'current', T1)] }),
    expect: { requiredKinds: [], materialCount: 0 },
  },
  {
    id: 'tb02_refresh_no_change',
    title: 'Refresh succeeded, status unchanged',
    description:
      'The most common outcome there will ever be. Recorded for the learning loop, explicitly NOT material, and never surfaced.',
    prior: ctx(T1),
    next: ctx(T2, { observations: [lane('nppes_identity', 'current', T2)] }),
    expect: { requiredKinds: ['observation_refreshed_no_change'], materialCount: 0 },
  },
  {
    id: 'tb03_stale_cleared',
    title: 'Refresh landed: stale became current',
    description: 'The blocker clears and the work VitalCV was going to do disappears with it.',
    prior: ctx(T1, {
      observations: [lane('nppes_identity', 'current', T1), lane('state_license:VA', 'stale', T1)],
    }),
    next: ctx(T2, {
      observations: [lane('nppes_identity', 'current', T1), lane('state_license:VA', 'current', T2)],
    }),
    expect: {
      requiredKinds: ['blocker_cleared', 'top_action_changed'],
      materialCount: 2,
    },
  },
  {
    id: 'tb04_lane_went_stale',
    title: 'A lane aged out of its window',
    description:
      'A reading ageing out is staleness, not a status change about the license. A blocker opens and VitalCV can act on it.',
    prior: ctx(T1, {
      observations: [lane('nppes_identity', 'current', T1), lane('state_license:VA', 'current', T1)],
    }),
    next: ctx(T2, {
      observations: [lane('nppes_identity', 'current', T1), lane('state_license:VA', 'stale', T1)],
    }),
    expect: {
      requiredKinds: ['blocker_opened', 'top_action_changed'],
      materialCount: 2,
    },
  },
  {
    id: 'tb05_employer_opened_not_material',
    title: 'Employer opened the packet',
    description:
      'Opening is not reviewing. The transition is recorded so the funnel can see it, and it is deliberately not material: nothing the clinician can act on has changed.',
    prior: ctx(T1, {
      role: { roleRef: 'r1', employerRef: 'e1', applicationState: 'submitted', requirements: [] },
      employerReview: { status: 'shared', evidenceRefs: [platformRef('review:e1', T1)] },
    }),
    next: ctx(T2, {
      role: { roleRef: 'r1', employerRef: 'e1', applicationState: 'submitted', requirements: [] },
      employerReview: { status: 'opened', evidenceRefs: [platformRef('review:e1', T2)] },
    }),
    expect: { requiredKinds: ['external_state_changed'], materialCount: 0 },
  },
  {
    id: 'tb06_employer_reviewed_material',
    title: 'Employer recorded a review',
    description:
      'The employer-owned blocker clears and the state change is material — this is the one the clinician has been waiting on.',
    prior: ctx(T1, {
      role: { roleRef: 'r1', employerRef: 'e1', applicationState: 'submitted', requirements: [] },
      employerReview: { status: 'opened', evidenceRefs: [platformRef('review:e1', T1)] },
    }),
    next: ctx(T2, {
      role: { roleRef: 'r1', employerRef: 'e1', applicationState: 'submitted', requirements: [] },
      employerReview: { status: 'reviewed', evidenceRefs: [platformRef('review:e1', T2)] },
    }),
    expect: {
      requiredKinds: ['blocker_cleared', 'external_state_changed', 'top_action_changed'],
      exactKinds: false,
      materialCount: 3,
    },
  },
  {
    id: 'tb07_reduced_vs_full_suppressed',
    title: 'Reduced plan against a full one',
    description:
      'Diffing across completeness would report the gap between what two actors can see as though it were a change in the world. Suppressed, never fabricated.',
    prior: ctx(T1),
    next: ctx(T2, {
      actor: 'system_scheduler',
      completeness: 'reduced',
      ownership: ownership('unknown', T2),
    }),
    expect: { requiredKinds: [], materialCount: 0, notComparable: 'completeness_mismatch' },
  },
  {
    id: 'tb08_source_unavailable_persists',
    title: 'Source unavailable across consecutive ticks',
    description:
      'A source that stays down must not accumulate one blocker per tick. Content-derived blocker ids make the second tick produce nothing.',
    prior: ctx(T1, {
      observations: [lane('nppes_identity', 'current', T1), lane('state_license:VA', 'unavailable', T1)],
    }),
    next: ctx(T2, {
      observations: [lane('nppes_identity', 'current', T1), lane('state_license:VA', 'unavailable', T1)],
    }),
    expect: { requiredKinds: [], materialCount: 0 },
  },
  {
    id: 'tb09_repeated_failure_pauses_once',
    title: 'Repeated failure crosses the threshold',
    description:
      'Crossing the pause threshold produces exactly one blocker, and the tick after it produces nothing new.',
    prior: ctx(T1, {
      observations: [lane('nppes_identity', 'current', T1), lane('state_license:VA', 'stale', T1)],
    }),
    next: ctx(T2, {
      observations: [lane('nppes_identity', 'current', T1), lane('state_license:VA', 'stale', T1)],
      actionHistory: [
        {
          // The REAL derived id, so the history actually marks the refresh
          // action failed rather than referring to nothing.
          actionId: actionId('refresh_source_observation', 'lane:state_license:VA'),
          type: 'refresh_source_observation',
          outcome: 'failed',
          at: T2,
          failureCount: 3,
        },
      ],
    }),
    expect: {
      // Three consequences, each of which the clinician's picture actually
      // changed by: the pause blocker opens, the refresh stops being
      // runnable, and the top step moves off it.
      requiredKinds: ['blocker_opened', 'action_became_blocked', 'top_action_changed'],
      materialCount: 3,
    },
  },
  {
    id: 'tb10_identical_state_idempotent',
    title: 'Two ticks over byte-identical state',
    description: 'No deltas, no duplicate work, nothing to say.',
    prior: ctx(T1),
    next: ctx(T1),
    expect: { requiredKinds: [], materialCount: 0 },
  },
];
