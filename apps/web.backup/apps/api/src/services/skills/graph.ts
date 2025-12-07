import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface SkillGraphNode {
  nodeId: string;
  name: string;
  category: 'specialty' | 'certification' | 'procedure';
  strength: number;
  metadata?: Record<string, unknown>;
}

export interface SkillGraphEdge {
  target: string;
  weight: number;
  label?: string;
}

export interface SkillGraph {
  clinicianId: string;
  nodes: SkillGraphNode[];
  adjacency: Record<string, SkillGraphEdge[]>;
  summary: {
    strengths: string[];
    gaps: string[];
    recommendedTraining: string[];
  };
}

export interface BuildSkillGraphOptions {
  prisma?: PrismaClient;
  monthsOfVolume?: number;
}

export async function buildSkillGraph(
  clinicianId: string,
  options: BuildSkillGraphOptions = {},
): Promise<SkillGraph | null> {
  const client = options.prisma ?? prisma;
  const clinician = await client.clinicianProfile.findUnique({
    where: { id: clinicianId },
    include: { user: true },
  });
  if (!clinician) {
    return null;
  }

  const [canonicalNodes, procedureVolume, credentials] = await Promise.all([
    client.skillNode.findMany(),
    client.procedureVolume.findMany({
      where: {
        clinicianId,
        periodEnd: {
          gte: monthsAgo(options.monthsOfVolume ?? 12),
        },
      },
      orderBy: { count: 'desc' },
      take: 20,
    }),
    client.credential.findMany({
      where: {
        userId: clinician.userId,
        type: { in: ['BOARD_CERT', 'ACLS', 'BLS', 'PALS', 'ATLS'] },
      },
      orderBy: { expiresAt: 'asc' },
    }),
  ]);

  const nodes: SkillGraphNode[] = [];
  if (clinician.specialty) {
    nodes.push({
      nodeId: `specialty:${clinician.specialty}`,
      name: clinician.specialty,
      category: 'specialty',
      strength: 0.95,
      metadata: {
        yearsExperience: clinician.yearsExperience,
        compactEligible: clinician.compactEligible ?? null,
      },
    });
  }

  credentials.forEach((credential) => {
    nodes.push({
      nodeId: `cert:${credential.id}`,
      name: credential.name ?? credential.type ?? credential.id,
      category: 'certification',
      strength: credential.expiresAt && credential.expiresAt < new Date() ? 0.35 : 0.8,
      metadata: {
        expiresAt: credential.expiresAt?.toISOString() ?? null,
        status: credential.status,
      },
    });
  });

  const procedureNodes = procedureVolume.map((entry) => {
    const normalized = normalizeVolume(entry.count);
    return {
      nodeId: `procedure:${entry.id}`,
      name: entry.procedure,
      category: 'procedure' as const,
      strength: normalized,
      metadata: {
        count: entry.count,
        periodStart: entry.periodStart.toISOString(),
        periodEnd: entry.periodEnd.toISOString(),
        roleBreakdown: entry.roleBreakdown,
      },
    };
  });
  nodes.push(...procedureNodes);

  const adjacency = buildAdjacency(nodes);
  const strengths = pickTopLabels(procedureNodes, 3);
  const gaps = detectSkillGaps(canonicalNodes, clinician.specialty ?? null, procedureNodes);
  const recommendedTraining = canonicalNodes
    .filter((node) => node.category === 'certification')
    .filter((node) => !credentials.some((cred) => equalsIgnoreCase(cred.name, node.name)))
    .slice(0, 3)
    .map((node) => node.name);

  return {
    clinicianId,
    nodes,
    adjacency,
    summary: {
      strengths,
      gaps,
      recommendedTraining,
    },
  };
}

function buildAdjacency(nodes: SkillGraphNode[]): Record<string, SkillGraphEdge[]> {
  const adjacency: Record<string, SkillGraphEdge[]> = {};
  const specialtyNode = nodes.find((node) => node.category === 'specialty');
  const certificationNodes = nodes.filter((node) => node.category === 'certification');
  const procedureNodes = nodes.filter((node) => node.category === 'procedure');

  if (specialtyNode) {
    adjacency[specialtyNode.nodeId] = certificationNodes.map((cert) => ({
      target: cert.nodeId,
      weight: Number((cert.strength * 0.9).toFixed(3)),
      label: 'requires',
    }));
  }

  certificationNodes.forEach((cert) => {
    adjacency[cert.nodeId] = procedureNodes
      .filter((procedure) => procedure.metadata?.roleBreakdown)
      .map((procedure) => ({
        target: procedure.nodeId,
        weight: Number((procedure.strength * 0.85).toFixed(3)),
        label: 'qualifies',
      }));
  });

  return adjacency;
}

function detectSkillGaps(
  canonicalNodes: Prisma.SkillNode[],
  specialty: string | null,
  procedureNodes: SkillGraphNode[],
): string[] {
  if (!specialty) {
    return [];
  }
  const canonicalProcedures = canonicalNodes.filter(
    (node) =>
      node.category === 'procedure' &&
      typeof node.metadata === 'object' &&
      (node.metadata as Record<string, unknown>)?.specialty === specialty,
  );
  const gaps = canonicalProcedures
    .filter(
      (canonical) =>
        !procedureNodes.some((proc) => equalsIgnoreCase(proc.name, canonical.name)),
    )
    .map((proc) => proc.name);
  return gaps.slice(0, 5);
}

function pickTopLabels(nodes: SkillGraphNode[], limit: number): string[] {
  return nodes
    .sort((a, b) => b.strength - a.strength)
    .slice(0, limit)
    .map((node) => node.name);
}

function normalizeVolume(count: number): number {
  if (!Number.isFinite(count)) {
    return 0.2;
  }
  return Math.min(1, Math.max(0.2, count / 50));
}

function monthsAgo(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
}

function equalsIgnoreCase(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

