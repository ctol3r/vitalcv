export const IGNITION_INVESTIGATOR_IDS = [
  'sanctions',
  'clinical_trial',
  'institution_expansion',
  'workforce_shift',
  'research_momentum',
  'industry_influence',
] as const;

export type IgnitionInvestigatorId = (typeof IGNITION_INVESTIGATOR_IDS)[number];
