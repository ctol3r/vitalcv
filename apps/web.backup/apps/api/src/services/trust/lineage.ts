import { IssuerFederation, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface LineageNodeMetrics {
  did: string;
  depth: number;
  parents: string[];
  children: string[];
}

export interface LineageEdge {
  parentDid: string;
  childDid: string;
  trustLevel: number;
  createdAt: string;
}

export interface LineageGraphSummary {
  nodes: LineageNodeMetrics[];
  edges: LineageEdge[];
  stats: {
    nodeCount: number;
    rootCount: number;
    maxDepth: number;
  };
  focusDid?: string;
  focusPath?: string[];
}

export interface LineageMetrics {
  issuerDid: string;
  depth: number;
  path: string[];
  trustFloor?: number;
}

export async function buildLineageGraph(targetDid?: string): Promise<LineageGraphSummary> {
  const edges = await fetchEdges();
  const roots = deriveRoots(edges);
  const adjacency = buildAdjacency(edges);
  const { nodes, maxDepth } = buildDepthIndex(roots, adjacency);

  const focus =
    targetDid && nodes.has(targetDid)
      ? resolveLineagePath(targetDid, adjacency, nodes.get(targetDid)!.depth)
      : undefined;

  return {
    nodes: Array.from(nodes.values()),
    edges: edges.map((edge) => ({
      parentDid: edge.parentDid,
      childDid: edge.childDid,
      trustLevel: edge.trustLevel,
      createdAt: edge.createdAt.toISOString(),
    })),
    stats: {
      nodeCount: nodes.size,
      rootCount: roots.length || (nodes.size ? 1 : 0),
      maxDepth,
    },
    focusDid: targetDid,
    focusPath: focus?.path,
  };
}

export async function getLineageMetrics(issuerDid: string): Promise<LineageMetrics> {
  const edges = await fetchEdges();
  if (!edges.length) {
    return {
      issuerDid,
      depth: 0,
      path: [issuerDid],
    };
  }

  const adjacency = buildAdjacency(edges);
  const parents = deriveRoots(edges);
  const visited = new Set<string>();
  const queue: Array<{ did: string; depth: number; path: string[]; trustFloor: number }> = parents.map(
    (root) => ({
      did: root,
      depth: 0,
      path: [root],
      trustFloor: 5,
    }),
  );

  while (queue.length) {
    const node = queue.shift()!;
    if (visited.has(node.did)) {
      continue;
    }
    visited.add(node.did);

    if (node.did === issuerDid) {
      return {
        issuerDid,
        depth: node.depth,
        path: node.path,
        trustFloor: node.trustFloor,
      };
    }

    const children = adjacency.get(node.did) ?? [];
    for (const child of children) {
      queue.push({
        did: child.childDid,
        depth: node.depth + 1,
        path: [...node.path, child.childDid],
        trustFloor: Math.min(node.trustFloor, child.trustLevel),
      });
    }
  }

  return {
    issuerDid,
    depth: 0,
    path: [issuerDid],
  };
}

async function fetchEdges(): Promise<IssuerFederation[]> {
  return prisma.issuerFederation.findMany({
    orderBy: [{ parentDid: 'asc' }, { childDid: 'asc' }],
  });
}

function deriveRoots(edges: IssuerFederation[]): string[] {
  const parents = new Set(edges.map((edge) => edge.parentDid));
  const children = new Set(edges.map((edge) => edge.childDid));
  const roots = Array.from(parents).filter((did) => !children.has(did));
  return roots.length ? roots : Array.from(parents);
}

function buildAdjacency(edges: IssuerFederation[]): Map<string, IssuerFederation[]> {
  const adjacency = new Map<string, IssuerFederation[]>();
  for (const edge of edges) {
    if (!adjacency.has(edge.parentDid)) {
      adjacency.set(edge.parentDid, []);
    }
    adjacency.get(edge.parentDid)!.push(edge);
  }
  return adjacency;
}

function buildDepthIndex(
  roots: string[],
  adjacency: Map<string, IssuerFederation[]>,
): { nodes: Map<string, LineageNodeMetrics>; maxDepth: number } {
  const nodes = new Map<string, LineageNodeMetrics>();
  const queue: Array<{ did: string; depth: number }> = roots.map((root) => ({
    did: root,
    depth: 0,
  }));
  let maxDepth = 0;

  while (queue.length) {
    const node = queue.shift()!;
    maxDepth = Math.max(maxDepth, node.depth);

    const children = adjacency.get(node.did) ?? [];
    const parents = findParents(node.did, adjacency);
    nodes.set(node.did, {
      did: node.did,
      depth: node.depth,
      parents,
      children: children.map((child) => child.childDid),
    });

    for (const child of children) {
      queue.push({
        did: child.childDid,
        depth: node.depth + 1,
      });
    }
  }

  return { nodes, maxDepth };
}

function findParents(target: string, adjacency: Map<string, IssuerFederation[]>): string[] {
  const parents: string[] = [];
  adjacency.forEach((children, parentDid) => {
    if (children.some((edge) => edge.childDid === target)) {
      parents.push(parentDid);
    }
  });
  return parents;
}

function resolveLineagePath(
  targetDid: string,
  adjacency: Map<string, IssuerFederation[]>,
  depth: number,
): { path: string[] } | undefined {
  if (!depth) {
    return { path: [targetDid] };
  }

  const parents: string[] = [];
  adjacency.forEach((children, parentDid) => {
    if (children.some((child) => child.childDid === targetDid)) {
      parents.push(parentDid);
    }
  });

  if (!parents.length) {
    return { path: [targetDid] };
  }

  // Prefer the first parent and build backwards.
  const path = [targetDid];
  let currentParents = parents;
  while (currentParents.length) {
    const parent = currentParents[0];
    path.push(parent);
    const nextParents: string[] = [];
    adjacency.forEach((children, candidateParent) => {
      if (children.some((child) => child.childDid === parent)) {
        nextParents.push(candidateParent);
      }
    });
    currentParents = nextParents;
  }

  return { path: path.reverse() };
}










