import prisma from '../../graphql/prisma_client';

export type KnowledgeNodeGroup =
  | 'credential'
  | 'issuer'
  | 'decision'
  | 'employer'
  | 'trust_state';

export type KnowledgeNode = {
  id: string;
  label: string;
  group: KnowledgeNodeGroup;
  status?: string;
  trustState?: string;
};

export type KnowledgeEdgeLabel =
  | 'ISSUED_BY'
  | 'SUPPORTS_DECISION'
  | 'EVALUATED_FOR'
  | 'HAS_TRUST_STATE';

export type KnowledgeEdge = {
  source: string;
  target: string;
  label: KnowledgeEdgeLabel;
};

export type KnowledgeGraphResult = {
  graph: {
    nodes: KnowledgeNode[];
    edges: KnowledgeEdge[];
  };
  provenance: {
    trust_state: {
      count: number;
      values: string[];
    };
    decision_capsules: {
      count: number;
    };
    verification_artifacts: {
      count: number;
    };
  };
  generatedAt: string;
};

type GenerateKnowledgeGraphOptions = {
  organizationId?: string;
};

const NODE_GROUP_ORDER: Record<KnowledgeNodeGroup, number> = {
  credential: 0,
  issuer: 1,
  trust_state: 2,
  decision: 3,
  employer: 4,
};

function buildIssuerNodeId(source: string): string {
  return `issuer-${encodeURIComponent(source.trim())}`;
}

function buildTrustStateNodeId(trustState: string): string {
  return `trust-state-${encodeURIComponent(trustState.trim().toLowerCase())}`;
}

function parseEmployerId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const rawValue = (metadata as Record<string, unknown>).employerId;
  if (typeof rawValue !== 'string') {
    return null;
  }

  const normalized = rawValue.trim();
  return normalized.length > 0 ? normalized : null;
}

function sortNodes(nodes: KnowledgeNode[]): KnowledgeNode[] {
  return [...nodes].sort((left, right) => {
    const groupDiff = NODE_GROUP_ORDER[left.group] - NODE_GROUP_ORDER[right.group];
    if (groupDiff !== 0) {
      return groupDiff;
    }

    return left.id.localeCompare(right.id);
  });
}

function sortEdges(edges: KnowledgeEdge[]): KnowledgeEdge[] {
  return [...edges].sort((left, right) => {
    const sourceDiff = left.source.localeCompare(right.source);
    if (sourceDiff !== 0) {
      return sourceDiff;
    }

    const targetDiff = left.target.localeCompare(right.target);
    if (targetDiff !== 0) {
      return targetDiff;
    }

    return left.label.localeCompare(right.label);
  });
}

export async function generateKnowledgeGraph(
  npi: string,
  options: GenerateKnowledgeGraphOptions = {},
): Promise<KnowledgeGraphResult> {
  const organizationId = options.organizationId?.trim();
  if (!organizationId) {
    throw new Error('organizationId is required for knowledge graph generation');
  }

  const [artifacts, decisionCapsules] = await Promise.all([
    prisma.verificationArtifact.findMany({
      where: {
        npi,
        organizationId,
      },
      orderBy: [{ verifiedAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        source: true,
        status: true,
        trustState: true,
      },
    }),
    // Residual schema constraint: DecisionCapsule has no organizationId field yet.
    // We intentionally scope by subjectNpi only until tenant scoping is added.
    prisma.decisionCapsule.findMany({
      where: { subjectNpi: npi },
      orderBy: [{ decisionTimestamp: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        decisionType: true,
        decisionTimestamp: true,
        status: true,
        credentialIds: true,
        metadata: true,
      },
    }),
  ]);

  const nodeById = new Map<string, KnowledgeNode>();
  const edgeByKey = new Map<string, KnowledgeEdge>();
  const trustStateValues = new Set<string>();

  const addNode = (node: KnowledgeNode): void => {
    if (!nodeById.has(node.id)) {
      nodeById.set(node.id, node);
    }
  };

  const addEdge = (edge: KnowledgeEdge): void => {
    const key = `${edge.source}|${edge.target}|${edge.label}`;
    if (!edgeByKey.has(key)) {
      edgeByKey.set(key, edge);
    }
  };

  for (const artifact of artifacts) {
    const credentialNodeId = `credential-${artifact.id}`;
    const issuerNodeId = buildIssuerNodeId(artifact.source);
    const normalizedTrustState = artifact.trustState.trim() || 'unknown';
    const trustStateNodeId = buildTrustStateNodeId(normalizedTrustState);

    trustStateValues.add(normalizedTrustState);

    addNode({
      id: credentialNodeId,
      label: `${artifact.source} Credential`,
      group: 'credential',
      status: artifact.status,
      trustState: normalizedTrustState,
    });
    addNode({
      id: issuerNodeId,
      label: artifact.source,
      group: 'issuer',
    });
    addNode({
      id: trustStateNodeId,
      label: normalizedTrustState,
      group: 'trust_state',
    });

    addEdge({
      source: credentialNodeId,
      target: issuerNodeId,
      label: 'ISSUED_BY',
    });
    addEdge({
      source: credentialNodeId,
      target: trustStateNodeId,
      label: 'HAS_TRUST_STATE',
    });
  }

  for (const capsule of decisionCapsules) {
    const decisionNodeId = `decision-${capsule.id}`;
    const dateLabel = capsule.decisionTimestamp.toISOString().slice(0, 10);

    addNode({
      id: decisionNodeId,
      label: `${capsule.decisionType} (${dateLabel})`,
      group: 'decision',
      status: capsule.status,
    });

    for (const credentialId of capsule.credentialIds) {
      const credentialNodeId = `credential-${credentialId}`;
      if (nodeById.has(credentialNodeId)) {
        addEdge({
          source: credentialNodeId,
          target: decisionNodeId,
          label: 'SUPPORTS_DECISION',
        });
      }
    }

    const employerId = parseEmployerId(capsule.metadata);
    if (employerId) {
      const employerNodeId = `employer-${encodeURIComponent(employerId)}`;
      addNode({
        id: employerNodeId,
        label: employerId,
        group: 'employer',
      });
      addEdge({
        source: decisionNodeId,
        target: employerNodeId,
        label: 'EVALUATED_FOR',
      });
    }
  }

  const nodes = sortNodes([...nodeById.values()]);
  const edges = sortEdges([...edgeByKey.values()]);
  const trustStateList = [...trustStateValues].sort((left, right) => left.localeCompare(right));

  return {
    graph: {
      nodes,
      edges,
    },
    provenance: {
      trust_state: {
        count: trustStateList.length,
        values: trustStateList,
      },
      decision_capsules: {
        count: decisionCapsules.length,
      },
      verification_artifacts: {
        count: artifacts.length,
      },
    },
    generatedAt: new Date().toISOString(),
  };
}
