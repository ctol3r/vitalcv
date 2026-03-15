import type {
  InvestigatorDefinition,
  InvestigatorFindingDetail,
  InvestigatorFindingRecord,
  InvestigatorFindingStatus,
  InvestigatorRunTrigger,
  InvestigatorScope,
} from './investigatorTypes';

export interface FindingStoreQuery {
  severity?: string[];
  findingType?: string[];
  provider?: string | null;
  institution?: string | null;
  investigatorId?: string[];
  status?: string[];
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number;
  offset?: number;
}

export interface FindingStatusUpdateInput {
  findingId: string;
  status: InvestigatorFindingStatus;
  actorId?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
  changedAt: string;
}

export interface FindingStoreRunStartInput {
  runId: string;
  investigatorId: string;
  trigger: InvestigatorRunTrigger;
  scope: InvestigatorScope;
  entityType: string | null;
  targetEntityIds: string[];
  startedAt: string;
  metadata?: Record<string, unknown>;
}

export interface FindingStorePersistInput<TDependencies = Record<string, never>> {
  runId: string;
  investigator: InvestigatorDefinition<TDependencies>;
  findings: InvestigatorFindingRecord[];
}

export interface FindingStorePersistResult {
  findingsCreated: number;
  findingsUpdated: number;
  persistedFindings: InvestigatorFindingRecord[];
}

export interface FindingStoreRunFinishInput {
  runId: string;
  status: 'succeeded' | 'failed';
  completedAt: string;
  durationMs: number;
  entitiesScanned: number;
  findingsGenerated: number;
  findingsCreated: number;
  findingsUpdated: number;
  findingsResolved: number;
  findingsSuppressed: number;
  storylinesMerged: number;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}

export interface FindingStore {
  beginRun(input: FindingStoreRunStartInput): Promise<void>;
  finishRun(input: FindingStoreRunFinishInput): Promise<void>;
  getLastRunStartedAt(investigatorIds?: string[]): Promise<Record<string, string>>;
  loadByDedupeKeys(dedupeKeys: string[]): Promise<InvestigatorFindingRecord[]>;
  persistFindings<TDependencies = Record<string, never>>(
    input: FindingStorePersistInput<TDependencies>,
  ): Promise<FindingStorePersistResult>;
  resolveMissingFindings(input: {
    investigatorId: string;
    coveredEntityIds: string[];
    activeDedupeKeys: string[];
    resolvedAt: string;
    note?: string | null;
  }): Promise<number>;
  listFindings(query: FindingStoreQuery): Promise<{ total: number; findings: InvestigatorFindingRecord[] }>;
  getFinding(findingId: string): Promise<InvestigatorFindingDetail | null>;
  updateStatus(input: FindingStatusUpdateInput): Promise<InvestigatorFindingDetail>;
}
