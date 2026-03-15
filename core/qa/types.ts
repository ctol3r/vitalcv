export type QaSeverity = 'info' | 'warning' | 'critical';

export interface QaFinding {
  code: string;
  severity: QaSeverity;
  component: string;
  summary: string;
  detectedAt: string;
  method?: string;
  endpoint?: string;
  entityIds?: string[];
  repairable?: boolean;
  suggestedFixes?: string[];
  metadata?: Record<string, unknown>;
}

export interface DataSanityFinding extends QaFinding {
  component: 'data-sanity';
  category:
    | 'MISSING_NPI'
    | 'POTENTIAL_DUPLICATE_PROVIDER'
    | 'CONFLICTING_SPECIALTY'
    | 'ORPHANED_GRAPH_NODE'
    | 'INVALID_TIMESTAMP'
    | 'BROKEN_RELATIONSHIP'
    | 'DUPLICATE_EDGE_RECORD'
    | 'MALFORMED_ENTITY_NAME';
}

export interface PerformanceWatchFinding extends QaFinding {
  component: 'performance-watch';
  metric:
    | 'API_LATENCY'
    | 'QUERY_LATENCY'
    | 'QUERY_LOAD'
    | 'GRAPH_RENDER'
    | 'COPILOT_RESPONSE';
}

export interface AutoFixVerification {
  name: string;
  passed: boolean;
  details: string;
}

export interface AutoFixAction {
  kind:
    | 'REBUILD_GRAPH_INDEXES'
    | 'NORMALIZE_ENTITY_NAMES'
    | 'REPAIR_BROKEN_EDGES'
    | 'DEDUPLICATE_RECORDS'
    | 'RECOMPUTE_TRUST_SCORES';
  status: 'applied' | 'skipped' | 'failed';
  details: string;
  startedAt: string;
  completedAt: string;
  entityIds?: string[];
  verification: AutoFixVerification[];
}

export interface QaRunSummary {
  trigger: 'build' | 'ingestion' | 'schedule' | 'manual';
  startedAt: string;
  completedAt: string;
  qaFindings: QaFinding[];
  dataSanityFindings: DataSanityFinding[];
  performanceFindings: PerformanceWatchFinding[];
  autoFixActions: AutoFixAction[];
}

export function createQaFinding(input: Omit<QaFinding, 'detectedAt'> & { detectedAt?: string }): QaFinding {
  return {
    ...input,
    detectedAt: input.detectedAt ?? new Date().toISOString(),
  };
}

export function createDataSanityFinding(
  input: Omit<DataSanityFinding, 'component' | 'detectedAt'> & { detectedAt?: string },
): DataSanityFinding {
  return {
    ...input,
    component: 'data-sanity',
    detectedAt: input.detectedAt ?? new Date().toISOString(),
  };
}

export function createPerformanceFinding(
  input: Omit<PerformanceWatchFinding, 'component' | 'detectedAt'> & { detectedAt?: string },
): PerformanceWatchFinding {
  return {
    ...input,
    component: 'performance-watch',
    detectedAt: input.detectedAt ?? new Date().toISOString(),
  };
}

