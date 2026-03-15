import {
  executeCopilotPlan,
  prepareCopilotQuery,
  type CopilotCandidate,
  type CopilotDependencies,
} from '../../../../../../../core/copilot/copilotEngine';

function clinicianCandidate(input: Partial<CopilotCandidate> & { id: string; title: string }): CopilotCandidate {
  return {
    id: input.id,
    type: input.type ?? 'CLINICIAN',
    title: input.title,
    subtitle: input.subtitle,
    summary: input.summary ?? `${input.title} summary`,
    specialty: input.specialty,
    state: input.state,
    institution: input.institution,
    licenseStatus: input.licenseStatus,
    boardCertified: input.boardCertified,
    trustScore: input.trustScore,
    trustBand: input.trustBand,
    researchTopics: input.researchTopics ?? [],
    affiliations: input.affiliations ?? [],
    payments: input.payments,
    freshness: input.freshness,
    sourceCoverage: input.sourceCoverage ?? [],
    evidence: input.evidence ?? [],
    engineHits: input.engineHits ?? [],
    matches: input.matches ?? [],
    graphSignals: input.graphSignals ?? [],
    metadata: input.metadata ?? {},
  };
}

describe('copilot query pipeline', () => {
  it('parses specialty, geography, and trust thresholds from natural language', () => {
    const prepared = prepareCopilotQuery({
      query: 'cardiologists in texas with trust score above 85',
      limit: 10,
    });

    expect(prepared.parsedQuery.structuredFilters.specialties).toContain('Cardiology');
    expect(prepared.parsedQuery.structuredFilters.states).toContain('TX');
    expect(prepared.parsedQuery.structuredFilters.trustScore?.min).toBe(85);
    expect(prepared.plan.stageOrder).toContain('STRUCTURED');
    expect(prepared.plan.stageBudgets.trust).toBeGreaterThan(0);
  });

  it('merges hybrid candidates, applies trust enrichment, and returns explainable results', async () => {
    const prepared = prepareCopilotQuery({
      query: 'cardiologists in texas with high trust score',
      limit: 5,
    });

    const dependencies: CopilotDependencies = {
      structuredSearch: async () => [
        clinicianCandidate({
          id: 'clinician:1234567890',
          title: 'Dr. High Trust',
          specialty: 'Cardiology',
          state: 'TX',
          institution: 'Mayo Clinic',
          sourceCoverage: ['NPPES'],
          engineHits: [{ engine: 'STRUCTURED', score: 0.92, reasons: ['structured filter match'] }],
          matches: [{ field: 'specialty', value: 'Cardiology', reason: 'specialty matched Cardiology' }],
          metadata: { npi: '1234567890' },
        }),
      ],
      semanticSearch: async () => [
        clinicianCandidate({
          id: 'clinician:2234567890',
          title: 'Dr. Lower Trust',
          specialty: 'Cardiology',
          state: 'TX',
          institution: 'Houston Heart',
          sourceCoverage: ['NPPES'],
          engineHits: [{ engine: 'SEMANTIC', score: 0.84, reasons: ['semantic similarity'] }],
          metadata: { npi: '2234567890' },
        }),
      ],
      graphSearch: async () => ({
        candidates: [
          clinicianCandidate({
            id: 'clinician:1234567890',
            title: 'Dr. High Trust',
            specialty: 'Cardiology',
            state: 'TX',
            institution: 'Mayo Clinic',
            sourceCoverage: ['PECOS'],
            engineHits: [{ engine: 'GRAPH', score: 0.75, reasons: ['graph traversal connected to query focus'] }],
            matches: [{ field: 'graph', value: 'clinician', reason: 'graph traversal connected to query focus' }],
            metadata: { npi: '1234567890' },
          }),
        ],
        insights: [
          {
            resultId: 'clinician:1234567890',
            type: 'NEIGHBOR',
            summary: 'Dr. High Trust is connected to Mayo Clinic.',
            path: ['Mayo Clinic', 'Dr. High Trust'],
            depth: 1,
          },
        ],
      }),
      trustSearch: async () => [
        {
          id: 'clinician:1234567890',
          trustScore: 94,
          trustBand: 'L3',
          verifiedSources: ['NPPES', 'PECOS', 'OIG'],
          trustReasons: ['trust band L3'],
        },
        {
          id: 'clinician:2234567890',
          trustScore: 82,
          trustBand: 'L2',
          verifiedSources: ['NPPES'],
          trustReasons: ['trust band L2'],
        },
      ],
    };

    const response = await executeCopilotPlan(prepared, dependencies);

    expect(response.results[0]?.id).toBe('clinician:1234567890');
    expect(response.results[0]?.trustScore).toBe(94);
    expect(response.explanations[0]?.because).toEqual(
      expect.arrayContaining([
        expect.stringContaining('specialty = Cardiology'),
        expect.stringContaining('trust score = 94'),
      ]),
    );
    expect(response.graphInsights[0]?.resultId).toBe('clinician:1234567890');
  });
});
