export type InvestigatorScope = 'provider' | 'institution' | 'network' | 'market';

export type InvestigatorSeverity = 'low' | 'medium' | 'high' | 'critical';

export type InvestigatorFindingStatus =
  | 'new'
  | 'acknowledged'
  | 'investigating'
  | 'dismissed'
  | 'resolved';

export type InvestigatorFindingStatusInput = InvestigatorFindingStatus | 'escalated';

export function normalizeInvestigatorFindingStatus(
  status: string | null | undefined,
): InvestigatorFindingStatus {
  switch ((status ?? '').toLowerCase()) {
    case 'acknowledged':
      return 'acknowledged';
    case 'investigating':
    case 'escalated':
      return 'investigating';
    case 'dismissed':
      return 'dismissed';
    case 'resolved':
      return 'resolved';
    case 'new':
    default:
      return 'new';
  }
}

export function isInvestigatorFindingStatus(
  status: string | null | undefined,
): status is InvestigatorFindingStatusInput {
  return ['new', 'acknowledged', 'investigating', 'dismissed', 'resolved', 'escalated'].includes(
    (status ?? '').toLowerCase(),
  );
}

export type InvestigatorRunTrigger =
  | 'scheduled'
  | 'targeted'
  | 'event_ingestion'
  | 'event_trust_change'
  | 'manual';

export type InvestigatorAudienceRole =
  | 'executive'
  | 'operations'
  | 'credentialing'
  | 'compliance'
  | 'recruiting'
  | 'research';

export interface InvestigatorSchedule {
  cadenceMinutes: number;
  batchSize: number;
  suppressionWindowMinutes: number;
  storylineWindowMinutes: number;
  triggers: InvestigatorRunTrigger[];
}

export interface FindingEvidence {
  evidenceId: string;
  evidenceType: string;
  sourceId?: string | null;
  sourceLabel?: string | null;
  recordType?: string | null;
  recordId?: string | null;
  url?: string | null;
  snippet?: string | null;
  observedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface FindingEntityLink {
  entityType: string;
  entityId: string;
  entityLabel?: string | null;
  relationship?: string | null;
  metadata?: Record<string, unknown>;
}

export interface FindingScoreSignals {
  confidence: number;
  trustImpact: number;
  freshness: number;
  novelty: number;
  entityImportance: number;
  graphCentrality: number;
}

export interface FindingRankBreakdown {
  severity: number;
  confidence: number;
  trustImpact: number;
  freshness: number;
  novelty: number;
  entityImportance: number;
  graphCentrality: number;
  total: number;
  weights: Record<keyof FindingScoreSignals | 'severity', number>;
}

export interface InvestigatorFindingDraft {
  investigatorId?: string;
  findingType: string;
  severity: InvestigatorSeverity;
  title: string;
  summary: string;
  entityIds: string[];
  entities?: FindingEntityLink[];
  supportingEvidence: FindingEvidence[];
  confidence: number;
  explanation?: string;
  audienceRoles?: InvestigatorAudienceRole[];
  scoreSignals?: Partial<Omit<FindingScoreSignals, 'confidence'>>;
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
  storylineKey?: string;
}

export interface InvestigatorFindingRecord {
  findingId: string;
  investigatorId: string;
  findingType: string;
  scope: InvestigatorScope;
  severity: InvestigatorSeverity;
  title: string;
  summary: string;
  entityIds: string[];
  entities: FindingEntityLink[];
  supportingEvidence: FindingEvidence[];
  confidence: number;
  explanation: string;
  status: InvestigatorFindingStatus;
  createdAt: string;
  updatedAt: string;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
  priorityScore: number;
  scoreSignals: FindingScoreSignals;
  rankBreakdown: FindingRankBreakdown;
  audienceRoles: InvestigatorAudienceRole[];
  metadata: Record<string, unknown>;
  dedupeKey: string;
  storylineKey: string;
}

export interface InvestigatorStatusEventRecord {
  fromStatus: InvestigatorFindingStatus | null;
  toStatus: InvestigatorFindingStatus;
  actorId?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface InvestigatorFindingDetail extends InvestigatorFindingRecord {
  statusEvents: InvestigatorStatusEventRecord[];
}

export interface InvestigatorExecutionContext<TDependencies = Record<string, never>> {
  now: string;
  trigger: InvestigatorRunTrigger;
  investigatorId: string;
  entityType: string | null;
  targetEntityIds: string[];
  batchSize: number;
  dependencies: TDependencies;
  markEntityCovered(entityId: string): void;
}

export interface InvestigatorDefinition<TDependencies = Record<string, never>> {
  id: string;
  name: string;
  description: string;
  scope: InvestigatorScope;
  schedule: InvestigatorSchedule;
  enabled: boolean;
  audienceRoles: InvestigatorAudienceRole[];
  run(context: InvestigatorExecutionContext<TDependencies>): Promise<InvestigatorFindingDraft[]>;
}

export interface InvestigatorRunResult {
  runId: string;
  investigatorId: string;
  trigger: InvestigatorRunTrigger;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  findingsGenerated: number;
  findingsCreated: number;
  findingsUpdated: number;
  findingsResolved: number;
  findingsSuppressed: number;
  storylinesMerged: number;
  coveredEntityIds: string[];
}

export interface InvestigatorRunRequest<TDependencies = Record<string, never>> {
  now?: string;
  trigger: InvestigatorRunTrigger;
  entityType?: string | null;
  targetEntityIds?: string[];
  investigatorIds?: string[];
  dependencies: TDependencies;
  metadata?: Record<string, unknown>;
}
