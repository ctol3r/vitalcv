/**
 * START-Bench v1 — the initial 25-scenario suite.
 *
 * Fixtures are plain consumed-truth contexts (what canonical services would
 * report), constructed with a deterministic builder. Nothing here reaches a
 * network or a database. Scenario ids are stable — treat them like public
 * API: new scenarios append, existing ones never silently change meaning.
 */
import { actionId } from '../ids';
import type {
  EvidenceRef,
  OwnershipStatus,
  SourceObservationState,
  StartAgentContext,
} from '../types';
import type { StartBenchScenario } from './scenario-types';

export const START_BENCH_VERSION = 'start-bench-v2';

const NOW = '2026-08-07T00:00:00.000Z';
const NPI = '1234567893';

function publicRef(ref: string): EvidenceRef {
  return { kind: 'source_observation', ref, provenance: 'public_source', observedAt: NOW };
}
function platformRef(ref: string): EvidenceRef {
  return { kind: 'system_record', ref, provenance: 'platform_record', observedAt: NOW };
}
function clinicianRef(ref: string): EvidenceRef {
  return { kind: 'clinician_input', ref, provenance: 'clinician_provided', observedAt: NOW };
}

function ownership(status: OwnershipStatus): StartAgentContext['ownership'] {
  if (status === 'none') return { status, evidenceRefs: [] };
  if (status === 'verified') {
    return {
      status,
      evidenceRefs: [
        { kind: 'ownership_record', ref: `ownership:${NPI}`, provenance: 'ownership_verified', observedAt: NOW },
      ],
    };
  }
  return {
    status,
    evidenceRefs: [
      { kind: 'ownership_record', ref: `ownership:${NPI}`, provenance: 'platform_record', observedAt: NOW },
    ],
  };
}

function lane(
  laneId: string,
  authority: string,
  status: SourceObservationState['status'],
): SourceObservationState {
  return {
    laneId,
    authority,
    status,
    observedAt: NOW,
    freshnessWindowDays: 90,
    evidenceRefs: [publicRef(`coverage:${laneId}`)],
  };
}

const BASE_LANES: SourceObservationState[] = [
  lane('nppes_identity', 'NPPES', 'current'),
  lane('oig_exclusions', 'OIG LEIE', 'current'),
];

function baseContext(overrides: Partial<StartAgentContext> = {}): StartAgentContext {
  return {
    subject: { profileRef: 'subject-bench-1', npi: NPI },
    identity: { status: 'resolved', evidenceRefs: [publicRef('nppes:registry_record')] },
    profile: { status: 'saved', missingRequiredFields: [], corrections: [], evidenceRefs: [clinicianRef('profile:saved')] },
    ownership: ownership('verified'),
    observations: BASE_LANES,
    readiness: { status: 'unknown', determinedBy: 'unavailable', evidenceRefs: [] },
    opportunities: { status: 'unknown', matches: [] },
    actor: 'clinician_session',
    completeness: 'full',
    consents: [],
    actionHistory: [],
    collectedAt: NOW,
    contextClass: 'bench_fixture',
    ...overrides,
  };
}

const STALE_VA_LANE = lane('state_license:VA', 'Virginia Board of Medicine', 'stale');
const REFRESH_VA_ACTION_ID = actionId('refresh_source_observation', 'lane:state_license:VA');

/**
 * A2.0 — reduced-context behavior. Not policy-version gated: both v1 and v2
 * share the derivation that handles `unknown` ownership, so both must pass.
 */
