import { vdsThemes, type VdsThemeName } from '../themes';
import { graphDesignTokens } from '../tokens/graph';
import { motionTokens } from '../tokens/motion';
import { spacingTokens } from '../tokens/spacing';
import { typographyTokens } from '../tokens/typography';

const radiusTokens = {
  sm: '0.75rem',
  md: '1rem',
  lg: '1.5rem',
  pill: '9999px',
} as const;

const shadowTokens = {
  card: '0 12px 30px rgb(15 23 42 / 0.08)',
  panel: '0 18px 44px rgb(15 23 42 / 0.12)',
  modal: '0 26px 60px rgb(2 6 23 / 0.22)',
} as const;

const legacyThemeKeyMap = {
  backgroundPrimary: 'background',
  backgroundPanel: 'surface',
  backgroundHover: 'surfaceSubtle',
  borderPrimary: 'border',
  textPrimary: 'textPrimary',
  textSecondary: 'textSecondary',
  textMuted: 'textMuted',
  accentBlue: 'accent',
  accentCyan: 'nodeInstitution',
  accentYellow: 'riskMedium',
  accentMagenta: 'nodeCompany',
  danger: 'severityCritical',
  success: 'statusResolved',
} as const;

type LegacyThemeColorKey = keyof typeof legacyThemeKeyMap;

function mapThemeColors(themeName: VdsThemeName, prefix: string) {
  const theme = vdsThemes[themeName];

  return Object.fromEntries(
    Object.entries(theme.colors).map(([token, value]) => [
      `--${prefix}-${themeName}-${token.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)}`,
      value,
    ]),
  ) as Record<`--${string}`, string>;
}

const vdsThemeCssVariables = {
  ...mapThemeColors('light', 'vds'),
  ...mapThemeColors('dark', 'vds'),
  ...mapThemeColors('midnight', 'vds'),
  ...mapThemeColors('graphite', 'vds'),
} as const satisfies Record<`--${string}`, string>;

const legacyThemeCssVariables = Object.fromEntries(
  Object.entries(vdsThemes).flatMap(([themeName, theme]) => (
    Object.entries(legacyThemeKeyMap).map(([legacyKey, sourceKey]) => [
      `--ui-${themeName}-${legacyKey.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)}`,
      theme.colors[sourceKey],
    ])
  )),
) as Record<`--${string}`, string>;

const typographyCssVariables = {
  '--vt-font-sans': typographyTokens.fontSans,
  '--vt-font-mono': typographyTokens.fontMono,
  '--vt-type-display-size': typographyTokens.size.display,
  '--vt-type-h1-size': typographyTokens.size.h1,
  '--vt-type-h2-size': typographyTokens.size.h2,
  '--vt-type-h3-size': typographyTokens.size.h3,
  '--vt-type-body-size': typographyTokens.size.body,
  '--vt-type-meta-size': typographyTokens.size.meta,
  '--vt-type-caption-size': typographyTokens.size.caption,
  '--vt-font-weight-regular': typographyTokens.weight.regular,
  '--vt-font-weight-medium': typographyTokens.weight.medium,
  '--vt-font-weight-semibold': typographyTokens.weight.semibold,
  '--vt-font-weight-bold': typographyTokens.weight.bold,
  '--vt-line-tight': typographyTokens.lineHeight.tight,
  '--vt-line-normal': typographyTokens.lineHeight.normal,
  '--vt-line-loose': typographyTokens.lineHeight.loose,
  '--font-body': typographyTokens.fontSans,
  '--font-heading': typographyTokens.fontSans,
  '--font-sans': typographyTokens.fontSans,
  '--font-mono': typographyTokens.fontMono,
  '--ui-font-sans': typographyTokens.fontSans,
  '--ui-font-body': typographyTokens.fontSans,
  '--ui-font-heading': typographyTokens.fontSans,
  '--ui-font-mono': typographyTokens.fontMono,
} as const satisfies Record<`--${string}`, string>;

