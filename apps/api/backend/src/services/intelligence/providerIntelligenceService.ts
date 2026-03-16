import { SpanStatusCode, trace } from '@opentelemetry/api';
import { Prisma, type PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import {
  articulationPoints,
  createEventGraph,
  createIdentityEntity,
  createIdentityGraph,
  createIdentityRelation,
  createIntelligenceGraph,
  createNetworkEdge,
  createNetworkEntity,
  createNetworkGraph,
  createProviderEvent,
  pageRank,
  projectIntelligenceGraph,
  toNetworkProjection,
  type EventGraph,
  type IdentityGraph,
  type IntelligenceGraph,
  type NetworkGraph,
} from '../../../../../../core/graph';
import {
  listPredictionInsights,
  type PredictionQuery,
  type StoredPredictionInsight,
} from '../predictions/predictionEngineService';
import {
  listActionRecommendations,
  type StoredActionRecommendation,
} from '../actions/actionEngineService';

const intelligenceTracer = trace.getTracer('vitalcv.provider-intelligence');
const NPI_RE = /^\d{10}$/;

type ConnectorId =
  | 'OPENALEX'
  | 'PUBMED'
  | 'CLINICAL_TRIALS'
  | 'NIH_REPORTER'
  | 'OPEN_PAYMENTS'
  | 'NPPES_API'
  | 'OIG_LEIE'
  | 'HRSA'
  | 'NRMP'
  | 'OEWS'
  | 'ACGME';

type FindingType =
  | 'publication_change'
  | 'grant_change'
  | 'trial_change'
  | 'payment_change'
  | 'credential_change'
  | 'sanction'
  | 'network_shift';

type FindingSeverity = 'low' | 'medium' | 'high' | 'critical';
type GroupingStrategy = 'entity_anchored' | 'event_anchored' | 'trend_anchored';

type ProviderProfileRow = {
  npi: string | null;
  firstName: string | null;
  lastName: string | null;
  specialty: string | null;
  stateOfPractice: string | null;
};

type ClaimRow = {
  claimId: string;
  subjectNpi: string;
  claimType: string;
  sourceId: string;
  confidenceScore: number;
  value: Prisma.JsonValue;
  createdAt: Date;
  observedAt: Date;
};

type AlertRow = {
  alertId: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  subject: string | null;
  createdAt: Date;
};

type GraphNodeRow = {
  id: string;
  type: string;
  label: string;
  metadata: Prisma.JsonValue;
};

type GraphEdgeRow = {
  id: string;
  edgeType: string;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
  sourceNode: GraphNodeRow;
  targetNode: GraphNodeRow;
};

type ResidencyProgramRow = {
  name: string;
  specialty: string;
  acgme_code: string;
  hospital_affiliation: string;
};

type OrganizationRow = {
  name: string;
  slug: string;
};

type OpportunityRow = {
  title: string;
  specialty: string;
  state: string;
  payRange: string | null;
  createdAt: Date;
  organization: OrganizationRow;
};

type ProviderContext = {
  providerId: string;
  label: string;
  specialty: string | null;
  state: string | null;
  graphNodeId: string | null;
  keys: Partial<Record<'NPI' | 'ORCID' | 'OPENALEX_ID' | 'PAC_ID' | 'ROR_ID', string>>;
};

type IntelligenceEventRecord = EventGraph['events'][number];

type IntelligenceFinding = {
  id: string;
  entityId: string;
  findingType: FindingType;
  severity: FindingSeverity;
  confidence: number;
  explanation: string;
  sources: string[];
  createdAt: string;
  headline: string;
  eventId?: string;
  anchorKey?: string | null;
  relatedEntityIds: string[];
  metadata: Record<string, unknown>;
};

type IntelligenceStoryline = {
  id: string;
  entityIds: string[];
  headline: string;
  summary: string;
  maxSeverity: FindingSeverity;
  findings: string[];
  firstEvent: string;
  lastEvent: string;
  groupingStrategy: GroupingStrategy;
  findingTypes: FindingType[];
};

type IntelligenceDriver = {
  label: string;
  value: number | string;
  direction: 'UP' | 'DOWN' | 'FLAT';
  source: string;
  explanation: string;
};

type PredictionSurface = {
  type: string;
  entity: {
    entityType: string;
    entityId: string;
    entityLabel: string | null;
  };
  score: number;
  scoreLabel: string;
  confidence: number;
  explanation: string;
  drivers: IntelligenceDriver[];
  lastUpdated: string;
  last_updated: string;
  predictionId: string;
};

type IntelligenceActionSurface = {
  id: string;
  entityId: string;
  entityType: string;
  actionType: string;
  intelligenceActionType: 'monitor_provider' | 'investigate_provider' | 'escalate_risk' | 'watch_specialty' | 'watch_institution';
  reason: string;
  priority: string;
  createdAt: string;
};

export type IntelligenceConnectorStatus = {
  id: ConnectorId;
  category: 'identity' | 'research' | 'workforce' | 'compliance' | 'network';
  supported: boolean;
  observed: boolean;
  description: string;
  mappedSignals: string[];
};

export type ProviderInsight = {
  type: 'provider';
  entity: {
    entityType: 'provider';
    entityId: string;
    entityLabel: string | null;
  };
  score: number;
  scoreLabel: string;
  confidence: number;
  explanation: string;
  drivers: IntelligenceDriver[];
  networkHubScore: number;
  relatedStorylineIds: string[];
  relatedActionIds: string[];
  lastUpdated: string;
  last_updated: string;
};

export type SpecialtyInsight = {
  type: 'specialty';
  entity: {
    entityType: 'specialty';
    entityId: string;
    entityLabel: string | null;
  };
  score: number;
  scoreLabel: string;
  confidence: number;
  explanation: string;
  drivers: IntelligenceDriver[];
  lastUpdated: string;
  last_updated: string;
};

export type InstitutionInsight = {
  type: 'institution';
  entity: {
    entityType: 'institution';
    entityId: string;
    entityLabel: string | null;
  };
  score: number;
  scoreLabel: string;
  confidence: number;
  explanation: string;
  drivers: IntelligenceDriver[];
  lastUpdated: string;
  last_updated: string;
};

export type ProviderIntelligenceSnapshot = {
  generatedAt: string;
  connectors: IntelligenceConnectorStatus[];
  graph: {
    identity: IdentityGraph;
    events: EventGraph;
    network: NetworkGraph;
    intelligence: IntelligenceGraph;
    projection: ReturnType<typeof projectIntelligenceGraph>;
  };
  findings: IntelligenceFinding[];
  storylines: IntelligenceStoryline[];
  predictions: PredictionSurface[];
  actions: IntelligenceActionSurface[];
  insights: {
    providers: ProviderInsight[];
    specialties: SpecialtyInsight[];
    institutions: InstitutionInsight[];
  };
};

const CONNECTOR_REGISTRY: IntelligenceConnectorStatus[] = [
  {
    id: 'OPENALEX',
    category: 'research',
    supported: true,
    observed: false,
    description: 'Publication and citation acceleration.',
    mappedSignals: ['publication_change', 'publication_acceleration', 'citation_impact_trend'],
  },
  {
    id: 'PUBMED',
    category: 'research',
    supported: true,
    observed: false,
    description: 'Publication identity corroboration.',
    mappedSignals: ['publication_change', 'citation_impact_trend'],
  },
  {
    id: 'CLINICAL_TRIALS',
    category: 'research',
    supported: true,
    observed: false,
    description: 'Trial registrations and trial leadership progression.',
    mappedSignals: ['trial_change', 'trial_leadership_progression'],
  },
  {
    id: 'NIH_REPORTER',
    category: 'research',
    supported: true,
    observed: false,
    description: 'Grant awards and institutional funding momentum.',
    mappedSignals: ['grant_change', 'grant_funding_trajectory', 'nih_funding_trajectory'],
  },
  {
    id: 'OPEN_PAYMENTS',
    category: 'compliance',
    supported: true,
    observed: false,
    description: 'Industry payments and shared industry relationships.',
    mappedSignals: ['payment_change', 'shared_industry_relationship'],
  },
  {
    id: 'NPPES_API',
    category: 'identity',
    supported: true,
    observed: false,
    description: 'Identity, practice location, and institution changes.',
    mappedSignals: ['location_change', 'credential_change'],
  },
  {
    id: 'OIG_LEIE',
    category: 'compliance',
    supported: true,
    observed: false,
    description: 'Sanction and exclusion monitoring.',
    mappedSignals: ['sanction'],
  },
  {
    id: 'HRSA',
    category: 'workforce',
    supported: true,
    observed: false,
    description: 'Specialty shortage projections.',
    mappedSignals: ['specialty_pressure_score'],
  },
  {
    id: 'NRMP',
    category: 'workforce',
    supported: true,
    observed: false,
    description: 'Match fill-rate pressure.',
    mappedSignals: ['specialty_pressure_score'],
  },
  {
    id: 'OEWS',
    category: 'workforce',
    supported: true,
    observed: false,
    description: 'Wage acceleration signals.',
    mappedSignals: ['specialty_pressure_score'],
  },
  {
    id: 'ACGME',
    category: 'workforce',
    supported: true,
    observed: false,
    description: 'Training pipeline expansion and coverage.',
    mappedSignals: ['training_pipeline_change', 'specialty_pressure_score'],
  },
];

function isMissingTableError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim());
}

