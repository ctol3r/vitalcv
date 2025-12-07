export type TimelinePhase =
  | 'identity'
  | 'licensure'
  | 'board'
  | 'dea'
  | 'enrollment'
  | 'privileging'
  | 'quality';

export const TIMELINE_PHASE_ORDER: TimelinePhase[] = [
  'identity',
  'licensure',
  'board',
  'dea',
  'enrollment',
  'privileging',
  'quality',
];

export const TIMELINE_PHASE_LABELS: Record<TimelinePhase, string> = {
  identity: 'Identity',
  licensure: 'Licensure',
  board: 'Board',
  dea: 'DEA',
  enrollment: 'Enrollment',
  privileging: 'Privileging',
  quality: 'Quality',
};

export type TimelineEventStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'warning'
  | 'scheduled';

export interface TimelineEventActor {
  display: string;
  reference?: string;
  role?: string;
}

export interface TimelineEvent {
  id: string;
  phase: TimelinePhase;
  type: string;
  title: string;
  timestamp: Date;
  status?: TimelineEventStatus;
  summary?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  actor?: TimelineEventActor;
  sensitive?: boolean;
}

export interface TimelinePhaseGroup {
  phase: TimelinePhase;
  events: TimelineEvent[];
}

export type SortDirection = 'asc' | 'desc';

export type TimelinePhase =
  | 'identity'
  | 'licensure'
  | 'board'
  | 'dea'
  | 'enrollment'
  | 'privileging'
  | 'quality';

export const TIMELINE_PHASE_ORDER: TimelinePhase[] = [
  'identity',
  'licensure',
  'board',
  'dea',
  'enrollment',
  'privileging',
  'quality',
];

export const TIMELINE_PHASE_LABELS: Record<TimelinePhase, string> = {
  identity: 'Identity',
  licensure: 'Licensure',
  board: 'Board',
  dea: 'DEA',
  enrollment: 'Enrollment',
  privileging: 'Privileging',
  quality: 'Quality',
};

export type TimelineEventStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'warning'
  | 'scheduled';

export interface TimelineEventActor {
  display: string;
  reference?: string;
  role?: string;
}

export interface TimelineEvent {
  id: string;
  phase: TimelinePhase;
  type: string;
  title: string;
  timestamp: Date;
  status?: TimelineEventStatus;
  summary?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  actor?: TimelineEventActor;
  sensitive?: boolean;
}

export interface TimelinePhaseGroup {
  phase: TimelinePhase;
  events: TimelineEvent[];
}

export type SortDirection = 'asc' | 'desc';