const spacingCssVariables = Object.fromEntries(
  Object.entries(spacingTokens).map(([token, value]) => [`--vt-space-${token}`, value]),
) as Record<`--vt-space-${string}`, string>;

const radiusCssVariables = {
  '--vt-radius-sm': radiusTokens.sm,
  '--vt-radius-md': radiusTokens.md,
  '--vt-radius-lg': radiusTokens.lg,
  '--vt-radius-pill': radiusTokens.pill,
} as const satisfies Record<`--${string}`, string>;

const shadowCssVariables = {
  '--vt-shadow-card': shadowTokens.card,
  '--vt-shadow-panel': shadowTokens.panel,
  '--vt-shadow-modal': shadowTokens.modal,
} as const satisfies Record<`--${string}`, string>;

const graphCssVariables = {
  '--vt-graph-node-size-provider': String(graphDesignTokens.nodeSizeHierarchy.provider),
  '--vt-graph-node-size-institution': String(graphDesignTokens.nodeSizeHierarchy.institution),
  '--vt-graph-node-size-company': String(graphDesignTokens.nodeSizeHierarchy.company),
  '--vt-graph-node-size-trial': String(graphDesignTokens.nodeSizeHierarchy.trial),
  '--vt-graph-node-size-publication': String(graphDesignTokens.nodeSizeHierarchy.publication),
  '--vt-graph-node-size-alert': String(graphDesignTokens.nodeSizeHierarchy.alert),
  '--vt-graph-edge-thickness-base': String(graphDesignTokens.edgeThickness.base),
  '--vt-graph-edge-thickness-weighted': String(graphDesignTokens.edgeThickness.weighted),
  '--vt-graph-edge-thickness-emphasized': String(graphDesignTokens.edgeThickness.emphasized),
  '--vt-graph-focus-opacity': String(graphDesignTokens.hover.focusOpacity),
  '--vt-graph-dim-opacity': String(graphDesignTokens.hover.dimOpacity),
  '--vt-graph-cluster-font-size': graphDesignTokens.clusterLabel.fontSize,
  '--vt-graph-cluster-letter-spacing': graphDesignTokens.clusterLabel.letterSpacing,
  '--vt-graph-cluster-font-weight': graphDesignTokens.clusterLabel.fontWeight,
  '--vt-graph-cluster-padding-inline': graphDesignTokens.clusterLabel.paddingInline,
  '--vt-graph-cluster-padding-block': graphDesignTokens.clusterLabel.paddingBlock,
} as const satisfies Record<`--${string}`, string>;

export const motionCssVariables = {
  '--vt-motion-control': motionTokens.duration.control,
  '--vt-motion-fast': motionTokens.duration.fast,
  '--vt-motion-normal': motionTokens.duration.normal,
  '--vt-motion-slow': motionTokens.duration.slow,
  '--vt-ease-standard': motionTokens.easing.standard,
  '--vt-ease-out': motionTokens.easing.out,
  '--vt-ease-spring': motionTokens.easing.spring,
  '--ui-motion-duration-fast': motionTokens.duration.fast,
  '--ui-motion-duration-highlight': motionTokens.duration.fast,
  '--ui-motion-duration-panel': motionTokens.duration.normal,
  '--ui-motion-duration-drawer': '360ms',
  '--ui-motion-duration-instant': motionTokens.duration.control,
  '--ui-motion-duration-tooltip': '180ms',
  '--ui-motion-ease-out': motionTokens.easing.out,
  '--ui-motion-ease-swift-out': motionTokens.easing.spring,
  '--ui-motion-ease-fade-out': motionTokens.easing.standard,
} as const satisfies Record<`--${string}`, string>;

