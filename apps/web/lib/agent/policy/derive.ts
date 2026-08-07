/**
 * start-policy-v1 — derivation stage.
 *
 * Turns a consumed `StartAgentContext` into typed blockers and candidate
 * actions. Everything here is a pure, deterministic transform: no fetches, no
 * clock, no randomness. Ids are content-derived so repeated derivation over
 * identical state converges byte-for-byte.
 *
 * Derivation never manufactures truth — every blocker cites evidence refs
 * from the state it was derived from (falling back to an explicit
 * platform_record ref to the context itself), and no rule upgrades a source
 * state, an ownership state, or a review state.
 */
import { actionId, blockerId } from '../ids';
import type {
  ActionOwner,
  AgentAction,
  AgentActionStatus,
  AgentActionType,
  EvidenceRef,
  PermissionClass,
  SourceObservationState,
  StartAgentContext,
  StartBlocker,
} from '../types';

export interface DerivationResult {
  blockers: StartBlocker[];
  actions: AgentAction[];
  /** Blocker ids that stand between the clinician and an ACTIVE application. */
  blockingApplication: Set<string>;
}

/** Consecutive failures after which an action is paused for review. */
export const REPEATED_FAILURE_THRESHOLD = 3;

function fallbackEvidence(context: StartAgentContext, ref: string): EvidenceRef {
  return {
    kind: 'system_record',
    ref: `context:${ref}`,
    provenance: 'platform_record',
    observedAt: context.collectedAt,
  };
}

function evidenceOr(
  context: StartAgentContext,
  refs: EvidenceRef[],
  fallbackRef: string,
): EvidenceRef[] {
  return refs.length > 0 ? refs : [fallbackEvidence(context, fallbackRef)];
}

interface ActionDraft {
  type: AgentActionType;
  discriminator: string;
  title: string;
  reason: string;
  owner: ActionOwner;
  permission: PermissionClass;
  status: AgentActionStatus;
  evidenceRefs: EvidenceRef[];
  expectedOutcome: string;
  consentScope?: string;
}

