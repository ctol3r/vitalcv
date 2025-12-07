import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const MONTH_IN_MS = 30 * 24 * 60 * 60 * 1000;

export type ProcedureRole = 'primary' | 'assist' | 'supervisory';

export interface EmploymentProcedureRecord {
  procedure: string;
  count?: number;
  primaryCount?: number;
  assistCount?: number;
  role?: ProcedureRole;
  periodStart?: string | null;
  periodEnd?: string | null;
  dataQuality?: 'tefca' | 'hl7' | 'manual';
  notes?: string;
}

export interface EmploymentCredentialRecord {
  credentialId: string;
  clinicianId: string;
  organization: string;
  roleTitle?: string;
  startDate?: string | null;
  endDate?: string | null;
  trustFrameworks?: string[];
  procedures?: EmploymentProcedureRecord[];
}

export interface SelfReportedProcedureLog {
  id: string;
  procedure: string;
  count: number;
  occurredOn: string;
  location?: string;
  verified?: boolean;
  notes?: string;
}

export interface ProcedureVolumeRequirement {
  procedure: string;
  minCount: number;
  lookbackMonths?: number;
  weight?: number;
  description?: string;
}

export interface ProcedureVolumeExtractorInput {
  clinicianId: string;
  employmentCredentials: EmploymentCredentialRecord[];
  selfReportedLogs?: SelfReportedProcedureLog[];
  requirements?: ProcedureVolumeRequirement[];
  lookbackMonths?: number;
  persist?: boolean;
}

export interface VolumeSourceSummary {
  procedure: string;
  sourceType: 'employment-vc' | 'self-report';
  sourceId: string;
  organization?: string;
  role?: string;
  count: number;
  confidence: number;
  tefcaAligned: boolean;
  periodStart: string;
  periodEnd: string;
}

export interface RequirementResult {
  procedure: string;
  minCount: number;
  observed: number;
  lookbackMonths: number;
  met: boolean;
  deficit: number;
  weight: number;
  description?: string;
}

export interface ProcedureVolumeAggregate {
  procedure: string;
  totalCount: number;
  primaryCount: number;
  assistCount: number;
  tefcaAlignedCount: number;
  mostRecentCase?: string;
  rollingTrend: Array<{ periodStart: string; periodEnd: string; count: number }>;
  sources: VolumeSourceSummary[];
  requirement?: RequirementResult;
}

export interface ProcedureVolumeSummary {
  clinicianId: string;
  windowStart: string;
  windowEnd: string;
  lookbackMonths: number;
  totalProcedures: number;
  volumeScore: number;
  tefcaCoverage: number;
  procedures: ProcedureVolumeAggregate[];
  requirementResults: RequirementResult[];
  missingProcedures: string[];
  recommendation: string;
  metadata: {
    sourcesEvaluated: number;
    employmentCredentials: number;
    selfReportedLogs: number;
  };
}

interface VolumeEvent {
  procedure: string;
  primaryCount: number;
  assistCount: number;
  totalCount: number;
  sourceType: VolumeSourceSummary['sourceType'];
  sourceId: string;
  organization?: string;
  role?: string;
  periodStart: Date;
  periodEnd: Date;
  confidence: number;
  tefcaAligned: boolean;
}

