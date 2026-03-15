import type { GraphEdge, GraphNode, NodeType } from '@/components/graph-system/types';
import {
  classifyEdgeType,
  type GraphColorMode,
  type GraphLinkClass,
} from '@/components/graph/state/graphDisplayState';
import { themeTokens } from '@/ui/theme/tokens';

const NODE_TYPE_COLORS: Partial<Record<NodeType, string>> = {
  clinician: themeTokens.colors.dark.accentBlue,
  organization: themeTokens.colors.dark.accentBlue,
  institution: themeTokens.colors.dark.accentCyan,
  specialty: themeTokens.colors.dark.accentYellow,
  program: themeTokens.colors.dark.accentMagenta,
  publication: themeTokens.colors.dark.success,
  trial: themeTokens.colors.dark.success,
  claim: themeTokens.colors.dark.accentCyan,
  artifact: themeTokens.colors.dark.textSecondary,
  receipt: themeTokens.colors.dark.accentYellow,
  source: themeTokens.colors.dark.textMuted,
  credential: themeTokens.colors.dark.success,
  license: themeTokens.colors.dark.success,
  decision: themeTokens.colors.dark.accentMagenta,
  exclusion: themeTokens.colors.dark.danger,
  enrollment: themeTokens.colors.dark.accentMagenta,
  note: themeTokens.colors.dark.accentBlue,
  document: themeTokens.colors.dark.textSecondary,
  tag: themeTokens.colors.dark.accentYellow,
  attachment: themeTokens.colors.dark.textPrimary,
  group: themeTokens.colors.dark.accentMagenta,
};

const TRUST_TIER_COLORS: Record<string, string> = {
  GOLD: themeTokens.colors.dark.accentYellow,
  SILVER: themeTokens.colors.dark.textPrimary,
  BRONZE: themeTokens.colors.dark.textSecondary,
};

const GROUP_COLORS = [
  themeTokens.colors.dark.accentBlue,
  themeTokens.colors.dark.accentCyan,
  themeTokens.colors.dark.success,
  themeTokens.colors.dark.accentYellow,
  themeTokens.colors.dark.accentMagenta,
  themeTokens.colors.dark.textPrimary,
  themeTokens.colors.dark.danger,
  themeTokens.colors.dark.textSecondary,
];

export const LINK_CLASS_STYLES: Record<GraphLinkClass, { stroke: string; dash: number[] }> = {
  explicit: { stroke: themeTokens.colors.dark.accentBlue, dash: [] },
  backlink: { stroke: themeTokens.colors.dark.accentCyan, dash: [6, 4] },
  ai: { stroke: themeTokens.colors.dark.accentMagenta, dash: [3, 5] },
  inferred: { stroke: themeTokens.colors.dark.accentYellow, dash: [2, 7] },
  trust: { stroke: themeTokens.colors.dark.textPrimary, dash: [] },
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
