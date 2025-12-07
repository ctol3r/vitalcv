/**
 * Batch 432 — Clinician Competency-Role Fusion Grid v7
 * Fuse competencies, skills, experience, training, and privileges into a "role fusion grid"
 */

import { PrismaClient } from '@prisma/client';
import { anchorEvent } from '../audit/anchor';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

export interface Competency {
  type: string;
  level: number;
  source: string;
}

export interface RoleRequirement {
  role: string;
  competencies: string[];
  privileges: string[];
  experience: number; // years
}

export interface FusionGridResult {
  clinicianId: string;
  fusion: {
    competencies: Competency[];
    duties: string[];
    privileges: string[];
    currentRoles: string[];
    futureRoles: string[];
  };
  matrix: {
    roles: string[];
    readinessScores: Record<string, number>; // role -> score (0-100)
    gaps: Record<string, string[]>; // role -> missing competencies
  };
  readiness: {
    scores: Record<string, number>; // role -> readiness score
    recommendations: Array<{
      role: string;
      score: number;
      actions: string[];
    }>;
  };
  drift: {
    detected: boolean;
    breakBetween: {
      skills: string[];
      privileges: string[];
    };
    severity: 'low' | 'medium' | 'high';
  };
  enhancement: {
    recommendations: Array<{
      type: 'CME' | 'privilege' | 'certification';
      description: string;
      priority: 'low' | 'medium' | 'high';
      impact: number;
    }>;
  };
  specialtyTransfer: {
    pathways: Array<{
      from: string;
      to: string;
      steps: string[];
      estimatedTime: number; // months
      difficulty: 'low' | 'medium' | 'high';
    }>;
  };
  updatedAt: string;
}

/**
 * Integrate competencies, duties & privileges
 */
function integrateCompetencyDutiesPrivileges(
  competencies: Competency[],
  duties: string[],
  privileges: string[]
): FusionGridResult['fusion'] {
  return {
    competencies,
    duties,
    privileges,
    currentRoles: [], // Would be determined from privileges and duties
    futureRoles: [], // Would be determined from competency analysis
  };
}

/**
 * Map competencies to current & future roles
 */
function generateRoleMatrix(
  fusion: FusionGridResult['fusion'],
  roleRequirements: RoleRequirement[]
): FusionGridResult['matrix'] {
  const readinessScores: Record<string, number> = {};
  const gaps: Record<string, string[]> = {};

  for (const requirement of roleRequirements) {
    const hasCompetencies = requirement.competencies.filter((comp) =>
      fusion.competencies.some((c) => c.type === comp)
    ).length;
    const hasPrivileges = requirement.privileges.filter((priv) => fusion.privileges.includes(priv)).length;
    const hasExperience = fusion.competencies.some((c) => c.level >= requirement.experience);

    const score = ((hasCompetencies / requirement.competencies.length) * 40 +
                   (hasPrivileges / requirement.privileges.length) * 40 +
                   (hasExperience ? 20 : 0));

    readinessScores[requirement.role] = Math.round(score);

    const missingCompetencies = requirement.competencies.filter(
      (comp) => !fusion.competencies.some((c) => c.type === comp)
    );
    gaps[requirement.role] = missingCompetencies;
  }

  return {
    roles: roleRequirements.map((r) => r.role),
    readinessScores,
    gaps,
  };
}

/**
 * Score alignment between clinician → target role
 */
function scoreRoleReadiness(
  clinicianId: string,
  targetRole: string,
  matrix: FusionGridResult['matrix']
): number {
  return matrix.readinessScores[targetRole] ?? 0;
}

/**
 * Detect break between skill and privilege evolution
 */
function detectFusionDrift(fusion: FusionGridResult['fusion']): FusionGridResult['drift'] {
  // Simplified drift detection
  const skillTypes = new Set(fusion.competencies.map((c) => c.type));
  const privilegeTypes = new Set(fusion.privileges.map((p) => p.split('.')[0]));

  const missingSkills = fusion.privileges
    .map((p) => p.split('.')[0])
    .filter((p) => !skillTypes.has(p));

  const missingPrivileges = Array.from(skillTypes).filter((s) => !privilegeTypes.has(s));

  const detected = missingSkills.length > 0 || missingPrivileges.length > 0;

  return {
    detected,
    breakBetween: {
      skills: missingPrivileges,
      privileges: missingSkills,
    },
    severity: missingSkills.length > 3 || missingPrivileges.length > 3 ? 'high' :
               missingSkills.length > 1 || missingPrivileges.length > 1 ? 'medium' : 'low',
  };
}

