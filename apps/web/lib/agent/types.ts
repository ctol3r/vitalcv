/**
 * Start Agent A0 — canonical domain types.
 *
 * The Start Agent continuously answers one internal question:
 *   "What can VitalCV do now that removes work or reduces time-to-start
 *    for this clinician?"
 *
 * Truth contract (docs/architecture/vitalcv-knowledge-trust-graph.md): the
 * agent CONSUMES truth from canonical services; it never manufactures it.
 * These types make the load-bearing distinctions structural rather than
 * conventions scattered across UI strings:
 *
 *  - provenance classes (public source / clinician provided / ownership
 *    verified / employer reviewed) ride on every piece of evidence and never
 *    collapse into one another;
 *  - progress states (resolved / profile saved / ownership verified /
 *    employer reviewed / ready to start) are independent fields read from
 *    canonical services — no agent inference derives one from another;
 *  - `ReadinessState` can only carry `ready_to_start` when a canonical
 *    readiness service said so (`determinedBy: 'canonical'`); the union makes
 *    the collapsed form unrepresentable, and the policy engine has no code
 *    path that writes it.
 */

// ---------------------------------------------------------------------------
// Owners and permissions
// ---------------------------------------------------------------------------

export const ACTION_OWNERS = [
  'vitalcv',
  'clinician',
  'employer',
  'source',
  'other_institution',
] as const;
export type ActionOwner = (typeof ACTION_OWNERS)[number];

export const PERMISSION_CLASSES = [
  'observe',
  'recommend',
  'prepare',
  'execute_with_consent',
  'human_only',
] as const;
export type PermissionClass = (typeof PERMISSION_CLASSES)[number];

/** Execution levels 0–4 map 1:1 onto permission classes. */
export type ExecutionLevel = 0 | 1 | 2 | 3 | 4;
export const EXECUTION_LEVEL_BY_PERMISSION: Record<PermissionClass, ExecutionLevel> = {
  observe: 0,
  recommend: 1,
  prepare: 2,
  execute_with_consent: 3,
  human_only: 4,
};

/**
 * A0 executes nothing above Level 2 (prepare). Levels 3–4 exist in the
 * representation so plans can carry them, but the tool registry refuses to
 * run them (see tools/registry.ts).
 */
export const MAX_EXECUTABLE_LEVEL_A0: ExecutionLevel = 2;

// ---------------------------------------------------------------------------
// Provenance and evidence
// ---------------------------------------------------------------------------

export const PROVENANCE_CLASSES = [
  'public_source',
  'clinician_provided',
  'ownership_verified',
  'employer_reviewed',
  /**
   * VitalCV's own operational records: ownership claims in progress or
   * revoked, consent grants, action history. This class exists so platform
   * facts never masquerade as one of the four truth classes above —
   * `ownership_verified` provenance is reserved for evidence backed by a
   * CURRENTLY-verified ownership record (enforced in truth-boundary.ts).
   */
  'platform_record',
] as const;
export type ProvenanceClass = (typeof PROVENANCE_CLASSES)[number];

export type EvidenceKind =
  | 'source_observation'
  | 'clinician_input'
  | 'ownership_record'
  | 'employer_review_record'
  | 'opportunity_record'
  | 'system_record';

/**
 * A pointer to evidence, never the evidence itself. `ref` is an opaque id
 * (lane id, receipt id, row uuid) — raw credential text must not travel
 * through the agent layer (see model/context-builder.ts).
 */
export interface EvidenceRef {
  kind: EvidenceKind;
  ref: string;
  provenance: ProvenanceClass;
  /** ISO timestamp of when the underlying evidence was observed/recorded. */
  observedAt?: string;
}

// ---------------------------------------------------------------------------
// Subject
// ---------------------------------------------------------------------------

export interface SubjectRef {
  /**
   * Opaque canonical subject reference. The context assembler must state
   * which id space it comes from and never mix spaces — the Clerk-subject vs
   * internal-User.id confusion is a known 500-class bug (npi_ownership.user_id
   * holds the INTERNAL uuid). In the A0 web route this is the Clerk user id,
   * the established web-side person key (MatchaPreference precedent).
   */
  profileRef: string;
  /** NPI is public-registry data; present so public-source tools can key on it. */
  npi?: string;
}

// ---------------------------------------------------------------------------
// Consumed truth: the StartAgentContext
// ---------------------------------------------------------------------------

/**
 * "Resolved" is a statement about the PUBLIC registry record only. It carries
 * no identity-ownership meaning; ownership lives in `OwnershipState` and the
 * two never merge.
 */
export type NpiResolutionStatus =
  | 'unresolved'
  | 'resolved'
  | 'resolved_with_correction'
  | 'invalid';

export interface NpiResolutionState {
  status: NpiResolutionStatus;
  evidenceRefs: EvidenceRef[];
}

