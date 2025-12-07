import type { CredentialTimelineEventType, TimelineEventSeverity } from '@prisma/client';

export type RoutineCheckStatus = 'pass' | 'warning' | 'fail' | 'skipped';

export interface RoutineCheckResult {
  id: string;
  title: string;
  status: RoutineCheckStatus;
  summary?: string;
  details?: string[];
  evidence?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timelineEvent?: CredentialTimelineEventType;
  timelineSeverity?: TimelineEventSeverity;
}

export interface RoutineActionRecommendation {
  id: string;
  label: string;
  detail?: string;
  type?: 'task' | 'alert' | 'fppe' | 'timeline';
  dueDate?: Date;
  metadata?: Record<string, unknown>;
}

export interface AgentRoutineContext {
  clinicianId?: string;
  clinicianDid?: string;
  npi?: string;
  orgIds?: string[];
  initiatedBy?: string;
  dryRun?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AgentRoutineResult {
  routineId: string;
  clinicianId?: string;
  clinicianDid?: string;
  npi?: string;
  startedAt: Date;
  completedAt: Date;
  status: 'completed' | 'failed';
  summary?: string;
  error?: string;
  checks: RoutineCheckResult[];
  recommendations?: RoutineActionRecommendation[];
  metadata?: Record<string, unknown>;
}

import type { CredentialTimelineEventType, TimelineEventSeverity } from '@prisma/client';

export type RoutineCheckStatus = 'pass' | 'warning' | 'fail' | 'skipped';

export interface RoutineCheckResult {
  id: string;
  title: string;
  status: RoutineCheckStatus;
  summary?: string;
  details?: string[];
  evidence?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timelineEvent?: CredentialTimelineEventType;
  timelineSeverity?: TimelineEventSeverity;
}

export interface RoutineActionRecommendation {
  id: string;
  label: string;
  detail?: string;
  type?: 'task' | 'alert' | 'fppe' | 'timeline';
  dueDate?: Date;
  metadata?: Record<string, unknown>;
}

export interface AgentRoutineContext {
  clinicianId?: string;
  clinicianDid?: string;
  npi?: string;
  orgIds?: string[];
  initiatedBy?: string;
  dryRun?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AgentRoutineResult {
  routineId: string;
  clinicianId?: string;
  clinicianDid?: string;
  npi?: string;
  startedAt: Date;
  completedAt: Date;
  status: 'completed' | 'failed';
  summary?: string;
  error?: string;
  checks: RoutineCheckResult[];
  recommendations?: RoutineActionRecommendation[];
  metadata?: Record<string, unknown>;
}


