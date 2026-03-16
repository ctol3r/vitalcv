import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type {
  InvestigatorAudienceRole,
  InvestigatorDefinition,
  InvestigatorFindingDraft,
} from '../../../../../../core/investigators/investigatorTypes';
import {
  buildInvestigatorOutputs,
  defaultScheduleJobs,
  nextRunAt,
  sourceDefinitionFor,
  type InvestigatorCadence,
  type InvestigatorSourceId,
  type NormalizedInvestigatorSignal,
  type ScheduleJobDefinition,
} from '../../../../../../services/investigator-engine/src';
import {
  ingestClinicianIdentity,
  type DeltaEvent,
} from '../identity/identityIngestionPipeline';
import { persistSourceRecord } from '../identity/identityStore';
import { queryNPDB } from '../providers/connectors/npdbConnector';

type BackendDependencies = {
  prisma: PrismaClient;
};

type ProviderProfile = {
  npi: string;
  label: string;
  firstName: string | null;
  lastName: string | null;
  specialty: string | null;
  state: string | null;
  centrality: number;
};

type SourceExecutionResult = {
  sourceId: InvestigatorSourceId;
  signals: NormalizedInvestigatorSignal[];
};

type ManualSourceSnapshot = {
  sourceUrl: string;
  snapshot: Record<string, unknown>;
};

const AUTONOMOUS_ENGINE_PREFIX = 'autonomous_investigator';

const PIPELINE_SOURCE_MAP: Partial<Record<InvestigatorSourceId, string>> = {
  LEIE: 'OIG_LEIE',
  NPPES: 'NPPES_API',
  CLINICAL_TRIALS: 'CLINICAL_TRIALS',
  OPENALEX: 'OPENALEX',
  OPEN_PAYMENTS: 'OPEN_PAYMENTS',
};

const FINDING_SIGNAL_TYPES = new Set([
  'exclusion',
  'trial',
  'publication',
  'grant',
  'payment',
  'credential',
  'network',
  'practice',
]);

export const AUTONOMOUS_INVESTIGATOR_SPECS: Array<{
  id: string;
  cadence: InvestigatorCadence;
  sources: InvestigatorSourceId[];
  description: string;
  audienceRoles: InvestigatorAudienceRole[];
  batchSize: number;
}> = [
  {
    id: `${AUTONOMOUS_ENGINE_PREFIX}_daily`,
    cadence: 'daily',
    sources: ['LEIE', 'NPPES', 'CLINICAL_TRIALS'],
    description: 'Daily provider-source monitoring across exclusion, identity, and trial registries.',
    audienceRoles: ['compliance', 'credentialing', 'research'],
    batchSize: 30,
  },
  {
    id: `${AUTONOMOUS_ENGINE_PREFIX}_weekly`,
    cadence: 'weekly',
    sources: ['OPENALEX', 'SEMANTIC_SCHOLAR', 'NIH_REPORTER'],
    description: 'Weekly research scan across publications, citations, and grants.',
    audienceRoles: ['research', 'executive', 'recruiting'],
    batchSize: 24,
  },
  {
    id: `${AUTONOMOUS_ENGINE_PREFIX}_monthly_diff`,
    cadence: 'monthly',
    sources: ['MONTHLY_DIFF'],
    description: 'Monthly trend-diff synthesis for multi-provider storylines.',
    audienceRoles: ['operations', 'executive', 'research'],
    batchSize: 40,
  },
  {
    id: `${AUTONOMOUS_ENGINE_PREFIX}_quarterly`,
    cadence: 'quarterly',
    sources: ['NPDB'],
    description: 'Quarterly NPDB adverse-action review.',
    audienceRoles: ['compliance', 'credentialing'],
    batchSize: 30,
  },
  {
    id: `${AUTONOMOUS_ENGINE_PREFIX}_annual`,
    cadence: 'annual',
    sources: ['OPEN_PAYMENTS'],
    description: 'Annual Open Payments diff for payment and ownership findings.',
    audienceRoles: ['compliance', 'executive'],
    batchSize: 50,
  },
];

const ACTIVE_FINDING_STATUSES = ['new', 'acknowledged', 'investigating', 'escalated'] as const;

function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clamp01(value: number | null | undefined, fallback = 0): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, Math.round(value * 10_000) / 10_000));
}

function readSourceId(sourceId: InvestigatorSourceId): string {
  return PIPELINE_SOURCE_MAP[sourceId] ?? sourceId;
}

function readEventAnchor(value: unknown): { id: string; type: string; label: string | null } | null {
  const record = asRecord(value);
  const doi = asString(record.doi) ?? asString(asRecord(record.externalIds).DOI);
  if (doi) {
    return { id: doi.toLowerCase(), type: 'doi', label: doi };
  }

  const nctId = asString(record.nctId);
  if (nctId) {
    return { id: nctId.toUpperCase(), type: 'trial', label: nctId.toUpperCase() };
  }

  const grantId = asString(record.awardId)
    ?? asString(record.coreProjectNum)
    ?? asString(record.projectNumber)
    ?? asString(record.grantNumber);
  if (grantId) {
    return { id: grantId, type: 'grant', label: grantId };
  }

  const paymentId = asString(record.paymentId) ?? asString(record.recordId);
  if (paymentId) {
    return { id: paymentId, type: 'payment', label: paymentId };
  }

  const publicationId = asString(record.pubmedId)
    ?? asString(record.openAlexId)
    ?? asString(record.authorId)
    ?? asString(record.paperId);
  if (publicationId) {
    return { id: publicationId, type: 'publication', label: publicationId };
  }

  return null;
}

