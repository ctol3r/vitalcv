import type { PrismaClient } from '@prisma/client';
import type {
  DecisionEntityLink,
  DecisionFinding,
  DecisionStoryline,
  DecisionTargetEntity,
} from '../../../../../../core/decisions/decisionEngine';

const ACTIVE_FINDING_STATUSES = ['new', 'acknowledged', 'investigating', 'escalated'] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function daysAgo(nowIso: string, days: number): Date {
  return new Date(new Date(nowIso).getTime() - (days * 86_400_000));
}

function severityRank(value: string): number {
  switch (value.toLowerCase()) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

function storylineTypeFromFindingTypes(findingTypes: string[]): string {
  if (findingTypes.some((type) => ['trust_decline', 'divergence', 'compliance', 'freshness', 'exclusion'].includes(type))) {
    return 'TRUST_RISK';
  }
  if (findingTypes.includes('research_momentum')) {
    return 'RISING_INVESTIGATOR';
  }
  if (findingTypes.includes('network_emergence')) {
    return 'NETWORK_EMERGENCE';
  }
  if (findingTypes.includes('workforce_pressure')) {
    return 'WORKFORCE_OPPORTUNITY';
  }
  if (findingTypes.includes('industry_influence')) {
    return 'INDUSTRY_INFLUENCE';
  }
  return 'GENERAL';
}

function combineNarrative(findings: DecisionFinding[]): string {
  return findings
    .slice(0, 2)
    .map((finding) => finding.summary || finding.explanation || finding.title)
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index)
    .join(' ');
}

function entityLinksFromRow(row: {
  entityLinks: Array<{
    entityType: string;
    entityId: string;
    entityLabel: string | null;
    relationship: string | null;
  }>;
}): DecisionEntityLink[] {
  return row.entityLinks.map((entity) => ({
    entityType: entity.entityType,
    entityId: entity.entityId,
    entityLabel: entity.entityLabel,
    relationship: entity.relationship,
  }));
}

function selectPrimaryEntity(row: {
  entityLinks: Array<{
    entityType: string;
    entityId: string;
    entityLabel: string | null;
    relationship: string | null;
  }>;
  entityIds: string[];
  metadata: unknown;
}): DecisionTargetEntity {
  const subject = row.entityLinks.find((entity) => entity.relationship === 'subject')
    ?? row.entityLinks.find((entity) => entity.entityType === 'provider')
    ?? row.entityLinks[0];
  if (subject) {
    return {
      entityType: subject.entityType,
      entityId: subject.entityId,
      entityLabel: subject.entityLabel,
    };
  }

  const metadata = asRecord(row.metadata);
  const npi = asString(metadata.npi);
  if (npi) {
    return {
      entityType: 'provider',
      entityId: npi,
      entityLabel: asString(metadata.providerLabel) ?? `Provider ${npi}`,
    };
  }

  const fallbackId = row.entityIds[0] ?? 'unknown';
  return {
    entityType: 'entity',
    entityId: fallbackId,
    entityLabel: fallbackId,
  };
}

export async function loadDecisionFindings(
  prismaClient: PrismaClient,
  nowIso: string,
): Promise<DecisionFinding[]> {
  const rows = await prismaClient.investigatorFinding.findMany({
    where: {
      status: { in: [...ACTIVE_FINDING_STATUSES] },
      lastSeenAt: { gte: daysAgo(nowIso, 180) },
    },
    include: {
      entityLinks: {
        select: {
          entityType: true,
          entityId: true,
          entityLabel: true,
          relationship: true,
        },
      },
    },
    orderBy: [
      { priorityScore: 'desc' },
      { lastSeenAt: 'desc' },
    ],
    take: 600,
  });

  return rows.map((row) => {
    const metadata = asRecord(row.metadata);
    return {
      findingId: row.findingId,
      findingType: row.findingType,
      severity: row.severity,
      title: row.title,
      summary: row.summary,
      explanation: row.explanation,
      primaryEntity: selectPrimaryEntity(row),
      entities: entityLinksFromRow(row),
      confidence: row.confidence,
      priorityScore: row.priorityScore,
      graphCentrality: row.graphCentrality,
      entityImportance: row.entityImportance,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      metadata: row.storylineKey
        ? {
          ...metadata,
          storylineKey: asString(metadata.storylineKey) ?? row.storylineKey,
        }
        : metadata,
    };
  });
}

export function buildDecisionStorylines(findings: readonly DecisionFinding[]): DecisionStoryline[] {
  const groups = new Map<string, DecisionFinding[]>();

  for (const finding of findings) {
    const storylineKey = asString(finding.metadata.storylineKey) ?? `${finding.findingType}:${finding.primaryEntity.entityId}`;
    const current = groups.get(storylineKey) ?? [];
    current.push(finding);
    groups.set(storylineKey, current);
  }

  const storylines: DecisionStoryline[] = [];
  for (const [storylineKey, group] of groups) {
    const sorted = [...group].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
    const latest = sorted[0];
    if (!latest) {
      continue;
    }

    const findingTypes = [...new Set(sorted.map((finding) => finding.findingType))];
    const severity = sorted.reduce(
      (current, finding) => severityRank(finding.severity) > severityRank(current) ? finding.severity : current,
      latest.severity,
    );

    storylines.push({
      storylineKey,
      storylineType: storylineTypeFromFindingTypes(findingTypes),
      title: latest.title,
      narrative: combineNarrative(sorted),
      severity,
      confidence: Math.max(...sorted.map((finding) => finding.confidence)),
      targetEntity: latest.primaryEntity,
      findingIds: sorted.map((finding) => finding.findingId),
      findingTypes,
      updatedAt: latest.updatedAt,
      metadata: {
        ...latest.metadata,
        graphCentrality: latest.graphCentrality,
        entityImportance: latest.entityImportance,
        activeFindingCount: sorted.length,
      },
    });
  }

  return storylines;
}
