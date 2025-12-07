import type { SkillGraph } from './graph';
import { buildSkillGraph, type BuildSkillGraphOptions } from './graph';

export interface JobSkillRequirements {
  requiredSkills?: string[];
  requiredCertifications?: string[];
  privilegedProcedures?: string[];
}

export interface SkillMatchResult {
  clinicianId: string;
  skillMatchScore: number;
  missingSkills: string[];
  coveredSkills: string[];
  coverageByCategory: Record<'skills' | 'certifications' | 'procedures', number>;
  graph: SkillGraph;
}

export async function matchClinicianToJob(
  clinicianId: string,
  requirements: JobSkillRequirements,
  options: BuildSkillGraphOptions = {},
): Promise<SkillMatchResult> {
  const graph = await buildSkillGraph(clinicianId, options);
  if (!graph) {
    throw new Error(`Clinician ${clinicianId} not found for skill evaluation`);
  }

  const lookup = buildLookup(graph);
  const coverage = {
    skills: computeCoverage(requirements.requiredSkills ?? [], lookup.specialty),
    certifications: computeCoverage(
      requirements.requiredCertifications ?? [],
      lookup.certifications,
    ),
    procedures: computeCoverage(
      requirements.privilegedProcedures ?? [],
      lookup.procedures,
    ),
  };

  const skillMatchScore = Number(
    clamp01(
      (coverage.skills.score + coverage.certifications.score + coverage.procedures.score) / 3,
    ).toFixed(4),
  );

  const missingSkills = [
    ...coverage.skills.missing,
    ...coverage.certifications.missing,
    ...coverage.procedures.missing,
  ];
  const coveredSkills = [
    ...coverage.skills.covered,
    ...coverage.certifications.covered,
    ...coverage.procedures.covered,
  ];

  return {
    clinicianId,
    skillMatchScore,
    missingSkills,
    coveredSkills,
    coverageByCategory: {
      skills: coverage.skills.score,
      certifications: coverage.certifications.score,
      procedures: coverage.procedures.score,
    },
    graph,
  };
}

function buildLookup(graph: SkillGraph) {
  const specialty = new Map<string, number>();
  const certifications = new Map<string, number>();
  const procedures = new Map<string, number>();

  graph.nodes.forEach((node) => {
    const key = node.name.toLowerCase();
    if (node.category === 'specialty') {
      specialty.set(key, node.strength);
    } else if (node.category === 'certification') {
      certifications.set(key, node.strength);
    } else if (node.category === 'procedure') {
      procedures.set(key, node.strength);
    }
  });

  return { specialty, certifications, procedures };
}

function computeCoverage(requirements: string[], lookup: Map<string, number>) {
  if (!requirements.length) {
    return {
      score: 1,
      missing: [],
      covered: [],
    };
  }

  let covered = 0;
  const missing: string[] = [];
  const satisfied: string[] = [];

  requirements.forEach((requirement) => {
    const strength = lookup.get(requirement.toLowerCase());
    if (typeof strength === 'number' && strength >= 0.4) {
      covered += 1;
      satisfied.push(requirement);
    } else {
      missing.push(requirement);
    }
  });

  return {
    score: clamp01(covered / requirements.length),
    missing,
    covered: satisfied,
  };
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

