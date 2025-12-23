export interface MatchCandidate {
  jobId: string;
  score: number;
  readinessPercent: number;
  explanation: string[];
}

export async function matchJobsForClinician(clinicianId: string): Promise<MatchCandidate[]> {
  // TODO: Load credentials and preferences for clinicianId
  // TODO: Load open jobs from ATS/source of truth
  // Simple mock logic for now; replace with actual match computation
  return [
    {
      jobId: 'job-001',
      score: 94,
      readinessPercent: 87,
      explanation: ['Specialty match', 'License verified'],
    },
    {
      jobId: 'job-002',
      score: 82,
      readinessPercent: 75,
      explanation: ['Location match', 'Pending board cert'],
    },
  ];
}
