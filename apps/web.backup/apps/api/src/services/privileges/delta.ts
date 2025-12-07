import { PrismaClient } from '@prisma/client';
import { normalizePrivilegeCode } from '../../../../../services/privyDep/models/PrivilegeNode';

const prisma = new PrismaClient();

export interface PrivilegeSetSnapshot {
  id: string;
  hospitalId: string;
  specialty: string;
  version: number;
  procedures: string[];
  updatedAt: string;
}

export interface PrivilegeDeltaOptions {
  baseHospitalId: string;
  compareHospitalId: string;
  specialty: string;
  baseVersion?: number;
  compareVersion?: number;
}

export interface PrivilegeDeltaResult {
  base: PrivilegeSetSnapshot;
  target: PrivilegeSetSnapshot;
  additions: string[];
  removals: string[];
  shared: string[];
  alignmentScore: number;
  coverageScore: number;
  recommendation: string;
}

export interface PrivilegeDeltaMatrixOptions {
  referenceHospitalId: string;
  specialty: string;
  hospitalIds: string[];
}

export interface PrivilegeDeltaMatrix {
  specialty: string;
  referenceHospitalId: string;
  entries: PrivilegeDeltaResult[];
}

export async function calculatePrivilegeDelta(
  options: PrivilegeDeltaOptions,
  prismaClient: PrismaClient = prisma,
): Promise<PrivilegeDeltaResult> {
  const base = await loadPrivilegeSetSnapshot(
    prismaClient,
    options.baseHospitalId,
    options.specialty,
    options.baseVersion,
  );
  const target = await loadPrivilegeSetSnapshot(
    prismaClient,
    options.compareHospitalId,
    options.specialty,
    options.compareVersion,
  );

  const baseSet = new Set(base.procedures);
  const targetSet = new Set(target.procedures);

  const additions = diff(targetSet, baseSet);
  const removals = diff(baseSet, targetSet);
  const shared = intersect(baseSet, targetSet);

  const alignmentScore = baseSet.size === 0 ? 1 : Number((shared.length / baseSet.size).toFixed(3));
  const coverageScore = targetSet.size === 0 ? 0 : Number((shared.length / targetSet.size).toFixed(3));

  return {
    base,
    target,
    additions,
    removals,
    shared,
    alignmentScore,
    coverageScore,
    recommendation: buildDeltaRecommendation(alignmentScore, additions, removals),
  };
}

export async function buildPrivilegeDeltaMatrix(
  options: PrivilegeDeltaMatrixOptions,
  prismaClient: PrismaClient = prisma,
): Promise<PrivilegeDeltaMatrix> {
  const uniqueHospitals = Array.from(new Set(options.hospitalIds.filter(Boolean)));
  const entries: PrivilegeDeltaResult[] = [];

  for (const hospitalId of uniqueHospitals) {
    if (hospitalId === options.referenceHospitalId) {
      continue;
    }
    const delta = await calculatePrivilegeDelta(
      {
        baseHospitalId: options.referenceHospitalId,
        compareHospitalId: hospitalId,
        specialty: options.specialty,
      },
      prismaClient,
    );
    entries.push(delta);
  }

  return {
    specialty: options.specialty,
    referenceHospitalId: options.referenceHospitalId,
    entries: entries.sort((a, b) => a.target.hospitalId.localeCompare(b.target.hospitalId)),
  };
}

async function loadPrivilegeSetSnapshot(
  prismaClient: PrismaClient,
  hospitalId: string,
  specialty: string,
  version?: number,
): Promise<PrivilegeSetSnapshot> {
  const record = await prismaClient.privilegeSet.findFirst({
    where: {
      hospitalId,
      specialty,
      ...(version ? { version } : {}),
    },
    orderBy: version ? undefined : { version: 'desc' },
  });

  if (!record) {
    throw new Error(`PrivilegeSet not found for ${hospitalId}/${specialty}${version ? ` v${version}` : ''}`);
  }

  const procedures = normalizeProcedureList(record.procedures ?? []);

  return {
    id: record.id,
    hospitalId: record.hospitalId,
    specialty: record.specialty,
    version: record.version,
    procedures,
    updatedAt: record.updatedAt instanceof Date ? record.updatedAt.toISOString() : String(record.updatedAt),
  };
}

function normalizeProcedureList(values: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  values.forEach((value) => {
    const normalizedCode = normalizePrivilegeCode(value);
    if (!normalizedCode || seen.has(normalizedCode)) {
      return;
    }
    seen.add(normalizedCode);
    normalized.push(normalizedCode);
  });
  return normalized.sort();
}

function diff(source: Set<string>, compare: Set<string>): string[] {
  return Array.from(source).filter((value) => !compare.has(value)).sort();
}

function intersect(a: Set<string>, b: Set<string>): string[] {
  return Array.from(a).filter((value) => b.has(value)).sort();
}

function buildDeltaRecommendation(alignment: number, additions: string[], removals: string[]): string {
  if (alignment === 1 && additions.length === 0 && removals.length === 0) {
    return 'Aligned with system baseline.';
  }
  if (removals.length && !additions.length) {
    return `Add missing privileges: ${removals.slice(0, 5).join(', ')}`;
  }
  if (additions.length && !removals.length) {
    return `Review site-specific additions: ${additions.slice(0, 5).join(', ')}`;
  }
  return 'Mixed delta — route to committee for review.';
}