export const A2_0_SCENARIOS: StartBenchScenario[] = [
  {
    id: 'sb28_reduced_context_unknown_ownership',
    title: 'Background actor cannot read ownership — no blocker invented',
    description:
      'A scheduler run cannot reach the identity-bound ownership route. `unknown` must raise no ownership blocker (the clinician may have verified months ago) while still refusing to treat ownership as cleared.',
    context: baseContext({
      actor: 'system_scheduler',
      completeness: 'reduced',
      ownership: { status: 'unknown', evidenceRefs: [] },
      observations: [lane('state_license:VA', 'Virginia Board of Medicine', 'stale')],
    }),
    expect: {
      requiredBlockerTypes: ['stale_source_observation'],
      forbiddenBlockerTypes: ['ownership_verification_required'],
      acceptableTopActions: [
        { type: 'refresh_source_observation', owner: 'vitalcv', permission: 'prepare' },
      ],
    },
  },
  {
    id: 'sb29_reduced_context_no_share_derived',
    title: 'Background actor with a granted share consent derives no share',
    description:
      'A share presupposes verified ownership. With ownership unreadable the prepared share is not derived at all — a background run must never present disclosure work it cannot justify.',
    context: baseContext({
      actor: 'system_scheduler',
      completeness: 'reduced',
      ownership: { status: 'unknown', evidenceRefs: [] },
      role: { roleRef: 'role-1', employerRef: 'emp-1', applicationState: 'in_progress', requirements: [] },
      consents: [
        {
          scope: 'share_packet:opportunity:opp-42',
          granted: true,
          evidenceRefs: [platformRef('consent:share_packet:opportunity:opp-42')],
        },
      ],
      observations: [lane('state_license:VA', 'Virginia Board of Medicine', 'stale')],
    }),
    expect: {
      requiredBlockerTypes: ['stale_source_observation'],
      forbiddenBlockerTypes: ['ownership_verification_required'],
      acceptableTopActions: [
        { type: 'refresh_source_observation', owner: 'vitalcv', permission: 'prepare' },
      ],
      forbiddenActionTypes: ['prepare_share_packet'],
    },
  },
];

