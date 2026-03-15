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
    id: 'provider-profile',
    label: 'Provider Profile',
    detail: 'Focused provider posture with trust score, issuer coverage, and evidence.',
  },
  {
    id: 'investigation-workspace',
    label: 'Investigation Workspace',
    detail: 'Findings, storylines, and recommended actions for current review.',
  },
  {
    id: 'comparison-view',
    label: 'Comparison View',
    detail: 'Side-by-side provider comparison for launch and routing decisions.',
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
