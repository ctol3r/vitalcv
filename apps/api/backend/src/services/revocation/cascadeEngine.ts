import prisma from '../../graphql/prisma_client';

export interface CredentialScopeContext {
  credentialId: string;
  subjectNpi: string;
  organizationId: string | null;
}

export interface ImpactedDecision {
  decisionId: string;
  decisionType: string;
  status: string;
  subjectNpi: string;
  subjectDid: string;
  decisionTimestamp: string;
  employerId: string | null;
  deploymentRef: string | null;
}

export interface ImpactedEmployer {
  employerId: string;
  impactedDecisionIds: string[];
  impactedDeploymentIds: string[];
  impactedDecisionCount: number;
  impactedDeploymentCount: number;
}

export interface ImpactedDeployment {
  deploymentRef: string;
  decisionId: string;
  status: string;
  subjectNpi: string;
  decisionTimestamp: string;
  employerId: string | null;
}

export interface RevocationCascadeReport {
  credentialId: string;
  impactedDecisions: ImpactedDecision[];
  impactedEmployers: ImpactedEmployer[];
  impactedDeployments: ImpactedDeployment[];
  generatedAt: string;
}

export interface LegacyBlastRadiusResult {
  credentialId: string;
  impactedCapsules: Array<{
    id: string;
    subjectNpi: string;
    subjectDid: string;
    decisionType: string;
    status: string;
    decisionTimestamp: string;
  }>;
  impactedNpis: string[];
  impactedDecisionTypes: string[];
  totalImpacted: number;
}

type GraphAdjacency = ReadonlyMap<string, ReadonlySet<string>>;

type DecisionGraphRecord = {
  decisionId: string;
  decisionType: string;
  status: string;
  subjectNpi: string;
  subjectDid: string;
  decisionTimestamp: string;
  employerId: string | null;
  deploymentRef: string | null;
};

const DECISION_NODE_PREFIX = 'decision:';
const CREDENTIAL_NODE_PREFIX = 'credential:';
const EMPLOYER_NODE_PREFIX = 'employer:';
const DEPLOYMENT_NODE_PREFIX = 'deployment:';

export class CredentialNotFoundError extends Error {
  constructor(credentialId: string) {
    super(`VerificationArtifact ${credentialId} not found.`);
    this.name = 'CredentialNotFoundError';
  }
}

function parseNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseEmployerId(metadata: unknown): string | null {
  const metadataObject = toJsonObject(metadata);
  if (!metadataObject) {
    return null;
  }
  return parseNonEmptyString(metadataObject.employerId);
}

function resolveDeploymentRef(metadata: unknown, decisionId: string): string {
  const metadataObject = toJsonObject(metadata);
  if (metadataObject) {
    const explicitRef =
      parseNonEmptyString(metadataObject.deploymentRef) ??
      parseNonEmptyString(metadataObject.deploymentId) ??
      parseNonEmptyString(metadataObject.deployment);
    if (explicitRef) {
      return explicitRef;
    }
  }
  return `decision-${decisionId}`;
}

function ensureNode(graph: Map<string, Set<string>>, nodeId: string): void {
  if (!graph.has(nodeId)) {
    graph.set(nodeId, new Set<string>());
  }
}

function addDirectedEdge(graph: Map<string, Set<string>>, source: string, target: string): void {
  ensureNode(graph, source);
  ensureNode(graph, target);
  graph.get(source)?.add(target);
}

export function computeReachableNodesMemoized(
  startNodeId: string,
  graph: GraphAdjacency,
  memo: Map<string, Set<string>> = new Map(),
  onNodeComputed?: (nodeId: string) => void,
): Set<string> {
  const visiting = new Set<string>();

  const visit = (nodeId: string): Set<string> => {
    const cached = memo.get(nodeId);
    if (cached) {
      return new Set(cached);
    }

    if (visiting.has(nodeId)) {
      return new Set<string>([nodeId]);
    }

    visiting.add(nodeId);
    const reachable = new Set<string>([nodeId]);
    const neighbors = graph.get(nodeId) ?? new Set<string>();

    for (const neighborId of neighbors) {
      const fromNeighbor = visit(neighborId);
      for (const childId of fromNeighbor) {
        reachable.add(childId);
      }
    }

    visiting.delete(nodeId);
    memo.set(nodeId, new Set(reachable));
    if (onNodeComputed) {
      onNodeComputed(nodeId);
    }
    return new Set(reachable);
  };

  return visit(startNodeId);
}

