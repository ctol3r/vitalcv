/**
 * Graph system shared types for frontend components.
 */

export type NodeType =
  | 'note' | 'document' | 'tag' | 'attachment' | 'group'
  | 'clinician' | 'organization' | 'institution' | 'specialty'
  | 'program' | 'publication' | 'trial' | 'claim' | 'artifact'
  | 'receipt' | 'source' | 'credential' | 'license' | 'decision'
  | 'exclusion' | 'enrollment';

export type EdgeType =
  | 'explicit_link' | 'backlink' | 'ai_suggested_link' | 'ai_accepted_link'
  | 'semantic_similarity' | 'mentions' | 'references'
  | 'affiliated_with' | 'works_at' | 'trained_at' | 'published_with'
  | 'derived_from' | 'sourced_from' | 'verifies' | 'same_as' | 'related_to'
  | 'issued_by' | 'verified_by' | 'depends_on' | 'accepted_by'
  | 'attested_by' | 'sanctioned_by' | 'privileged_at' | 'enrolled_in'
  | 'parent_of' | 'child_of' | 'tagged_with' | 'attached_to';

export type GraphLayer = 'knowledge' | 'trust' | 'blended';
export type ColorMode = 'type' | 'group' | 'tier' | 'edge_class' | 'custom';
export type ClusterMode = 'none' | 'type' | 'group' | 'tier' | 'louvain';

export interface GraphNode {
  id:            string;
  type:          NodeType;
  label:         string;
  title:         string;
  color:         string;
  group:         string;
  degree:        number;
  inDegree:      number;
  outDegree:     number;
  layer:         GraphLayer;
  metadata:      Record<string, unknown>;
  tags:          string[];
  sourceRefs:    string[];
  trustTier?:    string;
  trustBand?:    string;
  confidence?:   number;
  createdAt:     string;
  updatedAt:     string;
  x?:            number;
  y?:            number;
  fx?:           number | null;
  fy?:           number | null;
  size?:         number;
  visible?:      boolean;
  highlighted?:  boolean;
  selected?:     boolean;
  clusterId?:    string;
}

export interface GraphEdge {
  id:            string;
  source:        string;
  target:        string;
  type:          EdgeType;
  directed:      boolean;
  reciprocal:    boolean;
  confidence:    number;
  createdBy:     string;
  explanation:   string;
  status:        string;
  weight:        number;
  metadata:      Record<string, unknown>;
  layer:         GraphLayer;
  createdAt?:    string;
  updatedAt?:    string;
  color?:        string;
  opacity?:      number;
  visible?:      boolean;
  highlighted?:  boolean;
}

export interface PhysicsConfig {
  centerForce:     number;
  repelForce:      number;
  linkForce:       number;
  linkDistance:    number;
  clusterSpacing:  number;
  clusterGravity:  number;   // Positive pull toward cluster centroid (0–1)
  collisionRadius: number;   // Minimum node separation in px
  frozen:          boolean;
}

export interface DisplayConfig {
  showArrows:        boolean;
  showLabels:        boolean;
  showClusterHulls:  boolean;  // Draw cluster background regions
  animate:           boolean;
  nodeSize:          number;
  linkThickness:     number;
  textFadeThreshold: number;
  colorMode:         ColorMode;
  clusterMode:       ClusterMode;
}

export interface FilterConfig {
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
}

export interface GraphPreferences {
  layer:           GraphLayer;
  localNodeId:     string | null;
  depth:           number;
  filters:         FilterConfig;
  display:         DisplayConfig;
  physics:         PhysicsConfig;
}

// ── Physics Presets ────────────────────────────────────────────────────────

export interface PhysicsPreset {
  name:        string;
  label:       string;
  description: string;
  config:      PhysicsConfig;
}

export const PHYSICS_PRESETS: PhysicsPreset[] = [
  {
    name: 'balanced',
    label: 'Balanced',
    description: 'Good for general exploration',
    config: {
      centerForce: 0.3, repelForce: 120, linkForce: 0.4, linkDistance: 100,
      clusterSpacing: 60, clusterGravity: 0.08, collisionRadius: 18, frozen: false,
    },
  },
  {
    name: 'clustered',
    label: 'Clustered',
    description: 'Pulls groups together tightly',
    config: {
      centerForce: 0.5, repelForce: 80, linkForce: 0.6, linkDistance: 60,
      clusterSpacing: 120, clusterGravity: 0.25, collisionRadius: 14, frozen: false,
    },
  },
  {
    name: 'explore',
    label: 'Explore',
    description: 'Spreads nodes wide for navigation',
    config: {
      centerForce: 0.12, repelForce: 260, linkForce: 0.18, linkDistance: 190,
      clusterSpacing: 20, clusterGravity: 0.03, collisionRadius: 22, frozen: false,
    },
  },
  {
    name: 'dense',
    label: 'Dense',
    description: 'Compact overview layout',
    config: {
      centerForce: 0.6, repelForce: 55, linkForce: 0.8, linkDistance: 48,
      clusterSpacing: 30, clusterGravity: 0.15, collisionRadius: 11, frozen: false,
    },
  },
  {
    name: 'presentation',
    label: 'Present',
    description: 'Frozen elegant layout',
    config: {
      centerForce: 0.3, repelForce: 150, linkForce: 0.35, linkDistance: 125,
      clusterSpacing: 80, clusterGravity: 0.1, collisionRadius: 20, frozen: true,
    },
  },
];

