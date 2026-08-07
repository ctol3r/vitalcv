/**
 * A0 tool set — read-only wrappers over existing canonical capabilities.
 *
 * Every reader is injected so tests and CI never touch a network or a
 * database; production wiring supplies readers that call the canonical
 * adapters/routes (see context-assembler.ts). The canonical service stays
 * the authority for its data — these tools translate shapes defensively and
 * fail closed (an unexpected answer is a gap, never a guess).
 *
 * The one Level-2 tool (`share_apply_preparation`) is pure: it drafts a
 * share descriptor and touches nothing. Executing an actual share is
 * Level 3 and does not exist in A0 (the registry refuses the level).
 */
import type { SourceObservationState, SourceObservationStatus } from '../types';
import type { AgentTool } from './contract';

// Conservative canonical-coverage → observation-status mapping. Mirrors the
// shipped precedent in lib/readiness/passport-readiness-snapshot.ts: nothing
// is ever upgraded; synthetic/preview data can never present as an
// observation.
const COVERAGE_STATE_TO_OBSERVATION: Record<string, SourceObservationStatus> = {
  checked: 'current',
  stale: 'stale',
  pending: 'pending',
  unavailable: 'unavailable',
  gated: 'access_required',
  accessRequired: 'access_required',
  reviewRequired: 'review_required',
  notDecisionGrade: 'not_checked',
  previewOnly: 'not_checked',
  notFound: 'not_found',
};

export interface CanonicalReaders {
  /** Canonical public-registry read (web adapter `fetchNppesRecord`): null = no readable record (fail-closed). */
  readNppesIdentity(npi: string): Promise<{ found: boolean; retrievedAt: string } | null>;
  /** Canonical ownership state (backend ownership service): null = no ownership row. */
  readOwnershipState(npi: string): Promise<{ state: string; verifiedAt?: string | null } | null>;
  /** Canonical profile completeness read for the signed-in subject. */
  readProfileCompleteness(): Promise<{ score: number; missingFields: string[] } | null>;
  /** Canonical source-coverage read (trust-state layer). */
  readSourceCoverage(npi: string): Promise<Array<{
    sourceId: string;
    state: string;
    checkedAt?: string | null;
  }> | null>;
  /** Canonical opportunity read for the subject. */
  readOpportunities(npi: string): Promise<{ opportunityRefs: string[] } | null>;
  /** Agent consent ledger fold for the subject (A1). */
  readAgentConsents(subjectRef: string): Promise<Array<{
    scope: string;
    granted: boolean;
    eventRef: string;
    at: string;
  }>>;
  /** Prior agent action outcomes for the subject, from the telemetry store (A1). */
  readActionHistory(subjectRef: string): Promise<Array<{
    actionId: string;
    actionType: string;
    outcome: 'completed' | 'failed' | 'dismissed';
    at: string;
    failureCount?: number;
  }>>;
  /** Level-2 execution: trigger the canonical public-source refresh (A1). */
  triggerSourceRefresh(npi: string): Promise<{ requested: boolean; computedAt?: string } | null>;
  /**
   * Level-3 execution: the canonical apply-share (`POST /api/apply/share`)
   * with a server-resolved recipient via opportunityId (A1). `blocked` maps
   * the canonical authz refusal (ownership not verified/delegated).
   */
  executeApplyShare(input: {
    npi: string;
    opportunityRef: string;
    purpose: string;
  }): Promise<
    | { shareId: string; recipientName?: string; status: string; sharedAt?: string }
    | { blocked: 'canonical_ownership_authz' }
    | null
  >;
}

const NPI_INPUT = { fields: { npi: { type: 'string' as const, required: true } } };