function buildLegacyBlastRadius(report: RevocationCascadeReport): LegacyBlastRadiusResult {
  const impactedNpiSet = new Set<string>();
  const impactedDecisionTypeSet = new Set<string>();

  for (const decision of report.impactedDecisions) {
    impactedNpiSet.add(decision.subjectNpi);
    impactedDecisionTypeSet.add(decision.decisionType);
  }

  return {
    credentialId: report.credentialId,
    impactedCapsules: report.impactedDecisions.map((decision) => ({
      id: decision.decisionId,
      subjectNpi: decision.subjectNpi,
      subjectDid: decision.subjectDid,
      decisionType: decision.decisionType,
      status: decision.status,
      decisionTimestamp: decision.decisionTimestamp,
    })),
    impactedNpis: [...impactedNpiSet].sort((left, right) => left.localeCompare(right)),
    impactedDecisionTypes: [...impactedDecisionTypeSet].sort((left, right) =>
      left.localeCompare(right),
    ),
    totalImpacted: report.impactedDecisions.length,
  };
}

function sortDecisions(left: ImpactedDecision, right: ImpactedDecision): number {
  const timestampDelta =
    new Date(right.decisionTimestamp).getTime() - new Date(left.decisionTimestamp).getTime();
  if (timestampDelta !== 0) {
    return timestampDelta;
  }
  return left.decisionId.localeCompare(right.decisionId);
}

function sortDeployments(left: ImpactedDeployment, right: ImpactedDeployment): number {
  const timestampDelta =
    new Date(right.decisionTimestamp).getTime() - new Date(left.decisionTimestamp).getTime();
  if (timestampDelta !== 0) {
    return timestampDelta;
  }

  const deploymentDelta = left.deploymentRef.localeCompare(right.deploymentRef);
  if (deploymentDelta !== 0) {
    return deploymentDelta;
  }

  return left.decisionId.localeCompare(right.decisionId);
}

function buildImpactedEmployers(decisions: ImpactedDecision[]): ImpactedEmployer[] {
  const byEmployer = new Map<
    string,
    {
      decisionIds: Set<string>;
      deploymentIds: Set<string>;
    }
  >();

  for (const decision of decisions) {
    if (!decision.employerId) {
      continue;
    }

    const current = byEmployer.get(decision.employerId) ?? {
      decisionIds: new Set<string>(),
      deploymentIds: new Set<string>(),
    };

    current.decisionIds.add(decision.decisionId);
    if (decision.decisionType === 'DEPLOYMENT' && decision.deploymentRef) {
      current.deploymentIds.add(decision.deploymentRef);
    }

    byEmployer.set(decision.employerId, current);
  }

  return [...byEmployer.entries()]
    .map(([employerId, value]) => {
      const impactedDecisionIds = [...value.decisionIds].sort((left, right) =>
        left.localeCompare(right),
      );
      const impactedDeploymentIds = [...value.deploymentIds].sort((left, right) =>
        left.localeCompare(right),
      );
      return {
        employerId,
        impactedDecisionIds,
        impactedDeploymentIds,
        impactedDecisionCount: impactedDecisionIds.length,
        impactedDeploymentCount: impactedDeploymentIds.length,
      };
    })
    .sort((left, right) => left.employerId.localeCompare(right.employerId));
}

function buildImpactedDeployments(decisions: ImpactedDecision[]): ImpactedDeployment[] {
  return decisions
    .filter(
      (decision) => decision.decisionType === 'DEPLOYMENT' && typeof decision.deploymentRef === 'string',
    )
    .map((decision) => ({
      deploymentRef: decision.deploymentRef as string,
      decisionId: decision.decisionId,
      status: decision.status,
      subjectNpi: decision.subjectNpi,
      decisionTimestamp: decision.decisionTimestamp,
      employerId: decision.employerId,
    }))
    .sort(sortDeployments);
}