function clamp01(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, Math.round(value * 10_000) / 10_000));
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/g)
    .filter((entry) => entry.length > 0)
    .map((entry) => entry[0]!.toUpperCase() + entry.slice(1).toLowerCase())
    .join(' ');
}

function sortIsoAscending(values: string[]): string[] {
  return [...values].sort((left, right) => Date.parse(left) - Date.parse(right));
}

function severityRank(value: FindingSeverity): number {
  switch (value) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
    default:
      return 1;
  }
}

function dedupeStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))];
}

function hashSeed(value: unknown): string {
  const payload = JSON.stringify(value, Object.keys(asRecord(value)).sort());
  let hash = 0;
  for (const char of payload) {
    hash = (Math.imul(31, hash) + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(12, '0');
}

function providerEntityId(npi: string): string {
  return `provider:${npi}`;
}

function institutionEntityId(label: string): string {
  return `institution:${slugify(label)}`;
}

function specialtyEntityId(label: string): string {
  return `specialty:${slugify(label)}`;
}

function credentialEntityId(raw: string): string {
  return `credential:${slugify(raw)}`;
}

function trainingEntityId(code: string): string {
  return `training:${slugify(code)}`;
}

function practiceGroupEntityId(raw: string): string {
  return `practice-group:${slugify(raw)}`;
}

function providerLabel(profile: ProviderProfileRow, graphNode?: GraphNodeRow | null): string {
  const name = [profile.firstName, profile.lastName]
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .join(' ')
    .trim();

  return name || graphNode?.label || (profile.npi ? `Provider ${profile.npi}` : 'Unknown provider');
}

function connectorObservedSet(
  claims: ClaimRow[],
  alerts: AlertRow[],
  residencies: ResidencyProgramRow[],
): Set<ConnectorId> {
  const observed = new Set<ConnectorId>();
  for (const claim of claims) {
    const sourceId = claim.sourceId.toUpperCase();
    if (sourceId === 'OPENALEX') observed.add('OPENALEX');
    if (sourceId === 'PUBMED') observed.add('PUBMED');
    if (sourceId === 'CLINICAL_TRIALS') observed.add('CLINICAL_TRIALS');
    if (sourceId === 'NIH_REPORTER') observed.add('NIH_REPORTER');
    if (sourceId === 'OPEN_PAYMENTS') observed.add('OPEN_PAYMENTS');
    if (sourceId === 'NPPES_API') observed.add('NPPES_API');
    if (sourceId === 'HRSA') observed.add('HRSA');
    if (sourceId === 'NRMP') observed.add('NRMP');
    if (sourceId === 'OEWS') observed.add('OEWS');
    if (sourceId === 'ACGME') observed.add('ACGME');
  }

  if (alerts.some((alert) => /OIG|EXCLUSION|SANCTION/i.test(alert.type))) {
    observed.add('OIG_LEIE');
  }

  if (residencies.length > 0) {
    observed.add('ACGME');
  }

  return observed;
}

async function loadResidencyPrograms(
  prismaClient: PrismaClient,
): Promise<ResidencyProgramRow[]> {
  try {
    return await prismaClient.residencyProgram.findMany({
      select: {
        name: true,
        specialty: true,
        acgme_code: true,
        hospital_affiliation: true,
      },
      take: 1_000,
    });
  } catch (error) {
    if (isMissingTableError(error)) {
      return [];
    }
    throw error;
  }
}

function claimAnchorKey(claim: ClaimRow): string | null {
  const record = asRecord(claim.value);
  return asString(record.doi)
    ?? asString(record.nctId)
    ?? asString(record.grantId)
    ?? asString(record.awardId)
    ?? asString(record.paymentId)
    ?? asString(record.licenseNumber)
    ?? asString(record.recordId)
    ?? null;
}

function claimEventType(claim: ClaimRow): ProviderIntelligenceEventType | null {
  const claimType = claim.claimType.toUpperCase();
  const sourceId = claim.sourceId.toUpperCase();

  if (claimType.includes('PUBLICATION') || claimType.includes('CITATION') || sourceId === 'OPENALEX' || sourceId === 'PUBMED') {
    return 'publication';
  }
  if (claimType.includes('TRIAL') || sourceId === 'CLINICAL_TRIALS') {
    return 'trial_registration';
  }
  if (claimType.includes('GRANT') || sourceId === 'NIH_REPORTER') {
    return 'grant_award';
  }
  if (claimType.includes('PAYMENT') || sourceId === 'OPEN_PAYMENTS') {
    return 'industry_payment';
  }
  if (claimType.includes('LICENSE')) {
    return 'licensure_change';
  }
  if (claimType.includes('BOARD') || claimType.includes('CREDENTIAL') || claimType.includes('CERT')) {
    return 'credential_update';
  }
  if (claimType.includes('LOCATION') || claimType.includes('AFFILIATION')) {
    return 'location_change';
  }

  return null;
}

type ProviderIntelligenceEventType =
  | 'publication'
  | 'trial_registration'
  | 'grant_award'
  | 'industry_payment'
  | 'licensure_change'
  | 'credential_update'
  | 'location_change'
  | 'sanction_exclusion';

function diffRecords(
  previous: Record<string, unknown> | null,
  current: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!previous) {
    return {
      changeType: 'new_record',
      current,
    };
  }

  const changedFields = Object.keys({
    ...previous,
    ...current,
  }).filter((key) => JSON.stringify(previous[key]) !== JSON.stringify(current[key]));

  if (changedFields.length === 0) {
    return null;
  }

  return {
    changeType: 'delta',
    changedFields,
    previous: Object.fromEntries(changedFields.map((field) => [field, previous[field]])),
    current: Object.fromEntries(changedFields.map((field) => [field, current[field]])),
  };
}

function extractInstitution(value: Prisma.JsonValue): string | null {
  const record = asRecord(value);
  return asString(record.institution)
    ?? asString(record.organization)
    ?? asString(record.affiliation)
    ?? asString(record.employer)
    ?? asString(record.hospitalAffiliation);
}

function extractSpecialty(value: Prisma.JsonValue): string | null {
  const record = asRecord(value);
  return asString(record.specialty)
    ?? asString(record.taxonomy)
    ?? asString(record.primarySpecialty)
    ?? asString(record.programSpecialty);
}

function extractCredentialLabel(value: Prisma.JsonValue, claimType: string): string | null {
  const record = asRecord(value);
  return asString(record.credential)
    ?? asString(record.licenseType)
    ?? asString(record.board)
    ?? asString(record.certificate)
    ?? (claimType.toUpperCase().includes('LICENSE') ? claimType : null);
}

function extractPracticeGroup(value: Prisma.JsonValue): string | null {
  const record = asRecord(value);
  return asString(record.practiceGroup)
    ?? asString(record.group)
    ?? asString(record.practice_group);
}

function extractKeys(value: Prisma.JsonValue): Partial<Record<'ORCID' | 'OPENALEX_ID' | 'PAC_ID' | 'ROR_ID', string>> {
  const record = asRecord(value);
  const externalIds = asRecord(record.externalIds);
  return {
    ORCID: asString(record.orcid) ?? asString(externalIds.ORCID) ?? undefined,
    OPENALEX_ID: asString(record.openAlexId) ?? asString(externalIds.OPENALEX_ID) ?? undefined,
    PAC_ID: asString(record.pacId) ?? asString(externalIds.PAC_ID) ?? undefined,
    ROR_ID: asString(record.rorId) ?? asString(externalIds.ROR_ID) ?? undefined,
  };
}

function eventToFindingType(eventType: ProviderIntelligenceEventType): FindingType {
  switch (eventType) {
    case 'publication':
      return 'publication_change';
    case 'grant_award':
      return 'grant_change';
    case 'trial_registration':
      return 'trial_change';
    case 'industry_payment':
      return 'payment_change';
    case 'sanction_exclusion':
      return 'sanction';
    case 'location_change':
      return 'network_shift';
    case 'licensure_change':
    case 'credential_update':
    default:
      return 'credential_change';
  }
}

function eventSeverity(eventType: ProviderIntelligenceEventType, diffSnapshot: Record<string, unknown> | null): FindingSeverity {
  if (eventType === 'sanction_exclusion') {
    return 'critical';
  }
  if (eventType === 'licensure_change' || eventType === 'credential_update') {
    return diffSnapshot && JSON.stringify(diffSnapshot).match(/revok|suspend|disciplin/i)
      ? 'high'
      : 'medium';
  }
  if (eventType === 'industry_payment') {
    return 'medium';
  }
  if (eventType === 'location_change') {
    return 'medium';
  }
  return 'low';
}

function storylineSeverity(findings: IntelligenceFinding[]): FindingSeverity {
  return [...findings]
    .sort((left, right) => severityRank(right.severity) - severityRank(left.severity))[0]?.severity ?? 'low';
}

function normalizePredictionState(value: string): string {
  switch (value) {
    case 'emerging cluster':
      return 'emerging_cluster';
    case 'expanding collaboration':
      return 'collaboration_expansion';
    case 'network fragmentation':
      return 'network_fragmentation';
    case 'bridge provider shift':
      return 'bridge_provider_shift';
    default:
      return value;
  }
}

function driverExplanation(label: string, direction: 'UP' | 'DOWN' | 'FLAT'): string {
  const readable = titleCase(label);
  if (direction === 'UP') {
    return `${readable} increased in the latest observation window.`;
  }
  if (direction === 'DOWN') {
    return `${readable} declined in the latest observation window.`;
  }
  return `${readable} remained flat in the latest observation window.`;
}

function predictionDrivers(prediction: StoredPredictionInsight): IntelligenceDriver[] {
  return prediction.signals.map((signal) => ({
    label: signal.label,
    value: signal.value,
    direction: signal.direction,
    source: signal.source ?? 'derived',
    explanation: driverExplanation(signal.label, signal.direction),
  }));
}

function predictionSurface(prediction: StoredPredictionInsight): PredictionSurface {
  return {
    type: prediction.type,
    entity: {
      entityType: prediction.entityType,
      entityId: prediction.entityId,
      entityLabel: prediction.entityLabel ?? null,
    },
    score: prediction.score,
    scoreLabel: normalizePredictionState(prediction.state),
    confidence: prediction.confidence,
    explanation: prediction.explanation,
    drivers: predictionDrivers(prediction),
    lastUpdated: prediction.updatedAt,
    last_updated: prediction.updatedAt,
    predictionId: prediction.predictionId,
  };
}

function actionTypeAlias(actionType: string): IntelligenceActionSurface['intelligenceActionType'] {
  switch (actionType) {
    case 'MONITOR_PROVIDER':
      return 'monitor_provider';
    case 'ESCALATE_RISK':
    case 'ALERT_TEAM':
      return 'escalate_risk';
    case 'TRACK_SPECIALTY':
      return 'watch_specialty';
    case 'REVIEW_INSTITUTION':
      return 'watch_institution';
    case 'INVESTIGATE_PROVIDER':
    case 'INVESTIGATE_NETWORK':
    case 'VERIFY_CREDENTIAL':
    case 'RUN_VERIFICATION':
    case 'COMPARE_WITH_PEERS':
    case 'EXPORT_REPORT':
    default:
      return 'investigate_provider';
  }
}

function actionSurface(action: StoredActionRecommendation): IntelligenceActionSurface {
  return {
    id: action.actionId,
    entityId: action.targetEntity.entityId,
    entityType: action.targetEntity.entityType,
    actionType: action.actionType,
    intelligenceActionType: actionTypeAlias(action.actionType),
    reason: action.explanation,
    priority: action.priority,
    createdAt: action.createdAt,
  };
}

function withinDays(value: string, now: string, days: number): boolean {
  return Date.parse(now) - Date.parse(value) <= days * 86_400_000;
}

function ninetyDayWindowKey(value: string): string {
  const windowMs = 90 * 86_400_000;
  return String(Math.floor(Date.parse(value) / windowMs));
}

function storylineIdFor(groupingStrategy: GroupingStrategy, key: string): string {
  return `stl_intel_${hashSeed({ groupingStrategy, key })}`;
}

function findingIdFor(seed: Record<string, unknown>): string {
  return `fdg_${hashSeed(seed)}`;
}

function insightLinksForEntity(
  entityId: string,
  storylines: IntelligenceStoryline[],
  actions: IntelligenceActionSurface[],
): { storylineIds: string[]; actionIds: string[] } {
  return {
    storylineIds: storylines
      .filter((storyline) => storyline.entityIds.includes(entityId))
      .map((storyline) => storyline.id),
    actionIds: actions
      .filter((action) => action.entityId === entityId)
      .map((action) => action.id),
  };
}

async function withIntelligenceSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  work: () => Promise<T>,
): Promise<T> {
  return intelligenceTracer.startActiveSpan(name, async (span) => {
    span.setAttributes(attributes);
    try {
      const result = await work();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'provider intelligence failure',
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

async function loadBaseData(
  prismaClient: PrismaClient,
): Promise<{
  profiles: ProviderProfileRow[];
  claims: ClaimRow[];
  alerts: AlertRow[];
  graphNodes: GraphNodeRow[];
  graphEdges: GraphEdgeRow[];
  residencies: ResidencyProgramRow[];
  organizations: OrganizationRow[];
  opportunities: OpportunityRow[];
}> {
  const [
    profiles,
    claims,
    alerts,
    graphNodes,
    graphEdges,
    residencies,
    organizations,
    opportunities,
  ] = await Promise.all([
    prismaClient.personProfile.findMany({
      select: {
        npi: true,
        firstName: true,
        lastName: true,
        specialty: true,
        stateOfPractice: true,
      },
      take: 5_000,
    }),
    prismaClient.claimRecord.findMany({
      select: {
        claimId: true,
        subjectNpi: true,
        claimType: true,
        sourceId: true,
        confidenceScore: true,
        value: true,
        createdAt: true,
        observedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 12_000,
    }),
    prismaClient.trustAlertRecord.findMany({
      select: {
        alertId: true,
        type: true,
        severity: true,
        title: true,
        description: true,
        subject: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prismaClient.graphNode.findMany({
      where: {
        type: { in: ['clinician', 'organization', 'institution', 'specialty', 'program', 'credential', 'license'] },
      },
      select: {
        id: true,
        type: true,
        label: true,
        metadata: true,
      },
      take: 6_000,
    }),
    prismaClient.graphEdge.findMany({
      where: {
        status: { in: ['ACTIVE', 'PENDING'] },
      },
      select: {
        id: true,
        edgeType: true,
        confidence: true,
        createdAt: true,
        updatedAt: true,
        sourceNode: {
          select: {
            id: true,
            type: true,
            label: true,
            metadata: true,
          },
        },
        targetNode: {
          select: {
            id: true,
            type: true,
            label: true,
            metadata: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 8_000,
    }),
    loadResidencyPrograms(prismaClient),
    prismaClient.organization.findMany({
      select: {
        name: true,
        slug: true,
      },
      take: 1_000,
    }),
    prismaClient.opportunity.findMany({
      select: {
        title: true,
        specialty: true,
        state: true,
        payRange: true,
        createdAt: true,
        organization: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 4_000,
    }),
  ]);

  return {
    profiles,
    claims,
    alerts,
    graphNodes,
    graphEdges,
    residencies,
    organizations,
    opportunities,
  };
}

function buildProviderContexts(
  profiles: ProviderProfileRow[],
  graphNodes: GraphNodeRow[],
  claims: ClaimRow[],
): Map<string, ProviderContext> {
  const graphNodeByNpi = new Map<string, GraphNodeRow>();
  for (const node of graphNodes) {
    const npi = asString(asRecord(node.metadata).npi);
    if (npi && NPI_RE.test(npi)) {
      graphNodeByNpi.set(npi, node);
    }
  }

  const contexts = new Map<string, ProviderContext>();
  for (const profile of profiles) {
    if (!profile.npi || !NPI_RE.test(profile.npi)) {
      continue;
    }
    const graphNode = graphNodeByNpi.get(profile.npi);
    contexts.set(profile.npi, {
      providerId: providerEntityId(profile.npi),
      label: providerLabel(profile, graphNode),
      specialty: profile.specialty,
      state: profile.stateOfPractice?.toUpperCase() ?? null,
      graphNodeId: graphNode?.id ?? null,
      keys: {
        NPI: profile.npi,
      },
    });
  }

  for (const claim of claims) {
    if (!NPI_RE.test(claim.subjectNpi)) {
      continue;
    }
    const graphNode = graphNodeByNpi.get(claim.subjectNpi);
    const current = contexts.get(claim.subjectNpi) ?? {
      providerId: providerEntityId(claim.subjectNpi),
      label: graphNode?.label ?? `Provider ${claim.subjectNpi}`,
      specialty: extractSpecialty(claim.value),
      state: asString(asRecord(claim.value).state)?.toUpperCase() ?? null,
      graphNodeId: graphNode?.id ?? null,
      keys: {
        NPI: claim.subjectNpi,
      },
    };
    const keys = extractKeys(claim.value);
    current.keys = {
      ...current.keys,
      ...Object.fromEntries(
        Object.entries(keys).filter(([, value]) => typeof value === 'string' && value.trim().length > 0),
      ),
    };
    if (!current.specialty) {
      current.specialty = extractSpecialty(claim.value);
    }
    contexts.set(claim.subjectNpi, current);
  }

  return contexts;
}

function buildIdentityLayer(input: {
  providerContexts: Map<string, ProviderContext>;
  claims: ClaimRow[];
  organizations: OrganizationRow[];
  opportunities: OpportunityRow[];
  residencies: ResidencyProgramRow[];
}): IdentityGraph {
  const entities = new Map<string, ReturnType<typeof createIdentityEntity>>();
  const relations = new Map<string, ReturnType<typeof createIdentityRelation>>();

  for (const context of input.providerContexts.values()) {
    entities.set(context.providerId, createIdentityEntity({
      entityId: context.providerId,
      entityType: 'provider',
      label: context.label,
      keys: context.keys,
      metadata: {
        specialty: context.specialty,
        state: context.state,
        graphNodeId: context.graphNodeId,
      },
    }));
  }

  const ensureInstitution = (label: string, keys?: Partial<Record<'ROR_ID', string>>) => {
    const entityId = institutionEntityId(label);
    if (!entities.has(entityId)) {
      entities.set(entityId, createIdentityEntity({
        entityId,
        entityType: 'institution',
        label,
        keys: {
          ROR_ID: keys?.ROR_ID,
        },
      }));
    }
    return entityId;
  };

  const ensureSpecialty = (label: string) => {
    const entityId = specialtyEntityId(label);
    if (!entities.has(entityId)) {
      entities.set(entityId, createIdentityEntity({
        entityId,
        entityType: 'specialty',
        label,
      }));
    }
    return entityId;
  };

  const ensureCredential = (label: string) => {
    const entityId = credentialEntityId(label);
    if (!entities.has(entityId)) {
      entities.set(entityId, createIdentityEntity({
        entityId,
        entityType: 'credential',
        label,
      }));
    }
    return entityId;
  };

  const ensureTraining = (program: ResidencyProgramRow) => {
    const entityId = trainingEntityId(program.acgme_code);
    if (!entities.has(entityId)) {
      entities.set(entityId, createIdentityEntity({
        entityId,
        entityType: 'training',
        label: program.name,
        metadata: {
          acgmeCode: program.acgme_code,
          hospitalAffiliation: program.hospital_affiliation,
          specialty: program.specialty,
        },
      }));
    }
    return entityId;
  };

  const ensurePracticeGroup = (label: string) => {
    const entityId = practiceGroupEntityId(label);
    if (!entities.has(entityId)) {
      entities.set(entityId, createIdentityEntity({
        entityId,
        entityType: 'practice_group',
        label,
      }));
    }
    return entityId;
  };

  for (const organization of input.organizations) {
    ensureInstitution(organization.name);
  }

  for (const opportunity of input.opportunities) {
    ensureInstitution(opportunity.organization.name);
    ensureSpecialty(opportunity.specialty);
  }

  for (const residency of input.residencies) {
    const institutionId = ensureInstitution(residency.hospital_affiliation);
    const trainingId = ensureTraining(residency);
    const specialtyId = ensureSpecialty(residency.specialty);
    relations.set(`${trainingId}->${institutionId}`, createIdentityRelation({
      sourceEntityId: trainingId,
      targetEntityId: institutionId,
      relationType: 'hosted_by',
      directed: true,
      metadata: { acgmeCode: residency.acgme_code },
    }));
    relations.set(`${trainingId}->${specialtyId}`, createIdentityRelation({
      sourceEntityId: trainingId,
      targetEntityId: specialtyId,
      relationType: 'trains_for',
      directed: true,
      metadata: { acgmeCode: residency.acgme_code },
    }));
  }

  for (const claim of input.claims) {
    const providerContext = input.providerContexts.get(claim.subjectNpi);
    if (!providerContext) {
      continue;
    }

    const institution = extractInstitution(claim.value);
    const specialty = extractSpecialty(claim.value);
    const credential = extractCredentialLabel(claim.value, claim.claimType);
    const practiceGroup = extractPracticeGroup(claim.value);
    const keys = extractKeys(claim.value);

    const providerEntity = entities.get(providerContext.providerId);
    if (providerEntity) {
      providerEntity.keys = {
        ...providerEntity.keys,
        ...Object.fromEntries(
          Object.entries(keys).filter(([, value]) => typeof value === 'string' && value.trim().length > 0),
        ),
      };
    }

    if (institution) {
      const institutionId = ensureInstitution(institution, { ROR_ID: keys.ROR_ID });
      relations.set(`${providerContext.providerId}->${institutionId}:institution`, createIdentityRelation({
        sourceEntityId: providerContext.providerId,
        targetEntityId: institutionId,
        relationType: 'provider_to_institution',
        directed: true,
        observedAt: claim.observedAt.toISOString(),
        source: claim.sourceId,
      }));
    }

    if (specialty) {
      const specialtyId = ensureSpecialty(specialty);
      relations.set(`${providerContext.providerId}->${specialtyId}:specialty`, createIdentityRelation({
        sourceEntityId: providerContext.providerId,
        targetEntityId: specialtyId,
        relationType: 'provider_to_specialty',
        directed: true,
        observedAt: claim.observedAt.toISOString(),
        source: claim.sourceId,
      }));
    }

    if (credential) {
      const credentialId = ensureCredential(credential);
      relations.set(`${providerContext.providerId}->${credentialId}:credential`, createIdentityRelation({
        sourceEntityId: providerContext.providerId,
        targetEntityId: credentialId,
        relationType: 'provider_to_credential',
        directed: true,
        observedAt: claim.observedAt.toISOString(),
        source: claim.sourceId,
      }));
    }

    if (practiceGroup) {
      const practiceGroupId = ensurePracticeGroup(practiceGroup);
      relations.set(`${providerContext.providerId}->${practiceGroupId}:practice-group`, createIdentityRelation({
        sourceEntityId: providerContext.providerId,
        targetEntityId: practiceGroupId,
        relationType: 'provider_to_practice_group',
        directed: true,
        observedAt: claim.observedAt.toISOString(),
        source: claim.sourceId,
      }));
    }
  }

  return createIdentityGraph({
    entities: [...entities.values()],
    relations: [...relations.values()],
  });
}

function buildEventLayer(
  claims: ClaimRow[],
  alerts: AlertRow[],
  providerContexts: Map<string, ProviderContext>,
): EventGraph {
  const claimsByKey = new Map<string, ClaimRow[]>();
  for (const claim of claims) {
    const eventType = claimEventType(claim);
    if (!eventType || !providerContexts.has(claim.subjectNpi)) {
      continue;
    }
    const key = `${claim.subjectNpi}:${eventType}:${claim.sourceId}:${claimAnchorKey(claim) ?? claim.claimId}`;
    const bucket = claimsByKey.get(key) ?? [];
    bucket.push(claim);
    claimsByKey.set(key, bucket);
  }

  const events: IntelligenceEventRecord[] = [];
  for (const [key, rows] of claimsByKey) {
    const sorted = [...rows].sort((left, right) => left.observedAt.getTime() - right.observedAt.getTime());
    for (let index = 0; index < sorted.length; index += 1) {
      const current = sorted[index]!;
      const previous = index > 0 ? sorted[index - 1]! : null;
      const eventType = claimEventType(current);
      if (!eventType) {
        continue;
      }
      const eventId = `evt_${hashSeed({ key, observedAt: current.observedAt.toISOString(), claimId: current.claimId })}`;
      events.push(createProviderEvent({
        eventId,
        entityId: providerEntityId(current.subjectNpi),
        eventType,
        source: current.sourceId,
        timestamp: current.observedAt.toISOString(),
        confidence: current.confidenceScore,
        rawEvidence: current.value,
        rawData: current.value,
        diffSnapshot: diffRecords(previous ? asRecord(previous.value) : null, asRecord(current.value)),
        metadata: {
          claimId: current.claimId,
          sourceId: current.sourceId,
          anchorKey: claimAnchorKey(current),
          claimType: current.claimType,
        },
      }));
    }
  }

  for (const alert of alerts) {
    if (!alert.subject || !NPI_RE.test(alert.subject)) {
      continue;
    }
    events.push(createProviderEvent({
      eventId: `evt_${hashSeed({ alertId: alert.alertId, subject: alert.subject })}`,
      entityId: providerEntityId(alert.subject),
      eventType: 'sanction_exclusion',
      source: /OIG/i.test(alert.type) ? 'OIG_LEIE' : 'TRUST_ALERTS',
      timestamp: alert.createdAt.toISOString(),
      confidence: alert.severity === 'HIGH' ? 0.9 : 0.78,
      rawEvidence: {
        alertId: alert.alertId,
        type: alert.type,
        title: alert.title,
        description: alert.description,
      },
      diffSnapshot: {
        changeType: 'alert',
        severity: alert.severity,
      },
      metadata: {
        alertId: alert.alertId,
        title: alert.title,
      },
    }));
  }

  return createEventGraph({ events });
}

function extractProviderNpiFromNode(node: GraphNodeRow): string | null {
  return asString(asRecord(node.metadata).npi);
}

function buildNetworkLayer(input: {
  graphEdges: GraphEdgeRow[];
  claims: ClaimRow[];
  providerContexts: Map<string, ProviderContext>;
}): NetworkGraph {
  const entities = new Map<string, ReturnType<typeof createNetworkEntity>>();
  const edges = new Map<string, ReturnType<typeof createNetworkEdge>>();

  for (const context of input.providerContexts.values()) {
    entities.set(context.providerId, createNetworkEntity({
      entityId: context.providerId,
      label: context.label,
      entityType: 'provider',
      metadata: {
        specialty: context.specialty,
        state: context.state,
      },
    }));
  }

  for (const edge of input.graphEdges) {
    const sourceNpi = extractProviderNpiFromNode(edge.sourceNode);
    const targetNpi = extractProviderNpiFromNode(edge.targetNode);
    if (!sourceNpi || !targetNpi || sourceNpi === targetNpi) {
      continue;
    }

    let relationshipType: 'co_author' | 'co_investigator' | 'co_PI' | null = null;
    if (edge.edgeType === 'co_author') {
      relationshipType = 'co_author';
    } else if (edge.edgeType === 'co_investigator') {
      relationshipType = 'co_investigator';
    } else if (edge.edgeType === 'co_pi') {
      relationshipType = 'co_PI';
    }

    if (!relationshipType) {
      continue;
    }

    const sourceEntityId = providerEntityId(sourceNpi);
    const targetEntityId = providerEntityId(targetNpi);
    const edgeKey = `${sourceEntityId}:${targetEntityId}:${relationshipType}`;
    if (!edges.has(edgeKey)) {
      edges.set(edgeKey, createNetworkEdge({
        sourceEntityId,
        targetEntityId,
        relationshipType,
        weight: 1,
        confidence: edge.confidence,
        firstSeen: edge.createdAt.toISOString(),
        lastSeen: edge.updatedAt.toISOString(),
        metadata: {
          graphEdgeId: edge.id,
        },
      }));
      continue;
    }

    const current = edges.get(edgeKey)!;
    current.weight = Number((current.weight + 1).toFixed(4));
    current.confidence = clamp01(Math.max(current.confidence, edge.confidence));
    current.lastSeen = edge.updatedAt.toISOString();
  }

  const practiceGroups = new Map<string, Set<string>>();
  const payerGroups = new Map<string, Set<string>>();
  for (const claim of input.claims) {
    if (!input.providerContexts.has(claim.subjectNpi)) {
      continue;
    }
    const practiceGroup = extractPracticeGroup(claim.value);
    if (practiceGroup) {
      const set = practiceGroups.get(practiceGroup) ?? new Set<string>();
      set.add(claim.subjectNpi);
      practiceGroups.set(practiceGroup, set);
    }

    if (claim.sourceId.toUpperCase() === 'OPEN_PAYMENTS' || claim.claimType.toUpperCase().includes('PAYMENT')) {
      const record = asRecord(claim.value);
      const payer = asString(record.dominantPayer)
        ?? asString(record.applicable_manufacturer_or_applicable_gpo_making_payment_name)
        ?? asStringArray(record.topPayers)[0]
        ?? null;
      if (payer) {
        const set = payerGroups.get(payer) ?? new Set<string>();
        set.add(claim.subjectNpi);
        payerGroups.set(payer, set);
      }
    }
  }

  for (const [groupLabel, providers] of practiceGroups) {
    const providerIds = [...providers];
    for (let index = 0; index < providerIds.length; index += 1) {
      for (let inner = index + 1; inner < providerIds.length; inner += 1) {
        const sourceEntityId = providerEntityId(providerIds[index]!);
        const targetEntityId = providerEntityId(providerIds[inner]!);
        const edgeKey = `${sourceEntityId}:${targetEntityId}:co_practice_group:${groupLabel}`;
        edges.set(edgeKey, createNetworkEdge({
          sourceEntityId,
          targetEntityId,
          relationshipType: 'co_practice_group',
          weight: 1,
          confidence: 0.76,
          firstSeen: new Date().toISOString(),
          metadata: {
            practiceGroup: groupLabel,
          },
        }));
      }
    }
  }

  for (const [payer, providers] of payerGroups) {
    const providerIds = [...providers];
    for (let index = 0; index < providerIds.length; index += 1) {
      for (let inner = index + 1; inner < providerIds.length; inner += 1) {
        const sourceEntityId = providerEntityId(providerIds[index]!);
        const targetEntityId = providerEntityId(providerIds[inner]!);
        const edgeKey = `${sourceEntityId}:${targetEntityId}:shared_industry_relationship:${payer}`;
        edges.set(edgeKey, createNetworkEdge({
          sourceEntityId,
          targetEntityId,
          relationshipType: 'shared_industry_relationship',
          weight: 1,
          confidence: 0.74,
          firstSeen: new Date().toISOString(),
          metadata: {
            payer,
          },
        }));
      }
    }
  }

  return createNetworkGraph({
    entities: [...entities.values()],
    edges: [...edges.values()],
  });
}

function buildFindings(
  events: EventGraph,
  predictions: PredictionSurface[],
  providerContexts: Map<string, ProviderContext>,
): IntelligenceFinding[] {
  const findings: IntelligenceFinding[] = [];

  for (const event of events.events) {
    const eventType = event.eventType as ProviderIntelligenceEventType;
    const relatedEntityIds = [event.entityId];
    const anchorKey = asString(asRecord(event.metadata).anchorKey);
    const findingType = eventToFindingType(eventType);
    const entityContext = providerContexts.get(event.entityId.replace(/^provider:/, ''));
    const headline = entityContext
      ? `${entityContext.label} ${titleCase(findingType.replace(/_/g, ' ')).toLowerCase()}`
      : `${titleCase(findingType.replace(/_/g, ' '))}`;

    findings.push({
      id: findingIdFor({
        eventId: event.eventId,
        findingType,
      }),
      entityId: event.entityId,
      findingType,
      severity: eventSeverity(eventType, event.diffSnapshot ?? null),
      confidence: event.confidence,
      explanation: event.diffSnapshot
        ? `${titleCase(findingType.replace(/_/g, ' '))} detected from ${event.source}.`
        : `${titleCase(findingType.replace(/_/g, ' '))} observed from ${event.source}.`,
      sources: [event.source],
      createdAt: event.timestamp,
      headline,
      eventId: event.eventId,
      anchorKey,
      relatedEntityIds,
      metadata: {
        eventType,
        diffSnapshot: event.diffSnapshot ?? null,
        rawData: event.rawData ?? event.rawEvidence,
      },
    });
  }

  for (const prediction of predictions.filter((entry) => entry.type === 'NETWORK_SHIFT')) {
    findings.push({
      id: findingIdFor({
        predictionId: prediction.predictionId,
        findingType: 'network_shift',
      }),
      entityId: providerEntityId(prediction.entity.entityId),
      findingType: 'network_shift',
      severity: prediction.score >= 0.8 ? 'high' : 'medium',
      confidence: prediction.confidence,
      explanation: prediction.explanation,
      sources: dedupeStrings(prediction.drivers.map((driver) => driver.source)),
      createdAt: prediction.lastUpdated,
      headline: `${prediction.entity.entityLabel ?? prediction.entity.entityId} network shift`,
      anchorKey: prediction.predictionId,
      relatedEntityIds: [providerEntityId(prediction.entity.entityId)],
      metadata: {
        predictionType: prediction.type,
        scoreLabel: prediction.scoreLabel,
      },
    });
  }

  return findings
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .filter((finding, index, array) => array.findIndex((entry) => entry.id === finding.id) === index);
}

function buildStorylines(findings: IntelligenceFinding[], now: string): IntelligenceStoryline[] {
  const groups = new Map<string, IntelligenceFinding[]>();
  const trendBuckets = new Map<string, Set<string>>();
  for (const finding of findings.filter((entry) => withinDays(entry.createdAt, now, 90))) {
    const trendKey = `${finding.findingType}:${ninetyDayWindowKey(finding.createdAt)}`;
    const bucket = trendBuckets.get(trendKey) ?? new Set<string>();
    bucket.add(finding.entityId);
    trendBuckets.set(trendKey, bucket);
  }

  for (const finding of findings) {
    const eventAnchoredKey = finding.anchorKey && withinDays(finding.createdAt, now, 90)
      ? `event:${finding.anchorKey}`
      : null;
    const trendKey = (trendBuckets.get(`${finding.findingType}:${ninetyDayWindowKey(finding.createdAt)}`)?.size ?? 0) > 1
      ? `trend:${finding.findingType}:${ninetyDayWindowKey(finding.createdAt)}`
      : null;
    const entityKey = `entity:${finding.entityId}:${ninetyDayWindowKey(finding.createdAt)}`;
    const key = eventAnchoredKey ?? trendKey ?? entityKey;
    const bucket = groups.get(key) ?? [];
    bucket.push(finding);
    groups.set(key, bucket);
  }

  return [...groups.entries()].map(([key, bucket]) => {
    const sorted = [...bucket].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
    const groupingStrategy: GroupingStrategy = key.startsWith('event:')
      ? 'event_anchored'
      : key.startsWith('trend:')
        ? 'trend_anchored'
        : 'entity_anchored';
    const entityIds = dedupeStrings(bucket.flatMap((finding) => finding.relatedEntityIds));
    const firstEvent = sorted[0]?.createdAt ?? now;
    const lastEvent = sorted[sorted.length - 1]?.createdAt ?? now;
    const maxSeverity = storylineSeverity(bucket);
    const headline = groupingStrategy === 'event_anchored'
      ? sorted[0]?.headline ?? 'Event storyline'
      : groupingStrategy === 'trend_anchored'
        ? `${titleCase(sorted[0]?.findingType.replace(/_/g, ' ') ?? 'trend')} trend across ${entityIds.length} entities`
        : `${sorted[0]?.headline ?? 'Entity storyline'} over 90d`;

    return {
      id: storylineIdFor(groupingStrategy, key),
      entityIds,
      headline,
      summary: bucket.slice(0, 3).map((finding) => finding.explanation).join(' '),
      maxSeverity,
      findings: bucket.map((finding) => finding.id),
      firstEvent,
      lastEvent,
      groupingStrategy,
      findingTypes: dedupeStrings(bucket.map((finding) => finding.findingType)) as FindingType[],
    };
  }).sort((left, right) => Date.parse(right.lastEvent) - Date.parse(left.lastEvent));
}

function buildProviderInsights(input: {
  predictions: PredictionSurface[];
  storylines: IntelligenceStoryline[];
  actions: IntelligenceActionSurface[];
  network: NetworkGraph;
}): ProviderInsight[] {
  const networkProjection = toNetworkProjection(input.network);
  const pageRanks = new Map(pageRank(networkProjection).map((entry) => [entry.nodeId, entry.score]));
  const articulation = new Set(articulationPoints(networkProjection));

  return input.predictions
    .filter((prediction) => prediction.type === 'PROVIDER_TRAJECTORY' && prediction.entity.entityType === 'provider')
    .map((prediction) => {
      const entityId = providerEntityId(prediction.entity.entityId);
      const links = insightLinksForEntity(entityId, input.storylines, input.actions);
      const networkHubScore = clamp01((pageRanks.get(entityId) ?? 0) + (articulation.has(entityId) ? 0.12 : 0));
      const hubDirection: IntelligenceDriver['direction'] = networkHubScore >= 0.5 ? 'UP' : 'FLAT';

      return {
        type: 'provider' as const,
        entity: {
          entityType: 'provider' as const,
          entityId: prediction.entity.entityId,
          entityLabel: prediction.entity.entityLabel,
        },
        score: prediction.score,
        scoreLabel: prediction.scoreLabel,
        confidence: prediction.confidence,
        explanation: prediction.explanation,
        drivers: [
          ...prediction.drivers,
          {
            label: 'network_hub_score',
            value: Number(networkHubScore.toFixed(4)),
            direction: hubDirection,
            source: 'GRAPH_RUNTIME',
            explanation: articulation.has(entityId)
              ? 'Provider sits on an articulation point in the current network graph.'
              : 'Provider centrality is derived from current collaboration edges.',
          },
        ],
        networkHubScore,
        relatedStorylineIds: links.storylineIds,
        relatedActionIds: links.actionIds,
        lastUpdated: prediction.lastUpdated,
        last_updated: prediction.last_updated,
      };
    })
    .sort((left, right) => right.score - left.score || right.networkHubScore - left.networkHubScore);
}

function buildSpecialtyInsights(input: {
  predictions: PredictionSurface[];
}): SpecialtyInsight[] {
  return input.predictions
    .filter((prediction) => prediction.type === 'SPECIALTY_PRESSURE' && prediction.entity.entityType === 'specialty')
    .map((prediction) => ({
      type: 'specialty' as const,
      entity: {
        entityType: 'specialty' as const,
        entityId: prediction.entity.entityId,
        entityLabel: prediction.entity.entityLabel,
      },
      score: prediction.score,
      scoreLabel: prediction.scoreLabel,
      confidence: prediction.confidence,
      explanation: prediction.explanation,
      drivers: prediction.drivers,
      lastUpdated: prediction.lastUpdated,
      last_updated: prediction.last_updated,
    }))
    .sort((left, right) => right.score - left.score);
}

function buildInstitutionInsights(input: {
  predictions: PredictionSurface[];
}): InstitutionInsight[] {
  return input.predictions
    .filter((prediction) => prediction.type === 'INSTITUTION_MOMENTUM' && prediction.entity.entityType === 'institution')
    .map((prediction) => ({
      type: 'institution' as const,
      entity: {
        entityType: 'institution' as const,
        entityId: prediction.entity.entityId,
        entityLabel: prediction.entity.entityLabel,
      },
      score: prediction.score,
      scoreLabel: prediction.scoreLabel,
      confidence: prediction.confidence,
      explanation: prediction.explanation,
      drivers: prediction.drivers,
      lastUpdated: prediction.lastUpdated,
      last_updated: prediction.last_updated,
    }))
    .sort((left, right) => right.score - left.score);
}

export async function buildProviderIntelligenceSnapshot(
  options: {
    sync?: boolean;
    now?: string;
    predictionQuery?: PredictionQuery;
    prismaClient?: PrismaClient;
  } = {},
): Promise<ProviderIntelligenceSnapshot> {
  const prismaClient = options.prismaClient ?? prisma;
  const now = options.now ?? new Date().toISOString();

  return withIntelligenceSpan(
    'provider-intelligence.snapshot',
    {
      'vitalcv.intelligence.sync': options.sync !== false,
    },
    async () => {
      const base = await loadBaseData(prismaClient);
      const providerContexts = buildProviderContexts(base.profiles, base.graphNodes, base.claims);
      const [storedPredictions, storedActions] = await Promise.all([
        listPredictionInsights({
          ...(options.predictionQuery ?? {}),
          limit: 500,
          offset: 0,
          sync: options.sync,
        }, prismaClient),
        listActionRecommendations({
          limit: 250,
          offset: 0,
        }, prismaClient),
      ]);

      const identity = buildIdentityLayer({
        providerContexts,
        claims: base.claims,
        organizations: base.organizations,
        opportunities: base.opportunities,
        residencies: base.residencies,
      });
      const events = buildEventLayer(base.claims, base.alerts, providerContexts);
      const network = buildNetworkLayer({
        graphEdges: base.graphEdges,
        claims: base.claims,
        providerContexts,
      });
      const intelligence = createIntelligenceGraph({
        createdAt: now,
        identity,
        events,
        network,
      });
      const projection = projectIntelligenceGraph(intelligence, {
        now,
      });
      const predictions = storedPredictions.predictions.map(predictionSurface);
      const actions = storedActions.actions.map(actionSurface);
      const findings = buildFindings(events, predictions, providerContexts);
      const storylines = buildStorylines(findings, now);
      const observedConnectors = connectorObservedSet(base.claims, base.alerts, base.residencies);

      return {
        generatedAt: now,
        connectors: CONNECTOR_REGISTRY.map((connector) => ({
          ...connector,
          observed: observedConnectors.has(connector.id),
        })),
        graph: {
          identity,
          events,
          network,
          intelligence,
          projection,
        },
        findings,
        storylines,
        predictions,
        actions,
        insights: {
          providers: buildProviderInsights({
            predictions,
            storylines,
            actions,
            network,
          }),
          specialties: buildSpecialtyInsights({ predictions }),
          institutions: buildInstitutionInsights({ predictions }),
        },
      };
    },
  );
}

export async function getProviderIntelligenceGraph(
  options: {
    sync?: boolean;
    now?: string;
    prismaClient?: PrismaClient;
  } = {},
): Promise<ProviderIntelligenceSnapshot['graph'] & {
  generatedAt: string;
  connectors: IntelligenceConnectorStatus[];
  findings: IntelligenceFinding[];
  storylines: IntelligenceStoryline[];
}> {
  const snapshot = await buildProviderIntelligenceSnapshot(options);
  return {
    generatedAt: snapshot.generatedAt,
    connectors: snapshot.connectors,
    findings: snapshot.findings,
    storylines: snapshot.storylines,
    ...snapshot.graph,
  };
}

export async function listProviderInsights(
  options: {
    sync?: boolean;
    limit?: number;
    prismaClient?: PrismaClient;
  } = {},
): Promise<{
  generatedAt: string;
  insights: ProviderInsight[];
  connectors: IntelligenceConnectorStatus[];
}> {
  const snapshot = await buildProviderIntelligenceSnapshot(options);
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  return {
    generatedAt: snapshot.generatedAt,
    insights: snapshot.insights.providers.slice(0, limit),
    connectors: snapshot.connectors,
  };
}

export async function listSpecialtyInsights(
  options: {
    sync?: boolean;
    limit?: number;
    severity?: string;
    prismaClient?: PrismaClient;
  } = {},
): Promise<{
  generatedAt: string;
  insights: SpecialtyInsight[];
  connectors: IntelligenceConnectorStatus[];
}> {
  const snapshot = await buildProviderIntelligenceSnapshot(options);
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const severity = options.severity ? normalizePredictionState(options.severity) : null;
  const filtered = severity
    ? snapshot.insights.specialties.filter((insight) => insight.scoreLabel === severity)
    : snapshot.insights.specialties;
  return {
    generatedAt: snapshot.generatedAt,
    insights: filtered.slice(0, limit),
    connectors: snapshot.connectors,
  };
}

export async function listInstitutionInsights(
  options: {
    sync?: boolean;
    limit?: number;
    state?: string;
    prismaClient?: PrismaClient;
  } = {},
): Promise<{
  generatedAt: string;
  insights: InstitutionInsight[];
  connectors: IntelligenceConnectorStatus[];
}> {
  const snapshot = await buildProviderIntelligenceSnapshot(options);
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const state = options.state ? normalizePredictionState(options.state) : null;
  const filtered = state
    ? snapshot.insights.institutions.filter((insight) => insight.scoreLabel === state)
    : snapshot.insights.institutions;
  return {
    generatedAt: snapshot.generatedAt,
    insights: filtered.slice(0, limit),
    connectors: snapshot.connectors,
  };
}
