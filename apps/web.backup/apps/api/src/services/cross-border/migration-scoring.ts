export interface MigrationReadiness {
  clinicianId: string;
  targetCountry: string;
  score: number;
  readiness: 'ready' | 'partial' | 'not_ready';
  factors: Array<{
    factor: string;
    status: 'complete' | 'partial' | 'missing';
  }>;
}

export function migrationScoring(clinicianId: string, targetCountry: string): MigrationReadiness {
  const score = Math.random() * 0.4 + 0.6; // 0.6-1.0

  return {
    clinicianId,
    targetCountry,
    score: Math.round(score * 100) / 100,
    readiness: score > 0.8 ? 'ready' : score > 0.6 ? 'partial' : 'not_ready',
    factors: [
      { factor: 'credential_equivalency', status: 'complete' },
      { factor: 'language_proficiency', status: score > 0.7 ? 'complete' : 'partial' },
      { factor: 'regulatory_exam', status: score > 0.8 ? 'complete' : 'missing' },
    ],
  };
}