export async function resolveCredentialScope(
  credentialId: string,
): Promise<CredentialScopeContext> {
  const artifact = await prisma.verificationArtifact.findUnique({
    where: { id: credentialId },
    select: {
      id: true,
      npi: true,
      organizationId: true,
    },
  });

  if (!artifact) {
    throw new CredentialNotFoundError(credentialId);
  }

  return {
    credentialId: artifact.id,
    subjectNpi: artifact.npi,
    organizationId: artifact.organizationId,
  };
}

export async function generateRevocationCascadeReport(
  scope: CredentialScopeContext,
): Promise<RevocationCascadeReport> {
  const decisionRows = await prisma.decisionCapsule.findMany({
    where: {
      subjectNpi: scope.subjectNpi,
      credentialIds: { has: scope.credentialId },
    },
    orderBy: [{ decisionTimestamp: 'desc' }, { id: 'asc' }],
    select: {
      id: true,
      decisionType: true,
      status: true,
      subjectNpi: true,
      subjectDid: true,
      decisionTimestamp: true,
      metadata: true,
    },
  });

  const impactGraph = new Map<string, Set<string>>();
  const decisionByNodeId = new Map<string, DecisionGraphRecord>();
  const reachabilityMemo = new Map<string, Set<string>>();

  const credentialNodeId = `${CREDENTIAL_NODE_PREFIX}${scope.credentialId}`;
  ensureNode(impactGraph, credentialNodeId);

  for (const row of decisionRows) {
    const employerId = parseEmployerId(row.metadata);
    const deploymentRef =
      row.decisionType === 'DEPLOYMENT' ? resolveDeploymentRef(row.metadata, row.id) : null;

    const decisionNodeId = `${DECISION_NODE_PREFIX}${row.id}`;
    const decisionRecord: DecisionGraphRecord = {
      decisionId: row.id,
      decisionType: row.decisionType,
      status: row.status,
      subjectNpi: row.subjectNpi,
      subjectDid: row.subjectDid,
      decisionTimestamp: row.decisionTimestamp.toISOString(),
      employerId,
      deploymentRef,
    };

    decisionByNodeId.set(decisionNodeId, decisionRecord);
    addDirectedEdge(impactGraph, credentialNodeId, decisionNodeId);

    if (employerId) {
      addDirectedEdge(
        impactGraph,
        decisionNodeId,
        `${EMPLOYER_NODE_PREFIX}${encodeURIComponent(employerId)}`,
      );
    }

    if (deploymentRef) {
      addDirectedEdge(
        impactGraph,
        decisionNodeId,
        `${DEPLOYMENT_NODE_PREFIX}${encodeURIComponent(deploymentRef)}`,
      );
    }
  }

  const reachableNodes = computeReachableNodesMemoized(
    credentialNodeId,
    impactGraph,
    reachabilityMemo,
  );

  const impactedDecisions = [...decisionByNodeId.entries()]
    .filter(([nodeId]) => reachableNodes.has(nodeId))
    .map(([, decision]) => ({
      decisionId: decision.decisionId,
      decisionType: decision.decisionType,
      status: decision.status,
      subjectNpi: decision.subjectNpi,
      subjectDid: decision.subjectDid,
      decisionTimestamp: decision.decisionTimestamp,
      employerId: decision.employerId,
      deploymentRef: decision.deploymentRef,
    }))
    .sort(sortDecisions);

  const impactedDeployments = buildImpactedDeployments(impactedDecisions);
  const impactedEmployers = buildImpactedEmployers(impactedDecisions);

  return {
    credentialId: scope.credentialId,
    impactedDecisions,
    impactedEmployers,
    impactedDeployments,
    generatedAt: new Date().toISOString(),
  };
}

export const revocationCascadeEngine = {
  resolveCredentialScope,
  generateRevocationCascadeReport,
  buildLegacyBlastRadius,
};