export const themeCssVariables = {
  ...vdsThemeCssVariables,
  ...legacyThemeCssVariables,
  ...typographyCssVariables,
  ...spacingCssVariables,
  ...radiusCssVariables,
  ...shadowCssVariables,
  ...graphCssVariables,
  '--vital-ops-background': 'var(--ui-dark-background-primary)',
  '--vital-ops-panel': 'var(--ui-dark-background-panel)',
  '--vital-ops-panel-alt': 'var(--ui-dark-background-hover)',
  '--vital-ops-hover': 'var(--ui-dark-background-hover)',
  '--vital-ops-border': 'var(--ui-dark-border-primary)',
  '--vital-ops-border-subtle': 'var(--ui-dark-border-primary)',
  '--vital-ops-text-primary': 'var(--ui-dark-text-primary)',
  '--vital-ops-text-secondary': 'var(--ui-dark-text-secondary)',
  '--vital-ops-text-muted': 'var(--ui-dark-text-muted)',
  '--vital-ops-accent-blue': 'var(--ui-dark-accent-blue)',
  '--vital-ops-accent-cyan': 'var(--ui-dark-accent-cyan)',
  '--vital-ops-accent-yellow': 'var(--ui-dark-accent-yellow)',
  '--vital-ops-accent-magenta': 'var(--ui-dark-accent-magenta)',
  '--vital-ops-danger': 'var(--ui-dark-danger)',
  '--vital-ops-success': 'var(--ui-dark-success)',
  '--vital-ops-topbar-height': '3.9rem',
  '--vital-ops-sidebar-width': '20rem',
  '--vital-ops-context-width': '23rem',
} as const satisfies Record<`--${string}`, string>;

export const vdsCssVariables = {
  ...themeCssVariables,
  ...motionCssVariables,
} as const satisfies Record<`--${string}`, string>;

export const themeTokens = {
  colors: Object.fromEntries(
    Object.entries(vdsThemes).map(([themeName, theme]) => [
      themeName,
      Object.fromEntries(
        Object.entries(legacyThemeKeyMap).map(([legacyKey, sourceKey]) => [
          legacyKey,
          theme.colors[sourceKey],
        ]),
      ) as Record<LegacyThemeColorKey, string>,
    ]),
  ) as Record<VdsThemeName, Record<LegacyThemeColorKey, string>>,
  typography: {
    family: {
      sans: typographyTokens.fontSans,
      body: typographyTokens.fontSans,
      heading: typographyTokens.fontSans,
      mono: typographyTokens.fontMono,
      canvas: typographyTokens.fontSans,
    },
    size: {
      xs: typographyTokens.size.caption,
      sm: typographyTokens.size.meta,
      base: typographyTokens.size.body,
      lg: typographyTokens.size.h3,
      xl: typographyTokens.size.h2,
      '2xl': typographyTokens.size.h1,
      '3xl': typographyTokens.size.display,
      '4xl': '3.5rem',
      '5xl': '4rem',
      '6xl': '4.5rem',
      '7xl': '5rem',
      '8xl': '6rem',
      '9xl': '8rem',
    },
    lineHeight: {
      none: '1',
      tight: typographyTokens.lineHeight.tight,
      snug: '1.3',
      normal: typographyTokens.lineHeight.normal,
      relaxed: typographyTokens.lineHeight.loose,
      loose: '1.9',
    },
    spacing: {
      px: '1px',
      0: '0',
      0.5: spacingTokens[2],
      1: spacingTokens[4],
      2: spacingTokens[8],
      3: spacingTokens[12],
      4: spacingTokens[16],
      5: spacingTokens[20],
      6: spacingTokens[24],
      8: spacingTokens[32],
      10: spacingTokens[40],
      12: spacingTokens[48],
      16: spacingTokens[64],
      20: '5rem',
      24: '6rem',
      32: '8rem',
      40: '10rem',
      48: '12rem',
      64: '16rem',
    },
  },
  radius: {
    panel: radiusTokens.lg,
    badge: radiusTokens.pill,
  },
  shadow: {
    panel: shadowTokens.panel,
    stage: shadowTokens.modal,
  },
  layout: {
    topbarHeight: '3.9rem',
    sidebarWidth: '20rem',
    contextWidth: '23rem',
  },
} as const;
