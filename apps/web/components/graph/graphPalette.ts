import type { GraphEdge, GraphNode, NodeType } from '@/components/graph-system/types';
import {
  classifyEdgeType,
  type GraphColorMode,
  type GraphLinkClass,
} from '@/components/graph/state/graphDisplayState';
import { themeTokens } from '@/ui/theme/tokens';

const MUTED_PRIMARY = 'var(--vt-text-1, #f8fafc)';
const MUTED_SECONDARY = 'var(--vt-text-2, #94a3b8)';
const MUTED_TERTIARY = 'var(--vt-text-3, #475569)';
const MUTED_ACCENT = 'var(--vt-border, #334155)';

const NODE_TYPE_COLORS: Partial<Record<NodeType, string>> = {
  clinician: MUTED_PRIMARY,
  provider: MUTED_PRIMARY,
  organization: MUTED_PRIMARY,
  company: MUTED_SECONDARY,
  institution: MUTED_SECONDARY,
  specialty: MUTED_TERTIARY,
  program: MUTED_TERTIARY,
  publication: MUTED_TERTIARY,
  trial: MUTED_TERTIARY,
  claim: MUTED_TERTIARY,
  payment: MUTED_TERTIARY,
  artifact: MUTED_TERTIARY,
  evidence: MUTED_TERTIARY,
  receipt: MUTED_TERTIARY,
  source: MUTED_TERTIARY,
  credential: MUTED_SECONDARY,
  license: MUTED_SECONDARY,
  decision: MUTED_SECONDARY,
  exclusion: MUTED_SECONDARY,
  enrollment: MUTED_SECONDARY,
  regulatory: MUTED_SECONDARY,
  note: MUTED_TERTIARY,
  document: MUTED_TERTIARY,
  tag: MUTED_TERTIARY,
  attachment: MUTED_TERTIARY,
  group: MUTED_TERTIARY,
};

const TRUST_TIER_COLORS: Record<string, string> = {
  GOLD: MUTED_PRIMARY,
  SILVER: MUTED_SECONDARY,
  BRONZE: MUTED_TERTIARY,
};

const GROUP_COLORS = [
  MUTED_PRIMARY,
  MUTED_SECONDARY,
  MUTED_TERTIARY,
  '#cbd5e1',
  '#64748b',
  '#1e293b',
];

export const LINK_CLASS_STYLES: Record<GraphLinkClass, { stroke: string; dash: number[] }> = {
  explicit: { stroke: MUTED_ACCENT, dash: [] },
  backlink: { stroke: MUTED_ACCENT, dash: [4, 4] },
  ai: { stroke: MUTED_ACCENT, dash: [2, 4] },
  inferred: { stroke: MUTED_ACCENT, dash: [2, 6] },
  trust: { stroke: MUTED_ACCENT, dash: [] },
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
  return NODE_TYPE_COLORS[type] ?? themeTokens.colors.dark.textMuted;
}

export function colorForTrustTier(trustTier: string | undefined): string {
  if (!trustTier) {
    return themeTokens.colors.dark.textMuted;
  }

  return TRUST_TIER_COLORS[trustTier.toUpperCase()] ?? themeTokens.colors.dark.textSecondary;
}

export function colorForGroup(group: string): string {
  return GROUP_COLORS[hashSeed(group) % GROUP_COLORS.length] ?? themeTokens.colors.dark.textMuted;
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
