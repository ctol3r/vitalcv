/**
 * Context assembler — builds the StartAgentContext the policy consumes,
 * exclusively through registered tools (so the permission boundary is
 * exercised on the production path, not just in tests).
 *
 * Honesty rules:
 *  - a reader that fails is an INPUT GAP, reported as such — never mapped to
 *    a state (an unreachable ownership service does not mean "unowned");
 *  - readiness stays `unknown/unavailable` in A0 — no canonical activation
 *    read is wired yet, and nothing else may claim readiness;
 *  - consents, role context, and employer review are not wired in A0 and are
 *    simply absent — absence of data, not data.
 */
import { createToolRegistry, type ToolRegistry } from './tools/registry';
import { buildStartAgentTools, type CanonicalReaders } from './tools/canonical-tools';
import type {
  EvidenceRef,
  SourceObservationState,
  StartAgentContext,
  SubjectRef,
} from './types';

export interface AssembledContext {
  context: StartAgentContext;
  /** Canonical services the assembler could not read this time. */
  inputGaps: string[];
}

export class ContextAssemblyError extends Error {
  constructor(detail: string) {
    super(`Start Agent context assembly failed: ${detail}`);
    this.name = 'ContextAssemblyError';
  }
}

export interface AssembleOptions {
  subject: SubjectRef;
  contextClass: string;
  /** Injected clock so assembly is reproducible in tests. */
  now: string;
  registry?: ToolRegistry;
  readers?: CanonicalReaders;
}

export async function assembleStartAgentContext(options: AssembleOptions): Promise<AssembledContext> {
  const registry =
    options.registry ??
    (options.readers ? createToolRegistry(buildStartAgentTools(options.readers)) : null);
  if (!registry) {
    throw new ContextAssemblyError('either a tool registry or canonical readers must be supplied');
  }

  const inputGaps: string[] = [];
  const subject = options.subject;
  const npi = subject.npi;

  // Identity — public registry read, only meaningful with an NPI on file.
  let identityStatus: StartAgentContext['identity']['status'] = 'unresolved';
  const identityEvidence: EvidenceRef[] = [];
  if (npi) {
    try {
      const result = await registry.execute<{ resolved: boolean; retrievedAt?: string }>(
        'npi_identity_resolution',
        { npi },
      );
      identityStatus = result.resolved ? 'resolved' : 'unresolved';
      if (result.resolved) {
        identityEvidence.push({
          kind: 'source_observation',
          ref: 'nppes:registry_record',
          provenance: 'public_source',
          ...(result.retrievedAt ? { observedAt: result.retrievedAt } : {}),
        });
      }
    } catch {
      inputGaps.push('npi_identity_resolution');
    }
  }

  // Ownership — a failed read is a gap, never a state.
  let ownershipStatus: StartAgentContext['ownership']['status'] = 'none';
  if (npi) {
    try {
      const result = await registry.execute<{ status: string }>('ownership_state', { npi });
      ownershipStatus = result.status as StartAgentContext['ownership']['status'];
    } catch {
      inputGaps.push('ownership_state');
      throw new ContextAssemblyError(
        'the canonical ownership state could not be read; planning without it would require guessing ownership',
      );
    }
  }

  // Profile completeness.
  let profileStatus: StartAgentContext['profile']['status'] = 'none';
  let missingFields: string[] = [];
  try {
    const result = await registry.execute<{
      available: boolean;
      score?: number;
      missingFields?: string[];
    }>('clinician_profile_retrieval', {});
    if (result.available) {
      const score = result.score ?? 0;
      profileStatus = score >= 100 ? 'saved' : score > 0 ? 'partial' : 'none';
      missingFields = result.missingFields ?? [];
    } else {
      inputGaps.push('clinician_profile_retrieval');
    }
  } catch {
    inputGaps.push('clinician_profile_retrieval');
  }

  // Source observations.
  let observations: SourceObservationState[] = [];
  if (npi) {
    try {
      const result = await registry.execute<{
        available: boolean;
        observations?: SourceObservationState[];
      }>('source_observation_retrieval', { npi });
      if (result.available) {
        observations = result.observations ?? [];
      } else {
        inputGaps.push('source_observation_retrieval');
      }
    } catch {
      inputGaps.push('source_observation_retrieval');
    }
  }

  // Opportunities.
  let opportunities: StartAgentContext['opportunities'] = { status: 'unknown', matches: [] };
  if (npi) {
    try {
      const result = await registry.execute<{ available: boolean; opportunityRefs?: string[] }>(
        'opportunity_retrieval',
        { npi },
      );
      if (result.available) {
        const refs = result.opportunityRefs ?? [];
        opportunities =
          refs.length > 0
            ? {
                status: 'available',
                matches: refs.map((ref) => ({
                  opportunityRef: ref,
                  evidenceRefs: [
                    {
                      kind: 'opportunity_record' as const,
                      ref: `opportunity:${ref}`,
                      provenance: 'platform_record' as const,
                    },
                  ],
                })),
              }
            : { status: 'none_available', matches: [] };
      } else {
        inputGaps.push('opportunity_retrieval');
      }
    } catch {
      inputGaps.push('opportunity_retrieval');
    }
  }

  const context: StartAgentContext = {
    subject,
    identity: { status: identityStatus, evidenceRefs: identityEvidence },
    profile: {
      status: profileStatus,
      missingRequiredFields: missingFields.map((field) => ({
        field,
        requiredFor: ['profile completeness'],
      })),
      corrections: [],
      evidenceRefs: [],
    },
    ownership: {
      status: ownershipStatus,
      evidenceRefs:
        npi && ownershipStatus !== 'none'
          ? [
              {
                kind: 'ownership_record',
                ref: `ownership:${npi}`,
                provenance: ownershipStatus === 'verified' ? 'ownership_verified' : 'platform_record',
              },
            ]
          : [],
    },
    observations,
    readiness: { status: 'unknown', determinedBy: 'unavailable', evidenceRefs: [] },
    opportunities,
    consents: [],
    actionHistory: [],
    collectedAt: options.now,
    contextClass: options.contextClass,
  };

  return { context, inputGaps };
}