export async function extractProcedureVolumes(
  input: ProcedureVolumeExtractorInput,
): Promise<ProcedureVolumeSummary> {
  const now = new Date();
  const requirementLookbacks = input.requirements?.map((req) => req.lookbackMonths ?? 24) ?? [];
  const requestedLookback = input.lookbackMonths ?? 24;
  const maxLookback = Math.max(requestedLookback, requirementLookbacks.length ? Math.max(...requirementLookbacks) : requestedLookback);
  const windowStartDate = new Date(now.getTime() - monthsToMs(maxLookback));

  const events = normalizeEvents(input.employmentCredentials, input.selfReportedLogs ?? [], windowStartDate, now);
  const eventsInWindow = events.filter((event) => event.periodEnd >= windowStartDate);

  const aggregates = buildAggregates(eventsInWindow, windowStartDate, now);
  const totalProcedures = aggregates.reduce((sum, aggregate) => sum + aggregate.totalCount, 0);
  const requirements = normalizeRequirements(aggregates, input.requirements, maxLookback);
  const requirementResults = evaluateRequirements(requirements, aggregates, now);
  const enrichedAggregates = attachRequirements(aggregates, requirementResults);

  const totalWeight = requirementResults.reduce((sum, record) => sum + record.weight, 0) || 1;
  const satisfied = requirementResults.reduce((sum, record) => {
    const ratio = record.minCount === 0 ? 1 : Math.min(1, record.observed / record.minCount);
    return sum + ratio * record.weight;
  }, 0);
  const volumeScore = Number((satisfied / totalWeight).toFixed(3));

  const tefcaAligned = aggregates.reduce((sum, aggregate) => sum + aggregate.tefcaAlignedCount, 0);
  const tefcaCoverage = totalProcedures === 0 ? 0 : Number((tefcaAligned / totalProcedures).toFixed(3));

  const missingProcedures = requirementResults
    .filter((record) => !record.met)
    .map((record) => record.description ?? `Need ${record.minCount} ${record.procedure} cases within ${record.lookbackMonths} months (observed ${record.observed})`);

  const summary: ProcedureVolumeSummary = {
    clinicianId: input.clinicianId,
    windowStart: windowStartDate.toISOString(),
    windowEnd: now.toISOString(),
    lookbackMonths: maxLookback,
    totalProcedures,
    volumeScore,
    tefcaCoverage,
    procedures: enrichedAggregates,
    requirementResults,
    missingProcedures,
    recommendation: buildRecommendation(volumeScore, missingProcedures.length),
    metadata: {
      sourcesEvaluated: eventsInWindow.length,
      employmentCredentials: input.employmentCredentials.length,
      selfReportedLogs: input.selfReportedLogs?.length ?? 0,
    },
  };

  if (input.persist !== false) {
    await persistAggregates(input.clinicianId, windowStartDate, now, enrichedAggregates);
  }

  return summary;
}

function normalizeEvents(
  credentials: EmploymentCredentialRecord[],
  logs: SelfReportedProcedureLog[],
  windowStart: Date,
  windowEnd: Date,
): VolumeEvent[] {
  const events: VolumeEvent[] = [];

  for (const credential of credentials) {
    const tefcaAligned = Boolean(
      credential.trustFrameworks?.some((framework) => framework.toLowerCase().includes('tefca')),
    );
    const baseStart = parseDate(credential.startDate) ?? windowStart;
    const baseEnd = parseDate(credential.endDate) ?? windowEnd;

    for (const procedure of credential.procedures ?? []) {
      const procedureName = normalizeProcedureName(procedure.procedure);
      if (!procedureName) continue;

      const periodStart = parseDate(procedure.periodStart) ?? baseStart;
      const periodEnd = parseDate(procedure.periodEnd) ?? baseEnd;
      if (periodEnd < windowStart) continue;

      const primaryCount = Math.max(procedure.primaryCount ?? procedure.count ?? 0, 0);
      const assistCount = Math.max(procedure.assistCount ?? 0, 0);
      const totalCount = Math.max(primaryCount + assistCount, procedure.count ?? primaryCount + assistCount);
      if (totalCount === 0) continue;

      events.push({
        procedure: procedureName,
        primaryCount,
        assistCount,
        totalCount,
        sourceType: 'employment-vc',
        sourceId: credential.credentialId,
        organization: credential.organization,
        role: credential.roleTitle,
        periodStart,
        periodEnd,
        confidence: tefcaAligned ? 0.98 : 0.86,
        tefcaAligned: tefcaAligned || procedure.dataQuality === 'tefca',
      });
    }
  }

  for (const log of logs) {
    const procedureName = normalizeProcedureName(log.procedure);
    if (!procedureName) continue;
    const occurredOn = parseDate(log.occurredOn) ?? windowEnd;
    if (occurredOn < windowStart) continue;

    events.push({
      procedure: procedureName,
      primaryCount: log.count,
      assistCount: 0,
      totalCount: log.count,
      sourceType: 'self-report',
      sourceId: log.id,
      organization: log.location,
      periodStart: occurredOn,
      periodEnd: occurredOn,
      confidence: log.verified ? 0.82 : 0.55,
      tefcaAligned: false,
    });
  }

  return events;
}