/** A profile field the clinician has not yet supplied, and what needs it. */
export interface ProfileFieldGap {
  field: string;
  /** Human-readable requirement labels this gap blocks (roles, sharing, etc.). */
  requiredFor: string[];
}

/**
 * A clinician correction that disagrees with a public-source value. Both
 * sides are preserved with their own provenance; the agent never picks a
 * winner — surfacing the conflict is the only permitted move.
 */
export interface SourceCorrection {
  field: string;
  publicEvidence: EvidenceRef;
  clinicianEvidence: EvidenceRef;
}

export interface ClinicianProfileState {
  status: 'none' | 'partial' | 'saved';
  missingRequiredFields: ProfileFieldGap[];
  corrections: SourceCorrection[];
  evidenceRefs: EvidenceRef[];
}

/**
 * Read from the canonical ownership record only. Vocabulary mirrors the
 * canonical service (`apps/api/backend/src/services/ownership/npiOwnershipState.ts`):
 * `pending` = claimed but not verified (claimed is NOT verified), `delegated` =
 * verified-equivalent access granted by delegation, `none` = no row.
 */
export type OwnershipStatus = 'none' | 'pending' | 'verified' | 'delegated' | 'revoked';

export interface OwnershipState {
  status: OwnershipStatus;
  evidenceRefs: EvidenceRef[];
}

/**
 * One source lane as the canonical trust-state layer reports it. `unsupported`
 * means VitalCV has no live route to that authority (honest coverage gap, not
 * a clinician problem). `invalid` means the source returned something that
 * failed validation — which is NOT evidence of anything (never upgraded).
 * `not_found` is a finding (the source was checked and holds no record), not
 * missing evidence.
 */
export type SourceObservationStatus =
  | 'current'
  | 'stale'
  | 'pending'
  | 'unavailable'
  | 'invalid'
  | 'not_found'
  | 'adverse'
  | 'unsupported'
  /** Institutional access to the source is not configured (canonical `accessRequired`/`gated`). */
  | 'access_required'
  /** The source answered but the response needs human review before use. */
  | 'review_required'
  | 'not_checked';

export interface SourceObservationState {
  /** Canonical lane id, e.g. `nppes_identity`, `state_license:VA`. */
  laneId: string;
  /** The authority that owns this truth (the source is the authority, always). */
  authority: string;
  status: SourceObservationStatus;
  observedAt?: string;
  /** The source's own preferred freshness window, when it has one. */
  freshnessWindowDays?: number;
  evidenceRefs: EvidenceRef[];
}

export type RoleRequirementKind =
  | 'source_lane'
  | 'profile_field'
  | 'employer_controlled'
  | 'institution_controlled';

export interface RoleRequirement {
  id: string;
  kind: RoleRequirementKind;
  /** Set when kind === 'source_lane'. */
  laneId?: string;
  /** Set when kind === 'profile_field'. */
  field?: string;
  controlledBy: ActionOwner;
  satisfied: boolean | 'unknown';
  evidenceRefs: EvidenceRef[];
}

export interface RoleContext {
  roleRef: string;
  employerRef?: string;
  requirements: RoleRequirement[];
  applicationState: 'none' | 'in_progress' | 'submitted';
}

/**
 * Employer review progress. `opened` and `reviewed` are distinct on purpose:
 * opening a packet is not reviewing it, and reviewing it is not approving a
 * hire. Employer hiring decisions are not representable in this type at all —
 * they belong to the employer and arrive only via canonical employer records.
 */
export type EmployerReviewStatus = 'not_shared' | 'shared' | 'opened' | 'reviewed';

export interface EmployerReviewState {
  status: EmployerReviewStatus;
  evidenceRefs: EvidenceRef[];
}

/**
 * Readiness as reported by a canonical readiness service. The union makes
 * "ready without a canonical determination" unrepresentable: `ready_to_start`
 * only exists on the `determinedBy: 'canonical'` arm with at least one
 * evidence ref.
 */
export type ReadinessState =
  | {
      status: 'ready_to_start';
      determinedBy: 'canonical';
      evidenceRefs: [EvidenceRef, ...EvidenceRef[]];
    }
  | {
      status: 'not_ready' | 'unknown';
      determinedBy: 'canonical' | 'unavailable';
      evidenceRefs: EvidenceRef[];
    };

export interface ConsentState {
  /** Consent scope id, e.g. `share_packet:employer`, `private_holdings_access`. */
  scope: string;
  granted: boolean;
  evidenceRefs: EvidenceRef[];
}

export interface ActionHistoryEntry {
  actionId: string;
  type: AgentActionType;
  outcome: 'completed' | 'failed' | 'dismissed';
  at: string;
  /** Consecutive failures for this action, when outcome === 'failed'. */
  failureCount?: number;
}

