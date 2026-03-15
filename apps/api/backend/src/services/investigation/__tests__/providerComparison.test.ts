import { buildProviderComparison } from '../../../../../../../core/comparison/providerComparison';

describe('providerComparison', () => {
  it('ranks providers and computes specialty alignment against the cohort', () => {
    const result = buildProviderComparison([
      {
        npi: '1111111111',
        providerName: 'Dr. Alpha',
        primarySpecialty: 'Cardiology',
        secondarySpecialties: ['Internal Medicine'],
        trustScore: 92,
        trustBand: 'L3',
        publicationMetrics: {
          totalPublications: 18,
          citationCount: 220,
          recentPublications: 5,
        },
        fundingMetrics: {
          totalIndustryPayments: 25_000,
          paymentRecordCount: 7,
          uniquePayers: 3,
          sharedGrantCount: 1,
        },
        trialMetrics: {
          totalTrials: 4,
          activeTrials: 2,
          principalInvestigatorRoles: 2,
        },
      },
      {
        npi: '2222222222',
        providerName: 'Dr. Beta',
        primarySpecialty: 'Cardiology',
        secondarySpecialties: [],
        trustScore: 81,
        trustBand: 'L2',
        publicationMetrics: {
          totalPublications: 12,
          citationCount: 90,
          recentPublications: 3,
        },
        fundingMetrics: {
          totalIndustryPayments: 9_000,
          paymentRecordCount: 4,
          uniquePayers: 2,
          sharedGrantCount: 0,
        },
        trialMetrics: {
          totalTrials: 2,
          activeTrials: 1,
          principalInvestigatorRoles: 1,
        },
      },
      {
        npi: '3333333333',
        providerName: 'Dr. Gamma',
        primarySpecialty: 'Neurology',
        secondarySpecialties: [],
        trustScore: 74,
        trustBand: 'L2',
        publicationMetrics: {
          totalPublications: 5,
          citationCount: 35,
          recentPublications: 1,
        },
        fundingMetrics: {
          totalIndustryPayments: 1_000,
          paymentRecordCount: 1,
          uniquePayers: 1,
          sharedGrantCount: 0,
        },
        trialMetrics: {
          totalTrials: 1,
          activeTrials: 0,
          principalInvestigatorRoles: 0,
        },
      },
    ]);

    expect(result.rows[0]?.npi).toBe('1111111111');
    expect(result.summary.leaderByTrustScore).toBe('1111111111');
    expect(result.summary.dominantSpecialties).toContain('Cardiology');
    expect(result.rows.find((row) => row.npi === '2222222222')?.specialtyAlignment.alignmentLabel).toBe('ALIGNED');
    expect(result.rows.find((row) => row.npi === '3333333333')?.specialtyAlignment.alignmentLabel).toBe('DIVERGENT');
  });
});