function buildAggregates(events: VolumeEvent[], windowStart: Date, windowEnd: Date): ProcedureVolumeAggregate[] {
  const map = new Map<string, ProcedureVolumeAggregate & { bucketMap: Map<string, { start: Date; end: Date; count: number }> }>();

  for (const event of events) {
    const existing = map.get(event.procedure);
    if (!existing) {
      map.set(event.procedure, {
        procedure: event.procedure,
        totalCount: event.totalCount,
        primaryCount: event.primaryCount,
        assistCount: event.assistCount,
        tefcaAlignedCount: event.tefcaAligned ? event.totalCount : 0,
        mostRecentCase: event.periodEnd.toISOString(),
        rollingTrend: [],
        sources: [
          serializeSource(event),
        ],
        bucketMap: new Map(),
      });
    } else {
      existing.totalCount += event.totalCount;
      existing.primaryCount += event.primaryCount;
      existing.assistCount += event.assistCount;
      existing.tefcaAlignedCount += event.tefcaAligned ? event.totalCount : 0;
      existing.mostRecentCase =
        !existing.mostRecentCase || new Date(existing.mostRecentCase) < event.periodEnd
          ? event.periodEnd.toISOString()
          : existing.mostRecentCase;
      existing.sources.push(serializeSource(event));
    }

    const aggregate = map.get(event.procedure)!;
    const bucketKey = `${event.periodStart.getUTCFullYear()}-${event.periodStart.getUTCMonth()}`;
    const bucket = aggregate.bucketMap.get(bucketKey);
    const bucketStart = new Date(Date.UTC(event.periodStart.getUTCFullYear(), event.periodStart.getUTCMonth(), 1));
    const bucketEnd = new Date(Date.UTC(event.periodStart.getUTCFullYear(), event.periodStart.getUTCMonth() + 1, 0, 23, 59, 59));
    if (bucket) {
      bucket.count += event.totalCount;
    } else {
      aggregate.bucketMap.set(bucketKey, { start: bucketStart, end: bucketEnd, count: event.totalCount });
    }
  }

  return Array.from(map.values()).map((aggregate) => ({
    procedure: aggregate.procedure,
    totalCount: aggregate.totalCount,
    primaryCount: aggregate.primaryCount,
    assistCount: aggregate.assistCount,
    tefcaAlignedCount: aggregate.tefcaAlignedCount,
    mostRecentCase: aggregate.mostRecentCase,
    rollingTrend: Array.from(aggregate.bucketMap.values())
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map((bucket) => ({
        periodStart: bucket.start.toISOString(),
        periodEnd: bucket.end.toISOString(),
        count: bucket.count,
      })),
    sources: aggregate.sources.sort((a, b) => (b.periodStart > a.periodStart ? 1 : -1)),
  }));
}

function serializeSource(event: VolumeEvent): VolumeSourceSummary {
  return {
    procedure: event.procedure,
    sourceType: event.sourceType,
    sourceId: event.sourceId,
    organization: event.organization,
    role: event.role,
    count: event.totalCount,
    confidence: Number(event.confidence.toFixed(3)),
    tefcaAligned: event.tefcaAligned,
    periodStart: event.periodStart.toISOString(),
    periodEnd: event.periodEnd.toISOString(),
  };
}