export interface OpportunityContext {
  status: 'none_available' | 'available' | 'unknown';
  matches: Array<{ opportunityRef: string; evidenceRefs: EvidenceRef[] }>;
}

/**
 * Everything the policy engine is allowed to know, assembled exclusively from
 * canonical services by the tool layer. The policy never fetches; it consumes
 * this snapshot. Bench scenarios construct these directly.
 */
export interface StartAgentContext {
  subject: SubjectRef;
  identity: NpiResolutionState;
  profile: ClinicianProfileState;
  ownership: OwnershipState;
  observations: SourceObservationState[];
  role?: RoleContext;
  employerReview?: EmployerReviewState;
  readiness: ReadinessState;
  opportunities: OpportunityContext;
  consents: ConsentState[];
  actionHistory: ActionHistoryEntry[];
  /** ISO timestamp for when this snapshot was assembled (injected, never Date.now in the policy). */
  collectedAt: string;
  /** Coarse surface/situation class for telemetry, e.g. `holder`, `bench_fixture`. */
  contextClass: string;
}

// ---------------------------------------------------------------------------
// Blockers
// ---------------------------------------------------------------------------

export const BLOCKER_TYPES = [
  'missing_clinician_field',
  'unresolved_public_source_fact',
  'ownership_verification_required',
  'stale_source_observation',
  'role_requirement_unmet',
  'employer_review_required',
  'employer_controlled_requirement',
  'institution_controlled_requirement',
  'clinician_consent_required',
  'source_unavailable',
  'public_source_conflict',
  'invalid_source_observation',
  'unsupported_jurisdiction',
  'repeated_action_failure',
] as const;
export type BlockerType = (typeof BLOCKER_TYPES)[number];

/**
 * A typed blocker. Every field answers one of the six canonical questions —
 * there is deliberately no generic `incomplete` escape hatch.
 */
export interface StartBlocker {
  id: string;
  type: BlockerType;
  /** 1. What is blocking progress. */
  what: string;
  /** 2. Why it matters for reaching a start. */
  whyItMatters: string;
  /** 3. Who controls it. */
  controlledBy: ActionOwner;
  /** 4. Evidence supporting that conclusion — refs, never raw values. */
  evidenceRefs: EvidenceRef[];
  /** 5. Actions that can remove it (ids into StartPlan.actions). */
  resolvableByActionIds: string[];
  /** 6. Whether VitalCV can do anything about it right now. */
  vitalcvCanActNow: boolean;
  /** Blockers that must clear before this one can move (dependency chains). */
  dependsOnBlockerIds: string[];
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export const AGENT_ACTION_TYPES = [
  'collect_profile_field',
  'verify_ownership',
  'refresh_source_observation',
  'request_source_correction',
  'request_consent',
  'prepare_share_packet',
  'complete_role_requirement',
  'provide_manual_evidence',
  'review_opportunity',
  'await_employer_decision',
  'await_institution_decision',
  'await_source_availability',
  'review_repeated_failure',
  'review_source_response',
  'informational_note',
] as const;
export type AgentActionType = (typeof AGENT_ACTION_TYPES)[number];

export type AgentActionStatus =
  | 'ready'
  | 'blocked_on_dependency'
  | 'awaiting_consent'
  | 'awaiting_external'
  | 'completed'
  | 'failed'
  | 'suppressed';

export interface AgentAction {
  id: string;
  type: AgentActionType;
  title: string;
  reason: string;
  owner: ActionOwner;
  permission: PermissionClass;
  status: AgentActionStatus;
  /** 1 = highest. Assigned by the ranking stage; ties broken deterministically. */
  priority: number;
  /** Which ranking tier produced the priority (see policy/rank.ts). */
  rankTier: 1 | 2 | 3 | 4 | 5 | 6;
  /** Action ids that must complete first. */
  dependencies: string[];
  evidenceRefs: EvidenceRef[];
  expectedOutcome: string;
  resolvesBlockerIds: string[];
  /**
   * Required on `execute_with_consent` actions: the consent scope that must
   * be granted before the action may leave `awaiting_consent`.
   */
  consentScope?: string;
}

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

export interface StartPlan {
  /**
   * Deterministic content hash of (subject, policyVersion, context
   * fingerprint) — concurrent generations over identical state converge on
   * the same planId instead of forking.
   */
  planId: string;
  subject: SubjectRef;
  contextClass: string;
  /** Hash of the consumed context, for idempotence checks and telemetry joins. */
  contextFingerprint: string;
  blockers: StartBlocker[];
  /** Full candidate set with honest statuses (blocked/awaiting included). */
  actions: AgentAction[];
  /** Presentation order over actions that are currently rankable. */
  rankedActionIds: string[];
  generatedAt: string;
  policyVersion: string;
  toolsetVersion: string;
  modelVersion?: string;
}
