import type { WorkforceSupplyGraph } from '../graph/buildSupplyGraph.js';
import { buildSupplyGraph } from '../graph/buildSupplyGraph.js';

export interface SupplyEligibilityEngineOptions {
  buildGraph?: (clinicianIds: string[]) => Promise<WorkforceSupplyGraph>;
}

export interface SupplyEligibilityResult {
  clinicianId: string;
  states: string[];
  statesViaCompact: string[];
  orgs: string[];
  services: string[];
  payerCoverage: string[];
}

export class SupplyEligibilityEngine {
  private readonly buildGraph: (clinicianIds: string[]) => Promise<WorkforceSupplyGraph>;

  constructor(options: SupplyEligibilityEngineOptions = {}) {
    this.buildGraph =
      options.buildGraph ?? ((clinicianIds) => buildSupplyGraph({ clinicianIds }));
  }

  async evaluate(clinicianId: string): Promise<SupplyEligibilityResult> {
    const graph = await this.buildGraph([clinicianId]);
    const summary = graph.clinicianSummaries.find(
      (entry) => entry.clinicianId === clinicianId,
    );

    if (!summary) {
      return {
        clinicianId,
        states: [],
        statesViaCompact: [],
        orgs: [],
        services: [],
        payerCoverage: [],
      };
    }

    return {
      clinicianId,
      states: dedupe([...summary.statesLicensed, ...summary.statesViaCompacts]),
      statesViaCompact: [...summary.statesViaCompacts],
      orgs: [...summary.orgsApproved],
      services: [...summary.privilegeCodes],
      payerCoverage: [...summary.payerCoverage],
    };
  }
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

