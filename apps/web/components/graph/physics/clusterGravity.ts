import type { SimulationNode } from '@/components/graph/physics/layoutEngine';

export function applyClusterGravity(nodes: SimulationNode[], clusterForce: number): void {
  if (clusterForce <= 0) {
    return;
  }

  const centroids = new Map<string, { x: number; y: number; count: number }>();

  for (const node of nodes) {
    if (!node.clusterId) {
      continue;
    }

    const centroid = centroids.get(node.clusterId) ?? { x: 0, y: 0, count: 0 };
    centroid.x += node.x ?? 0;
    centroid.y += node.y ?? 0;
    centroid.count += 1;
    centroids.set(node.clusterId, centroid);
  }

  for (const centroid of centroids.values()) {
    centroid.x /= centroid.count;
    centroid.y /= centroid.count;
  }

  for (const node of nodes) {
    if (!node.clusterId || node.fx != null || node.fy != null) {
      continue;
    }

    const centroid = centroids.get(node.clusterId);
    if (!centroid) {
      continue;
    }

    const dx = centroid.x - (node.x ?? centroid.x);
    const dy = centroid.y - (node.y ?? centroid.y);
    const weight = 1 + Math.min(node.degree, 8) * 0.04;

    node.vx += dx * clusterForce * 0.0018 * weight;
    node.vy += dy * clusterForce * 0.0018 * weight;
  }
}