export function deriveBlockersAndActions(context: StartAgentContext): DerivationResult {
  const blockers: StartBlocker[] = [];
  const actions = new Map<string, AgentAction>();
  const blockingApplication = new Set<string>();

  const applicationActive =
    context.role !== undefined &&
    (context.role.applicationState === 'in_progress' || context.role.applicationState === 'submitted');

  function upsertAction(draft: ActionDraft): string {
    const id = actionId(draft.type, draft.discriminator);
    if (!actions.has(id)) {
      actions.set(id, {
        id,
        type: draft.type,
        title: draft.title,
        reason: draft.reason,
        owner: draft.owner,
        permission: draft.permission,
        status: draft.status,
        priority: 0,
        rankTier: 6,
        dependencies: [],
        evidenceRefs: draft.evidenceRefs,
        expectedOutcome: draft.expectedOutcome,
        resolvesBlockerIds: [],
        ...(draft.consentScope ? { consentScope: draft.consentScope } : {}),
      });
    }
    return id;
  }

  function addBlocker(input: {
    type: StartBlocker['type'];
    discriminator: string;
    what: string;
    whyItMatters: string;
    controlledBy: ActionOwner;
    evidenceRefs: EvidenceRef[];
    vitalcvCanActNow: boolean;
    actionIds: string[];
    blocksApplication?: boolean;
  }): string {
    const id = blockerId(input.type, input.discriminator);
    if (blockers.some((b) => b.id === id)) return id;
    blockers.push({
      id,
      type: input.type,
      what: input.what,
      whyItMatters: input.whyItMatters,
      controlledBy: input.controlledBy,
      evidenceRefs: input.evidenceRefs,
      resolvableByActionIds: input.actionIds,
      vitalcvCanActNow: input.vitalcvCanActNow,
      dependsOnBlockerIds: [],
    });
    for (const aId of input.actionIds) {
      const action = actions.get(aId);
      if (action && !action.resolvesBlockerIds.includes(id)) {
        action.resolvesBlockerIds.push(id);
      }
    }
    if (input.blocksApplication) blockingApplication.add(id);
    return id;
  }

  // -------------------------------------------------------------------------
  // 1. Public identity resolution
  // -------------------------------------------------------------------------
  if (context.identity.status === 'invalid') {
    const aId = upsertAction({
      type: 'collect_profile_field',
      discriminator: 'field:npi',
      title: 'Provide a valid NPI',
      reason: 'The NPI on file does not pass registry validation, so no public record can be read.',
      owner: 'clinician',
      permission: 'recommend',
      status: 'ready',
      evidenceRefs: evidenceOr(context, context.identity.evidenceRefs, 'identity'),
      expectedOutcome: 'A structurally valid NPI that the public registry can be queried with.',
    });
    addBlocker({
      type: 'unresolved_public_source_fact',
      discriminator: 'identity:invalid',
      what: 'The NPI on file fails registry validation.',
      whyItMatters: 'Without a readable public record, no source-backed evidence can be assembled.',
      controlledBy: 'clinician',
      evidenceRefs: evidenceOr(context, context.identity.evidenceRefs, 'identity'),
      vitalcvCanActNow: false,
      actionIds: [aId],
      blocksApplication: applicationActive,
    });
  } else if (context.identity.status === 'unresolved') {
    const aId = upsertAction({
      type: 'refresh_source_observation',
      discriminator: 'lane:nppes_identity',
      title: 'Read the public NPI registry record',
      reason: 'The public registry has not been read for this NPI yet.',
      owner: 'vitalcv',
      permission: 'prepare',
      status: 'ready',
      evidenceRefs: evidenceOr(context, context.identity.evidenceRefs, 'identity'),
      expectedOutcome: 'A registry observation recorded with its own timestamp and provenance.',
    });
    addBlocker({
      type: 'unresolved_public_source_fact',
      discriminator: 'identity:unresolved',
      what: 'The public NPI registry record has not been read yet.',
      whyItMatters: 'The public record anchors every downstream source check.',
      controlledBy: 'vitalcv',
      evidenceRefs: evidenceOr(context, context.identity.evidenceRefs, 'identity'),
      vitalcvCanActNow: true,
      actionIds: [aId],
      blocksApplication: applicationActive,
    });
  }

  // -------------------------------------------------------------------------
  // 2. Missing clinician-provided fields
  // -------------------------------------------------------------------------
  const fieldBlockerIds = new Map<string, string>();
  for (const gap of context.profile.missingRequiredFields) {
    const aId = upsertAction({
      type: 'collect_profile_field',
      discriminator: `field:${gap.field}`,
      title: `Add your ${gap.field.replace(/_/g, ' ')}`,
      reason:
        gap.requiredFor.length > 0
          ? `This field is needed for: ${gap.requiredFor.join(', ')}. Only you can supply it.`
          : 'This field is part of your required profile and only you can supply it.',
      owner: 'clinician',
      permission: 'recommend',
      status: 'ready',
      evidenceRefs: evidenceOr(context, context.profile.evidenceRefs, `profile:${gap.field}`),
      expectedOutcome: 'The field saved to your profile, recorded as provided by you.',
    });
    const bId = addBlocker({
      type: 'missing_clinician_field',
      discriminator: `field:${gap.field}`,
      what: `Your profile is missing ${gap.field.replace(/_/g, ' ')}.`,
      whyItMatters:
        gap.requiredFor.length > 0
          ? `Without it, ${gap.requiredFor.join(' and ')} cannot proceed.`
          : 'Required profile information is incomplete.',
      controlledBy: 'clinician',
      evidenceRefs: evidenceOr(context, context.profile.evidenceRefs, `profile:${gap.field}`),
      vitalcvCanActNow: false,
      actionIds: [aId],
      blocksApplication: applicationActive && gap.requiredFor.length > 0,
    });
    fieldBlockerIds.set(gap.field, bId);
  }

  // -------------------------------------------------------------------------
  // 3. Ownership
  // -------------------------------------------------------------------------
  let ownershipBlockerId: string | null = null;
  if (context.ownership.status !== 'verified' && context.ownership.status !== 'delegated') {
    const revoked = context.ownership.status === 'revoked';
    const aId = upsertAction({
      type: 'verify_ownership',
      discriminator: 'ownership',
      title: revoked ? 'Re-establish ownership of this record' : 'Confirm this record is yours',
      reason: revoked
        ? 'Ownership of this record was revoked; the previous confirmation no longer applies.'
        : context.ownership.status === 'pending'
          ? 'A claim was started but ownership has not been confirmed. A claim by itself does not establish ownership.'
          : 'No ownership link exists between this account and the record.',
      owner: 'clinician',
      permission: 'recommend',
      status: 'ready',
      evidenceRefs: evidenceOr(context, context.ownership.evidenceRefs, 'ownership'),
      expectedOutcome: 'A canonical ownership record with a confirmation timestamp.',
    });
    ownershipBlockerId = addBlocker({
      type: 'ownership_verification_required',
      discriminator: 'ownership',
      what: revoked
        ? 'Ownership of this record was revoked.'
        : 'Ownership of this record has not been confirmed.',
      whyItMatters:
        'Private holdings, sharing, and applications stay locked until the canonical ownership record confirms this account controls the NPI.',
      controlledBy: 'clinician',
      evidenceRefs: evidenceOr(context, context.ownership.evidenceRefs, 'ownership'),
      vitalcvCanActNow: false,
      actionIds: [aId],
      blocksApplication: applicationActive,
    });
  }

  // -------------------------------------------------------------------------
  // 4. Clinician corrections vs public source — surfaced, never merged
  // -------------------------------------------------------------------------
  for (const correction of context.profile.corrections) {
    const aId = upsertAction({
      type: 'request_source_correction',
      discriminator: `correction:${correction.field}`,
      title: `Prepare a correction request for ${correction.field.replace(/_/g, ' ')}`,
      reason:
        'Your provided value disagrees with the public record. Both are kept with their own provenance; the public record can only change at its source.',
      owner: 'vitalcv',
      permission: 'prepare',
      status: 'ready',
      evidenceRefs: [correction.publicEvidence, correction.clinicianEvidence],
      expectedOutcome:
        'A prepared correction request addressed to the source authority. The public record keeps its value until the source updates it.',
    });
    addBlocker({
      type: 'public_source_conflict',
      discriminator: `correction:${correction.field}`,
      what: `Your provided ${correction.field.replace(/_/g, ' ')} disagrees with the public record.`,
      whyItMatters:
        'Reviewers see both values with their provenance; an unexplained conflict slows review.',
      controlledBy: 'source',
      evidenceRefs: [correction.publicEvidence, correction.clinicianEvidence],
      vitalcvCanActNow: true,
      actionIds: [aId],
    });
  }

  // -------------------------------------------------------------------------
  // 5. Source observations per lane
  // -------------------------------------------------------------------------
  const laneActionIds = new Map<string, string>();
  function laneRefreshAction(lane: SourceObservationState): string {
    const id = upsertAction({
      type: 'refresh_source_observation',
      discriminator: `lane:${lane.laneId}`,
      title: `Refresh the ${lane.laneId.replace(/[_:]/g, ' ')} observation`,
      reason:
        lane.status === 'stale'
          ? `The last observation from ${lane.authority} is older than its freshness window.`
          : lane.status === 'invalid'
            ? `${lane.authority} returned a response that failed validation, which is not evidence of anything.`
            : `${lane.authority} has not been read for this record yet.`,
      owner: 'vitalcv',
      permission: 'prepare',
      status: 'ready',
      evidenceRefs: evidenceOr(context, lane.evidenceRefs, `lane:${lane.laneId}`),
      expectedOutcome: `A current observation from ${lane.authority}, recorded with its own timestamp.`,
    });
    laneActionIds.set(lane.laneId, id);
    return id;
  }

  for (const lane of context.observations) {
    const laneEvidence = evidenceOr(context, lane.evidenceRefs, `lane:${lane.laneId}`);
    switch (lane.status) {
      case 'stale': {
        const aId = laneRefreshAction(lane);
        addBlocker({
          type: 'stale_source_observation',
          discriminator: `lane:${lane.laneId}`,
          what: `The ${lane.authority} observation is older than its freshness window.`,
          whyItMatters: 'Reviewers discount observations that have aged past the window the source itself sets.',
          controlledBy: 'vitalcv',
          evidenceRefs: laneEvidence,
          vitalcvCanActNow: true,
          actionIds: [aId],
        });
        break;
      }
      case 'invalid': {
        const aId = laneRefreshAction(lane);
        addBlocker({
          type: 'invalid_source_observation',
          discriminator: `lane:${lane.laneId}`,
          what: `${lane.authority} returned a response that failed validation.`,
          whyItMatters:
            'An unparseable response is not evidence and is never treated as a status. A clean re-read is needed.',
          controlledBy: 'source',
          evidenceRefs: laneEvidence,
          vitalcvCanActNow: true,
          actionIds: [aId],
        });
        break;
      }
      case 'unavailable': {
        const aId = upsertAction({
          type: 'await_source_availability',
          discriminator: `lane:${lane.laneId}`,
          title: `Wait for ${lane.authority} to come back`,
          reason: `${lane.authority} is not answering right now. VitalCV keeps watching and will re-read when it returns.`,
          owner: 'source',
          permission: 'observe',
          status: 'awaiting_external',
          evidenceRefs: laneEvidence,
          expectedOutcome: `A fresh observation once ${lane.authority} is reachable again. Its absence today is a source condition, not a finding about you.`,
        });
        laneActionIds.set(lane.laneId, aId);
        addBlocker({
          type: 'source_unavailable',
          discriminator: `lane:${lane.laneId}`,
          what: `${lane.authority} is temporarily unreachable.`,
          whyItMatters: 'The lane cannot move until the source answers; only the source controls that.',
          controlledBy: 'source',
          evidenceRefs: laneEvidence,
          vitalcvCanActNow: false,
          actionIds: [aId],
        });
        break;
      }
      case 'unsupported':
      case 'access_required': {
        const aId = upsertAction({
          type: 'provide_manual_evidence',
          discriminator: `lane:${lane.laneId}`,
          title: `Provide documentation for ${lane.laneId.replace(/[_:]/g, ' ')}`,
          reason: `VitalCV has no live route to ${lane.authority} yet. That is a VitalCV coverage gap, not a problem with your record.`,
          owner: 'clinician',
          permission: 'recommend',
          status: 'ready',
          evidenceRefs: laneEvidence,
          expectedOutcome:
            'Your documentation stored as clinician-provided evidence — clearly labeled as such, never presented as a source observation.',
        });
        laneActionIds.set(lane.laneId, aId);
        addBlocker({
          type: 'unsupported_jurisdiction',
          discriminator: `lane:${lane.laneId}`,
          what: `VitalCV cannot read ${lane.authority} yet.`,
          whyItMatters:
            'Until coverage exists, this lane can only carry clinician-provided documentation, which reviewers weigh differently.',
          controlledBy: 'vitalcv',
          evidenceRefs: laneEvidence,
          vitalcvCanActNow: false,
          actionIds: [aId],
        });
        break;
      }
      case 'adverse': {
        const aId = upsertAction({
          type: 'provide_manual_evidence',
          discriminator: `lane:${lane.laneId}:adverse`,
          title: `Add context for the ${lane.authority} record`,
          reason: `${lane.authority} reports a record that needs your attention. Resolution runs through the source; your context travels alongside it.`,
          owner: 'clinician',
          permission: 'recommend',
          status: 'ready',
          evidenceRefs: laneEvidence,
          expectedOutcome:
            'Your context stored as clinician-provided evidence next to the source record. The source record itself is unchanged.',
        });
        laneActionIds.set(lane.laneId, aId);
        addBlocker({
          type: 'unresolved_public_source_fact',
          discriminator: `lane:${lane.laneId}:adverse`,
          what: `${lane.authority} reports an adverse record on this lane.`,
          whyItMatters: 'Reviewers will see the source record; unaddressed, it stops most reviews.',
          controlledBy: 'source',
          evidenceRefs: laneEvidence,
          vitalcvCanActNow: false,
          actionIds: [aId],
          blocksApplication: applicationActive,
        });
        break;
      }
      case 'review_required': {
        const aId = upsertAction({
          type: 'review_source_response',
          discriminator: `lane:${lane.laneId}`,
          title: `Review the ${lane.authority} response`,
          reason: `${lane.authority} answered, but the response needs a human look before it can be used as evidence.`,
          owner: 'vitalcv',
          permission: 'observe',
          status: 'ready',
          evidenceRefs: laneEvidence,
          expectedOutcome:
            'The response is reviewed and either recorded as an observation or sent back for a clean re-read. Until then it is not evidence.',
        });
        laneActionIds.set(lane.laneId, aId);
        addBlocker({
          type: 'unresolved_public_source_fact',
          discriminator: `lane:${lane.laneId}:review`,
          what: `The ${lane.authority} response is waiting on human review.`,
          whyItMatters: 'An unreviewed response is never used as evidence, so the lane holds until the review happens.',
          controlledBy: 'vitalcv',
          evidenceRefs: laneEvidence,
          vitalcvCanActNow: true,
          actionIds: [aId],
        });
        break;
      }
      case 'not_checked': {
        // Enrichment only — an unchecked optional lane is not a blocker.
        laneRefreshAction(lane);
        break;
      }
      default:
        // current | pending | not_found: no derived work. `not_found` is a
        // finding (the source was checked and holds no record), not a gap.
        break;
    }
  }

  // -------------------------------------------------------------------------
  // 6. Role requirements
  // -------------------------------------------------------------------------
  if (context.role) {
    for (const req of context.role.requirements) {
      if (req.satisfied === true) continue;
      const reqEvidence = evidenceOr(context, req.evidenceRefs, `requirement:${req.id}`);

      if (req.kind === 'profile_field' && req.field) {
        if (!fieldBlockerIds.has(req.field)) {
          const aId = upsertAction({
            type: 'collect_profile_field',
            discriminator: `field:${req.field}`,
            title: `Add your ${req.field.replace(/_/g, ' ')}`,
            reason: 'This role requires it and only you can supply it.',
            owner: 'clinician',
            permission: 'recommend',
            status: 'ready',
            evidenceRefs: reqEvidence,
            expectedOutcome: 'The field saved to your profile, recorded as provided by you.',
          });
          const bId = addBlocker({
            type: 'missing_clinician_field',
            discriminator: `field:${req.field}`,
            what: `The role requires ${req.field.replace(/_/g, ' ')}, which your profile does not have.`,
            whyItMatters: 'The application cannot move without it.',
            controlledBy: 'clinician',
            evidenceRefs: reqEvidence,
            vitalcvCanActNow: false,
            actionIds: [aId],
            blocksApplication: applicationActive,
          });
          fieldBlockerIds.set(req.field, bId);
        } else if (applicationActive) {
          blockingApplication.add(fieldBlockerIds.get(req.field)!);
        }
        continue;
      }

      if (req.kind === 'source_lane' && req.laneId) {
        let linkedActionId = laneActionIds.get(req.laneId);
        if (!linkedActionId) {
          const lane = context.observations.find((o) => o.laneId === req.laneId);
          linkedActionId = laneRefreshAction(
            lane ?? {
              laneId: req.laneId,
              authority: 'the source authority',
              status: 'not_checked',
              evidenceRefs: reqEvidence,
            },
          );
        }
        addBlocker({
          type: 'role_requirement_unmet',
          discriminator: `requirement:${req.id}`,
          what: `The role's ${req.laneId.replace(/[_:]/g, ' ')} requirement is ${req.satisfied === 'unknown' ? 'not yet evidenced' : 'unmet'}.`,
          whyItMatters: 'The employer requires this before the application can conclude.',
          controlledBy: req.controlledBy,
          evidenceRefs: reqEvidence,
          vitalcvCanActNow: actions.get(linkedActionId)?.owner === 'vitalcv',
          actionIds: [linkedActionId],
          blocksApplication: applicationActive,
        });
        continue;
      }

      if (req.kind === 'employer_controlled') {
        const aId = upsertAction({
          type: 'await_employer_decision',
          discriminator: `requirement:${req.id}`,
          title: 'Employer-side step pending',
          reason:
            'This requirement is completed inside the employer’s own process. VitalCV cannot do it for you or for them.',
          owner: 'employer',
          permission: 'human_only',
          status: 'awaiting_external',
          evidenceRefs: reqEvidence,
          expectedOutcome: 'The employer records the step in their own system; VitalCV reflects it once recorded.',
        });
        addBlocker({
          type: 'employer_controlled_requirement',
          discriminator: `requirement:${req.id}`,
          what: 'A requirement for this role sits inside the employer’s own process.',
          whyItMatters: 'Progress on it is entirely the employer’s to make.',
          controlledBy: 'employer',
          evidenceRefs: reqEvidence,
          vitalcvCanActNow: false,
          actionIds: [aId],
          blocksApplication: applicationActive,
        });
        continue;
      }

      if (req.kind === 'institution_controlled') {
        const aId = upsertAction({
          type: 'await_institution_decision',
          discriminator: `requirement:${req.id}`,
          title: 'Institution-side step pending',
          reason:
            'Another institution controls this step (for example a privileging committee). VitalCV cannot make this decision.',
          owner: 'other_institution',
          permission: 'human_only',
          status: 'awaiting_external',
          evidenceRefs: reqEvidence,
          expectedOutcome: 'The institution records its decision; VitalCV reflects it once recorded.',
        });
        addBlocker({
          type: 'institution_controlled_requirement',
          discriminator: `requirement:${req.id}`,
          what: 'A requirement for this role is controlled by another institution.',
          whyItMatters: 'Only that institution can move it.',
          controlledBy: 'other_institution',
          evidenceRefs: reqEvidence,
          vitalcvCanActNow: false,
          actionIds: [aId],
          blocksApplication: applicationActive,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // 7. Employer review
  // -------------------------------------------------------------------------
  if (
    context.employerReview &&
    (context.employerReview.status === 'shared' || context.employerReview.status === 'opened')
  ) {
    const reviewEvidence = evidenceOr(context, context.employerReview.evidenceRefs, 'employer_review');
    const aId = upsertAction({
      type: 'await_employer_decision',
      discriminator: 'employer_review',
      title: 'Employer review pending',
      reason:
        context.employerReview.status === 'opened'
          ? 'The employer opened your packet. Opening is not a review — the review itself has not been recorded.'
          : 'Your packet has been shared. The employer has not opened or recorded a review yet.',
      owner: 'employer',
      permission: 'human_only',
      status: 'awaiting_external',
      evidenceRefs: reviewEvidence,
      expectedOutcome: 'A recorded employer review. Until that record exists, no review has happened.',
    });
    addBlocker({
      type: 'employer_review_required',
      discriminator: 'employer_review',
      what:
        context.employerReview.status === 'opened'
          ? 'The employer opened the packet but has not recorded a review.'
          : 'The employer has not reviewed the shared packet.',
      whyItMatters: 'The next step belongs to the employer; only their recorded review moves it.',
      controlledBy: 'employer',
      evidenceRefs: reviewEvidence,
      vitalcvCanActNow: false,
      actionIds: [aId],
      blocksApplication: applicationActive,
    });
  }

  // -------------------------------------------------------------------------
  // 8. Consents
  // -------------------------------------------------------------------------
  for (const consent of context.consents) {
    if (consent.granted) continue;
    const consentEvidence = evidenceOr(context, consent.evidenceRefs, `consent:${consent.scope}`);
    const requestId = upsertAction({
      type: 'request_consent',
      discriminator: `consent:${consent.scope}`,
      title: `Approve: ${consent.scope.replace(/[_:]/g, ' ')}`,
      reason: 'VitalCV does not act on your behalf without your recorded approval.',
      owner: 'clinician',
      permission: 'recommend',
      status: 'ready',
      evidenceRefs: consentEvidence,
      expectedOutcome: 'A recorded consent grant scoped to exactly this action, revocable by you.',
    });
    const consentBlockerId = addBlocker({
      type: 'clinician_consent_required',
      discriminator: `consent:${consent.scope}`,
      what: `Your approval for ${consent.scope.replace(/[_:]/g, ' ')} has not been given.`,
      whyItMatters: 'The dependent step waits on your approval and on nothing else you need to do.',
      controlledBy: 'clinician',
      evidenceRefs: consentEvidence,
      vitalcvCanActNow: false,
      actionIds: [requestId],
    });

    if (consent.scope.startsWith('share_packet')) {
      const prepId = upsertAction({
        type: 'prepare_share_packet',
        discriminator: `consent:${consent.scope}`,
        title: 'Prepared: share your evidence packet',
        reason: 'The packet is assembled and waiting on your approval before anything leaves your account.',
        owner: 'vitalcv',
        permission: 'execute_with_consent',
        status: 'awaiting_consent',
        evidenceRefs: consentEvidence,
        expectedOutcome: 'On your approval, the packet is shared exactly as prepared — nothing is sent before that.',
        consentScope: consent.scope,
      });
      const prep = actions.get(prepId)!;
      if (!prep.dependencies.includes(requestId)) prep.dependencies.push(requestId);
      const consentBlocker = blockers.find((b) => b.id === consentBlockerId);
      if (consentBlocker && !consentBlocker.resolvableByActionIds.includes(prepId)) {
        // Approving unblocks the prepared share as well.
        prep.resolvesBlockerIds.push(consentBlockerId);
        consentBlocker.resolvableByActionIds.push(prepId);
      }
      // Dependency chain: sharing is meaningless until ownership is confirmed.
      if (ownershipBlockerId) {
        const verifyActionId = actionId('verify_ownership', 'ownership');
        if (!prep.dependencies.includes(verifyActionId) && actions.has(verifyActionId)) {
          prep.dependencies.push(verifyActionId);
          prep.status = 'blocked_on_dependency';
        }
        const consentBlockerRow = blockers.find((b) => b.id === consentBlockerId);
        if (consentBlockerRow && !consentBlockerRow.dependsOnBlockerIds.includes(ownershipBlockerId)) {
          consentBlockerRow.dependsOnBlockerIds.push(ownershipBlockerId);
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // 9. Action history: completed / dismissed / repeated failures
  // -------------------------------------------------------------------------
  for (const entry of context.actionHistory) {
    const existing = actions.get(entry.actionId);
    if (entry.outcome === 'completed' && existing) {
      existing.status = 'completed';
    }
    if (entry.outcome === 'dismissed' && existing) {
      existing.status = 'suppressed';
    }
    if (entry.outcome === 'failed' && (entry.failureCount ?? 1) >= REPEATED_FAILURE_THRESHOLD) {
      if (existing) existing.status = 'failed';
      const aId = upsertAction({
        type: 'review_repeated_failure',
        discriminator: `history:${entry.actionId}`,
        title: 'A step keeps failing and is paused',
        reason: `An automated step failed ${entry.failureCount ?? REPEATED_FAILURE_THRESHOLD} times in a row. Retrying blindly would not help, so it is paused for review.`,
        owner: 'vitalcv',
        permission: 'observe',
        status: 'ready',
        evidenceRefs: [fallbackEvidence(context, `history:${entry.actionId}`)],
        expectedOutcome: 'The failure is reviewed and the step is fixed or replaced before it runs again.',
      });
      addBlocker({
        type: 'repeated_action_failure',
        discriminator: `history:${entry.actionId}`,
        what: 'An automated step has failed repeatedly and is paused.',
        whyItMatters: 'Silent retry loops hide real problems; the step stays paused until the cause is understood.',
        controlledBy: 'vitalcv',
        evidenceRefs: [fallbackEvidence(context, `history:${entry.actionId}`)],
        vitalcvCanActNow: true,
        actionIds: [aId],
      });
    }
  }

  // -------------------------------------------------------------------------
  // 10. Opportunities
  // -------------------------------------------------------------------------
  if (context.opportunities.status === 'available') {
    for (const match of context.opportunities.matches) {
      upsertAction({
        type: 'review_opportunity',
        discriminator: `opportunity:${match.opportunityRef}`,
        title: 'A role matches your profile',
        reason: 'This match was scored against your current evidence; reviewing it is your call.',
        owner: 'clinician',
        permission: 'recommend',
        status: 'ready',
        evidenceRefs: evidenceOr(context, match.evidenceRefs, `opportunity:${match.opportunityRef}`),
        expectedOutcome: 'You decide whether to pursue it; nothing is applied to or shared without you.',
      });
    }
  } else if (context.opportunities.status === 'none_available') {
    upsertAction({
      type: 'informational_note',
      discriminator: 'opportunities:none',
      title: 'No matching roles right now',
      reason: 'The current opportunity pool holds no role matching your profile. That is the honest state of the pool today, not a gap in your record.',
      owner: 'vitalcv',
      permission: 'observe',
      status: 'ready',
      evidenceRefs: [fallbackEvidence(context, 'opportunities')],
      expectedOutcome: 'VitalCV keeps watching the pool and surfaces matches as they appear.',
    });
  }

  // -------------------------------------------------------------------------
  // 11. Nothing at all derived — say so honestly
  // -------------------------------------------------------------------------
  if (actions.size === 0) {
    upsertAction({
      type: 'informational_note',
      discriminator: 'all_clear',
      title: 'Nothing needs your attention right now',
      reason: 'Every state VitalCV consumed shows no pending work it can see.',
      owner: 'vitalcv',
      permission: 'observe',
      status: 'ready',
      evidenceRefs: [fallbackEvidence(context, 'all_clear')],
      expectedOutcome: 'VitalCV keeps watching and raises the next useful step when one exists.',
    });
  }

  return { blockers, actions: [...actions.values()], blockingApplication };
}