function classifyDelta(signalSourceId: InvestigatorSourceId, event: DeltaEvent): {
  signalType: NormalizedInvestigatorSignal['signalType'];
  summary: string;
  magnitude: number;
} | null {
  if (event.type === 'EXCLUSION_DETECTED' || event.type === 'NEW_SANCTION_HIT') {
    return {
      signalType: 'exclusion',
      summary: 'An exclusion or sanction signal changed in an authoritative source.',
      magnitude: 1,
    };
  }

  if (event.type === 'NEW_PAYMENT_RELATIONSHIP') {
    return {
      signalType: 'payment',
      summary: 'A new payment relationship or payment-change signal was detected.',
      magnitude: 0.9,
    };
  }

  if (event.type === 'PROVIDER_MOVED_LOCATION' || event.type === 'PROVIDER_MOVED_ORGANIZATION') {
    return {
      signalType: 'practice',
      summary: 'Provider practice footprint changed across organization or location fields.',
      magnitude: 0.72,
    };
  }

  if (
    event.type === 'LICENSE_STATUS_CHANGED'
    || event.type === 'LICENSE_STATE_CHANGED'
    || event.type === 'BOARD_CERT_STATUS_CHANGED'
  ) {
    return {
      signalType: 'credential',
      summary: 'A credential or licensure state changed.',
      magnitude: 0.84,
    };
  }

  const claimType = event.claimType.toUpperCase();
  if (claimType.includes('CLINICAL_TRIAL')) {
    return {
      signalType: 'trial',
      summary: 'Clinical-trial participation changed.',
      magnitude: event.type === 'CLAIM_ADDED' ? 0.7 : 0.58,
    };
  }

  if (claimType.includes('PUBLICATION') || claimType.includes('CITATION')) {
    return {
      signalType: 'publication',
      summary: 'Publication or citation evidence changed.',
      magnitude: event.type === 'CLAIM_ADDED' ? 0.66 : 0.54,
    };
  }

  if (claimType.includes('GRANT') || signalSourceId === 'NIH_REPORTER') {
    return {
      signalType: 'grant',
      summary: 'Grant activity changed.',
      magnitude: event.type === 'CLAIM_ADDED' ? 0.82 : 0.68,
    };
  }

  if (claimType.includes('AFFILIATION') || claimType.includes('GROUP')) {
    return {
      signalType: 'network',
      summary: 'Network or affiliation evidence changed.',
      magnitude: 0.52,
    };
  }

  if (claimType.includes('PRACTICE') || signalSourceId === 'NPPES') {
    return {
      signalType: 'practice',
      summary: 'Practice-state or identity evidence changed.',
      magnitude: 0.48,
    };
  }

  if (event.type === 'SOURCE_STALE' || event.type === 'SOURCE_DISAPPEARED') {
    return {
      signalType: 'credential',
      summary: 'A required source became stale or disappeared.',
      magnitude: 0.44,
    };
  }

  return null;
}

function signalSummary(event: DeltaEvent, baselineSummary: string): string {
  const previous = asRecord(event.previous);
  const current = asRecord(event.current);
  const label = current.title
    ?? current.institution
    ?? current.organization
    ?? current.status
    ?? current.exclusionType
    ?? current.nctId
    ?? previous.status
    ?? previous.institution
    ?? previous.organization;

  const valueLabel = typeof label === 'string' && label.trim().length > 0
    ? ` (${label})`
    : '';

  return `${baselineSummary}${valueLabel}`;
}

async function loadProviderProfile(prisma: PrismaClient, npi: string): Promise<ProviderProfile> {
  const [profile, identityClaim, graphNode] = await Promise.all([
    prisma.personProfile.findFirst({
      where: { npi },
      select: {
        firstName: true,
        lastName: true,
        specialty: true,
        stateOfPractice: true,
      },
    }),
    prisma.claimRecord.findFirst({
      where: {
        subjectNpi: npi,
        claimType: 'PERSONAL_IDENTITY',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        value: true,
      },
    }),
    prisma.graphNode.findFirst({
      where: {
        metadata: {
          path: ['npi'],
          equals: npi,
        },
      },
      orderBy: { degree: 'desc' },
      select: {
        label: true,
        degree: true,
      },
    }).catch(() => null),
  ]);

  const identity = asRecord(identityClaim?.value);
  const firstName = profile?.firstName ?? asString(identity.firstName);
  const lastName = profile?.lastName ?? asString(identity.lastName);
  const label = [firstName, lastName].filter((value): value is string => Boolean(value)).join(' ').trim()
    || graphNode?.label
    || `Provider ${npi}`;
  const centrality = clamp01((graphNode?.degree ?? 0) / 24, 0.22);

  return {
    npi,
    label,
    firstName,
    lastName,
    specialty: profile?.specialty ?? asString(identity.specialty),
    state: profile?.stateOfPractice?.toUpperCase() ?? asString(identity.state)?.toUpperCase() ?? null,
    centrality,
  };
}

async function selectTargetNpis(
  prisma: PrismaClient,
  sourceIds: InvestigatorSourceId[],
  batchSize: number,
  targetEntityIds: string[],
): Promise<string[]> {
  const targetNpis = [...new Set(targetEntityIds.filter((entityId) => /^\d{10}$/.test(entityId)))];
  if (targetNpis.length > 0) {
    return targetNpis.slice(0, batchSize);
  }

  const seen = new Set<string>();
  const sourceRecordRows = await prisma.sourceRecord.findMany({
    where: {
      sourceId: { in: sourceIds.map((sourceId) => readSourceId(sourceId)) },
    },
    orderBy: [
      { observedAt: 'asc' },
      { createdAt: 'asc' },
    ],
    select: { subjectNpi: true },
    take: batchSize * 2,
  }).catch(() => []);

  const npis: string[] = [];
  for (const row of sourceRecordRows) {
    if (seen.has(row.subjectNpi)) {
      continue;
    }
    seen.add(row.subjectNpi);
    npis.push(row.subjectNpi);
    if (npis.length >= batchSize) {
      return npis;
    }
  }

  const profiles = await prisma.personProfile.findMany({
    where: {
      npi: { not: null },
    },
    orderBy: { createdAt: 'asc' },
    select: { npi: true },
    take: batchSize * 3,
  });

  for (const profile of profiles) {
    if (!profile.npi || seen.has(profile.npi)) {
      continue;
    }
    seen.add(profile.npi);
    npis.push(profile.npi);
    if (npis.length >= batchSize) {
      break;
    }
  }

  return npis;
}

