/**
 * GET /api/employer-pipeline
 *
 * Employer pipeline cohort + per-clinician `marketRisk` enrichment
 * via the OpenEvidence risk engine (WAVE C69).
 *
 * Returns a typed cohort suitable for the Employer Pipeline UI. Each
 * entry carries the canonical identity fields (npi, name, credential,
 * taxonomy, state) plus the `marketRisk` object emitted by
 * `evaluateMarketRisk(...)` from `@vitalcv/core`.
 *
 * Demo cohort lives in this module so the route is renderable without
 * a backend connection (wave constraint: "do not touch production
 * databases"). Future adapter: replace `getDemoCohort()` with a
 * Prisma query — the response shape is stable.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  evaluateMarketRisk,
  type MarketRiskResult,
} from '@vitalcv/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface PipelineClinician {
  npi: string;
  name: string;
  credential: string;
  taxonomyCode: string;
  taxonomyLabel: string;
  state: string;
  /** Operator-flagged rural service area; preferred over ZIP heuristic. */
  isRural?: boolean;
  /** Practice ZIP; used only when `isRural` is undefined. */
  zipCode?: string;
}

export interface PipelineEntry extends PipelineClinician {
  /** Null when the taxonomy is not in the risk-engine dictionary. */
  marketRisk: MarketRiskResult | null;
}

export interface PipelineResponse {
  cohort: readonly PipelineEntry[];
  meta: {
    count: number;
    enrichedAt: string;
    riskEngineSource: string;
  };
}

function getDemoCohort(): readonly PipelineClinician[] {
  return [
    {
      npi: '1346053246',
      name: 'Macie Miller, PA-C',
      credential: 'PA-C',
      taxonomyCode: '207R00000X',
      taxonomyLabel: 'Internal Medicine',
      state: 'CA',
      isRural: false,
    },
    {
      npi: '1356428912',
      name: 'Mira Chen, MD',
      credential: 'MD',
      taxonomyCode: '207R00000X',
      taxonomyLabel: 'Internal Medicine',
      state: 'CA',
      isRural: false,
    },
    {
      npi: '1234567893',
      name: 'Connor Kilch, DO',
      credential: 'DO',
      taxonomyCode: '207X00000X',
      taxonomyLabel: 'Orthopedic Surgery',
      state: 'SD',
      isRural: true,
    },
    {
      npi: '1000000004',
      name: 'D. Okafor, RN',
      credential: 'RN',
      taxonomyCode: '207RH0000X',
      taxonomyLabel: 'Hospital Medicine',
      state: 'TX',
      isRural: false,
    },
    {
      npi: '1000000012',
      name: 'J. Park, MD',
      credential: 'MD',
      taxonomyCode: '2084P0800X',
      taxonomyLabel: 'Psychiatry',
      state: 'NY',
      isRural: false,
    },
    {
      npi: '1000000020',
      name: 'K. Liu, NP',
      credential: 'NP',
      taxonomyCode: '208600000X',
      taxonomyLabel: 'Surgery',
      state: 'WY',
      isRural: true,
    },
  ];
}

export async function GET(_req: NextRequest) {
  const cohort = getDemoCohort();
  const enriched: PipelineEntry[] = cohort.map((c) => ({
    ...c,
    marketRisk: evaluateMarketRisk({
      taxonomyCode: c.taxonomyCode,
      isRural: c.isRural,
      zipCode: c.zipCode,
    }),
  }));

  const body: PipelineResponse = {
    cohort: enriched,
    meta: {
      count: enriched.length,
      enrichedAt: new Date().toISOString(),
      riskEngineSource:
        'OpenEvidence physician-attrition benchmark · early-tenure cost-band midpoint',
    },
  };

  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  });
}