export function buildStartAgentTools(readers: CanonicalReaders): AgentTool[] {
  const npiIdentityResolution: AgentTool = {
    id: 'npi_identity_resolution',
    description:
      'Reads the public NPI registry record via the canonical NPPES adapter. Public-source facts only; carries no ownership meaning.',
    requiredPermission: 'observe',
    inputSchema: NPI_INPUT,
    outputSchema: {
      fields: {
        resolved: { type: 'boolean', required: true },
        retrievedAt: { type: 'string' },
      },
    },
    async execute(input) {
      const { npi } = input as { npi: string };
      const record = await readers.readNppesIdentity(npi);
      if (!record || !record.found) return { resolved: false };
      return { resolved: true, retrievedAt: record.retrievedAt };
    },
  };

  const ownershipState: AgentTool = {
    id: 'ownership_state',
    description:
      'Reads the canonical ownership state for an NPI. The ownership service alone decides the state; a claim is not ownership.',
    requiredPermission: 'observe',
    inputSchema: NPI_INPUT,
    outputSchema: {
      fields: {
        status: { type: 'string', required: true },
      },
    },
    async execute(input) {
      const { npi } = input as { npi: string };
      const row = await readers.readOwnershipState(npi);
      if (!row) return { status: 'none' };
      const allowed = new Set(['verified', 'delegated', 'pending', 'revoked']);
      if (!allowed.has(row.state)) {
        // Fail closed: an unrecognized state is treated as the weakest one.
        return { status: 'pending' };
      }
      return { status: row.state };
    },
  };

  const clinicianProfileRetrieval: AgentTool = {
    id: 'clinician_profile_retrieval',
    description: 'Reads the canonical profile completeness summary for the signed-in clinician.',
    requiredPermission: 'observe',
    inputSchema: { fields: {} },
    outputSchema: {
      fields: {
        available: { type: 'boolean', required: true },
        score: { type: 'number' },
        missingFields: { type: 'array' },
      },
    },
    async execute() {
      const profile = await readers.readProfileCompleteness();
      if (!profile) return { available: false };
      return { available: true, score: profile.score, missingFields: profile.missingFields };
    },
  };

  const sourceObservationRetrieval: AgentTool = {
    id: 'source_observation_retrieval',
    description:
      'Reads canonical source-coverage checks (trust-state layer) and maps them conservatively; no state is ever upgraded.',
    requiredPermission: 'observe',
    inputSchema: NPI_INPUT,
    outputSchema: {
      fields: {
        available: { type: 'boolean', required: true },
        observations: { type: 'array' },
      },
    },
    async execute(input) {
      const { npi } = input as { npi: string };
      const checks = await readers.readSourceCoverage(npi);
      if (!checks) return { available: false };
      const observations: SourceObservationState[] = checks.map((check) => ({
        laneId: check.sourceId.toLowerCase(),
        authority: check.sourceId,
        status: COVERAGE_STATE_TO_OBSERVATION[check.state] ?? 'not_checked',
        ...(check.checkedAt ? { observedAt: check.checkedAt } : {}),
        evidenceRefs: [
          {
            kind: 'source_observation' as const,
            ref: `coverage:${check.sourceId}`,
            provenance: 'public_source' as const,
            ...(check.checkedAt ? { observedAt: check.checkedAt } : {}),
          },
        ],
      }));
      return { available: true, observations };
    },
  };

  const opportunityRetrieval: AgentTool = {
    id: 'opportunity_retrieval',
    description: 'Reads canonical opportunity matches for the subject; absence of matches is an honest pool state.',
    requiredPermission: 'observe',
    inputSchema: NPI_INPUT,
    outputSchema: {
      fields: {
        available: { type: 'boolean', required: true },
        opportunityRefs: { type: 'array' },
      },
    },
    async execute(input) {
      const { npi } = input as { npi: string };
      const result = await readers.readOpportunities(npi);
      if (!result) return { available: false };
      return { available: true, opportunityRefs: result.opportunityRefs };
    },
  };

  const shareApplyPreparation: AgentTool = {
    id: 'share_apply_preparation',
    description:
      'Level 2: drafts a share/apply descriptor from plan state. Pure — nothing is sent, stored, or shared. Actual sharing is Level 3 and does not exist in A0.',
    requiredPermission: 'prepare',
    inputSchema: {
      fields: {
        planId: { type: 'string', required: true },
        actionId: { type: 'string', required: true },
        consentScope: { type: 'string', required: true },
      },
    },
    outputSchema: {
      fields: {
        draft: { type: 'object', required: true },
      },
    },
    async execute(input) {
      const { planId, actionId, consentScope } = input as {
        planId: string;
        actionId: string;
        consentScope: string;
      };
      return {
        draft: {
          kind: 'share_packet_draft',
          planId,
          actionId,
          consentScope,
          executed: false,
          note: 'Prepared only. Execution requires recorded consent and a later wave.',
        },
      };
    },
  };

  const consentStateRetrieval: AgentTool = {
    id: 'consent_state_retrieval',
    description: 'Reads the agent consent ledger fold for the subject. Absent or revoked scopes simply do not appear as granted — never guessed.',
    requiredPermission: 'observe',
    inputSchema: { fields: { subjectRef: { type: 'string', required: true } } },
    outputSchema: {
      fields: {
        states: { type: 'array', required: true },
      },
    },
    async execute(input) {
      const { subjectRef } = input as { subjectRef: string };
      const states = await readers.readAgentConsents(subjectRef);
      return { states };
    },
  };

  const actionHistoryRetrieval: AgentTool = {
    id: 'action_history_retrieval',
    description: 'Reads prior agent action outcomes for the subject from the telemetry store, so completed work is never re-recommended and repeated failures pause.',
    requiredPermission: 'observe',
    inputSchema: { fields: { subjectRef: { type: 'string', required: true } } },
    outputSchema: {
      fields: {
        entries: { type: 'array', required: true },
      },
    },
    async execute(input) {
      const { subjectRef } = input as { subjectRef: string };
      const entries = await readers.readActionHistory(subjectRef);
      return { entries };
    },
  };

  const triggerSourceRefresh: AgentTool = {
    id: 'trigger_source_refresh',
    description:
      'Level 2 execution: triggers the canonical trust-state refresh (a public-source re-read). The canonical service records its own artifacts and audit rows; this tool asserts nothing about the outcome.',
    requiredPermission: 'prepare',
    inputSchema: NPI_INPUT,
    outputSchema: {
      fields: {
        requested: { type: 'boolean', required: true },
        computedAt: { type: 'string' },
      },
    },
    async execute(input) {
      const { npi } = input as { npi: string };
      const result = await readers.triggerSourceRefresh(npi);
      if (!result || !result.requested) return { requested: false };
      return { requested: true, ...(result.computedAt ? { computedAt: result.computedAt } : {}) };
    },
  };

  const executeApplyShare: AgentTool = {
    id: 'execute_apply_share',
    description:
      'Level 3 execution: the canonical apply-share with a server-resolved recipient (opportunityId). Runs ONLY under a ConsentProof; the canonical route additionally refuses unless NPI ownership is verified or delegated.',
    requiredPermission: 'execute_with_consent',
    inputSchema: {
      fields: {
        npi: { type: 'string', required: true },
        consentScope: { type: 'string', required: true },
        opportunityRef: { type: 'string', required: true },
        purpose: { type: 'string', required: true },
      },
    },
    outputSchema: {
      fields: {
        executed: { type: 'boolean', required: true },
        shareId: { type: 'string' },
        recipientName: { type: 'string' },
        status: { type: 'string' },
        sharedAt: { type: 'string' },
        blockedBy: { type: 'string' },
      },
    },
    async execute(input) {
      const { npi, opportunityRef, purpose } = input as {
        npi: string;
        opportunityRef: string;
        purpose: string;
      };
      const result = await readers.executeApplyShare({ npi, opportunityRef, purpose });
      if (!result) return { executed: false, blockedBy: 'canonical_capability_unavailable' };
      if ('blocked' in result) return { executed: false, blockedBy: result.blocked };
      return {
        executed: true,
        shareId: result.shareId,
        ...(result.recipientName ? { recipientName: result.recipientName } : {}),
        status: result.status,
        ...(result.sharedAt ? { sharedAt: result.sharedAt } : {}),
      };
    },
  };

  return [
    npiIdentityResolution,
    ownershipState,
    clinicianProfileRetrieval,
    sourceObservationRetrieval,
    opportunityRetrieval,
    shareApplyPreparation,
    consentStateRetrieval,
    actionHistoryRetrieval,
    triggerSourceRefresh,
    executeApplyShare,
  ];
}
