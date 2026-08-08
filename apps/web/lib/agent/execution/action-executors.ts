/**
 * Action → tool dispatch. An action is executable by VitalCV only when a
 * mapping exists here; everything else is refused honestly (clinician-,
 * employer-, source-, and institution-owned actions are theirs to do).
 *
 * A1 mappings:
 *  - refresh_source_observation → trigger_source_refresh (Level 2)
 *  - prepare_share_packet with an OPPORTUNITY target → execute_apply_share
 *    (Level 3; consent-gated). Employer-ref shares without an opportunity
 *    stay non-executable: the canonical share resolves its recipient only
 *    from an opportunity, and the agent never asserts a recipient itself.
 */
import type { AgentAction, SubjectRef } from '../types';

export interface ToolInvocation {
  toolId: string;
  input: Record<string, unknown>;
}

export function toolInvocationFor(
  action: AgentAction,
  subject: SubjectRef,
): ToolInvocation | null {
  switch (action.type) {
    case 'refresh_source_observation': {
      if (!subject.npi) return null;
      return { toolId: 'trigger_source_refresh', input: { npi: subject.npi } };
    }
    case 'prepare_share_packet': {
      if (!subject.npi || !action.consentScope) return null;
      const opportunityRef = action.target?.opportunityRef;
      if (!opportunityRef) return null;
      return {
        toolId: 'execute_apply_share',
        input: {
          npi: subject.npi,
          consentScope: action.consentScope,
          opportunityRef,
          purpose: `Clinician-approved share for opportunity ${opportunityRef}`,
        },
      };
    }
    default:
      return null;
  }
}