function normalizeRequirements(
  aggregates: ProcedureVolumeAggregate[],
  explicit: ProcedureVolumeRequirement[] | undefined,
  defaultLookback: number,
): ProcedureVolumeRequirement[] {
  if (explicit?.length) {
    return explicit.map((requirement) => ({
      ...requirement,
      procedure: normalizeProcedureName(requirement.procedure),
      lookbackMonths: requirement.lookbackMonths ?? defaultLookback,
      weight: requirement.weight ?? 1,
    }));
  }

  return aggregates.map((aggregate) => ({
    procedure: aggregate.procedure,
    minCount: Math.max(5, Math.min(20, Math.round(aggregate.totalCount * 0.6) || 6)),
    lookbackMonths: defaultLookback,
    weight: aggregate.tefcaAlignedCount > 0 ? 1.2 : 1,
    description: `Sustain ${aggregate.procedure} throughput (${aggregate.totalCount} observed)`,
  }));
}

function evaluateRequirements(
  requirements: ProcedureVolumeRequirement[],
  aggregates: ProcedureVolumeAggregate[],
  now: Date,
): RequirementResult[] {
  const aggregateMap = new Map(aggregates.map((aggregate) => [aggregate.procedure, aggregate]));

  return requirements.map((requirement) => {
    const aggregate = aggregateMap.get(requirement.procedure);
    if (!aggregate) {
      return {
        procedure: requirement.procedure,
        minCount: requirement.minCount,
        observed: 0,
        lookbackMonths: requirement.lookbackMonths ?? 24,
        met: false,
        deficit: requirement.minCount,
        weight: requirement.weight ?? 1,
        description: requirement.description,
      };
    }

    const lookbackStart = new Date(now.getTime() - monthsToMs(requirement.lookbackMonths ?? 24));
    const observed = aggregate.rollingTrend
      .filter((bucket) => new Date(bucket.periodEnd) >= lookbackStart)
      .reduce((sum, bucket) => sum + bucket.count, 0);
    const met = observed >= requirement.minCount;

    return {
      procedure: requirement.procedure,
      minCount: requirement.minCount,
      observed,
      lookbackMonths: requirement.lookbackMonths ?? 24,
      met,
      deficit: met ? 0 : requirement.minCount - observed,
      weight: requirement.weight ?? 1,
      description: requirement.description,
    };
  });
}

function attachRequirements(
  aggregates: ProcedureVolumeAggregate[],
  requirements: RequirementResult[],
): ProcedureVolumeAggregate[] {
  const requirementMap = new Map(requirements.map((record) => [record.procedure, record]));
  return aggregates.map((aggregate) => ({
    ...aggregate,
    requirement: requirementMap.get(aggregate.procedure),
  }));
}

async function persistAggregates(
  clinicianId: string,
  periodStart: Date,
  periodEnd: Date,
  aggregates: ProcedureVolumeAggregate[],
) {
  await prisma.$transaction(async (tx) => {
    await tx.procedureVolume.deleteMany({
      where: {
        clinicianId,
        periodStart,
        periodEnd,
      },
    });

    if (aggregates.length === 0) {
      return;
    }

    await tx.procedureVolume.createMany({
      data: aggregates.map((aggregate) => ({
        clinicianId,
        procedure: aggregate.procedure,
        count: aggregate.totalCount,
        roleBreakdown: {
          primary: aggregate.primaryCount,
          assist: aggregate.assistCount,
        },
        sources: aggregate.sources,
        periodStart,
        periodEnd,
      })),
    });
  });
}

function buildRecommendation(volumeScore: number, missingCount: number): string {
  if (volumeScore >= 0.85 && missingCount === 0) {
    return 'Ready for committee packet inclusion.';
  }
  if (volumeScore >= 0.65) {
    return 'Recommend OPPE review; minor gaps detected.';
  }
  if (missingCount > 1) {
    return 'Route to FPPE and collect fresh procedure logs.';
  }
  return 'Volume insufficient; request proctor attestations.';
}

function normalizeProcedureName(value: string | undefined | null): string {
  if (!value) return '';
  return value.trim().toUpperCase().replace(/\s+/g, '-');
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function monthsToMs(months: number): number {
  if (!Number.isFinite(months) || months <= 0) {
    return 6 * MONTH_IN_MS;
  }
  return months * MONTH_IN_MS;
}