// ── Edge color vocabulary ──────────────────────────────────────────────────

export const EDGE_COLORS: Partial<Record<EdgeType, string>> = {
  issued_by:            '#2563eb',   // Trust blue
  verified_by:          '#1d4ed8',   // Deeper trust blue
  attested_by:          '#3b82f6',   // Lighter trust blue
  verifies:             '#3b82f6',
  accepted_by:          '#7c3aed',   // Decision violet
  enrolled_in:          '#8b5cf6',
  privileged_at:        '#a78bfa',
  depends_on:           '#b45309',   // Dependency amber
  sourced_from:         '#ca8a04',
  derived_from:         '#d97706',
  works_at:             '#059669',   // Institution emerald
  affiliated_with:      '#10b981',
  trained_at:           '#34d399',
  published_with:       '#6ee7b7',
  ai_suggested_link:    '#4f46e5',   // AI indigo
  ai_accepted_link:     '#6366f1',
  semantic_similarity:  '#818cf8',
  sanctioned_by:        '#dc2626',   // Sanction red
  explicit_link:        '#0891b2',   // Navigation cyan
  backlink:             '#06b6d4',
  references:           '#22d3ee',
  mentions:             '#67e8f9',
  same_as:              '#475569',   // Identity slate
  related_to:           '#64748b',
  parent_of:            '#6b7280',   // Hierarchy gray
  child_of:             '#6b7280',
  tagged_with:          '#78716c',
  attached_to:          '#57534e',
};

export function getEdgeColor(type: EdgeType, fallback = '#1e3a5f'): string {
  return EDGE_COLORS[type] ?? fallback;
}

// ── Node color vocabulary ──────────────────────────────────────────────────

export const NODE_COLORS: Partial<Record<NodeType, string>> = {
  clinician:    '#f59e0b',
  organization: '#3b82f6',
  institution:  '#60a5fa',
  credential:   '#10b981',
  license:      '#34d399',
  decision:     '#c4b5fd',
  exclusion:    '#f87171',
  enrollment:   '#a78bfa',
  claim:        '#67e8f9',
  artifact:     '#94a3b8',
  source:       '#6b7280',
  specialty:    '#fb923c',
  publication:  '#a3e635',
  trial:        '#4ade80',
};

export function getNodeColor(type: NodeType): string {
  return NODE_COLORS[type] ?? '#475569';
}

// ── Cluster hull colors ────────────────────────────────────────────────────

export function getClusterHullColor(clusterId: string): string {
  const map: Record<string, string> = {
    clinician:    'rgba(245,158,11,0.07)',
    organization: 'rgba(59,130,246,0.06)',
    institution:  'rgba(96,165,250,0.06)',
    credential:   'rgba(16,185,129,0.06)',
    license:      'rgba(52,211,153,0.06)',
    decision:     'rgba(124,58,237,0.06)',
    exclusion:    'rgba(248,113,113,0.06)',
    source:       'rgba(14,116,144,0.05)',
    artifact:     'rgba(100,116,139,0.04)',
    specialty:    'rgba(251,146,60,0.06)',
    claim:        'rgba(103,232,249,0.05)',
  };
  return map[clusterId] ?? 'rgba(100,116,139,0.04)';
}

export function getClusterBorderColor(clusterId: string): string {
  const map: Record<string, string> = {
    clinician:    'rgba(245,158,11,0.15)',
    organization: 'rgba(59,130,246,0.12)',
    institution:  'rgba(96,165,250,0.12)',
    credential:   'rgba(16,185,129,0.12)',
    license:      'rgba(52,211,153,0.12)',
    decision:     'rgba(124,58,237,0.12)',
    exclusion:    'rgba(248,113,113,0.15)',
    source:       'rgba(14,116,144,0.10)',
  };
  return map[clusterId] ?? 'rgba(100,116,139,0.08)';
}
