/**
 * B212C-ENROLL-012: Mock PayerNetworkGraph for tests
 *
 * Provides baseline payer distribution for region; used by tests.
 */

import type {
  PayerNetworkGraph,
  GraphNode,
  GraphEdge,
  CoverageGap,
  GraphSummary,
} from '../../payer/networkGraph.js';

/**
 * Baseline payer distribution for common regions
 * Used as a reference for coverage calculations in tests
 */
export const BASELINE_PAYER_DISTRIBUTION: Record<string, string[]> = {
  CA: [
    'UnitedHealthcare',
    'Blue Shield of California',
    'Anthem Blue Cross',
    'Aetna',
    'Cigna',
    'Kaiser Permanente',
  ],
  NY: ['EmblemHealth', 'Empire BlueCross', 'UnitedHealthcare', 'Aetna', 'Cigna'],
  TX: [
    'UnitedHealthcare',
    'Blue Cross Blue Shield of Texas',
    'Aetna',
    'Cigna',
    'Humana',
  ],
  FL: ['Florida Blue', 'UnitedHealthcare', 'Humana', 'Aetna', 'Cigna'],
  IL: [
    'Blue Cross Blue Shield of Illinois',
    'Aetna',
    'UnitedHealthcare',
    'Cigna',
  ],
  MA: [
    'Blue Cross Blue Shield of Massachusetts',
    'Tufts Health Plan',
    'Harvard Pilgrim',
    'Aetna',
  ],
  PA: [
    'Independence Blue Cross',
    'Highmark Blue Cross Blue Shield',
    'Aetna',
    'UnitedHealthcare',
  ],
};

/**
 * Create a mock PayerNetworkGraph for testing
 */
export function createMockPayerNetworkGraph(
  options: {
    clinicianId?: string;
    practiceStates?: string[];
    enrolledPayers?: string[];
    panelFullPayers?: string[];
    coverageGaps?: CoverageGap[];
  } = {}
): PayerNetworkGraph {
  const {
    clinicianId = 'clinician-test-001',
    practiceStates = ['CA'],
    enrolledPayers = ['UnitedHealthcare', 'Blue Shield of California'],
    panelFullPayers = [],
    coverageGaps = [],
  } = options;

  const nodes: GraphNode[] = [
    {
      id: `clinician:${clinicianId}`,
      type: 'clinician',
      label: `Clinician ${clinicianId}`,
    },
  ];

  const edges: GraphEdge[] = [];
  const warnings: string[] = [];

  // Add payer nodes and edges for enrolled payers
  for (const payerName of enrolledPayers) {
    const payerId = `payer:${payerName.toLowerCase().replace(/\s+/g, '-')}`;
    nodes.push({
      id: payerId,
      type: 'payer',
      label: payerName,
      metadata: {
        payerId: payerId,
        requiresCaqh: true,
        requiresPecos: true,
      },
    });

    edges.push({
      id: `edge:clinician:${clinicianId}->${payerId}`,
      source: `clinician:${clinicianId}`,
      target: payerId,
      type: 'enrolled',
      metadata: {
        status: 'ENROLLED',
        panelType: 'PRIMARY',
        effectiveDate: new Date().toISOString(),
      },
    });
  }

  // Add payer nodes for panel full payers
  for (const payerName of panelFullPayers) {
    const payerId = `payer:${payerName.toLowerCase().replace(/\s+/g, '-')}`;
    nodes.push({
      id: payerId,
      type: 'payer',
      label: payerName,
      metadata: {
        payerId: payerId,
        requiresCaqh: true,
        requiresPecos: true,
      },
    });

    edges.push({
      id: `edge:clinician:${clinicianId}->${payerId}`,
      source: `clinician:${clinicianId}`,
      target: payerId,
      type: 'enrolled',
      metadata: {
        status: 'PANEL_FULL',
        panelType: 'PRIMARY',
      },
    });

    warnings.push(`${payerName} panel is full`);
  }

  // Add state nodes
  for (const state of practiceStates) {
    const stateNodeId = `state:${state.toUpperCase()}`;
    nodes.push({
      id: stateNodeId,
      type: 'state',
      label: state.toUpperCase(),
    });
  }

  // Add coverage gap warnings
  for (const gap of coverageGaps) {
    warnings.push(
      `Missing major payer(s) in ${gap.state}: ${gap.missingPayers.join(', ')}`
    );
  }

  const summary: GraphSummary = {
    totalPayers: enrolledPayers.length + panelFullPayers.length,
    activeEnrollments: enrolledPayers.length,
    panelFull: panelFullPayers.length,
    statesCovered: practiceStates.length,
  };

  return {
    nodes,
    edges,
    warnings: Array.from(new Set(warnings)),
    coverageGaps,
    summary,
  };
}

/**
 * Get baseline payer distribution for a region
 */
export function getBaselinePayerDistribution(
  state: string
): string[] {
  const normalized = state.toUpperCase();
  return BASELINE_PAYER_DISTRIBUTION[normalized] ?? [];
}

/**
 * Calculate coverage ratio for a region based on enrolled payers
 */
export function calculateCoverageRatio(
  state: string,
  enrolledPayers: string[]
): number {
  const baseline = getBaselinePayerDistribution(state);
  if (baseline.length === 0) return 1.0;

  const enrolledSet = new Set(
    enrolledPayers.map((p) => p.toLowerCase())
  );
  const baselineSet = new Set(baseline.map((p) => p.toLowerCase()));

  let matched = 0;
  for (const payer of baseline) {
    if (enrolledSet.has(payer.toLowerCase())) {
      matched++;
    }
  }

  return matched / baseline.length;
}

/**
 * Create coverage gaps for a region
 */
export function createCoverageGaps(
  state: string,
  enrolledPayers: string[]
): CoverageGap {
  const baseline = getBaselinePayerDistribution(state);
  const enrolledSet = new Set(
    enrolledPayers.map((p) => p.toLowerCase())
  );

  const missing = baseline.filter(
    (payer) => !enrolledSet.has(payer.toLowerCase())
  );

  return {
    state: state.toUpperCase(),
    missingPayers: missing,
    coverageRatio: calculateCoverageRatio(state, enrolledPayers),
  };
}

