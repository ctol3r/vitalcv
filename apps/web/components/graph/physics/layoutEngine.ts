import type { GraphEdge, GraphNode } from '@/components/graph-system/types';
import { applyClusterGravity } from '@/components/graph/physics/clusterGravity';
import { applyCollision } from '@/components/graph/physics/collision';
import { classifyEdgeType } from '@/components/graph/state/graphDisplayState';
import type { GraphPhysicsState } from '@/components/graph/state/graphDisplayState';

export interface SimulationNode extends GraphNode {
  vx: number;
  vy: number;
  radius: number;
}

interface StepLayoutOptions {
  nodes: SimulationNode[];
  edges: GraphEdge[];
  physics: GraphPhysicsState;
  width: number;
  height: number;
  selectedNodeId: string | null;
  nodeScale: number;
}

const EDGE_DISTANCE_MULTIPLIERS = {
  explicit: 0.92,
  backlink: 0.86,
  ai: 1.18,
  inferred: 1.24,
  trust: 1.04,
} as const;

const EDGE_STRENGTH_MULTIPLIERS = {
  explicit: 1.18,
  backlink: 1.04,
  ai: 0.78,
  inferred: 0.72,
  trust: 1.06,
} as const;

function hashSeed(value: string): number {
  let seed = 0;

  for (let index = 0; index < value.length; index += 1) {
    seed = (seed << 5) - seed + value.charCodeAt(index);
    seed |= 0;
  }

  return Math.abs(seed);
}

function seededOffset(seed: number, amplitude: number): number {
  return ((seed % 1000) / 1000 - 0.5) * amplitude;
}

export function seedSimulationNodes(
  nodes: GraphNode[],
  width: number,
  height: number,
  nodeScale: number,
): SimulationNode[] {
  const centerX = width / 2;
  const centerY = height / 2;

  return nodes.map((node, index) => {
    const clusterSeed = hashSeed(node.clusterId ?? node.group ?? node.type);
    const nodeSeed = hashSeed(`${node.id}:${index}`);
    const ring = 110 + (clusterSeed % 7) * 28;
    const angle = ((index + 1) * 137.5 + (clusterSeed % 180)) * (Math.PI / 180);

    return {
      ...node,
      x:
        node.fx ??
        node.x ??
        centerX + Math.cos(angle) * ring + seededOffset(nodeSeed, 44),
      y:
        node.fy ??
        node.y ??
        centerY + Math.sin(angle) * ring + seededOffset(nodeSeed >> 2, 44),
      vx: 0,
      vy: 0,
      radius: Math.max(8, (node.size ?? 8) * nodeScale),
    };
  });
}

export function stepLayout({
  nodes,
  edges,
  physics,
  width,
  height,
  selectedNodeId,
  nodeScale,
}: StepLayoutOptions): void {
  const centerX = width / 2;
  const centerY = height / 2;
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const focusNeighborIds = new Set<string>();

  if (selectedNodeId) {
    focusNeighborIds.add(selectedNodeId);
    for (const edge of edges) {
      if (edge.source === selectedNodeId) {
        focusNeighborIds.add(edge.target);
      }
      if (edge.target === selectedNodeId) {
        focusNeighborIds.add(edge.source);
      }
    }
  }

  for (const node of nodes) {
    if (node.fx != null && node.fy != null) {
      node.x = node.fx;
      node.y = node.fy;
      node.vx = 0;
      node.vy = 0;
      continue;
    }

    const centerDamping = selectedNodeId && !focusNeighborIds.has(node.id) ? 0.7 : 1;
    node.vx += (centerX - (node.x ?? centerX)) * physics.centerForce * 0.0025 * centerDamping;
    node.vy += (centerY - (node.y ?? centerY)) * physics.centerForce * 0.0025 * centerDamping;
  }

  for (let index = 0; index < nodes.length; index += 1) {
    for (let peerIndex = index + 1; peerIndex < nodes.length; peerIndex += 1) {
      const node = nodes[index];
      const peer = nodes[peerIndex];
      const dx = (peer.x ?? 0) - (node.x ?? 0);
      const dy = (peer.y ?? 0) - (node.y ?? 0);
      const distance = Math.hypot(dx, dy) || 0.0001;
      const distanceSquared = distance * distance;
      const interClusterBias =
        node.clusterId && peer.clusterId && node.clusterId !== peer.clusterId ? 1.08 : 0.92;
      const repel = (physics.repelForce / distanceSquared) * interClusterBias;
      const repelX = (dx / distance) * repel;
      const repelY = (dy / distance) * repel;

      if (node.fx == null && node.fy == null) {
        node.vx -= repelX;
        node.vy -= repelY;
      }

      if (peer.fx == null && peer.fy == null) {
        peer.vx += repelX;
        peer.vy += repelY;
      }
    }
  }

  for (const edge of edges) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);

    if (!source || !target || edge.visible === false) {
      continue;
    }

    const linkClass = classifyEdgeType(edge);
    const distanceMultiplier = EDGE_DISTANCE_MULTIPLIERS[linkClass];
    const strengthMultiplier = EDGE_STRENGTH_MULTIPLIERS[linkClass];
    const dx = (target.x ?? 0) - (source.x ?? 0);
    const dy = (target.y ?? 0) - (source.y ?? 0);
    const distance = Math.hypot(dx, dy) || 0.0001;
    const desiredDistance = physics.linkDistance * distanceMultiplier;
    const focusBoost =
      selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId) ? 1.28 : 1;
    const force =
      (distance - desiredDistance) * physics.linkForce * strengthMultiplier * 0.012 * focusBoost;
    const forceX = (dx / distance) * force;
    const forceY = (dy / distance) * force;

    if (source.fx == null && source.fy == null) {
      source.vx += forceX;
      source.vy += forceY;
    }

    if (target.fx == null && target.fy == null) {
      target.vx -= forceX;
      target.vy -= forceY;
    }
  }

  applyClusterGravity(nodes, physics.clusterForce);
  applyCollision(nodes, 10 + nodeScale * 2);

  for (const node of nodes) {
    if (node.fx != null && node.fy != null) {
      continue;
    }

    const focusDamping = selectedNodeId && !focusNeighborIds.has(node.id) ? 0.78 : 0.87;
    node.vx *= focusDamping;
    node.vy *= focusDamping;
    node.x = Math.max(node.radius, Math.min(width - node.radius, (node.x ?? centerX) + node.vx));
    node.y = Math.max(node.radius, Math.min(height - node.radius, (node.y ?? centerY) + node.vy));
    node.radius = Math.max(8, (node.size ?? 8) * nodeScale);
  }
}
