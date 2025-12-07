import {
  PrismaClient,
  type PrivilegeSafetySignal,
  PrivilegeSafetySeverity,
  type Prisma,
} from '@prisma/client';
import type { AnchorRecord } from '../audit/anchor';
import { anchorPrivilegeAssignment } from '../audit/anchor';
import { buildCredentialGraph } from './graph';

const prisma = new PrismaClient();

export interface CommitteePacketOptions {
  systemId: string;
  clinicianId: string;
  siteIds?: string[];
  includePdf?: boolean;
}

export interface CommitteePacketSummary {
  systemId: string;
  clinician: {
    id: string;
    name: string | null;
    specialty: string | null;
  };
  standardPrivileges: string[];
  siteDeltas: Array<{
    siteId: string;
    additions: string[];
    gaps: string[];
    recommendation: string;
  }>;
  risk: {
    category: 'green' | 'yellow' | 'red';
    signals: PrivilegeSafetySignal[];
  };
  generatedAt: string;
  pdfBundle?: string;
}

export interface CaseLogAttachment {
  procedure: string;
  count: number;
  periodStart: string;
  periodEnd: string;
  sources: unknown;
}

export interface TrainingEvidenceAttachment {
  name: string;
  completedAt?: string | null;
  expiresAt?: string | null;
  sponsoringOrg?: string;
}

export interface CommitteePacketV2 {
  packet: CommitteePacketSummary;
  caseLogs: CaseLogAttachment[];
  trainingEvidence: TrainingEvidenceAttachment[];
  anchor: AnchorRecord<PrivilegeAssignmentAnchorPayload>;
}

interface PrivilegeAssignmentAnchorPayload {
  clinicianId: string;
  privilegeCodes: string[];
  siteIds: string[];
  packetId: string;
}

export async function buildCommitteeAutoPacket(
  options: CommitteePacketOptions,
): Promise<CommitteePacketSummary> {
  const [clinician, policy] = await Promise.all([
    prisma.clinicianProfile.findUnique({
      where: { id: options.clinicianId },
      include: { user: { select: { name: true } } },
    }),
    prisma.privilegePropagationPolicy.findFirst({
      where: { systemId: options.systemId },
    }),
  ]);

  if (!clinician) {
    throw new Error(`Clinician ${options.clinicianId} not found`);
  }

  const sites = options.siteIds ?? policy?.sites ?? [];
  if (sites.length === 0) {
    throw new Error('No sites available for committee packet generation');
  }

  const packs = await prisma.privilegePack.findMany({
    where: { orgId: { in: sites } },
  });

  const summaries = packs.map((pack) => ({
    siteId: pack.orgId,
    privilegeCodes: extractPrivilegeCodes(pack),
  }));

  const standardPrivileges = deriveStandardPrivileges(summaries);
  const siteDeltas = summaries.map((summary) => deriveSiteDelta(summary, standardPrivileges));
  const signals = await prisma.privilegeSafetySignal.findMany({
    where: { clinicianId: options.clinicianId },
    orderBy: { detectedAt: 'desc' },
    take: 10,
  });
  const riskCategory = deriveRiskCategory(signals);

  const packet: CommitteePacketSummary = {
    systemId: options.systemId,
    clinician: {
      id: clinician.id,
      name: clinician.user?.name ?? null,
      specialty: clinician.specialty,
    },
    standardPrivileges,
    siteDeltas,
    risk: {
      category: riskCategory,
      signals,
    },
    generatedAt: new Date().toISOString(),
  };

  if (options.includePdf) {
    packet.pdfBundle = Buffer.from(JSON.stringify(packet, null, 2)).toString('base64');
  }

  return packet;
}

