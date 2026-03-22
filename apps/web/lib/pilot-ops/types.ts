import type { LaunchReadinessPayload } from '@/lib/launch/readiness';
import type { PilotProofSummary } from '@/lib/proof/types';

export const PILOT_QUEUE_STATUSES = [
  'NEW',
  'ACKNOWLEDGED',
  'INVESTIGATING',
  'KNOWN_ISSUE',
  'HOTFIX_QUEUED',
  'MITIGATED',
  'RESOLVED',
] as const;

export type PilotQueueStatus = (typeof PILOT_QUEUE_STATUSES)[number];
export type PilotSeverity = 'low' | 'medium' | 'high' | 'critical';
export type PilotQueueSource =
  | 'feedback'
  | 'support'
  | 'auth'
  | 'route_failure'
  | 'system_failure'
  | 'metric'
  | 'runtime'
  | 'manual';
export type PilotSurfaceMode = 'enabled' | 'degraded' | 'disabled' | 'hidden';
export type LaunchOpsIssueSource =
  | PilotQueueSource
  | 'metric'
  | 'runtime';
export type LaunchOpsIssueStatus =
  | PilotQueueStatus
  | 'OPEN';
export type LaunchOpsSanityStatus = 'pass' | 'warn' | 'fail';

export interface PilotEntityContext {
  kind?: string | null;
  id?: string | null;
  label?: string | null;
  objectType?: string | null;
}

export interface PilotOpsMetrics {
  signIns: number;
  onboardingStarted: number;
  onboardingCompleted: number;
  readinessViewed: number;
  blockerOpened: number;
  blockerResolved: number;
  opportunityViewed: number;
  applyStarted: number;
  applySubmitted: number;
  applicationDetailViewed: number;
  feedbackSubmitted: number;
  supportTriggered: number;
  authFailures: number;
  routeFailures: number;
  openQueueItems: number;
  criticalQueueItems: number;
  applicationStatusViewed: number;
  alertViewed: number;
  walletViewed: number;
  returnSession: number;
}

export interface PilotQueueAction {
  status: PilotQueueStatus;
  owner: string | null;
  note: string | null;
  actorId: string | null;
  updatedAt: string;
}

export interface PilotQueueItem {
  id: string;
  source: PilotQueueSource;
  title: string;
  message: string;
  severity: PilotSeverity;
  route: string | null;
  role: string | null;
  status: PilotQueueStatus;
  owner: string | null;
  createdAt: string;
  updatedAt: string;
  eventType: string | null;
  blocking: boolean;
  entity: PilotEntityContext | null;
  email: string | null;
  feedbackId: string | null;
  details: Record<string, unknown> | null;
  lastAction: PilotQueueAction | null;
}

export interface PilotBaselineSnapshot {
  providerCount: number;
  findingsCount: number;
  storylineCount: number;
  opportunitiesCount: number;
  graphNodeCount: number;
  graphEdgeCount: number;
  activeApplications: number;
  buildVersion: string;
  commitHash: string;
  nodeVersion: string;
}

export interface PilotSurfaceControl {
  surfaceId: string;
  label: string;
  affectsRoutes: string[];
  mode: PilotSurfaceMode;
  reason: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface PilotOpsSummary {
  generatedAt: string;
  metrics: PilotOpsMetrics;
  queue: PilotQueueItem[];
  baseline: PilotBaselineSnapshot;
  surfaceControls: PilotSurfaceControl[];
}

export interface LaunchOpsSanityCheck {
  id: string;
  title: string;
  detail: string;
  status: LaunchOpsSanityStatus;
  value: string;
}

export interface LaunchOpsIssue {
  id: string;
  title: string;
  message: string;
  source: LaunchOpsIssueSource;
  route: string;
  userRole: string | null;
  severity: PilotSeverity;
  timestamp: string;
  status: LaunchOpsIssueStatus;
  owner: string | null;
  queueItemId: string | null;
  blocking: boolean;
  entity: PilotEntityContext | null;
  details: Record<string, unknown> | null;
  lastAction: PilotQueueAction | null;
  reproduceHref: string | null;
}

export interface LaunchOpsSupportItem {
  id: string;
  title: string;
  route: string;
  source: Extract<PilotQueueSource, 'feedback' | 'support'>;
  severity: PilotSeverity;
  timestamp: string;
  userRole: string | null;
  email: string | null;
  context: Record<string, unknown> | null;
  entity: PilotEntityContext | null;
  lastAction: PilotQueueAction | null;
  reproduceHref: string | null;
}

export interface LaunchOpsKnownIssue {
  id: string;
  title: string;
  severity: PilotSeverity;
  affectedFlow: string;
  workaround: string | null;
  status: Extract<PilotQueueStatus, 'KNOWN_ISSUE' | 'HOTFIX_QUEUED' | 'MITIGATED' | 'RESOLVED'>;
  owner: string | null;
  updatedAt: string;
}

export interface LaunchOps24HourReport {
  signIns: number;
  onboardingCompletion: number;
  readinessViews: number;
  blockersResolved: number;
  applicationsSubmitted: number;
  supportIssues: number;
  topFailingRoutes: Array<{ route: string; count: number }>;
  topConfusingSurfaces: Array<{ route: string; count: number }>;
}

export interface LaunchOpsOperatorPanel {
  summaryStatus: 'pass' | 'warn' | 'fail';
  summaryLabel: string;
  summaryDetail: string;
  deploy: {
    frontendVersion: string | null;
    frontendSha: string | null;
    backendVersion: string | null;
    backendSha: string | null;
    deploymentId: string | null;
    target: string | null;
  };
  routeHealth: {
    passing: number;
    warned: number;
    failed: number;
  };
  liveCounts: {
    providers: number;
    findings: number;
    storylines: number;
    opportunities: number;
    applications: number | null;
    authFailures: number;
    feedbackAndSupport: number;
    issueQueue: number;
  };
}

export interface LaunchOpsSnapshot {
  generatedAt: string;
  operatorPanel: LaunchOpsOperatorPanel;
  launchReadiness: LaunchReadinessPayload;
  pilotOps: PilotOpsSummary;
  pilotProof: PilotProofSummary | null;
  report24h: LaunchOps24HourReport;
  sanityChecks: LaunchOpsSanityCheck[];
  triageIssues: LaunchOpsIssue[];
  supportItems: LaunchOpsSupportItem[];
  knownIssues: LaunchOpsKnownIssue[];
  surfaceControls: PilotSurfaceControl[];
}