function buildEvidence(sourceId: InvestigatorSourceId, observedAt: string, label: string, metadata: Record<string, unknown>): Array<{
  sourceId: InvestigatorSourceId;
  label: string;
  snippet: string | null;
  observedAt: string;
  recordId?: string | null;
  metadata?: Record<string, unknown>;
}> {
  return [{
    sourceId,
    label,
    snippet: label,
    observedAt,
    recordId: asString(metadata.sourceRecordId) ?? asString(metadata.artifactId),
    metadata,
  }];
}

function createPipelineSignals(
  sourceId: InvestigatorSourceId,
  provider: ProviderProfile,
  deltaEvents: DeltaEvent[],
  metadata: Record<string, unknown>,
  sourceConfidence: number,
): NormalizedInvestigatorSignal[] {
  return deltaEvents.flatMap((event) => {
    const classified = classifyDelta(sourceId, event);
    if (!classified) {
      return [];
    }

    const current = asRecord(event.current);
    const previous = asRecord(event.previous);
    const anchor = readEventAnchor(event.current) ?? readEventAnchor(event.previous);

    return [{
      sourceId,
      providerId: provider.npi,
      signalType: classified.signalType,
      detectedAt: metadata.detectedAt as string,
      summary: signalSummary(event, classified.summary),
      evidence: buildEvidence(
        sourceId,
        metadata.detectedAt as string,
        `${event.type}:${event.claimType}`,
        {
          ...metadata,
          deltaType: event.type,
          claimType: event.claimType,
          previous,
          current,
        },
      ),
      sourceConfidence,
      sourceRecordId: asString(metadata.sourceRecordId),
      magnitude: classified.magnitude,
      providerLabel: provider.label,
      providerSpecialty: provider.specialty,
      providerState: provider.state,
      providerCentrality: provider.centrality,
      recencyDays: 0,
      metadata: {
        ...metadata,
        providerLabel: provider.label,
        providerSpecialty: provider.specialty,
        providerState: provider.state,
        detectedFrom: event.type,
        claimType: event.claimType,
        previous,
        current,
      },
      eventAnchor: anchor
        ? {
            type: anchor.type as 'doi' | 'trial' | 'grant' | 'payment' | 'publication' | 'npdb' | 'generic',
            id: anchor.id,
            label: anchor.label,
          }
        : null,
      trendAnchor: classified.signalType === 'payment' && provider.specialty
        ? {
            id: `${provider.specialty.toLowerCase()}:payments`,
            label: `${provider.specialty} payment trend`,
          }
        : null,
    }];
  });
}

async function executePipelineSource(
  prisma: PrismaClient,
  sourceId: InvestigatorSourceId,
  provider: ProviderProfile,
  nowIso: string,
): Promise<SourceExecutionResult> {
  if (process.env.NODE_ENV === 'test') {
    return { sourceId, signals: [] };
  }

  const pipelineSource = PIPELINE_SOURCE_MAP[sourceId];
  if (!pipelineSource) {
    return { sourceId, signals: [] };
  }

  const report = await ingestClinicianIdentity(provider.npi, [pipelineSource as never]);
  const result = report.results.find((entry) => entry.source === pipelineSource);
  if (!result || result.status === 'FAILED') {
    return { sourceId, signals: [] };
  }

  return {
    sourceId,
    signals: createPipelineSignals(
      sourceId,
      provider,
      result.deltaEvents,
      {
        detectedAt: nowIso,
        artifactId: result.artifactId,
        sourceRunId: result.sourceRunId,
        sourceRecordId: result.sourceRecordId,
      },
      sourceDefinitionFor(sourceId).defaultConfidence,
    ),
  };
}

async function loadLatestManualSnapshots(
  prisma: PrismaClient,
  sourceId: InvestigatorSourceId,
  npi: string,
): Promise<Array<{ id: string; metadata: Record<string, unknown>; createdAt: string }>> {
  const rows = await prisma.sourceRecord.findMany({
    where: {
      sourceId: readSourceId(sourceId),
      subjectNpi: npi,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      metadata: true,
      createdAt: true,
    },
    take: 2,
  }).catch(() => []);

  return rows.map((row) => ({
    id: row.id,
    metadata: asRecord(row.metadata),
    createdAt: row.createdAt.toISOString(),
  }));
}

async function persistManualSnapshot(
  prisma: PrismaClient,
  sourceId: InvestigatorSourceId,
  npi: string,
  observedAt: string,
  matchingStrategy: string,
  snapshot: ManualSourceSnapshot,
): Promise<{ sourceRunId: string; sourceRecordId: string | null }> {
  const sourceRun = await prisma.sourceRun.create({
    data: {
      sourceId: readSourceId(sourceId),
      subjectNpi: npi,
      idempotencyKey: stableHash({
        sourceId,
        npi,
        observedAt,
        checksum: stableHash(snapshot.snapshot),
      }),
      status: 'FETCHED',
      startedAt: new Date(observedAt),
      completedAt: new Date(observedAt),
      runSummary: {
        externalSnapshot: true,
        sourceUrl: snapshot.sourceUrl,
      },
    },
    select: { id: true },
  });

  const persisted = await persistSourceRecord({
    sourceRunId: sourceRun.id,
    sourceId: readSourceId(sourceId),
    subjectNpi: npi,
    sourceRecordKey: npi,
    sourceUrl: snapshot.sourceUrl,
    checksum: stableHash(snapshot.snapshot),
    fetchedAt: observedAt,
    observedAt,
    parserVersion: 'v1.0.0',
    matchingStrategy,
    status: 'FETCHED',
    metadata: {
      sourceUrl: snapshot.sourceUrl,
      snapshot: snapshot.snapshot,
    },
  }).catch(() => ({ id: null, created: false }));

  await prisma.sourceRun.update({
    where: { id: sourceRun.id },
    data: {
      status: 'VERIFIED',
      runSummary: {
        externalSnapshot: true,
        sourceUrl: snapshot.sourceUrl,
        sourceRecordId: persisted.id,
      },
    },
  }).catch(() => null);

  return {
    sourceRunId: sourceRun.id,
    sourceRecordId: persisted.id,
  };
}

