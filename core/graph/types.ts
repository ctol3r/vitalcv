export type GraphLayer = 'ontology' | 'events' | 'network' | 'dual' | 'intelligence';

export interface GraphNode {
  id: string;
  kind: string;
  label: string;
  layer: GraphLayer;
  confidence: number;
  timestamp?: string;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  directed: boolean;
  weight: number;
  confidence: number;
  layer: GraphLayer;
  timestamp?: string;
  metadata: Record<string, unknown>;
}

export interface GraphProjection {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphScore {
  nodeId: string;
  score: number;
  rank: number;
  percentile: number;
}

export interface GraphCommunity {
  communityId: string;
  memberNodeIds: string[];
  size: number;
  density: number;
  cohesion: number;
}

export interface GraphAlgorithmBundle {
  pageRank: GraphScore[];
  betweennessCentrality: GraphScore[];
  articulationPoints: string[];
  communities: GraphCommunity[];
}
