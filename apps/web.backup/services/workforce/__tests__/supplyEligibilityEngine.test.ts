import { SupplyEligibilityEngine } from '../eligibility/supplyEligibility.js';
import type { WorkforceSupplyGraph } from '../graph/buildSupplyGraph.js';

describe('SupplyEligibilityEngine', () => {
  it('returns deduplicated states, orgs, services, and payers for clinician', async () => {
    const graph: WorkforceSupplyGraph = {
      nodes: [],
      edges: [],
      generatedAt: new Date(),
      clinicianSummaries: [
        {
          clinicianId: 'clinician-42',
          licenses: 2,
          privileges: 3,
          enrollments: 1,
          compacts: 1,
          ehrRoles: 1,
          statesLicensed: ['CA', 'NV'],
          statesViaCompacts: ['AZ', 'CA'],
          orgsApproved: ['alpha'],
          payerCoverage: ['payer-uhc'],
          privilegeCodes: ['CARDIO_CORE', 'STRUCTURAL_HEART'],
        },
      ],
    };

    const engine = new SupplyEligibilityEngine({
      buildGraph: async () => graph,
    });

    const result = await engine.evaluate('clinician-42');

    expect(result.states).toEqual(expect.arrayContaining(['CA', 'NV', 'AZ']));
    expect(result.statesViaCompact).toEqual(['AZ', 'CA']);
    expect(result.orgs).toEqual(['alpha']);
    expect(result.services).toEqual(['CARDIO_CORE', 'STRUCTURAL_HEART']);
    expect(result.payerCoverage).toEqual(['payer-uhc']);
  });

  it('returns empty result when clinician summary missing', async () => {
    const graph: WorkforceSupplyGraph = {
      nodes: [],
      edges: [],
      generatedAt: new Date(),
      clinicianSummaries: [],
    };

    const engine = new SupplyEligibilityEngine({
      buildGraph: async () => graph,
    });

    const result = await engine.evaluate('unknown');
    expect(result.states).toEqual([]);
    expect(result.orgs).toEqual([]);
    expect(result.services).toEqual([]);
  });
});

