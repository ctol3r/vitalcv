import type {
  EdgeType,
  GraphEdge,
  GraphLayer,
  GraphNode,
  NodeType,
} from '@/components/graph-system/types';

export type GraphViewMode = 'global' | 'local';
export type GraphPhysicsPresetId = 'balanced' | 'clustered' | 'explore' | 'dense' | 'presentation';
export type GraphColorMode = 'type' | 'group' | 'tier' | 'relationship_class';
export type GraphClusterMode = 'none' | 'type' | 'group' | 'tier';
export type GraphLinkClass = 'explicit' | 'backlink' | 'ai' | 'inferred' | 'trust';

export interface GraphFilterState {
  searchTerm: string;
  nodeTypes: NodeType[];
  linkClasses: GraphLinkClass[];
  trustTiers: string[];
  showOrphans: boolean;
  showDirected: boolean;
}

export interface GraphVisualState {
  showArrows: boolean;
  showLabels: boolean;
  animate: boolean;
  nodeSize: number;
  linkThickness: number;
  textFadeThreshold: number;
  colorMode: GraphColorMode;
  clusterMode: GraphClusterMode;
}

export interface GraphPhysicsState {
  preset: GraphPhysicsPresetId;
  centerForce: number;
  repelForce: number;
  linkForce: number;
  linkDistance: number;
  clusterForce: number;
  frozen: boolean;
}

export interface GraphDisplayState {
  layer: GraphLayer;
  viewMode: GraphViewMode;
  localRootId: string | null;
  filters: GraphFilterState;
  visuals: GraphVisualState;
  physics: GraphPhysicsState;
}

export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  orphanCount: number;
  aiSuggestedLinks: number;
}

export const GRAPH_LINK_CLASS_ORDER: GraphLinkClass[] = [
  'explicit',
  'backlink',
  'ai',
  'inferred',
  'trust',
];

export const GRAPH_LINK_CLASS_LABELS: Record<GraphLinkClass, string> = {
  explicit: 'Explicit',
  backlink: 'Backlinks',
  ai: 'AI links',
  inferred: 'Inferred',
  trust: 'Trust ops',
};

export const GRAPH_COLOR_MODE_LABELS: Record<GraphColorMode, string> = {
  type: 'Node type',
  group: 'Group / folder',
  tier: 'Trust tier',
  relationship_class: 'Relationship class',
};

export const DEFAULT_GRAPH_STATS: GraphStats = {
  totalNodes: 0,
  totalEdges: 0,
  orphanCount: 0,
  aiSuggestedLinks: 0,
};

export const DEFAULT_GRAPH_FILTERS: GraphFilterState = {
  searchTerm: '',
  nodeTypes: [],
  linkClasses: [...GRAPH_LINK_CLASS_ORDER],
  trustTiers: [],
  showOrphans: false,
  showDirected: true,
};

export const DEFAULT_GRAPH_VISUALS: GraphVisualState = {
  showArrows: true,
  showLabels: true,
  animate: true,
  nodeSize: 7,
  linkThickness: 1.4,
  textFadeThreshold: 0.72,
  colorMode: 'type',
  clusterMode: 'group',
};

export const DEFAULT_GRAPH_PHYSICS: GraphPhysicsState = {
  preset: 'balanced',
  centerForce: 0.015,
  repelForce: 180,
  linkForce: 0.085,
  linkDistance: 150,
  clusterForce: 0.045,
  frozen: false,
};

export const DEFAULT_GRAPH_DISPLAY_STATE: GraphDisplayState = {
  layer: 'blended',
  viewMode: 'global',
  localRootId: null,
  filters: DEFAULT_GRAPH_FILTERS,
  visuals: DEFAULT_GRAPH_VISUALS,
  physics: DEFAULT_GRAPH_PHYSICS,
};

const AI_EDGE_TYPES = new Set<EdgeType>(['ai_suggested_link', 'ai_accepted_link']);
const INFERRED_EDGE_TYPES = new Set<EdgeType>([
  'semantic_similarity',
  'related_to',
  'same_as',
  'derived_from',
  'sourced_from',
  'references',
  'storyline_related',
]);
const EXPLICIT_EDGE_TYPES = new Set<EdgeType>(['explicit_link', 'evidence_link']);
const TRUST_EDGE_TYPES = new Set<EdgeType>([
  'mentions',
  'affiliated_with',
  'works_at',
  'trained_at',
  'published_with',
  'co_author',
  'co_investigator',
  'financial',
  'institutional',
  'regulatory',
  'verifies',
  'issued_by',
  'verified_by',
  'depends_on',
  'accepted_by',
  'attested_by',
  'sanctioned_by',
  'privileged_at',
  'enrolled_in',
  'tagged_with',
  'attached_to',
  'parent_of',
  'child_of',
]);

export function humanizeGraphToken(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatGraphNodeType(type: NodeType): string {
  return humanizeGraphToken(type);
}

export function classifyEdgeType(edge: Pick<GraphEdge, 'type'>): GraphLinkClass {
  if (edge.type === 'backlink') {
    return 'backlink';
  }

  if (EXPLICIT_EDGE_TYPES.has(edge.type)) {
    return 'explicit';
  }

  if (AI_EDGE_TYPES.has(edge.type)) {
    return 'ai';
  }

  if (INFERRED_EDGE_TYPES.has(edge.type)) {
    return 'inferred';
  }

  if (TRUST_EDGE_TYPES.has(edge.type)) {
    return 'trust';
  }

  return 'trust';
}

export function collectNodeTypes(nodes: GraphNode[]): NodeType[] {
  return [...new Set(nodes.map((node) => node.type))].sort((left, right) => left.localeCompare(right));
}

export function collectTrustTiers(nodes: GraphNode[]): string[] {
  return [...new Set(nodes.flatMap((node) => (node.trustTier ? [node.trustTier] : [])))]
    .sort((left, right) => left.localeCompare(right));
}

export function deriveClusterId(node: GraphNode, clusterMode: GraphClusterMode): string | undefined {
  switch (clusterMode) {
    case 'type':
      return node.type;
    case 'group':
      return node.group || node.type;
    case 'tier':
      return node.trustTier ?? 'untiered';
    default:
      return undefined;
  }
}

export function resolveGraphStats(nodes: GraphNode[], edges: GraphEdge[]): GraphStats {
  const connectedNodeIds = new Set<string>();

  for (const edge of edges) {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  }

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    orphanCount: nodes.filter((node) => !connectedNodeIds.has(node.id)).length,
    aiSuggestedLinks: edges.filter((edge) => AI_EDGE_TYPES.has(edge.type) || edge.type === 'storyline_related').length,
  };
}
