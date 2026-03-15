import type { SimulationNode } from '@/components/graph/physics/layoutEngine';

export function applyCollision(nodes: SimulationNode[], padding = 10): void {
  for (let index = 0; index < nodes.length; index += 1) {
    for (let peerIndex = index + 1; peerIndex < nodes.length; peerIndex += 1) {
      const node = nodes[index];
      const peer = nodes[peerIndex];

      const dx = (peer.x ?? 0) - (node.x ?? 0);
      const dy = (peer.y ?? 0) - (node.y ?? 0);
      const distance = Math.hypot(dx, dy) || 0.0001;
      const minimumDistance = node.radius + peer.radius + padding;

      if (distance >= minimumDistance) {
        continue;
      }

      const overlap = (minimumDistance - distance) / distance;
      const pushX = dx * overlap * 0.5;
      const pushY = dy * overlap * 0.5;

      if (node.fx == null && node.fy == null) {
        node.x = (node.x ?? 0) - pushX;
        node.y = (node.y ?? 0) - pushY;
      }

      if (peer.fx == null && peer.fy == null) {
        peer.x = (peer.x ?? 0) + pushX;
        peer.y = (peer.y ?? 0) + pushY;
      }
    }
  }
}
