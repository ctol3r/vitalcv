export const graphNodeTokens = {
  provider: 'node-provider',
  institution: 'node-institution',
  publication: 'node-publication',
  trial: 'node-trial',
  company: 'node-company',
  alert: 'node-alert',
} as const;

export const graphEdgeTokens = {
  coAuthor: 'edge-co-author',
  coInvestigator: 'edge-co-investigator',
  coGrant: 'edge-co-grant',
  practiceGroup: 'edge-practice-group',
  industryPayment: 'edge-industry-payment',
} as const;

export const graphDesignTokens = {
  nodeSizeHierarchy: {
    provider: 1.2,
    institution: 1.1,
    company: 1.05,
    trial: 1,
    publication: 0.95,
    alert: 1.25,
  },
  edgeThickness: {
    base: 1.25,
    weighted: 2.1,
    emphasized: 3,
  },
  hover: {
    focusOpacity: 1,
    dimOpacity: 0.22,
  },
  clusterLabel: {
    fontSize: '0.75rem',
    letterSpacing: '0.16em',
    fontWeight: '600',
    paddingInline: '0.75rem',
    paddingBlock: '0.375rem',
  },
} as const;