function semanticScholarSnapshotSourceUrl(firstName: string, lastName: string): string {
  const query = encodeURIComponent(`${firstName} ${lastName}`);
  return `https://api.semanticscholar.org/graph/v1/author/search?query=${query}&limit=3&fields=authorId,name,paperCount,citationCount,hIndex,affiliations,papers.title,papers.year,papers.externalIds`;
}

async function fetchSemanticScholarSnapshot(
  provider: ProviderProfile,
): Promise<ManualSourceSnapshot | null> {
  if (!provider.firstName || !provider.lastName || process.env.NODE_ENV === 'test') {
    return null;
  }

  const sourceUrl = semanticScholarSnapshotSourceUrl(provider.firstName, provider.lastName);
  const response = await fetch(sourceUrl, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'VitalCV-Investigator/1.0',
    },
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload) {
    return null;
  }

  const top = Array.isArray(payload.data) ? asRecord(payload.data[0]) : {};
  const papers = Array.isArray(top.papers)
    ? top.papers
      .map((paper) => asRecord(paper))
      .slice(0, 5)
      .map((paper) => ({
        title: asString(paper.title),
        year: asNumber(paper.year),
        doi: asString(asRecord(paper.externalIds).DOI),
      }))
    : [];

  return {
    sourceUrl,
    snapshot: {
      authorId: asString(top.authorId),
      paperCount: asNumber(top.paperCount) ?? 0,
      citationCount: asNumber(top.citationCount) ?? 0,
      hIndex: asNumber(top.hIndex) ?? 0,
      papers,
    },
  };
}

function createSemanticScholarSignals(
  provider: ProviderProfile,
  observedAt: string,
  sourceRecordId: string | null,
  previousSnapshot: Record<string, unknown> | null,
  currentSnapshot: Record<string, unknown>,
): NormalizedInvestigatorSignal[] {
  const previousPapers = new Set(
    (Array.isArray(previousSnapshot?.papers) ? previousSnapshot?.papers : [])
      .map((paper) => asString(asRecord(paper).doi) ?? asString(asRecord(paper).title))
      .filter((value): value is string => Boolean(value)),
  );
  const currentPapers = Array.isArray(currentSnapshot.papers)
    ? currentSnapshot.papers.map((paper) => asRecord(paper))
    : [];
  const signals: NormalizedInvestigatorSignal[] = [];

  for (const paper of currentPapers) {
    const anchorId = asString(paper.doi) ?? asString(paper.title);
    if (!anchorId || previousPapers.has(anchorId)) {
      continue;
    }

    signals.push({
      sourceId: 'SEMANTIC_SCHOLAR',
      providerId: provider.npi,
      signalType: 'publication',
      detectedAt: observedAt,
      summary: `Semantic Scholar linked a new scholarly work to ${provider.label}.`,
      evidence: buildEvidence('SEMANTIC_SCHOLAR', observedAt, 'semantic_scholar:publication', {
        sourceRecordId,
        paper,
      }),
      sourceConfidence: 0.62,
      sourceRecordId,
      magnitude: 0.6,
      providerLabel: provider.label,
      providerSpecialty: provider.specialty,
      providerState: provider.state,
      providerCentrality: provider.centrality,
      recencyDays: 0,
      metadata: {
        providerLabel: provider.label,
        providerSpecialty: provider.specialty,
        providerState: provider.state,
        sourceRecordId,
      },
      eventAnchor: {
        type: 'doi',
        id: anchorId,
        label: asString(paper.title) ?? anchorId,
      },
      trendAnchor: {
        id: `${provider.npi}:research`,
        label: `${provider.label} research expansion`,
      },
    });
  }

  if (signals.length > 0) {
    return signals;
  }

  const previousPaperCount = asNumber(previousSnapshot?.paperCount) ?? 0;
  const currentPaperCount = asNumber(currentSnapshot.paperCount) ?? 0;
  const previousCitations = asNumber(previousSnapshot?.citationCount) ?? 0;
  const currentCitations = asNumber(currentSnapshot.citationCount) ?? 0;

  if (currentPaperCount !== previousPaperCount || currentCitations !== previousCitations) {
    return [{
      sourceId: 'SEMANTIC_SCHOLAR',
      providerId: provider.npi,
      signalType: 'publication',
      detectedAt: observedAt,
      summary: `Semantic Scholar author metrics changed for ${provider.label}.`,
      evidence: buildEvidence('SEMANTIC_SCHOLAR', observedAt, 'semantic_scholar:author_metrics', {
        sourceRecordId,
        previousPaperCount,
        currentPaperCount,
        previousCitations,
        currentCitations,
      }),
      sourceConfidence: 0.62,
      sourceRecordId,
      magnitude: clamp01(
        Math.max(
          Math.abs(currentPaperCount - previousPaperCount) / Math.max(previousPaperCount || 1, 1),
          Math.abs(currentCitations - previousCitations) / Math.max(previousCitations || 1, 1),
        ),
        0.45,
      ),
      providerLabel: provider.label,
      providerSpecialty: provider.specialty,
      providerState: provider.state,
      providerCentrality: provider.centrality,
      recencyDays: 0,
      metadata: {
        providerLabel: provider.label,
        providerSpecialty: provider.specialty,
        providerState: provider.state,
        sourceRecordId,
      },
      trendAnchor: {
        id: `${provider.npi}:research`,
        label: `${provider.label} research expansion`,
      },
    }];
  }

  return [];
}