export async function generateCommitteePacketV2(
  options: CommitteePacketOptions,
): Promise<CommitteePacketV2> {
  const packet = await buildCommitteeAutoPacket(options);
  const [caseLogs, trainingEvidence] = await Promise.all([
    fetchCaseLogs(options.clinicianId),
    fetchTrainingEvidence(options.clinicianId),
  ]);

  const anchor = anchorPrivilegeAssignment({
    clinicianId: options.clinicianId,
    privilegeCodes: packet.standardPrivileges,
    siteIds: packet.siteDeltas.map((delta) => delta.siteId),
    packetId: `${options.systemId}:${options.clinicianId}`,
  });

  return {
    packet,
    caseLogs,
    trainingEvidence,
    anchor,
  };
}

async function fetchCaseLogs(clinicianId: string): Promise<CaseLogAttachment[]> {
  const volumes = await prisma.procedureVolume.findMany({
    where: { clinicianId },
    orderBy: { periodEnd: 'desc' },
    take: 25,
  });

  return volumes.map((volume) => ({
    procedure: volume.procedure,
    count: volume.count,
    periodStart: volume.periodStart.toISOString(),
    periodEnd: volume.periodEnd.toISOString(),
    sources: volume.sources,
  }));
}

async function fetchTrainingEvidence(clinicianId: string): Promise<TrainingEvidenceAttachment[]> {
  const graph = await buildCredentialGraph(clinicianId);
  if (!graph) return [];
  return graph.trainings.map((training) => ({
    name: training.label ?? training.code ?? 'Training',
    completedAt: training.expiresAt ?? null,
    expiresAt: training.expiresAt ?? null,
    sponsoringOrg: training.jurisdiction ?? undefined,
  }));
}

function extractPrivilegeCodes(pack: Prisma.PrivilegePackGetPayload<{}>): string[] {
  const rules = (pack.rules as { requires?: string[]; anyOf?: string[] } | null) ?? null;
  const tokens = [
    ...(Array.isArray(rules?.requires) ? rules?.requires : []),
    ...(Array.isArray(rules?.anyOf) ? rules?.anyOf : []),
  ];
  return dedupeStrings(tokens.map((token) => token.toUpperCase()));
}

function deriveStandardPrivileges(
  summaries: Array<{ privilegeCodes: string[] }>,
): string[] {
  const counts = new Map<string, number>();
  summaries.forEach((summary) => {
    summary.privilegeCodes.forEach((code) => {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    });
  });

  const threshold = Math.max(1, Math.ceil(summaries.length * 0.5));
  return Array.from(counts.entries())
    .filter(([, count]) => count >= threshold)
    .map(([code]) => code)
    .sort();
}

function deriveSiteDelta(
  summary: { siteId: string; privilegeCodes: string[] },
  standardPrivileges: string[],
): { siteId: string; additions: string[]; gaps: string[]; recommendation: string } {
  const standardSet = new Set(standardPrivileges);
  const siteSet = new Set(summary.privilegeCodes);
  const additions = summary.privilegeCodes.filter((code) => !standardSet.has(code));
  const gaps = standardPrivileges.filter((code) => !siteSet.has(code));

  let recommendation = 'Aligned with system standard';
  if (gaps.length && additions.length) {
    recommendation = 'Review delta before committee';
  } else if (gaps.length) {
    recommendation = 'Add missing privileges to align';
  } else if (additions.length) {
    recommendation = 'Evaluate site-specific additions';
  }

  return {
    siteId: summary.siteId,
    additions,
    gaps,
    recommendation,
  };
}

function deriveRiskCategory(signals: PrivilegeSafetySignal[]): 'green' | 'yellow' | 'red' {
  if (!signals.length) {
    return 'green';
  }

  const severities = new Set(signals.map((signal) => signal.severity));
  if (severities.has(PrivilegeSafetySeverity.CRITICAL) || severities.has(PrivilegeSafetySeverity.HIGH)) {
    return 'red';
  }
  if (severities.has(PrivilegeSafetySeverity.MED)) {
    return 'yellow';
  }
  return 'green';
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}


