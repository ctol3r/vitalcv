export type CredentialNodeCategory =
  | 'license'
  | 'board'
  | 'education'
  | 'compact'
  | 'sanction'
  | 'identity';

export interface CredentialGraphNode {
  id: string;
  code: string;
  label: string;
  category: CredentialNodeCategory;
  verified: boolean;
  readinessWeight?: number;
  chainStatus?: 'anchored' | 'pending' | 'stale';
  jurisdiction?: string;
}

export interface JobRequirement {
  code: string;
  label: string;
  mandatory?: boolean;
  jurisdictions?: string[];
  compactEligible?: boolean;
}

export interface FitSummaryResult {
  fitScore: number;
  missingItems: string[];
  compactEligibility: {
    status: 'eligible' | 'partial' | 'blocked';
    states: string[];
    blockers: string[];
  };
}

export function buildFitSummary(
  graph: CredentialGraphNode[],
  requirements: JobRequirement[],
): FitSummaryResult {
  if (requirements.length === 0) {
    return {
      fitScore: 1,
      missingItems: [],
      compactEligibility: {
        status: 'eligible',
        states: [],
        blockers: [],
      },
    };
  }

  const normalizedGraph = graph.map((node) => ({
    ...node,
    readinessWeight: node.readinessWeight ?? 1,
    chainStatus: node.chainStatus ?? (node.verified ? 'anchored' : 'pending'),
  }));

  const matchedRequirements = requirements.filter((requirement) =>
    normalizedGraph.some(
      (node) => node.code === requirement.code || node.label === requirement.label,
    ),
  );

  const missingItems = requirements
    .filter(
      (requirement) =>
        requirement.mandatory &&
        !matchedRequirements.some((match) => match.code === requirement.code),
    )
    .map((requirement) => requirement.label);

  const matchedRatio = matchedRequirements.length / requirements.length;
  const readinessAverage =
    normalizedGraph.reduce((sum, node) => sum + (node.verified ? node.readinessWeight! : 0), 0) /
    Math.max(normalizedGraph.length, 1);
  const chainStability =
    normalizedGraph.reduce((score, node) => {
      if (node.chainStatus === 'anchored') return score + 1;
      if (node.chainStatus === 'pending') return score + 0.5;
      return score;
    }, 0) / Math.max(normalizedGraph.length, 1);

  const fitScore = Number(
    (
      matchedRatio * 0.45 +
      readinessAverage * 0.35 +
      chainStability * 0.2 -
      missingItems.length * 0.03
    ).toFixed(2),
  );

  const compactNodes = normalizedGraph.filter((node) => node.category === 'compact');
  const compactStates = Array.from(
    new Set(
      compactNodes
        .map((node) => node.jurisdiction)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  let compactStatus: FitSummaryResult['compactEligibility']['status'] = 'blocked';
  const blockers: string[] = [];

  if (compactNodes.length === 0) {
    blockers.push('No compact credentials discovered');
  } else if (compactNodes.every((node) => node.verified)) {
    compactStatus = 'eligible';
  } else {
    compactStatus = 'partial';
    blockers.push('Compact credentials pending or unverified');
  }

  return {
    fitScore: Math.max(0, Math.min(1, fitScore)),
    missingItems,
    compactEligibility: {
      status: compactStatus,
      states: compactStates,
      blockers,
    },
  };
}

