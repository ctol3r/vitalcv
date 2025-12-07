export interface GlobalMapping {
  credentialId: string;
  sourceCountry: string;
  targetCountry: string;
  equivalentRole: string;
  confidence: number;
  requirements: string[];
}

const COUNTRY_EQUIVALENCY: Record<string, Record<string, string>> = {
  US: {
    UK: 'GMC_Registration',
    AU: 'AHPRA_Registration',
    CA: 'Medical_Council_Registration',
  },
  UK: {
    US: 'State_Medical_License',
    AU: 'AHPRA_Registration',
  },
};

export function globalMappingEngine(credentialId: string, sourceCountry: string, targetCountry: string): GlobalMapping {
  const mapping = COUNTRY_EQUIVALENCY[sourceCountry]?.[targetCountry] || 'UNKNOWN';

  return {
    credentialId,
    sourceCountry,
    targetCountry,
    equivalentRole: mapping,
    confidence: mapping !== 'UNKNOWN' ? 0.8 : 0.3,
    requirements: ['language_proficiency', 'clinical_experience', 'regulatory_exam'],
  };
}