/**
 * Recommend CME, privileges, certifications
 */
function recommendEnhancements(
  matrix: FusionGridResult['matrix'],
  drift: FusionGridResult['drift']
): FusionGridResult['enhancement'] {
  const recommendations: FusionGridResult['enhancement']['recommendations'] = [];

  // Recommend based on gaps
  Object.entries(matrix.gaps).forEach(([role, gaps]) => {
    if (gaps.length > 0) {
      recommendations.push({
        type: 'certification',
        description: `Obtain certifications for ${gaps.join(', ')} to qualify for ${role}`,
        priority: gaps.length > 3 ? 'high' : 'medium',
        impact: gaps.length * 10,
      });
    }
  });

  // Recommend based on drift
  if (drift.detected) {
    recommendations.push({
      type: 'privilege',
      description: `Address privilege gaps: ${drift.breakBetween.privileges.join(', ')}`,
      priority: drift.severity === 'high' ? 'high' : 'medium',
      impact: drift.breakBetween.privileges.length * 15,
    });
  }

  return { recommendations };
}

/**
 * Predict transfer path between specialties
 */
function predictSpecialtyTransfer(
  currentRole: string,
  targetRole: string
): FusionGridResult['specialtyTransfer'] {
  // Simplified transfer pathway prediction
  const steps = [
    `Assess current competencies in ${currentRole}`,
    `Identify gap competencies for ${targetRole}`,
    `Complete required CME courses`,
    `Obtain necessary certifications`,
    `Apply for privileges in ${targetRole}`,
  ];

  return {
    pathways: [
      {
        from: currentRole,
        to: targetRole,
        steps,
        estimatedTime: 12, // months
        difficulty: 'medium',
      },
    ],
  };
}

/**
 * Generate fusion grid profile
 */
export async function generateFusionGrid(
  clinicianId: string,
  competencies: Competency[],
  duties: string[],
  privileges: string[]
): Promise<FusionGridResult> {
  const fusion = integrateCompetencyDutiesPrivileges(competencies, duties, privileges);

  // Example role requirements (in real implementation, would come from database)
  const roleRequirements: RoleRequirement[] = [
    { role: 'Emergency Medicine', competencies: ['trauma', 'critical_care'], privileges: ['emergency_procedures'], experience: 2 },
    { role: 'Internal Medicine', competencies: ['diagnosis', 'patient_management'], privileges: ['internal_procedures'], experience: 1 },
  ];

  const matrix = generateRoleMatrix(fusion, roleRequirements);
  const readiness = {
    scores: matrix.readinessScores,
    recommendations: Object.entries(matrix.readinessScores).map(([role, score]) => ({
      role,
      score,
      actions: matrix.gaps[role] || [],
    })),
  };

  const drift = detectFusionDrift(fusion);
  const enhancement = recommendEnhancements(matrix, drift);
  const specialtyTransfer = predictSpecialtyTransfer('current', 'target');

  const result: FusionGridResult = {
    clinicianId,
    fusion,
    matrix,
    readiness,
    drift,
    enhancement,
    specialtyTransfer,
    updatedAt: new Date().toISOString(),
  };

  // Save to database
  await prisma.competencyRoleFusion.upsert({
    where: { clinicianId },
    create: {
      clinicianId,
      fusion: result as any,
    },
    update: {
      fusion: result as any,
    },
  });

  return result;
}

/**
 * Export fusion dossier
 */
export async function exportFusionDossier(clinicianId: string): Promise<{
  fusion: FusionGridResult;
  exportHash: string;
  generatedAt: string;
}> {
  const record = await prisma.competencyRoleFusion.findUnique({
    where: { clinicianId },
  });

  if (!record) {
    throw new Error(`No fusion grid found for clinician ${clinicianId}`);
  }

  const fusion = record.fusion as any as FusionGridResult;

  // Anchor snapshot
  anchorEvent('competencyRoleFusionAnchored', {
    clinicianId,
    fusionHash: createHash('sha256').update(JSON.stringify(fusion)).digest('hex'),
    roleCount: fusion.matrix.roles.length,
    driftDetected: fusion.drift.detected,
  });

  return {
    fusion,
    exportHash: `fusion_${clinicianId}_${Date.now()}`,
    generatedAt: new Date().toISOString(),
  };
}








