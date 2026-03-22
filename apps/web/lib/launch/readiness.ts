export type LaunchReadinessStatus = 'pass' | 'warn' | 'fail';
export type LaunchReadinessTone = 'healthy' | 'warning' | 'critical' | 'neutral';

export interface LaunchReadinessRouteCheck {
  id: string;
  label: string;
  href: string;
  status: LaunchReadinessStatus;
  httpStatus: number | null;
  detail: string;
}

export interface LaunchReadinessLoopCheck {
  id: string;
  label: string;
  status: LaunchReadinessStatus;
  detail: string;
}

export interface LaunchReadinessAlert {
  id: string;
  tone: LaunchReadinessTone;
  title: string;
  detail: string;
}

export interface LaunchReadinessCounts {
  providers: number;
  findings: number;
  storylines: number;
  graphNodes: number;
  graphEdges: number;
  actions: number;
  employers: number;
  opportunities: number;
  applications: number | null;
}

export interface LaunchReadinessVersionInfo {
  version: string | null;
  sha: string | null;
  deploymentId: string | null;
  target: string | null;
  health: 'healthy' | 'degraded' | 'unknown';
  detail: string;
}

export interface LaunchReadinessPayload {
  generatedAt: string;
  environment: {
    target: string;
    webOrigin: string;
    backendBase: string;
  };
  summary: {
    status: LaunchReadinessStatus;
    label: string;
    detail: string;
  };
  versions: {
    frontend: LaunchReadinessVersionInfo;
    backend: LaunchReadinessVersionInfo;
  };
  counts: LaunchReadinessCounts;
  routeChecks: LaunchReadinessRouteCheck[];
  loopChecks: LaunchReadinessLoopCheck[];
  alerts: LaunchReadinessAlert[];
}

export function shortSha(value: string | null | undefined): string {
  if (!value) {
    return 'unknown';
  }

  return value.slice(0, 8);
}

export function formatNullableCount(value: number | null): string {
  return value === null ? 'n/a' : `${value}`;
}

export function readinessTone(status: LaunchReadinessStatus): LaunchReadinessTone {
  switch (status) {
    case 'pass':
      return 'healthy';
    case 'warn':
      return 'warning';
    case 'fail':
    default:
      return 'critical';
  }
}