async function executeSemanticScholarSource(
  prisma: PrismaClient,
  provider: ProviderProfile,
  nowIso: string,
): Promise<SourceExecutionResult> {
  const previous = await loadLatestManualSnapshots(prisma, 'SEMANTIC_SCHOLAR', provider.npi);
  const snapshot = await fetchSemanticScholarSnapshot(provider);
  if (!snapshot) {
    return { sourceId: 'SEMANTIC_SCHOLAR', signals: [] };
  }

  const persisted = await persistManualSnapshot(
    prisma,
    'SEMANTIC_SCHOLAR',
    provider.npi,
    nowIso,
    'NAME_FUZZY',
    snapshot,
  );

  return {
    sourceId: 'SEMANTIC_SCHOLAR',
    signals: createSemanticScholarSignals(
      provider,
      nowIso,
      persisted.sourceRecordId,
      asRecord(previous[0]?.metadata.snapshot),
      snapshot.snapshot,
    ),
  };
}

async function fetchNihReporterSnapshot(provider: ProviderProfile): Promise<ManualSourceSnapshot | null> {
  if (!provider.firstName || !provider.lastName || process.env.NIH_REPORTER_ENABLED !== 'true') {
    return null;
  }

  const sourceUrl = 'https://api.reporter.nih.gov/v2/projects/search';
  const response = await fetch(sourceUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'VitalCV-Investigator/1.0',
    },
    body: JSON.stringify({
      criteria: {
        pi_names: [{
          first_name: provider.firstName,
          last_name: provider.lastName,
        }],
      },
      include_fields: [
        'ApplId',
        'ProjectTitle',
        'CoreProjectNum',
        'ContactPiName',
        'Organization',
        'AwardAmount',
        'FiscalYear',
      ],
      limit: 5,
      offset: 0,
    }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload) {
    return null;
  }

  const grants = Array.isArray(payload.results)
    ? payload.results.map((item) => asRecord(item)).slice(0, 5).map((item) => ({
      awardId: asString(item.ApplId) ?? asString(item.appl_id) ?? asString(item.CoreProjectNum),
      title: asString(item.ProjectTitle) ?? asString(item.project_title),
      awardAmount: asNumber(item.AwardAmount) ?? asNumber(item.award_amount) ?? 0,
      fiscalYear: asNumber(item.FiscalYear) ?? asNumber(item.fiscal_year),
      organization: asString(item.Organization) ?? asString(asRecord(item.organization).org_name),
    }))
    : [];

  return {
    sourceUrl,
    snapshot: {
      grants,
    },
  };
}

function createNihReporterSignals(
  provider: ProviderProfile,
  observedAt: string,
  sourceRecordId: string | null,
  previousSnapshot: Record<string, unknown> | null,
  currentSnapshot: Record<string, unknown>,
): NormalizedInvestigatorSignal[] {
  const previousAwards = new Set(
    (Array.isArray(previousSnapshot?.grants) ? previousSnapshot?.grants : [])
      .map((grant) => asString(asRecord(grant).awardId))
      .filter((value): value is string => Boolean(value)),
  );

  const grants = Array.isArray(currentSnapshot.grants)
    ? currentSnapshot.grants.map((grant) => asRecord(grant))
    : [];

  return grants.flatMap((grant) => {
    const awardId = asString(grant.awardId);
    if (!awardId || previousAwards.has(awardId)) {
      return [];
    }

    return [{
      sourceId: 'NIH_REPORTER',
      providerId: provider.npi,
      signalType: 'grant',
      detectedAt: observedAt,
      summary: `NIH RePORTER linked a new grant to ${provider.label}.`,
      evidence: buildEvidence('NIH_REPORTER', observedAt, 'nih_reporter:grant', {
        sourceRecordId,
        grant,
      }),
      sourceConfidence: 0.82,
      sourceRecordId,
      magnitude: clamp01((asNumber(grant.awardAmount) ?? 0) / 5_000_000, 0.7),
      providerLabel: provider.label,
      providerSpecialty: provider.specialty,
      providerState: provider.state,
      providerCentrality: provider.centrality,
      recencyDays: 0,
      metadata: {
        providerLabel: provider.label,
        providerSpecialty: provider.specialty,
        providerState: provider.state,
        sourceRecordId,
      },
      eventAnchor: {
        type: 'grant',
        id: awardId,
        label: asString(grant.title) ?? awardId,
      },
      trendAnchor: {
        id: `${provider.npi}:grant-portfolio`,
        label: `${provider.label} research expansion`,
      },
    }];
  });
}

async function executeNihReporterSource(
  prisma: PrismaClient,
  provider: ProviderProfile,
  nowIso: string,
): Promise<SourceExecutionResult> {
  const previous = await loadLatestManualSnapshots(prisma, 'NIH_REPORTER', provider.npi);
  const snapshot = await fetchNihReporterSnapshot(provider);
  if (!snapshot) {
    return { sourceId: 'NIH_REPORTER', signals: [] };
  }

  const persisted = await persistManualSnapshot(
    prisma,
    'NIH_REPORTER',
    provider.npi,
    nowIso,
    'NAME_FUZZY',
    snapshot,
  );

  return {
    sourceId: 'NIH_REPORTER',
    signals: createNihReporterSignals(
      provider,
      nowIso,
      persisted.sourceRecordId,
      asRecord(previous[0]?.metadata.snapshot),
      snapshot.snapshot,
    ),
  };
}

