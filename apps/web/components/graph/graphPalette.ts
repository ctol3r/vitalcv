import type { GraphEdge, GraphNode, NodeType } from '@/components/graph-system/types';
import {
  classifyEdgeType,
  type GraphColorMode,
  type GraphLinkClass,
} from '@/components/graph/state/graphDisplayState';

const NODE_TYPE_COLORS: Partial<Record<NodeType, string>> = {
  clinician: '#5ba2ff',
  organization: '#3b82f6',
  institution: '#22d3ee',
  specialty: '#f59e0b',
  program: '#a78bfa',
  publication: '#84cc16',
  trial: '#34d399',
  claim: '#38bdf8',
  artifact: '#94a3b8',
  receipt: '#fbbf24',
  source: '#64748b',
  credential: '#10b981',
  license: '#4ade80',
  decision: '#f472b6',
  exclusion: '#f87171',
  enrollment: '#c084fc',
  note: '#60a5fa',
  document: '#93c5fd',
  tag: '#facc15',
  attachment: '#cbd5e1',
  group: '#818cf8',
};

const TRUST_TIER_COLORS: Record<string, string> = {
  GOLD: '#facc15',
  SILVER: '#cbd5e1',
  BRONZE: '#fb923c',
};

const GROUP_COLORS = [
  '#60a5fa',
  '#22d3ee',
  '#4ade80',
  '#f59e0b',
  '#f472b6',
  '#a78bfa',
  '#f87171',
  '#c084fc',
];

export const LINK_CLASS_STYLES: Record<GraphLinkClass, { stroke: string; dash: number[] }> = {
  explicit: { stroke: '#38bdf8', dash: [] },
  backlink: { stroke: '#22d3ee', dash: [6, 4] },
  ai: { stroke: '#f472b6', dash: [3, 5] },
  inferred: { stroke: '#facc15', dash: [2, 7] },
  trust: { stroke: '#5ba2ff', dash: [] },
};

function hashSeed(value: string): number {
  let seed = 0;

  for (let index = 0; index < value.length; index += 1) {
    seed = (seed << 5) - seed + value.charCodeAt(index);
    seed |= 0;
  }

  return Math.abs(seed);
}

export function colorForNodeType(type: NodeType): string {
  return NODE_TYPE_COLORS[type] ?? '#64748b';
}

export function colorForTrustTier(trustTier: string | undefined): string {
  if (!trustTier) {
    return '#64748b';
  }

  return TRUST_TIER_COLORS[trustTier.toUpperCase()] ?? '#94a3b8';
}

export function colorForGroup(group: string): string {
  return GROUP_COLORS[hashSeed(group) % GROUP_COLORS.length] ?? '#64748b';
}

export function colorForRelationshipClass(node: GraphNode, edges: GraphEdge[]): string {
  const classes = edges
    .filter((edge) => edge.source === node.id || edge.target === node.id)
    .map((edge) => classifyEdgeType(edge));

  const dominantClass = classes[0] ?? 'trust';
  return LINK_CLASS_STYLES[dominantClass].stroke;
}

export function resolveNodeColor(
  node: GraphNode,
  edges: GraphEdge[],
  colorMode: GraphColorMode,
): string {
  switch (colorMode) {
    case 'group':
      return colorForGroup(node.group || node.type);
    case 'tier':
      return colorForTrustTier(node.trustTier);
    case 'relationship_class':
      return colorForRelationshipClass(node, edges);
    case 'type':
    default:
      return colorForNodeType(node.type);
  }
}
