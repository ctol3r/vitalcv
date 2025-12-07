import { PrismaClient } from '@prisma/client';
import type { PrivilegeOntology } from './parser';

/**
 * Infer missing privileges based on peer hospitals
 */
export async function inferMissingPrivileges(
  hospitalId: string,
  specialty: string,
  options: { prisma?: PrismaClient } = {},
): Promise<{
  inferred: string[];
  confidence: number;
  peerHospitals: string[];
}> {
  const prisma = options.prisma ?? new PrismaClient();

  // Find peer hospitals (same specialty, similar size)
  const peerOntologies = await prisma.privilegeOntology.findMany({
    where: {
      specialty,
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });

  if (peerOntologies.length === 0) {
    return {
      inferred: [],
      confidence: 0,
      peerHospitals: [],
    };
  }

  // Aggregate procedures from peer hospitals
  const procedureCounts = new Map<string, number>();

  for (const ontology of peerOntologies) {
    const procedures = (ontology.ontology as PrivilegeOntology).procedures ?? [];
    for (const procedure of procedures) {
      procedureCounts.set(procedure, (procedureCounts.get(procedure) ?? 0) + 1);
    }
  }

  // Procedures that appear in majority of peer hospitals
  const threshold = Math.ceil(peerOntologies.length * 0.6);
  const inferred: string[] = [];

  for (const [procedure, count] of procedureCounts.entries()) {
    if (count >= threshold) {
      inferred.push(procedure);
    }
  }

  const confidence = peerOntologies.length >= 5 ? 0.8 : 0.6;

  return {
    inferred,
    confidence,
    peerHospitals: peerOntologies.map((o) => o.id),
  };
}

