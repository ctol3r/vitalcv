import type { PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { buildReadinessNextActions } from '../entity/readinessActions';
import {
  calculateETA,
  type CredentialingProgress,
  type LaneProgress,
} from '../opportunities/credentialingProgress';
import { enrichBlockers } from './blockerEnricher';
import { buildOrchestratedPlan, type BlockerNode, type OrchestrationPlan } from './orchestrationEngine';

export type CasePriority = 'critical' | 'high' | 'medium' | 'low';

export interface CaseAction {
  id: string;
  title: string;
  detail: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'pending' | 'in_progress' | 'completed';
  estimatedDays: number;
  owner: 'clinician' | 'employer' | 'system';
}

export interface ClinicalCase {
  entityId: string;
  npi: string;
  clinicianName: string;
  blockers: BlockerNode[];
  actions: CaseAction[];
  progress: CredentialingProgress;
  progressPercent: number;
  estimatedCompletion: string;
  orchestrationPlan: OrchestrationPlan;
  priority: CasePriority;
}

const DOMAIN_TO_LANE: Record<string, keyof CredentialingProgress> = {
  IDENTITY: 'identity',
  EXCLUSION_CHECK: 'sanctions',
  LICENSURE: 'licensure',
  MEDICARE_ENROLLMENT: 'enrollment',
};

const LANE_DOMAINS: Record<keyof CredentialingProgress, string[]> = {
  identity: ['IDENTITY'],
  sanctions: ['EXCLUSION_CHECK'],
  licensure: ['LICENSURE'],
  enrollment: ['MEDICARE_ENROLLMENT'],
};

function credentialStatusToLaneProgress(
  statuses: string[],
  verificationLevels: string[],
): LaneProgress {
  if (statuses.length === 0) {
    return 'missing';
  }

  const hasActive = statuses.some((s) => s === 'ACTIVE');
  if (hasActive) {
    const hasSourceVerified = verificationLevels.some(
      (l) => l === 'SOURCE_VERIFIED' || l === 'SOURCE_MATCHED' || l === 'CRYPTOGRAPHICALLY_SIGNED',
    );
    return hasSourceVerified ? 'complete' : 'in_progress';
  }

  const hasPending = statuses.some((s) => s === 'PENDING' || s === 'IN_REVIEW');
  if (hasPending) {
    return 'in_progress';
  }

  return 'pending';
}

function computeProgress(
  credentials: Array<{ domain: string; status: string; verificationLevel: string }>,
): CredentialingProgress {
  const byDomain = new Map<keyof CredentialingProgress, { statuses: string[]; levels: string[] }>();

  for (const lane of Object.keys(LANE_DOMAINS) as Array<keyof CredentialingProgress>) {
    byDomain.set(lane, { statuses: [], levels: [] });
  }

  for (const cred of credentials) {
    const lane = DOMAIN_TO_LANE[cred.domain];
    if (!lane) {
      continue;
    }
    const entry = byDomain.get(lane);
    if (entry) {
      entry.statuses.push(cred.status);
      entry.levels.push(cred.verificationLevel);
    }
  }

  return {
    identity: credentialStatusToLaneProgress(
      byDomain.get('identity')!.statuses,
      byDomain.get('identity')!.levels,
    ),
    sanctions: credentialStatusToLaneProgress(
      byDomain.get('sanctions')!.statuses,
      byDomain.get('sanctions')!.levels,
    ),
    licensure: credentialStatusToLaneProgress(
      byDomain.get('licensure')!.statuses,
      byDomain.get('licensure')!.levels,
    ),
    enrollment: credentialStatusToLaneProgress(
      byDomain.get('enrollment')!.statuses,
      byDomain.get('enrollment')!.levels,
    ),
  };
}

function progressPercent(progress: CredentialingProgress): number {
  const lanes = Object.values(progress) as LaneProgress[];
  const complete = lanes.filter((l) => l === 'complete').length;
  return Math.round((complete / lanes.length) * 100);
}

function missingDomainsFromProgress(progress: CredentialingProgress): string[] {
  const missing: string[] = [];
  for (const [lane, status] of Object.entries(progress) as Array<[keyof CredentialingProgress, LaneProgress]>) {
    if (status === 'missing') {
      const domains = LANE_DOMAINS[lane];
      missing.push(...domains);
    }
  }
  return missing;
}

function blockersFromProgress(progress: CredentialingProgress): string[] {
  const blockers: string[] = [];
  if (progress.enrollment === 'pending' || progress.enrollment === 'in_progress') {
    blockers.push('PECOS enrollment status requires review');
  }
  return blockers;
}

function derivePriority(progress: CredentialingProgress, blockers: BlockerNode[]): CasePriority {
  if (blockers.some((b) => b.severity === 'critical')) {
    return 'critical';
  }
  if (progress.enrollment === 'missing') {
    return 'high';
  }
  if (progress.licensure === 'missing') {
    return 'high';
  }
  if (blockers.some((b) => b.severity === 'high')) {
    return 'high';
  }
  if (blockers.length > 0) {
    return 'medium';
  }
  return 'low';
}

function toActions(blockers: BlockerNode[]): CaseAction[] {
  return blockers.map((b) => ({
    id: b.id,
    title: b.label,
    detail: b.resolutionPath,
    priority: blockerSeverityToActionPriority(b.severity),
    status: 'pending' as const,
    estimatedDays: b.estimatedDays,
    owner: b.owner,
  }));
}

function blockerSeverityToActionPriority(severity: BlockerNode['severity']): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (severity === 'critical' || severity === 'high') {
    return 'HIGH';
  }
  if (severity === 'medium') {
    return 'MEDIUM';
  }
  return 'LOW';
}

