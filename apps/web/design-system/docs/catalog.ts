import { graphDesignTokens } from '../tokens/graph';
import { motionTokens } from '../tokens/motion';
import { spacingTokens } from '../tokens/spacing';
import { typographyTokens } from '../tokens/typography';
import { semanticColorTokens } from '../tokens/colors';
import { vdsThemes } from '../themes';

export const designSystemDocs = {
  tokens: {
    colors: Object.values(semanticColorTokens),
    typography: typographyTokens,
    spacing: spacingTokens,
    motion: motionTokens,
    graph: graphDesignTokens,
  },
  themes: Object.values(vdsThemes).map((theme) => ({
    name: theme.name,
    label: theme.label,
    preview: {
      background: theme.colors.background,
      surface: theme.colors.surface,
      accent: theme.colors.accent,
      text: theme.colors.textPrimary,
    },
  })),
  components: [
    'Button',
    'Badge',
    'Card',
    'Panel',
    'Table',
    'Input',
    'Dropdown',
    'Tabs',
    'Modal',
    'Toast',
    'Icon',
    'FindingCard',
    'StorylineCard',
    'ActionCard',
    'ProviderCard',
    'SeverityBadge',
    'RiskScoreBadge',
    'ConfidenceBadge',
    'EvidenceTable',
    'Timeline',
    'InvestigationPanel',
    'GraphLegend',
    'GraphToolbar',
  ],
  layouts: [
    'AppLayout',
    'SidebarLayout',
    'DetailLayout',
    'ListLayout',
    'SplitPanelLayout',
    'IntelligenceConsoleLayout',
  ],
  patterns: ['StatusBanner', 'EmptyState', 'MetricCluster'],
  graphRules: [
    'Node size hierarchy encodes importance: alert > provider > institution > company > trial > publication.',
    'Edge thickness scales with relationship confidence and shared activity weight.',
    'Hover focus keeps the target opaque and dims non-related nodes to the configured dim opacity token.',
    'Cluster labels use uppercase meta typography with compact pill padding for dense graph canvases.',
  ],
} as const;
