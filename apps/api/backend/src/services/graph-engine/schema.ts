/**
 * schema.ts — Canonical Graph Domain Model
 *
 * Dual graph system:
 *   1. KNOWLEDGE GRAPH — notes, docs, tags, attachments, semantic links
 *   2. TRUST / ENTITY GRAPH — clinicians, organizations, claims, artifacts, sources
 *
 * Both share the same node/edge contract, rendered with the same engine,
 * but can be filtered, blended, or viewed separately.
 *
 * Storage: KnowledgeNode + AuthorityEdge Prisma models.
 * Extended metadata goes in the JSON `attributes` / `metadata` columns.
 */

// ── Node Types ────────────────────────────────────────────────────────────────

export const NODE_TYPES = [
  // Knowledge graph
  'note', 'document', 'tag', 'attachment', 'group',
  // Trust / entity graph
  'clinician', 'organization', 'institution', 'specialty',
  'program', 'publication', 'trial', 'claim', 'artifact',
  'receipt', 'source', 'credential', 'license', 'decision',
  'taxonomy', 'state', 'trust_state',
  'exclusion', 'enrollment',
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

// ── Edge Types ────────────────────────────────────────────────────────────────

export const EDGE_TYPES = [
  // Linking
  'explicit_link', 'backlink', 'ai_suggested_link', 'ai_accepted_link',
  'semantic_similarity', 'mentions', 'references',
  // Entity relationships
  'affiliated_with', 'works_at', 'trained_at', 'published_with',
  'derived_from', 'sourced_from', 'verifies', 'same_as', 'related_to',
  // Trust / authority
  'issued_by', 'verified_by', 'depends_on', 'accepted_by',
  'attested_by', 'sanctioned_by', 'privileged_at', 'enrolled_in',
  'taxonomy_to_provider', 'state_to_provider', 'provider_to_trust_state',
  // Hierarchy
  'parent_of', 'child_of', 'tagged_with', 'attached_to',
] as const;

export type EdgeType = (typeof EDGE_TYPES)[number];

// ── Edge Creation Source ──────────────────────────────────────────────────────

export type EdgeCreator = 'user' | 'ai' | 'system' | 'ingest';
export type EdgeStatus = 'active' | 'pending' | 'rejected' | 'superseded';

// ── Graph Layer ───────────────────────────────────────────────────────────────

export type GraphLayer = 'knowledge' | 'trust' | 'blended';

// ── Color Groups ──────────────────────────────────────────────────────────────

export const COLOR_GROUPS: Record<NodeType, string> = {
  note:          '#94a3b8', // slate
  document:      '#94a3b8',
  tag:           '#a78bfa', // violet
  attachment:    '#64748b', // slate-500
  group:         '#c084fc', // purple
  clinician:     '#f59e0b', // amber/gold — center of gravity
  organization:  '#3b82f6', // blue
  institution:   '#6366f1', // indigo
  specialty:     '#14b8a6', // teal
  program:       '#8b5cf6', // violet
  publication:   '#22d3ee', // cyan
  trial:         '#06b6d4', // cyan-500
  claim:         '#10b981', // emerald
  artifact:      '#059669', // emerald-600
  receipt:       '#34d399', // emerald-400
  source:        '#f97316', // orange
  credential:    '#10b981', // emerald
  license:       '#22c55e', // green
  decision:      '#f8fafc', // white
  taxonomy:      '#06b6d4', // cyan-500
  state:         '#2563eb', // blue-600
  trust_state:   '#f59e0b', // amber
  exclusion:     '#ef4444', // red
  enrollment:    '#3b82f6', // blue
};

// ── Graph Node ────────────────────────────────────────────────────────────────

export interface GraphNode {
  id:            string;
  type:          NodeType;
  label:         string;
  title:         string;       // full title/name
  color:         string;       // hex color from group
  group:         string;       // grouping key (type, folder, tier, custom)
  degree:        number;       // total edge count
  inDegree:      number;
  outDegree:     number;
  layer:         GraphLayer;

  // Metadata
  metadata:      Record<string, unknown>;
  tags:          string[];
  sourceRefs:    string[];     // artifact IDs, document IDs, etc.

  // Trust-specific (optional)
  trustTier?:    'GOLD' | 'SILVER' | 'BRONZE';
  trustBand?:    'L0' | 'L1' | 'L2' | 'L3';
  confidence?:   number;       // 0-1

  // Temporal
  createdAt:     string;
  updatedAt:     string;

  // Render state (computed, not persisted in DB)
  x?:            number;
  y?:            number;
  fx?:           number | null; // pinned x
  fy?:           number | null; // pinned y
  size?:         number;        // computed from degree
  visible?:      boolean;
  highlighted?:  boolean;
  selected?:     boolean;
  clusterId?:    string;
}

// ── Graph Edge ────────────────────────────────────────────────────────────────

export interface GraphEdge {
  id:            string;
  source:        string;       // source node ID
  target:        string;       // target node ID
  type:          EdgeType;
  directed:      boolean;
  reciprocal:    boolean;      // true = A->B implies B->A

  // Provenance
  confidence:    number;       // 0-1
  createdBy:     EdgeCreator;
  explanation:   string;       // why this edge exists
  status:        EdgeStatus;

  // Metadata
  weight:        number;       // for force simulation
  metadata:      Record<string, unknown>;
  layer:         GraphLayer;

  // Temporal
  createdAt:     string;
  updatedAt:     string;

  // Render state
  color?:        string;
  opacity?:      number;
  visible?:      boolean;
  highlighted?:  boolean;
}

// ── Graph Snapshot ─────────────────────────────────────────────────────────────

export interface GraphSnapshot {
  id:            string;
  generatedAt:   string;
  layer:         GraphLayer;
  nodeCount:     number;
  edgeCount:     number;
  nodes:         GraphNode[];
  edges:         GraphEdge[];
  stats:         GraphStats;
  version:       string;
}

export interface GraphStats {
  totalNodes:      number;
  totalEdges:      number;
  orphanCount:     number;
  avgDegree:       number;
  maxDegree:       number;
  clusterCount:    number;
  aiSuggestedLinks: number;
  aiAcceptedLinks:  number;
  explicitLinks:   number;
  inferredLinks:   number;
  hubCount?:       number;
  similarityEdgeCount?: number;
  recommendationCount?: number;
  avgRelationshipStrength?: number;
  nodesByType:     Record<string, number>;
  edgesByType:     Record<string, number>;
}

export interface GraphHubSummary {
  nodeId: string;
  score: number;
  rank: number;
  percentile: number;
  reason: string;
}

export interface GraphClusterSummary {
  clusterId: string;
  label: string;
  memberNodeIds: string[];
  size: number;
  density: number;
  bridgeNodeIds: string[];
}

export interface GraphConnectionRecommendation {
  sourceNodeId: string;
  targetNodeId: string;
  score: number;
  reasons: string[];
  sharedNeighborIds: string[];
  sharedTokens: string[];
}

export interface GraphIntelligenceMetrics {
  clusterCount: number;
  hubCount: number;
  similarityEdgeCount: number;
  recommendationCount: number;
  avgRelationshipStrength: number;
}

export interface GraphIntelligenceReport {
  version: string;
  generatedAt: string;
  hubs: GraphHubSummary[];
  clusters: GraphClusterSummary[];
  recommendations: GraphConnectionRecommendation[];
  metrics: GraphIntelligenceMetrics;
}

// ── Graph Preferences (persisted per user) ────────────────────────────────────

export interface GraphPreferences {
  id:              string;
  name:            string;       // preset name
  isDefault:       boolean;

  // View mode
  layer:           GraphLayer;
  localNodeId:     string | null; // null = global view
  depth:           number;        // hops from local node

  // Filters
  filters: {
    nodeTypes:       NodeType[];
    edgeTypes:       EdgeType[];
    trustTiers:      string[];
    tags:            string[];
    showOrphans:     boolean;
    showAttachments: boolean;
    showExplicit:    boolean;
    showInferred:    boolean;
    showAiLinks:     boolean;
    showDirected:    boolean;
    searchTerm:      string;
    groups:          string[];
  };

  // Display
  display: {
    showArrows:        boolean;
    showLabels:        boolean;
    animate:           boolean;
    nodeSize:          number;     // 1-20 scale factor
    linkThickness:     number;     // 1-10
    textFadeThreshold: number;     // zoom level below which labels hide
    colorMode:         'type' | 'group' | 'tier' | 'edge_class' | 'custom';
    clusterMode:       'none' | 'type' | 'group' | 'tier' | 'louvain';
  };

  // Physics
  physics: {
    centerForce:     number;      // 0-1
    repelForce:      number;      // 0-500
    linkForce:       number;      // 0-1
    linkDistance:     number;      // 10-500
    clusterSpacing:  number;      // 0-200
    frozen:          boolean;
  };

  // Pinned nodes
  pinnedNodes:     Record<string, { x: number; y: number }>;

  // Camera
  camera: {
    x:      number;
    y:      number;
    zoom:   number;
  };

  // Timestamps
  createdAt:   string;
  updatedAt:   string;
}

// ── Default preferences ───────────────────────────────────────────────────────

export function defaultPreferences(): GraphPreferences {
  return {
    id:        'default',
    name:      'Default',
    isDefault: true,
    layer:     'blended',
    localNodeId: null,
    depth:     2,
    filters: {
      nodeTypes:       [...NODE_TYPES],
      edgeTypes:       [...EDGE_TYPES],
      trustTiers:      ['GOLD', 'SILVER', 'BRONZE'],
      tags:            [],
      showOrphans:     false,
      showAttachments: true,
      showExplicit:    true,
      showInferred:    true,
      showAiLinks:     true,
      showDirected:    true,
      searchTerm:      '',
      groups:          [],
    },
    display: {
      showArrows:        true,
      showLabels:        true,
      animate:           true,
      nodeSize:          6,
      linkThickness:     2,
      textFadeThreshold: 0.5,
      colorMode:         'type',
      clusterMode:       'type',
    },
    physics: {
      centerForce:     0.3,
      repelForce:      100,
      linkForce:       0.5,
      linkDistance:     80,
      clusterSpacing:  60,
      frozen:          false,
    },
    pinnedNodes: {},
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ── Edge color map ────────────────────────────────────────────────────────────

export const EDGE_COLORS: Record<string, string> = {
  explicit_link:        '#64748b',
  backlink:             '#475569',
  ai_suggested_link:    '#fbbf24', // amber — attention
  ai_accepted_link:     '#34d399', // emerald — confirmed
  semantic_similarity:  '#818cf8', // indigo
  mentions:             '#94a3b8',
  references:           '#94a3b8',
  affiliated_with:      '#3b82f6',
  works_at:             '#6366f1',
  trained_at:           '#8b5cf6',
  published_with:       '#22d3ee',
  derived_from:         '#f97316',
  sourced_from:         '#f97316',
  verifies:             '#10b981',
  same_as:              '#f59e0b',
  related_to:           '#64748b',
  issued_by:            '#3b82f6',
  verified_by:          '#10b981',
  depends_on:           '#f59e0b',
  accepted_by:          '#8b5cf6',
  attested_by:          '#a78bfa',
  sanctioned_by:        '#ef4444',
  privileged_at:        '#6366f1',
  enrolled_in:          '#3b82f6',
  taxonomy_to_provider: '#06b6d4',
  state_to_provider:    '#2563eb',
  provider_to_trust_state: '#f59e0b',
  parent_of:            '#475569',
  child_of:             '#475569',
  tagged_with:          '#a78bfa',
  attached_to:          '#64748b',
};

// ── Utility: classify node into graph layer ───────────────────────────────────

const KNOWLEDGE_TYPES: NodeType[] = ['note', 'document', 'tag', 'attachment', 'group'];
const TRUST_TYPES: NodeType[] = ['clinician', 'organization', 'institution', 'specialty',
  'program', 'publication', 'trial', 'claim', 'artifact', 'receipt', 'source',
  'credential', 'license', 'decision', 'taxonomy', 'state', 'trust_state',
  'exclusion', 'enrollment'];

export function nodeLayer(type: NodeType): GraphLayer {
  if (KNOWLEDGE_TYPES.includes(type)) return 'knowledge';
  if (TRUST_TYPES.includes(type)) return 'trust';
  return 'blended';
}

export function edgeLayer(type: EdgeType): GraphLayer {
  const knowledgeEdges: EdgeType[] = ['explicit_link', 'backlink', 'mentions', 'references', 'tagged_with', 'attached_to', 'parent_of', 'child_of'];
  if (knowledgeEdges.includes(type)) return 'knowledge';
  return 'trust';
}

export const GRAPH_SCHEMA_VERSION = '272.3';
export const GRAPH_FILTER_SCHEMA_VERSION = '1';

export const EXPLICIT_EDGE_TYPES = new Set<EdgeType>(['explicit_link', 'backlink']);
export const AI_EDGE_TYPES = new Set<EdgeType>(['ai_suggested_link', 'ai_accepted_link']);
export const INFERRED_EDGE_TYPES = new Set<EdgeType>([
  'semantic_similarity',
  'mentions',
  'references',
  'related_to',
  'derived_from',
  'same_as',
]);

export type ClusterMode = 'none' | 'type' | 'group' | 'tier' | 'louvain';
export type GraphScope = 'global' | 'local';

export interface GraphQueryFilters {
  graphMode: GraphLayer;
  scope: GraphScope;
  focusNodeId?: string | null;
  depth: number;
  nodeTypes: NodeType[];
  edgeTypes: EdgeType[];
  tags: string[];
  groups: string[];
  trustTiers: string[];
  searchTerm: string;
  showAttachments: boolean;
  showExistingFilesOnly: boolean;
  showOrphans: boolean;
  showExplicit: boolean;
  showInferred: boolean;
  showAiLinks: boolean;
  includeEdgeStatus: string[];
  clusterMode: ClusterMode;
  limit: number;
  cursor?: string | null;
}

export interface GraphChunk {
  nodes: GraphNode[];
  edges: GraphEdge[];
  nextCursor: string | null;
  truncated: boolean;
}

export interface GraphQueryResult {
  snapshotId: string;
  graphMode: GraphLayer;
  scope: GraphScope;
  focusNodeId: string | null;
  depth: number;
  generatedAt: string;
  cacheStatus: 'hit' | 'miss';
  filters: GraphQueryFilters;
  chunk: GraphChunk;
  intelligence?: GraphIntelligenceReport;
  stats: GraphStats & {
    payloadBytes: number;
    clusterMode: ClusterMode;
    invalidated: boolean;
  };
}

export function defaultGraphQueryFilters(): GraphQueryFilters {
  const defaults = defaultPreferences();
  return {
    graphMode: defaults.layer,
    scope: 'global',
    focusNodeId: null,
    depth: defaults.depth,
    nodeTypes: [...NODE_TYPES],
    edgeTypes: [...EDGE_TYPES],
    tags: [],
    groups: [],
    trustTiers: [...defaults.filters.trustTiers],
    searchTerm: '',
    showAttachments: defaults.filters.showAttachments,
    showExistingFilesOnly: false,
    showOrphans: defaults.filters.showOrphans,
    showExplicit: defaults.filters.showExplicit,
    showInferred: defaults.filters.showInferred,
    showAiLinks: defaults.filters.showAiLinks,
    includeEdgeStatus: ['active', 'pending'],
    clusterMode: defaults.display.clusterMode,
    limit: 300,
    cursor: null,
  };
}

export function normalizeGraphMode(value: unknown): GraphLayer {
  if (value === 'knowledge' || value === 'trust' || value === 'blended') {
    return value;
  }
  return 'blended';
}

export function normalizeClusterMode(value: unknown): ClusterMode {
  if (value === 'none' || value === 'type' || value === 'group' || value === 'tier' || value === 'louvain') {
    return value;
  }
  return 'type';
}

export function normalizeScope(value: unknown): GraphScope {
  return value === 'local' ? 'local' : 'global';
}

export function parseCsvValues(value: unknown): string[] {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return [];
  }
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return fallback;
}

export function coerceNodeTypes(values: string[], fallback: NodeType[] = [...NODE_TYPES]): NodeType[] {
  if (values.length === 0) return fallback;
  const allowed = new Set(NODE_TYPES);
  const coerced = values.filter((value): value is NodeType => allowed.has(value as NodeType));
  return coerced.length > 0 ? coerced : fallback;
}

export function coerceEdgeTypes(values: string[], fallback: EdgeType[] = [...EDGE_TYPES]): EdgeType[] {
  if (values.length === 0) return fallback;
  const allowed = new Set(EDGE_TYPES);
  const coerced = values.filter((value): value is EdgeType => allowed.has(value as EdgeType));
  return coerced.length > 0 ? coerced : fallback;
}
