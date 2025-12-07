import { PrismaClient, Prisma } from '@prisma/client';
import {
  PrivilegeGraph,
  PrivilegeMatrixEntry,
  PrivilegePrerequisite,
  PrivilegeNode,
  normalizePrivilegeCode,
  parsePrerequisites,
  cloneMatrixEntry,
} from './types';

const prisma = new PrismaClient();

type PrivilegeMatrixRecord = Prisma.PrivilegeMatrixGetPayload<Prisma.PrivilegeMatrixDefaultArgs>;

function mapRecord(record: PrivilegeMatrixRecord): PrivilegeMatrixEntry {
  return {
    id: record.id,
    privilegeCode: record.privilegeCode,
    name: record.name,
    specialty: record.specialty,
    description: record.description,
    prerequisites: parsePrerequisites(record.prerequisites),
    tags: record.tags ?? [],
    isActive: record.isActive,
  };
}

function addEdge(map: Map<string, Set<string>>, from: string, to: string) {
  if (!map.has(from)) {
    map.set(from, new Set());
  }
  map.get(from)!.add(to);
}

function addConflict(conflicts: Map<string, Set<string>>, a: string, b: string) {
  if (!conflicts.has(a)) {
    conflicts.set(a, new Set());
  }
  if (!conflicts.has(b)) {
    conflicts.set(b, new Set());
  }
  conflicts.get(a)!.add(b);
  conflicts.get(b)!.add(a);
}

function extractDependencyCodes(prerequisites: PrivilegePrerequisite[]): string[] {
  return prerequisites
    .filter((p): p is Extract<PrivilegePrerequisite, { type: 'PRIVILEGE' }> => p.type === 'PRIVILEGE')
    .map((p) => normalizePrivilegeCode(p.privilegeCode))
    .filter(Boolean);
}

function extractConflictCodes(prerequisites: PrivilegePrerequisite[]): string[][] {
  return prerequisites
    .filter((p): p is Extract<PrivilegePrerequisite, { type: 'CONFLICT' }> => p.type === 'CONFLICT')
    .map((conflict) => conflict.privilegeCodes.map((code) => normalizePrivilegeCode(code)).filter(Boolean))
    .filter((group) => group.length > 0);
}

function extractMutexGroups(tags: string[] = []): Record<string, true> {
  const groups: Record<string, true> = {};
  for (const tag of tags) {
    if (!tag) continue;
    const [prefix, value] = tag.split(':', 2);
    if (prefix?.toLowerCase() === 'mutex' && value) {
      groups[normalizePrivilegeCode(value)] = true;
    }
  }
  return groups;
}

export async function fetchPrivilegeMatrixEntries(
  codes: string[],
  includeInactive = false
): Promise<PrivilegeMatrixEntry[]> {
  if (codes.length === 0) {
    return [];
  }

  const normalized = Array.from(new Set(codes.map((code) => normalizePrivilegeCode(code)).filter(Boolean)));
  if (!normalized.length) {
    return [];
  }

  const records = await prisma.privilegeMatrix.findMany({
    where: {
      privilegeCode: { in: normalized },
      ...(includeInactive ? {} : { isActive: true }),
    },
  });

  return records.map(mapRecord);
}

export async function buildPrivilegeGraph(
  rootCode: string,
  options: { maxDepth?: number; includeInactive?: boolean } = {}
): Promise<PrivilegeGraph> {
  const normalizedRoot = normalizePrivilegeCode(rootCode);
  const maxDepth = options.maxDepth ?? 4;
  const nodes = new Map<string, PrivilegeNode>();
  const downstream = new Map<string, Set<string>>();
  const upstream = new Map<string, Set<string>>();
  const conflicts = new Map<string, Set<string>>();
  const missingCodes = new Set<string>();
  const queue: Array<{ code: string; depth: number }> = [{ code: normalizedRoot, depth: 0 }];
  const fetched = new Set<string>();

  while (queue.length > 0) {
    const { code, depth } = queue.shift()!;
    if (fetched.has(code) || depth > maxDepth) {
      continue;
    }

    fetched.add(code);
    const entry = await prisma.privilegeMatrix.findFirst({
      where: {
        privilegeCode: code,
        ...(options.includeInactive ? {} : { isActive: true }),
      },
    });

    if (!entry) {
      missingCodes.add(code);
      continue;
    }

    const mapped = mapRecord(entry);
    nodes.set(code, cloneMatrixEntry(mapped));

    const dependencyCodes = extractDependencyCodes(mapped.prerequisites);
    for (const dependency of dependencyCodes) {
      addEdge(downstream, dependency, code);
      addEdge(upstream, code, dependency);
      if (!fetched.has(dependency)) {
        queue.push({ code: dependency, depth: depth + 1 });
      }
    }

    const conflictGroups = extractConflictCodes(mapped.prerequisites);
    for (const group of conflictGroups) {
      for (const other of group) {
        if (other === code) continue;
        addConflict(conflicts, code, other);
        if (!fetched.has(other)) {
          queue.push({ code: other, depth: depth + 1 });
        }
      }
    }

    const mutexGroups = extractMutexGroups(mapped.tags);
    for (const groupCode of Object.keys(mutexGroups)) {
      if (!groupCode || groupCode === code) continue;
      addConflict(conflicts, code, groupCode);
      if (!fetched.has(groupCode)) {
        queue.push({ code: groupCode, depth: depth + 1 });
      }
    }
  }

  return {
    rootCode: normalizedRoot,
    nodes,
    downstream,
    upstream,
    conflicts,
    missingCodes,
  };
}

