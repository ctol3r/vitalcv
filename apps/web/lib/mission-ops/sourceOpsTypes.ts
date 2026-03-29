import type { PassportSourceCoverageState } from '@/lib/trust/source-coverage';

export type SourceOpsCoverageState = PassportSourceCoverageState;

export interface SourceOpsEntry {
  sourceId: string;
  name: string;
  isSpine: boolean;
  supportedInLaunchLane: boolean;
  decisionGrade: boolean;
  liveDecisionGrade: boolean;
  coverageState: SourceOpsCoverageState;
  featureFlag: {
    key: string;
    enabled: boolean;
    mismatch: boolean;
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