async function executeNpdbSource(
  prisma: PrismaClient,
  provider: ProviderProfile,
  nowIso: string,
): Promise<SourceExecutionResult> {
  const previous = await loadLatestManualSnapshots(prisma, 'NPDB', provider.npi);
  const result = await queryNPDB(provider.npi);
  const snapshot: ManualSourceSnapshot = {
    sourceUrl: result.sourceUrl,
    snapshot: {
      status: result.status,
      adverseActionCount: result.adverseActionCount,
      malpracticePayments: result.malpracticePayments,
      licenseActions: result.licenseActions,
    },
  };
  const persisted = await persistManualSnapshot(
    prisma,
    'NPDB',
    provider.npi,
    nowIso,
    'NPI_EXACT',
    snapshot,
  );

  const previousSnapshot = asRecord(previous[0]?.metadata.snapshot);
  if (result.status !== 'FLAGGED' && asString(previousSnapshot.status) !== 'FLAGGED') {
    return { sourceId: 'NPDB', signals: [] };
  }

  const countDelta = (
    (result.adverseActionCount - (asNumber(previousSnapshot.adverseActionCount) ?? 0))
    + (result.licenseActions - (asNumber(previousSnapshot.licenseActions) ?? 0))
    + (result.malpracticePayments - (asNumber(previousSnapshot.malpracticePayments) ?? 0))
  );

  if (countDelta <= 0 && asString(previousSnapshot.status) === result.status) {
    return { sourceId: 'NPDB', signals: [] };
  }

  return {
    sourceId: 'NPDB',
    signals: [{
      sourceId: 'NPDB',
      providerId: provider.npi,
      signalType: 'credential',
      detectedAt: nowIso,
      summary: `NPDB status changed for ${provider.label}.`,
      evidence: buildEvidence('NPDB', nowIso, 'npdb:status', {
        sourceRecordId: persisted.sourceRecordId,
        status: result.status,
        adverseActionCount: result.adverseActionCount,
        malpracticePayments: result.malpracticePayments,
        licenseActions: result.licenseActions,
      }),
      sourceConfidence: 0.88,
      sourceRecordId: persisted.sourceRecordId,
      magnitude: clamp01(Math.max(countDelta, 1) / 4, 0.78),
      providerLabel: provider.label,
      providerSpecialty: provider.specialty,
      providerState: provider.state,
      providerCentrality: provider.centrality,
      recencyDays: 0,
      metadata: {
        providerLabel: provider.label,
        providerSpecialty: provider.specialty,
        providerState: provider.state,
        sourceRecordId: persisted.sourceRecordId,
      },
      eventAnchor: {
        type: 'npdb',
        id: `${provider.npi}:${result.status}:${result.adverseActionCount}`,
        label: `NPDB ${result.status}`,
      },
    }],
  };
}

async function buildMonthlyDiffSignals(
  prisma: PrismaClient,
  nowIso: string,
): Promise<SourceExecutionResult> {
  const now = Date.parse(nowIso);
  const recentCutoff = new Date(now - (30 * 24 * 60 * 60 * 1000));
  const priorCutoff = new Date(now - (60 * 24 * 60 * 60 * 1000));
  const rows = await prisma.investigatorFinding.findMany({
    where: {
      investigatorId: {
        in: AUTONOMOUS_INVESTIGATOR_SPECS
          .map((spec) => spec.id)
          .filter((id) => !id.endsWith('monthly_diff')),
      },
      findingType: {
        in: ['payment', 'publication', 'grant', 'trial', 'network'],
      },
      createdAt: { gte: priorCutoff },
    },
    select: {
      findingType: true,
      createdAt: true,
      entityIds: true,
      metadata: true,
    },
    take: 400,
  });

  type Grouped = {
    findingType: string;
    specialty: string;
    recent: number;
    previous: number;
    leaderProviderId: string | null;
    leaderProviderLabel: string | null;
    leaderCentrality: number;
  };

  const grouped = new Map<string, Grouped>();
  for (const row of rows) {
    const metadata = asRecord(row.metadata);
    const specialty = asString(metadata.providerSpecialty) ?? 'unknown';
    const providerId = row.entityIds.find((entityId) => /^\d{10}$/.test(entityId)) ?? asString(metadata.providerId);
    const key = `${row.findingType}:${specialty.toLowerCase()}`;
    const current = grouped.get(key) ?? {
      findingType: row.findingType,
      specialty,
      recent: 0,
      previous: 0,
      leaderProviderId: providerId,
      leaderProviderLabel: asString(metadata.providerLabel),
      leaderCentrality: asNumber(metadata.providerCentrality) ?? 0,
    };
    if (row.createdAt >= recentCutoff) {
      current.recent += 1;
    } else {
      current.previous += 1;
    }
    const centrality = asNumber(metadata.providerCentrality) ?? 0;
    if (centrality > current.leaderCentrality && providerId) {
      current.leaderProviderId = providerId;
      current.leaderProviderLabel = asString(metadata.providerLabel);
      current.leaderCentrality = centrality;
    }
    grouped.set(key, current);
  }

  const signals: NormalizedInvestigatorSignal[] = [];
  for (const entry of grouped.values()) {
    if (entry.recent < 3 || entry.recent <= entry.previous) {
      continue;
    }

    if (!entry.leaderProviderId) {
      continue;
    }

    signals.push({
      sourceId: 'MONTHLY_DIFF',
      providerId: entry.leaderProviderId,
      signalType: FINDING_SIGNAL_TYPES.has(entry.findingType) ? entry.findingType as NormalizedInvestigatorSignal['signalType'] : 'network',
      detectedAt: nowIso,
      summary: `${entry.specialty} ${entry.findingType} signals rose from ${entry.previous} to ${entry.recent} in the last 30 days.`,
      evidence: buildEvidence('MONTHLY_DIFF', nowIso, 'monthly_diff:trend', {
        specialty: entry.specialty,
        findingType: entry.findingType,
        recent: entry.recent,
        previous: entry.previous,
      }),
      sourceConfidence: 0.72,
      magnitude: clamp01((entry.recent - entry.previous) / Math.max(entry.previous || 1, 1), 0.76),
      providerLabel: entry.leaderProviderLabel ?? entry.leaderProviderId,
      providerSpecialty: entry.specialty,
      providerCentrality: entry.leaderCentrality,
      recencyDays: 0,
      trendAnchor: {
        id: `${entry.specialty.toLowerCase()}:${entry.findingType}:monthly`,
        label: `${entry.findingType} rising in ${entry.specialty}`,
        cohortSize: entry.recent,
      },
      metadata: {
        providerLabel: entry.leaderProviderLabel ?? entry.leaderProviderId,
        providerSpecialty: entry.specialty,
        trendAnchorLabel: `${entry.findingType} rising in ${entry.specialty}`,
      },
    });
  }

  return {
    sourceId: 'MONTHLY_DIFF',
    signals,
  };
}

