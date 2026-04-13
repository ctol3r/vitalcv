import type { PrismaClient } from '@prisma/client';

export interface TraversedGraphNode {
  id: string;
  type: string;
  label: string;
  groupKey: string | null;
  metadata: unknown;
}

export interface TraversedGraphEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: string;
  confidence: number;
  status: string;
}

export interface TraversedGraphResult {
  nodes: TraversedGraphNode[];
  edges: TraversedGraphEdge[];
}

export async function traverseActiveGraph(
  prismaClient: PrismaClient,
  input: {
    startNodeId: string;
    depth?: number;
    edgeTypes?: string[];
  },
): Promise<TraversedGraphResult> {
  const depth = Math.max(0, input.depth ?? 1);
  const nodeIds = new Set<string>([input.startNodeId]);
  const edgeMap = new Map<string, TraversedGraphEdge>();
  let frontier = new Set<string>([input.startNodeId]);

  for (let hop = 0; hop < depth; hop += 1) {
    if (frontier.size === 0) {
      break;
    }

    const edges = await prismaClient.graphEdge.findMany({
      where: {
        status: 'ACTIVE',
        ...(input.edgeTypes && input.edgeTypes.length > 0
          ? { edgeType: { in: input.edgeTypes } }
          : {}),
        OR: [
          { sourceNodeId: { in: [...frontier] } },
          { targetNodeId: { in: [...frontier] } },
        ],
      },
      select: {
        id: true,
        sourceNodeId: true,
        targetNodeId: true,
        edgeType: true,
        confidence: true,
        status: true,
      },
    });

    const nextFrontier = new Set<string>();
    for (const edge of edges) {
      edgeMap.set(edge.id, edge);
      if (!nodeIds.has(edge.sourceNodeId)) {
        nodeIds.add(edge.sourceNodeId);
        nextFrontier.add(edge.sourceNodeId);
      }
      if (!nodeIds.has(edge.targetNodeId)) {
        nodeIds.add(edge.targetNodeId);
        nextFrontier.add(edge.targetNodeId);
      }
    }
    frontier = nextFrontier;
  }

  const nodes = await prismaClient.graphNode.findMany({
    where: {
      id: { in: [...nodeIds] },
      active: true,
    },
    select: {
      id: true,
      type: true,
      label: true,
      groupKey: true,
      metadata: true,
    },
  });

  const activeNodeIds = new Set(nodes.map((node) => node.id));
  const edges = [...edgeMap.values()].filter(
    (edge) => activeNodeIds.has(edge.sourceNodeId) && activeNodeIds.has(edge.targetNodeId),
  );

  return {
    nodes,
    edges,
  };
}
