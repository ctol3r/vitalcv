export type SourceOpsCoverageState =
  | 'checked'
  | 'gated'
  | 'pending'
  | 'stale'
  | 'notDecisionGrade'
  | 'unavailable'
  | 'accessRequired'
  | 'reviewRequired'
  | 'previewOnly';

export interface SourceOpsEntry {
  sourceId: string;
  name: string;
  isSpine: boolean;
  decisionGrade: boolean;
  coverageState: SourceOpsCoverageState;
  featureFlag: {
    key: string;
    enabled: boolean;
  };
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  freshnessSlaHours: number;
}

export interface SourceOpsReport {
  timestamp: string;
  sources: SourceOpsEntry[];
  spineStatus: 'HEALTHY' | 'DEGRADED' | 'STALE' | 'CRITICAL';
  alerts: string[];
}
