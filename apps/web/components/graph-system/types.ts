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
  color?:        string;
  opacity?:      number;
  visible?:      boolean;
  highlighted?:  boolean;
}

export interface PhysicsConfig {
  centerForce:   number;
  repelForce:    number;
  linkForce:     number;
  linkDistance:   number;
  clusterSpacing: number;
  frozen:        boolean;
}

export interface DisplayConfig {
  showArrows:        boolean;
  showLabels:        boolean;
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