function withPeerRates(signals: NormalizedInvestigatorSignal[]): NormalizedInvestigatorSignal[] {
  const byCohort = new Map<string, number>();
  for (const signal of signals) {
    const cohort = `${signal.signalType}:${signal.providerSpecialty ?? 'unknown'}`;
    byCohort.set(cohort, (byCohort.get(cohort) ?? 0) + 1);
  }

  return signals.map((signal) => ({
    ...signal,
    peerOccurrenceRate: clamp01(
      (byCohort.get(`${signal.signalType}:${signal.providerSpecialty ?? 'unknown'}`) ?? 1) / Math.max(signals.length, 1),
      0.12,
    ),
  }));
}

function withCorroboration(signals: NormalizedInvestigatorSignal[]): NormalizedInvestigatorSignal[] {
  const anchors = new Map<string, Set<InvestigatorSourceId>>();
  for (const signal of signals) {
    const key = signal.eventAnchor?.id
      ? `${signal.providerId}:${signal.signalType}:${signal.eventAnchor.id}`
      : signal.trendAnchor?.id
        ? `trend:${signal.trendAnchor.id}`
        : `${signal.providerId}:${signal.signalType}`;
    const current = anchors.get(key) ?? new Set<InvestigatorSourceId>();
    current.add(signal.sourceId);
    anchors.set(key, current);
  }

  return signals.map((signal) => {
    const key = signal.eventAnchor?.id
      ? `${signal.providerId}:${signal.signalType}:${signal.eventAnchor.id}`
      : signal.trendAnchor?.id
        ? `trend:${signal.trendAnchor.id}`
        : `${signal.providerId}:${signal.signalType}`;
    const corroboration = [...(anchors.get(key) ?? new Set<InvestigatorSourceId>())]
      .filter((sourceId) => sourceId !== signal.sourceId);

    return {
      ...signal,
      corroborationSourceIds: corroboration,
    };
  });
}

function evidenceToFindingEvidence(signal: NormalizedInvestigatorSignal): InvestigatorFindingDraft['supportingEvidence'] {
  return signal.evidence.map((evidence, index) => ({
    evidenceId: `${signal.sourceId}_${index}_${stableHash({
      providerId: signal.providerId,
      label: evidence.label,
      observedAt: evidence.observedAt,
    }).slice(0, 12)}`,
    evidenceType: 'source_record',
    sourceId: readSourceId(evidence.sourceId),
    sourceLabel: sourceDefinitionFor(evidence.sourceId).label,
    recordType: 'source_record',
    recordId: evidence.recordId ?? null,
    url: evidence.url ?? null,
    snippet: evidence.snippet,
    observedAt: evidence.observedAt,
    metadata: evidence.metadata ?? {},
  }));
}

function audienceRolesForSignal(signalType: NormalizedInvestigatorSignal['signalType']): InvestigatorAudienceRole[] {
  switch (signalType) {
    case 'exclusion':
    case 'credential':
      return ['compliance', 'credentialing'];
    case 'grant':
    case 'publication':
    case 'trial':
      return ['research', 'executive'];
    case 'payment':
      return ['compliance', 'executive'];
    case 'network':
    case 'practice':
    default:
      return ['operations', 'recruiting'];
  }
}

function findingDraftsFromSignals(
  investigatorId: string,
  signals: NormalizedInvestigatorSignal[],
  existingStorylineKeys: string[],
): InvestigatorFindingDraft[] {
  const { findings } = buildInvestigatorOutputs({
    signals: withCorroboration(withPeerRates(signals)),
    existingStorylineKeys,
  });

  return findings.map((finding) => ({
    investigatorId,
    findingType: finding.signalType,
    severity: finding.severity,
    title: finding.title,
    summary: finding.summary,
    entityIds: [finding.providerId],
    entities: [{
      entityType: 'provider',
      entityId: finding.providerId,
      entityLabel: asString(finding.metadata.providerLabel) ?? finding.providerId,
      relationship: 'subject',
      metadata: {
        specialty: asString(finding.metadata.providerSpecialty),
        state: asString(finding.metadata.providerState),
      },
    }],
    supportingEvidence: evidenceToFindingEvidence({
      ...signals.find((signal) => signal.providerId === finding.providerId && signal.summary === finding.summary) ?? signals[0]!,
      evidence: finding.evidence,
    }),
    confidence: finding.confidence,
    explanation: finding.explanation,
    audienceRoles: audienceRolesForSignal(finding.signalType),
    scoreSignals: {
      trustImpact: clamp01(finding.priority.normalizedScore, 0.6),
      freshness: clamp01(finding.novelty.breakdown.recency, 0.72),
      novelty: clamp01(finding.novelty.normalizedScore, 0.7),
      entityImportance: clamp01(
        Math.max(
          asNumber(asRecord(finding.metadata.investigationPriorityBreakdown).corroboration) ?? 0,
          finding.novelty.breakdown.rarityAmongPeers,
        ),
        0.55,
      ),
      graphCentrality: clamp01(asNumber(finding.metadata.providerCentrality), 0.22),
    },
    metadata: {
      ...finding.metadata,
      providerId: finding.providerId,
      providerIds: [finding.providerId],
      sourceEngine: 'investigator-engine',
      investigationPriorityScore: finding.priority.score,
      investigationPriorityBreakdown: finding.priority.breakdown,
      storylineNarrativeHeadline: finding.metadata.storylineTitle ?? finding.title,
    },
    dedupeKey: finding.dedupeKey,
    storylineKey: finding.storylineKey,
  }));
}

async function loadExistingStorylineKeys(
  prisma: PrismaClient,
  investigatorId: string,
): Promise<string[]> {
  const rows = await prisma.investigatorFinding.findMany({
    where: {
      investigatorId,
      status: { in: [...ACTIVE_FINDING_STATUSES] },
    },
    select: { storylineKey: true },
    take: 500,
  });

  return rows.map((row) => row.storylineKey);
}

