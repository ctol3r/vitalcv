import type { WorkspaceSectionId } from './contracts';

export const WORKSPACE_SECTIONS: Array<{
  id: WorkspaceSectionId;
  label: string;
  detail: string;
}> = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    detail: 'System-wide provider readiness, active investigations, and trust pressure.',
  },
  {
    id: 'findings',
    label: 'Findings',
    detail: 'Operational investigator findings with real filters and triage actions.',
  },
  {
    id: 'storylines',
    label: 'Storylines',
    detail: 'Narrative summaries of related findings with progression history.',
  },
  {
    id: 'actions',
    label: 'Actions',
    detail: 'Actionable intelligence recommendations for entities and storylines.',
  },
  {
    id: 'providers',
    label: 'Providers',
    detail: 'Global provider directory with posture, verifications, and trust scoring.',
  },
  {
    id: 'investigations',
    label: 'Investigations',
    detail: 'Four-panel investigation surface for exploring entities and finding context.',
  },
  {
    id: 'calibration',
    label: 'Calibration',
    detail: 'Tune scoring rules, confidence thresholds, and system health checks.',
  },
  {
    id: 'system-health',
    label: 'System Health',
    detail: 'Pipeline integrity, verification throughput, and connector stability.',
  },
  {
    id: 'graph',
    label: 'Trust Graph',
    detail: 'Zoomable canvas visualizing credential links and trust networks.',
  },
];

export const RIGHT_PANEL_MODULES = [
  {
    id: 'graph',
    label: 'Graph',
    detail: 'Trust graph context and neighborhood exploration.',
  },
  {
    id: 'copilot',
    label: 'Copilot',
    detail: 'Natural-language investigation summaries and follow-up prompts.',
  },
  {
    id: 'sources',
    label: 'Sources',
    detail: 'Primary evidence drawn from findings, storylines, and actions.',
  },
  {
    id: 'system-health',
    label: 'System Health',
    detail: 'Pipeline integrity, graph health, and connector stability.',
  },
] as const;