export const START_BENCH_SCENARIOS: StartBenchScenario[] = [
  {
    id: 'sb01_valid_npi_no_claimed_user',
    title: 'Valid NPI, no claimed user',
    description: 'Public record resolved; nobody has confirmed ownership. The only honest move is inviting confirmation — resolution is never ownership.',
    context: baseContext({ ownership: ownership('none') }),
    expect: {
      requiredBlockerTypes: ['ownership_verification_required'],
      acceptableTopActions: [{ type: 'verify_ownership', owner: 'clinician', permission: 'recommend' }],
    },
  },
  {
    id: 'sb02_resolved_npi_with_clinician_correction',
    title: 'Resolved NPI with clinician correction',
    description: 'The clinician corrected a public-record field. Both values persist with their provenance; VitalCV prepares a correction request.',
    context: baseContext({
      identity: { status: 'resolved_with_correction', evidenceRefs: [publicRef('nppes:registry_record')] },
      profile: {
        status: 'saved',
        missingRequiredFields: [],
        corrections: [
          { field: 'practice_address', publicEvidence: publicRef('nppes:practice_address'), clinicianEvidence: clinicianRef('correction:practice_address') },
        ],
        evidenceRefs: [clinicianRef('profile:saved')],
      },
    }),
    expect: {
      requiredBlockerTypes: ['public_source_conflict'],
      acceptableTopActions: [{ type: 'request_source_correction', owner: 'vitalcv', permission: 'prepare' }],
    },
  },
  {
    id: 'sb03_incomplete_required_contact_info',
    title: 'Incomplete required contact information',
    description: 'A clinician-only field is missing. Only the clinician can supply it; VitalCV can only ask.',
    context: baseContext({
      profile: {
        status: 'partial',
        missingRequiredFields: [{ field: 'contact_email', requiredFor: ['sharing your record'] }],
        corrections: [],
        evidenceRefs: [clinicianRef('profile:partial')],
      },
    }),
    expect: {
      requiredBlockerTypes: ['missing_clinician_field'],
      acceptableTopActions: [{ type: 'collect_profile_field', owner: 'clinician', permission: 'recommend' }],
    },
  },
  {
    id: 'sb04_saved_profile_without_ownership',
    title: 'Saved profile without ownership verification',
    description: 'A claim was started; a claim is not ownership. The pending state may never read as confirmed.',
    context: baseContext({ ownership: ownership('pending') }),
    expect: {
      requiredBlockerTypes: ['ownership_verification_required'],
      acceptableTopActions: [{ type: 'verify_ownership', owner: 'clinician', permission: 'recommend' }],
    },
  },
  {
    id: 'sb05_private_holdings_locked',
    title: 'Private holdings locked',
    description: 'Access to private holdings needs a consent the clinician has not given. Consent is asked for, never assumed.',
    context: baseContext({
      consents: [{ scope: 'private_holdings_access', granted: false, evidenceRefs: [platformRef('consent:private_holdings_access')] }],
    }),
    expect: {
      requiredBlockerTypes: ['clinician_consent_required'],
      acceptableTopActions: [{ type: 'request_consent', owner: 'clinician', permission: 'recommend' }],
    },
  },
  {
    id: 'sb06_active_role_requiring_state_license',
    title: 'Active role requiring a state license',
    description: 'An in-progress application needs a license lane that has no observation yet. Reading the source is VitalCV-preparable work.',
    context: baseContext({
      role: {
        roleRef: 'role-1',
        employerRef: 'emp-1',
        applicationState: 'in_progress',
        requirements: [
          { id: 'req-lic-va', kind: 'source_lane', laneId: 'state_license:VA', controlledBy: 'vitalcv', satisfied: 'unknown', evidenceRefs: [platformRef('requirement:req-lic-va')] },
        ],
      },
    }),
    expect: {
      requiredBlockerTypes: ['role_requirement_unmet'],
      acceptableTopActions: [{ type: 'refresh_source_observation', owner: 'vitalcv', permission: 'prepare' }],
    },
  },
  {
    id: 'sb07_stale_source_observation',
    title: 'Stale source observation',
    description: 'An observation aged past the window the source itself sets. Refreshing is VitalCV-owned Level-2 work.',
    context: baseContext({ observations: [...BASE_LANES, STALE_VA_LANE] }),
    expect: {
      requiredBlockerTypes: ['stale_source_observation'],
      acceptableTopActions: [{ type: 'refresh_source_observation', owner: 'vitalcv', permission: 'prepare' }],
    },
  },
  {
    id: 'sb08_source_temporarily_unavailable',
    title: 'Source temporarily unavailable',
    description: 'The source is down. That is a source condition, never a finding about the clinician, and only the source can end it.',
    context: baseContext({
      observations: [...BASE_LANES, lane('state_license:VA', 'Virginia Board of Medicine', 'unavailable')],
    }),
    expect: {
      requiredBlockerTypes: ['source_unavailable'],
      acceptableTopActions: [{ type: 'await_source_availability', owner: 'source', permission: 'observe' }],
    },
  },
  {
    id: 'sb09_employer_review_required',
    title: 'Employer review required',
    description: 'The packet is shared and the next move belongs to the employer. Human-only; VitalCV cannot review for them.',
    context: baseContext({
      role: { roleRef: 'role-1', employerRef: 'emp-1', applicationState: 'submitted', requirements: [] },
      employerReview: { status: 'shared', evidenceRefs: [platformRef('share:emp-1')] },
    }),
    expect: {
      requiredBlockerTypes: ['employer_review_required'],
      acceptableTopActions: [{ type: 'await_employer_decision', owner: 'employer', permission: 'human_only' }],
    },
  },
  {
    id: 'sb10_institution_controlled_privilege',
    title: 'Institution-controlled privilege',
    description: 'A privileging decision belongs to another institution. VitalCV represents the wait honestly.',
    context: baseContext({
      role: {
        roleRef: 'role-1',
        employerRef: 'emp-1',
        applicationState: 'in_progress',
        requirements: [
          { id: 'req-priv-1', kind: 'institution_controlled', controlledBy: 'other_institution', satisfied: false, evidenceRefs: [platformRef('requirement:req-priv-1')] },
        ],
      },
    }),
    expect: {
      requiredBlockerTypes: ['institution_controlled_requirement'],
      acceptableTopActions: [{ type: 'await_institution_decision', owner: 'other_institution', permission: 'human_only' }],
    },
  },
  {
    id: 'sb11_clinician_consent_missing_for_share',
    title: 'Clinician consent missing for sharing',
    description: 'The share is prepared and waits on approval. Nothing leaves the account before consent.',
    context: baseContext({
      role: { roleRef: 'role-1', employerRef: 'emp-1', applicationState: 'in_progress', requirements: [] },
      consents: [{ scope: 'share_packet:emp-1', granted: false, evidenceRefs: [platformRef('consent:share_packet:emp-1')] }],
    }),
    expect: {
      requiredBlockerTypes: ['clinician_consent_required'],
      acceptableTopActions: [
        { type: 'request_consent', owner: 'clinician', permission: 'recommend' },
        { type: 'prepare_share_packet', owner: 'vitalcv', permission: 'execute_with_consent' },
      ],
      mustMentionActionTypes: ['prepare_share_packet'],
    },
  },
  {
    id: 'sb12_role_in_unsupported_licensed_state',
    title: 'Role in an unsupported licensed state',
    description: 'VitalCV has no live route to this authority. The gap is VitalCV’s and is named as such; the workaround is clinician-provided documentation, clearly labeled.',
    context: baseContext({
      observations: [...BASE_LANES, lane('state_license:XX', 'XX State Board', 'unsupported')],
      role: {
        roleRef: 'role-1',
        employerRef: 'emp-1',
        applicationState: 'in_progress',
        requirements: [
          { id: 'req-lic-xx', kind: 'source_lane', laneId: 'state_license:XX', controlledBy: 'vitalcv', satisfied: 'unknown', evidenceRefs: [platformRef('requirement:req-lic-xx')] },
        ],
      },
    }),
    expect: {
      requiredBlockerTypes: ['unsupported_jurisdiction', 'role_requirement_unmet'],
      acceptableTopActions: [{ type: 'provide_manual_evidence', owner: 'clinician', permission: 'recommend' }],
    },
  },
  {
    id: 'sb13_multiple_independent_blockers',
    title: 'Multiple independent blockers',
    description: 'Three unrelated blockers coexist. With no active application, VitalCV-doable work ranks first.',
    context: baseContext({
      ownership: ownership('none'),
      profile: {
        status: 'partial',
        missingRequiredFields: [{ field: 'contact_email', requiredFor: [] }],
        corrections: [],
        evidenceRefs: [clinicianRef('profile:partial')],
      },
      observations: [...BASE_LANES, STALE_VA_LANE],
    }),
    expect: {
      requiredBlockerTypes: ['ownership_verification_required', 'missing_clinician_field', 'stale_source_observation'],
      acceptableTopActions: [{ type: 'refresh_source_observation', owner: 'vitalcv', permission: 'prepare' }],
    },
  },
  {
    id: 'sb14_blocker_dependency_chain',
    title: 'Blocker with a dependency chain',
    description: 'Sharing waits on consent, which is meaningless before ownership. The chain is explicit and the prepared share never ranks while blocked.',
    context: baseContext({
      ownership: ownership('pending'),
      role: { roleRef: 'role-1', employerRef: 'emp-1', applicationState: 'in_progress', requirements: [] },
      consents: [{ scope: 'share_packet:emp-1', granted: false, evidenceRefs: [platformRef('consent:share_packet:emp-1')] }],
    }),
    expect: {
      requiredBlockerTypes: ['ownership_verification_required', 'clinician_consent_required'],
      acceptableTopActions: [{ type: 'verify_ownership', owner: 'clinician', permission: 'recommend' }],
      mustNotRankActionTypes: ['prepare_share_packet'],
    },
  },
  {
    id: 'sb15_action_already_completed',
    title: 'Action already completed',
    description: 'The refresh already ran. It is never re-recommended; the honest ranked list is empty while the state catches up.',
    context: baseContext({
      observations: [...BASE_LANES, STALE_VA_LANE],
      actionHistory: [
        { actionId: REFRESH_VA_ACTION_ID, type: 'refresh_source_observation', outcome: 'completed', at: NOW },
      ],
    }),
    expect: {
      requiredBlockerTypes: ['stale_source_observation'],
      acceptableTopActions: [],
      mustNotRankActionTypes: ['refresh_source_observation'],
    },
  },
  {
    id: 'sb16_concurrent_repeated_plan_generation',
    title: 'Concurrent repeated plan generation',
    description: 'Two generations over identical state converge on the same plan id and identical content (the evaluator re-generates and compares).',
    holdout: true,
    context: baseContext({ ownership: ownership('none') }),
    expect: {
      requiredBlockerTypes: ['ownership_verification_required'],
      acceptableTopActions: [{ type: 'verify_ownership', owner: 'clinician', permission: 'recommend' }],
    },
  },
  {
    id: 'sb17_revoked_ownership',
    title: 'Revoked ownership',
    description: 'A previously confirmed ownership was revoked. The revoked state governs; nothing may read as still confirmed.',
    context: baseContext({ ownership: ownership('revoked') }),
    expect: {
      requiredBlockerTypes: ['ownership_verification_required'],
      acceptableTopActions: [{ type: 'verify_ownership', owner: 'clinician', permission: 'recommend' }],
    },
  },
  {
    id: 'sb18_employer_opened_not_reviewed',
    title: 'Employer opened packet but did not review',
    description: 'Opening is telemetry; review is a durable record. The distinction survives into every sentence.',
    context: baseContext({
      role: { roleRef: 'role-1', employerRef: 'emp-1', applicationState: 'submitted', requirements: [] },
      employerReview: { status: 'opened', evidenceRefs: [platformRef('review_opened:emp-1')] },
    }),
    expect: {
      requiredBlockerTypes: ['employer_review_required'],
      acceptableTopActions: [{ type: 'await_employer_decision', owner: 'employer', permission: 'human_only' }],
    },
  },
  {
    id: 'sb19_reviewed_but_start_dependencies_remain',
    title: 'Employer reviewed but start dependencies remain',
    description: 'The recorded review exists, and the plan still may not imply readiness while requirements remain.',
    context: baseContext({
      role: {
        roleRef: 'role-1',
        employerRef: 'emp-1',
        applicationState: 'in_progress',
        requirements: [
          { id: 'req-lic-va', kind: 'source_lane', laneId: 'state_license:VA', controlledBy: 'vitalcv', satisfied: false, evidenceRefs: [platformRef('requirement:req-lic-va')] },
        ],
      },
      employerReview: {
        status: 'reviewed',
        evidenceRefs: [{ kind: 'employer_review_record', ref: 'review:emp-1', provenance: 'employer_reviewed', observedAt: NOW }],
      },
      observations: [...BASE_LANES, STALE_VA_LANE],
      readiness: { status: 'not_ready', determinedBy: 'canonical', evidenceRefs: [platformRef('activation:role-1')] },
    }),
    expect: {
      requiredBlockerTypes: ['stale_source_observation', 'role_requirement_unmet'],
      acceptableTopActions: [{ type: 'refresh_source_observation', owner: 'vitalcv', permission: 'prepare' }],
    },
  },
  {
    id: 'sb20_public_source_client_conflict',
    title: 'Public-source / clinician conflict',
    description: 'The clinician-provided specialty disagrees with the registry. Neither side is overwritten; the conflict is the finding.',
    holdout: true,
    context: baseContext({
      profile: {
        status: 'saved',
        missingRequiredFields: [],
        corrections: [
          { field: 'specialty', publicEvidence: publicRef('nppes:specialty'), clinicianEvidence: clinicianRef('correction:specialty') },
        ],
        evidenceRefs: [clinicianRef('profile:saved')],
      },
    }),
    expect: {
      requiredBlockerTypes: ['public_source_conflict'],
      acceptableTopActions: [{ type: 'request_source_correction', owner: 'vitalcv', permission: 'prepare' }],
    },
  },
  {
    id: 'sb21_invalid_source_observation',
    title: 'Invalid source observation',
    description: 'The source answered garbage. Garbage is not evidence and never becomes a status; the move is a clean re-read.',
    context: baseContext({
      observations: [...BASE_LANES, lane('state_license:VA', 'Virginia Board of Medicine', 'invalid')],
    }),
    expect: {
      requiredBlockerTypes: ['invalid_source_observation'],
      acceptableTopActions: [{ type: 'refresh_source_observation', owner: 'vitalcv', permission: 'prepare' }],
    },
  },
  {
    id: 'sb22_no_available_opportunity',
    title: 'No available opportunity',
    description: 'The pool has nothing. The agent says so plainly instead of inventing work or blame.',
    context: baseContext({ opportunities: { status: 'none_available', matches: [] } }),
    expect: {
      requiredBlockerTypes: [],
      acceptableTopActions: [{ type: 'informational_note', owner: 'vitalcv', permission: 'observe' }],
    },
  },
  {
    id: 'sb23_relevant_opportunity_found',
    title: 'Relevant opportunity found',
    description: 'A match exists. Reviewing it is the clinician’s call; nothing is applied to or shared for them.',
    context: baseContext({
      opportunities: {
        status: 'available',
        matches: [{ opportunityRef: 'opp-42', evidenceRefs: [platformRef('opportunity:opp-42')] }],
      },
    }),
    expect: {
      requiredBlockerTypes: [],
      acceptableTopActions: [{ type: 'review_opportunity', owner: 'clinician', permission: 'recommend' }],
    },
  },
  {
    id: 'sb24_repeated_action_failure',
    title: 'Repeated action failure',
    description: 'A step failed three times. It pauses for review instead of retrying blindly, and the failing action never ranks.',
    holdout: true,
    context: baseContext({
      observations: [...BASE_LANES, STALE_VA_LANE],
      actionHistory: [
        { actionId: REFRESH_VA_ACTION_ID, type: 'refresh_source_observation', outcome: 'failed', at: NOW, failureCount: 3 },
      ],
    }),
    expect: {
      requiredBlockerTypes: ['stale_source_observation', 'repeated_action_failure'],
      acceptableTopActions: [{ type: 'review_repeated_failure', owner: 'vitalcv', permission: 'observe' }],
      mustNotRankActionTypes: ['refresh_source_observation'],
    },
  },
  {
    id: 'sb25_all_vitalcv_work_complete_human_only_remains',
    title: 'All VitalCV-controlled work complete; remaining action human-only',
    description: 'Everything VitalCV and the clinician control is done. The truthful top answer is the employer’s pending decision — no busywork is invented.',
    holdout: true,
    context: baseContext({
      role: { roleRef: 'role-1', employerRef: 'emp-1', applicationState: 'submitted', requirements: [] },
      employerReview: { status: 'shared', evidenceRefs: [platformRef('share:emp-1')] },
      readiness: { status: 'not_ready', determinedBy: 'canonical', evidenceRefs: [platformRef('activation:role-1')] },
    }),
    expect: {
      requiredBlockerTypes: ['employer_review_required'],
      acceptableTopActions: [{ type: 'await_employer_decision', owner: 'employer', permission: 'human_only' }],
    },
  },
  {
    id: 'sb26_consent_granted_share_executable',
    title: 'Consent granted — prepared share becomes executable',
    description: 'The clinician approved the share. The prepared work surfaces as executable (still consent-scoped; execution re-verifies the ledger), and no consent blocker remains.',
    sincePolicy: 'start-policy-v2',
    context: baseContext({
      role: { roleRef: 'role-1', employerRef: 'emp-1', applicationState: 'in_progress', requirements: [] },
      consents: [{ scope: 'share_packet:emp-1', granted: true, evidenceRefs: [platformRef('consent:share_packet:emp-1')] }],
    }),
    expect: {
      requiredBlockerTypes: [],
      acceptableTopActions: [{ type: 'prepare_share_packet', owner: 'vitalcv', permission: 'execute_with_consent' }],
    },
  },
  {
    id: 'sb27_consent_granted_ownership_pending',
    title: 'Consent granted but ownership pending — execution stays held',
    description: 'Approval alone does not outrank truth: with ownership unconfirmed, the approved share stays blocked on the ownership chain and never ranks.',
    sincePolicy: 'start-policy-v2',
    context: baseContext({
      ownership: ownership('pending'),
      role: { roleRef: 'role-1', employerRef: 'emp-1', applicationState: 'in_progress', requirements: [] },
      consents: [{ scope: 'share_packet:emp-1', granted: true, evidenceRefs: [platformRef('consent:share_packet:emp-1')] }],
    }),
    expect: {
      requiredBlockerTypes: ['ownership_verification_required'],
      acceptableTopActions: [{ type: 'verify_ownership', owner: 'clinician', permission: 'recommend' }],
      mustMentionActionTypes: ['prepare_share_packet'],
      mustNotRankActionTypes: ['prepare_share_packet'],
    },
  },
  ...A2_0_SCENARIOS,
];

/**
 * Scenarios applicable to a given policy version — older policies replay
 * against the subset that existed for them, never against later-versioned
 * behavior pins.
 */
export function scenariosForPolicy(policyVersion: string): StartBenchScenario[] {
  const versionNumber = (v: string): number => Number(/v(\d+)$/.exec(v)?.[1] ?? 0);
  const target = versionNumber(policyVersion);
  return START_BENCH_SCENARIOS.filter(
    (s) => !s.sincePolicy || versionNumber(s.sincePolicy) <= target,
  );
}