async function executeSource(
  prisma: PrismaClient,
  sourceId: InvestigatorSourceId,
  provider: ProviderProfile,
  nowIso: string,
): Promise<SourceExecutionResult> {
  if (process.env.NODE_ENV === 'test') {
    return { sourceId, signals: [] };
  }

  if (sourceId === 'SEMANTIC_SCHOLAR') {
    return executeSemanticScholarSource(prisma, provider, nowIso);
  }

  if (sourceId === 'NIH_REPORTER') {
    return executeNihReporterSource(prisma, provider, nowIso);
  }

  if (sourceId === 'NPDB') {
    return executeNpdbSource(prisma, provider, nowIso);
  }

  if (sourceId === 'MONTHLY_DIFF') {
    return buildMonthlyDiffSignals(prisma, nowIso);
  }

  return executePipelineSource(prisma, sourceId, provider, nowIso);
}

export async function buildAutonomousInvestigatorFindings(input: {
  investigatorId: string;
  prisma: PrismaClient;
  sources: InvestigatorSourceId[];
  targetEntityIds: string[];
  batchSize: number;
  now: string;
  markEntityCovered: (entityId: string) => void;
}): Promise<InvestigatorFindingDraft[]> {
  if (process.env.NODE_ENV === 'test') {
    return [];
  }

  const npis = await selectTargetNpis(input.prisma, input.sources, input.batchSize, input.targetEntityIds);
  const existingStorylineKeys = await loadExistingStorylineKeys(input.prisma, input.investigatorId);
  const allSignals: NormalizedInvestigatorSignal[] = [];

  if (input.sources.length === 1 && input.sources[0] === 'MONTHLY_DIFF') {
    const monthly = await buildMonthlyDiffSignals(input.prisma, input.now);
    allSignals.push(...monthly.signals);
  } else {
    for (const npi of npis) {
      input.markEntityCovered(npi);
      const provider = await loadProviderProfile(input.prisma, npi);
      for (const sourceId of input.sources) {
        const result = await executeSource(input.prisma, sourceId, provider, input.now);
        allSignals.push(...result.signals);
      }
    }
  }

  return findingDraftsFromSignals(input.investigatorId, allSignals, existingStorylineKeys);
}

export function buildAutonomousInvestigatorDefinitions(): InvestigatorDefinition<BackendDependencies>[] {
  return AUTONOMOUS_INVESTIGATOR_SPECS.map((spec) => ({
    id: spec.id,
    name: `${spec.cadence[0]!.toUpperCase()}${spec.cadence.slice(1)} Autonomous Investigator`,
    description: spec.description,
    scope: 'provider',
    enabled: true,
    audienceRoles: spec.audienceRoles,
    schedule: {
      cadenceMinutes: {
        daily: 1_440,
        weekly: 10_080,
        monthly: 43_200,
        quarterly: 129_600,
        annual: 525_600,
      }[spec.cadence],
      batchSize: spec.batchSize,
      suppressionWindowMinutes: 10_080,
      storylineWindowMinutes: 43_200,
      triggers: ['scheduled', 'targeted', 'manual', 'event_ingestion'],
    },
    async run(context) {
      return buildAutonomousInvestigatorFindings({
        investigatorId: spec.id,
        prisma: context.dependencies.prisma,
        sources: spec.sources,
        targetEntityIds: context.targetEntityIds,
        batchSize: spec.batchSize,
        now: context.now,
        markEntityCovered: context.markEntityCovered,
      });
    },
  }));
}

export async function getAutonomousInvestigatorStatus(prisma: PrismaClient): Promise<{
  jobs: Array<ScheduleJobDefinition & {
    investigatorId: string | null;
    lastRunAt: string | null;
    nextRunAt: string | null;
    findingsGenerated: number;
  }>;
  sources: Array<{
    sourceId: InvestigatorSourceId;
    label: string;
    lastSeenAt: string | null;
    recordCount: number;
  }>;
}> {
  const jobDefinitions = defaultScheduleJobs();
  const lastRunRows = await prisma.investigatorRunLog.findMany({
    where: {
      investigatorId: {
        in: AUTONOMOUS_INVESTIGATOR_SPECS.map((spec) => spec.id),
      },
    },
    orderBy: { startedAt: 'desc' },
    select: {
      investigatorId: true,
      startedAt: true,
      findingsGenerated: true,
    },
    take: 50,
  });

  const latestByInvestigator = new Map<string, { lastRunAt: string; findingsGenerated: number }>();
  for (const row of lastRunRows) {
    if (!latestByInvestigator.has(row.investigatorId)) {
      latestByInvestigator.set(row.investigatorId, {
        lastRunAt: row.startedAt.toISOString(),
        findingsGenerated: row.findingsGenerated,
      });
    }
  }

  const sourceStats = await Promise.all(
    [...new Set(jobDefinitions.flatMap((job) => job.sources))]
      .filter((sourceId) => sourceId !== 'MONTHLY_DIFF')
      .map(async (sourceId) => {
        const rows = await prisma.sourceRecord.findMany({
          where: { sourceId: readSourceId(sourceId) },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
          take: 1,
        }).catch(() => []);
        const count = await prisma.sourceRecord.count({
          where: { sourceId: readSourceId(sourceId) },
        }).catch(() => 0);
        return {
          sourceId,
          label: sourceDefinitionFor(sourceId).label,
          lastSeenAt: rows[0]?.createdAt.toISOString() ?? null,
          recordCount: count,
        };
      }),
  );

  const jobs = jobDefinitions.map((job) => {
    const investigator = AUTONOMOUS_INVESTIGATOR_SPECS.find((spec) => spec.cadence === job.cadence && spec.sources.join(',') === job.sources.join(','));
    const latest = investigator ? latestByInvestigator.get(investigator.id) : undefined;
    return {
      ...job,
      investigatorId: investigator?.id ?? null,
      lastRunAt: latest?.lastRunAt ?? null,
      nextRunAt: nextRunAt(job.cadence, latest?.lastRunAt ?? null),
      findingsGenerated: latest?.findingsGenerated ?? 0,
    };
  });

  return { jobs, sources: sourceStats };
}