function assembleCase(entity: {
  id: string;
  npi: string | null;
  displayName: string;
  credentials: Array<{ domain: string; status: string; verificationLevel: string }>;
}): ClinicalCase | null {
  if (!entity.npi) {
    return null;
  }

  const progress = computeProgress(entity.credentials);
  const missingDomains = missingDomainsFromProgress(progress);
  const progressBlockers = blockersFromProgress(progress);

  const nextActions = buildReadinessNextActions({
    missingBlockingDomains: missingDomains,
    blockers: progressBlockers,
    gaps: [],
  });

  const enriched = enrichBlockers(nextActions);
  const plan = buildOrchestratedPlan(enriched);
  const pct = progressPercent(progress);
  const priority = derivePriority(progress, enriched);

  return {
    entityId: entity.id,
    npi: entity.npi,
    clinicianName: entity.displayName,
    blockers: enriched,
    actions: toActions(enriched),
    progress,
    progressPercent: pct,
    estimatedCompletion: calculateETA(progress),
    orchestrationPlan: plan,
    priority,
  };
}

export async function listCases(
  prismaClient: PrismaClient = prisma,
): Promise<ClinicalCase[]> {
  const entities = await prismaClient.vcvEntity.findMany({
    where: {
      entityType: 'PERSON',
      npi: { not: null },
    },
    select: {
      id: true,
      npi: true,
      displayName: true,
    },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });

  if (entities.length === 0) {
    return [];
  }

  const entityIds = entities.map((e) => e.id);
  const credentials = await prismaClient.vcvCredential.findMany({
    where: {
      subjectId: { in: entityIds },
      domain: { in: ['IDENTITY', 'EXCLUSION_CHECK', 'LICENSURE', 'MEDICARE_ENROLLMENT'] },
    },
    select: {
      subjectId: true,
      domain: true,
      status: true,
      verificationLevel: true,
    },
  });

  const credsByEntity = new Map<string, Array<{ domain: string; status: string; verificationLevel: string }>>();
  for (const cred of credentials) {
    const list = credsByEntity.get(cred.subjectId) ?? [];
    list.push({ domain: cred.domain, status: cred.status, verificationLevel: cred.verificationLevel });
    credsByEntity.set(cred.subjectId, list);
  }

  const cases: ClinicalCase[] = [];
  for (const entity of entities) {
    const c = assembleCase({
      id: entity.id,
      npi: entity.npi,
      displayName: entity.displayName,
      credentials: credsByEntity.get(entity.id) ?? [],
    });
    if (c) {
      cases.push(c);
    }
  }

  return cases;
}

export async function getCaseDetail(
  entityId: string,
  prismaClient: PrismaClient = prisma,
): Promise<ClinicalCase | null> {
  const entity = await prismaClient.vcvEntity.findUnique({
    where: { id: entityId },
    select: { id: true, npi: true, displayName: true },
  });

  if (!entity || !entity.npi) {
    return null;
  }

  const credentials = await prismaClient.vcvCredential.findMany({
    where: {
      subjectId: entityId,
      domain: { in: ['IDENTITY', 'EXCLUSION_CHECK', 'LICENSURE', 'MEDICARE_ENROLLMENT'] },
    },
    select: { domain: true, status: true, verificationLevel: true },
  });

  return assembleCase({
    id: entity.id,
    npi: entity.npi,
    displayName: entity.displayName,
    credentials: credentials.map((c) => ({
      domain: c.domain,
      status: c.status,
      verificationLevel: c.verificationLevel,
    })),
  });
}
