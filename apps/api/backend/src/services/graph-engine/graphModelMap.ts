export const TRUST_GRAPH_MODEL_MAP = Object.freeze({
  Provider: ['Provider', 'PersonProfile', 'VcvEntity'],
  Claim: ['ClaimRecord'],
  Evidence: ['VerificationArtifact', 'VerificationReceiptRecord'],
  Source: ['SourceRecord'],
  Snapshot: ['ProviderDecisionState', 'ProviderDecisionHistory'],
  Decision: ['DecisionCapsule', 'EmployerDecisionEvent'],
  Divergence: ['AnomalyHistory', 'IdentityClaimDelta'],
  Employer: ['Organization', 'VcvOrganizationContext', 'VcvEntity'],
  Job: ['Opportunity', 'Application'],
  ResearchIdentity: ['ClaimRecord', 'VerificationArtifact'],
} as const);

export type TrustGraphConcept = keyof typeof TRUST_GRAPH_MODEL_MAP;

export function modelsForTrustGraphConcept(concept: TrustGraphConcept): readonly string[] {
  return TRUST_GRAPH_MODEL_MAP[concept];
}
