import type {
  GraphPhysicsPresetId,
  GraphPhysicsState,
} from '@/components/graph/state/graphDisplayState';

export interface GraphPhysicsPreset extends Omit<GraphPhysicsState, 'preset' | 'frozen'> {
  label: string;
  description: string;
}

export const GRAPH_PHYSICS_PRESETS: Record<GraphPhysicsPresetId, GraphPhysicsPreset> = {
  balanced: {
    label: 'Balanced',
    description: 'General-purpose operational layout with readable cohesion.',
    centerForce: 0.015,
    repelForce: 180,
    linkForce: 0.085,
    linkDistance: 150,
    clusterForce: 0.045,
  },
  clustered: {
    label: 'Clustered',
    description: 'Stronger intra-group gravity for separated graph domains.',
    centerForce: 0.012,
    repelForce: 205,
    linkForce: 0.08,
    linkDistance: 156,
    clusterForce: 0.09,
  },
  explore: {
    label: 'Explore',
    description: 'More air between structures for local investigation.',
    centerForce: 0.008,
    repelForce: 240,
    linkForce: 0.065,
    linkDistance: 176,
    clusterForce: 0.05,
  },
  dense: {
    label: 'Dense',
    description: 'Compact topology for high-volume connected slices.',
    centerForce: 0.022,
    repelForce: 145,
    linkForce: 0.1,
    linkDistance: 124,
    clusterForce: 0.035,
  },
  presentation: {
    label: 'Presentation',
    description: 'Restrained movement with clean cluster hierarchy.',
    centerForce: 0.014,
    repelForce: 195,
    linkForce: 0.078,
    linkDistance: 164,
    clusterForce: 0.068,
  },
};

export function applyPhysicsPreset(
  preset: GraphPhysicsPresetId,
  frozen = false,
): GraphPhysicsState {
  const config = GRAPH_PHYSICS_PRESETS[preset];

  return {
    preset,
    frozen,
    centerForce: config.centerForce,
    repelForce: config.repelForce,
    linkForce: config.linkForce,
    linkDistance: config.linkDistance,
    clusterForce: config.clusterForce,
  };
}
