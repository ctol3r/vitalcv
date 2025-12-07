import { TimelineEvent, TimelineEventStatus } from './types';

export type AgentActionCategory = 'auto_psv' | 'compliance' | 'pecos' | 'remediation' | 'timeline_sync' | 'escalation';
export type AgentActionState = 'pending' | 'running' | 'completed' | 'failed' | 'warning';

export interface AgentActionEvidence {
  id: string;
  label: string;
  type?: 'document' | 'api' | 'note' | 'bundle';
  url?: string;
  storedAt?: string | Date;
  checksum?: string;
}

export interface AgentAction {
  id: string;
  agentId: string;
  orgId?: string;
  clinicianId?: string;
  category: AgentActionCategory;
  state: AgentActionState;
  startedAt: Date;
  completedAt?: Date;
  summary: string;
  evidence?: AgentActionEvidence[];
  progress?: number;
  metadata?: Record<string, unknown>;
}

const CATEGORY_TO_PHASE: Record<AgentActionCategory, TimelineEvent['phase']> = {
  auto_psv: 'licensure',
  compliance: 'quality',
  pecos: 'enrollment',
  remediation: 'privileging',
  timeline_sync: 'identity',
  escalation: 'quality',
};

const STATE_TO_STATUS: Record<AgentActionState, TimelineEventStatus> = {
  pending: 'pending',
  running: 'in_progress',
  completed: 'completed',
  failed: 'failed',
  warning: 'warning',
};

export function mapAgentActionToTimelineEvent(action: AgentAction): TimelineEvent {
  const phase = CATEGORY_TO_PHASE[action.category] ?? 'quality';
  const status = STATE_TO_STATUS[action.state] ?? 'in_progress';

  return {
    id: `agent-action:${action.id}`,
    phase,
    type: `AGENT_${action.category.toUpperCase()}`,
    title: buildActionTitle(action),
    timestamp: action.completedAt ?? action.startedAt,
    status,
    source: 'ai_agent',
    summary: action.summary,
    metadata: {
      agentId: action.agentId,
      orgId: action.orgId,
      clinicianId: action.clinicianId,
      evidence: action.evidence?.map((entry) => ({
        ...entry,
        storedAt: normalizeDate(entry.storedAt),
      })),
      progress: action.progress,
      extra: action.metadata ?? undefined,
    },
  };
}

export function appendAgentActionsToTimeline(
  existing: TimelineEvent[],
  actions: AgentAction[],
  options: { dedupe?: boolean } = {}
): TimelineEvent[] {
  const converted = actions.map(mapAgentActionToTimelineEvent);
  if (!options.dedupe) {
    return [...converted, ...existing].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  const seen = new Set<string>();
  const merged = [...converted, ...existing].filter((event) => {
    if (seen.has(event.id)) {
      return false;
    }
    seen.add(event.id);
    return true;
  });

  merged.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return merged;
}

function buildActionTitle(action: AgentAction): string {
  const friendlyName = friendlyCategoryLabel(action.category);
  if (action.state === 'completed') {
    return `${friendlyName} completed`;
  }
  if (action.state === 'failed') {
    return `${friendlyName} failed`; // eligible for remediation
  }
  if (action.state === 'warning') {
    return `${friendlyName} completed with warnings`;
  }
  if (action.state === 'running') {
    return `${friendlyName} running`;
  }
  return `${friendlyName} queued`;
}

function friendlyCategoryLabel(category: AgentActionCategory): string {
  switch (category) {
    case 'auto_psv':
      return 'Auto-PSV run';
    case 'compliance':
      return 'Compliance check';
    case 'pecos':
      return 'PECOS sync';
    case 'remediation':
      return 'Remediation workflow';
    case 'timeline_sync':
      return 'Timeline sync';
    case 'escalation':
      return 'Escalation';
    default:
      return 'Agent action';
  }
}

function normalizeDate(value?: string | Date): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    return value.toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
