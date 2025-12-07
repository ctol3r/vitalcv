export interface TranslationCheck {
  clinicianId: string;
  sourceCountry: string;
  targetCountry: string;
  preserved: boolean;
  issues: string[];
  confidence: number;
}

export function translationChecker(clinicianId: string, sourceCountry: string, targetCountry: string): TranslationCheck {
  const preserved = Math.random() > 0.2;

  return {
    clinicianId,
    sourceCountry,
    targetCountry,
    preserved,
    issues: preserved ? [] : ['specialty_mismatch', 'scope_difference'],
    confidence: preserved ? 0.9 : 0.6,
  };
}








