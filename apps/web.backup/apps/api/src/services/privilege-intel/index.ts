/**
 * Batch 216 — Privilege Intelligence Network v3
 * AI mapping of privilege sets, risk, experience, and readiness across hospitals.
 */

import { prisma } from '@/lib/prisma';
import { anchorEvent } from '../audit/anchor';

export interface PrivilegeIntel {
  eligibility: {
    score: number;
    checks: Array<{ check: string; passed: boolean; reason?: string }>;
  };
  risk: {
    score: number;
    factors: Array<{ factor: string; severity: number }>;
  };
  comparison: {
    hospitals: Array<{ hospitalId: string; privileges: string[]; overlap: number }>;
  };
  confidence: number;
  trainingGaps: Array<{ gap: string; severity: 'low' | 'moderate' | 'high' }>;
}

/**
 * Task 216.2 — Cross-check credentials → privileges
 */
export async function checkPrivilegeEligibility(
  clinicianId: string,
  privilegeCodes: string[]
): Promise<{ score: number; checks: Array<{ check: string; passed: boolean; reason?: string }> }> {
  const clinician = await prisma.clinicianProfile.findUnique({
    where: { id: clinicianId },
    include: {
      credentials: true,
      licenses: true,
    },
  });

  if (!clinician) {
    throw new Error(`Clinician not found: ${clinicianId}`);
  }

  const checks: Array<{ check: string; passed: boolean; reason?: string }> = [];

  // Check required credentials
  for (const code of privilegeCodes) {
    // In production, this would query privilege requirements
    checks.push({
      check: `Privilege ${code} - License check`,
      passed: (clinician.licenses?.length || 0) > 0,
      reason: (clinician.licenses?.length || 0) === 0 ? 'No active licenses' : undefined,
    });

    checks.push({
      check: `Privilege ${code} - Board certification`,
      passed: (clinician.credentials?.filter((c) => c.type === 'board_certification').length || 0) > 0,
      reason: 'Board certification required',
    });
  }

  const passedCount = checks.filter((c) => c.passed).length;
  const score = checks.length > 0 ? passedCount / checks.length : 0;

  return { score, checks };
}

/**
 * Task 216.3 — Predict risk based on history & safety signals
 */
export async function predictPrivilegeRisk(
  clinicianId: string,
  privilegeCodes: string[]
): Promise<{ score: number; factors: Array<{ factor: string; severity: number }> }> {
  const safetySignals = await prisma.privilegeSafetySignal.findMany({
    where: {
      clinicianId,
      privilegeCodes: { hasSome: privilegeCodes },
    },
    orderBy: { detectedAt: 'desc' },
    take: 10,
  });

  const riskFactors: Array<{ factor: string; severity: number }> = [];

  for (const signal of safetySignals) {
    const severityMap = { LOW: 0.25, MED: 0.5, HIGH: 0.75, CRITICAL: 1.0 };
    riskFactors.push({
      factor: signal.summary,
      severity: severityMap[signal.severity] || 0.5,
    });
  }

  // Calculate overall risk score (0-1, higher = more risky)
  const riskScore = riskFactors.length > 0
    ? riskFactors.reduce((sum, f) => sum + f.severity, 0) / riskFactors.length
    : 0;

  return { score: Math.min(1, riskScore), factors: riskFactors };
}

/**
 * Task 216.4 — Compare clinician's privileges across hospitals
 */
export async function comparePrivilegesAcrossHospitals(
  clinicianId: string
): Promise<{ hospitals: Array<{ hospitalId: string; privileges: string[]; overlap: number }> }> {
  // In production, this would query privilege assignments per hospital
  // For now, return mock structure
  return {
    hospitals: [],
  };
}

/**
 * Task 216.6 — Auto-extract from hospital documents
 */
export async function extractHospitalPrivilegeMapping(
  hospitalId: string,
  documents: Array<{ type: string; content: string }>
): Promise<{ privileges: Array<{ code: string; name: string }> }> {
  // In production, this would use NLP/OCR to extract privilege mappings
  // For now, return empty structure
  return { privileges: [] };
}

/**
 * Task 216.7 — Score how well a clinician fits specific privileges
 */
export async function calculatePrivilegeConfidence(
  clinicianId: string,
  privilegeCodes: string[]
): Promise<number> {
  const eligibility = await checkPrivilegeEligibility(clinicianId, privilegeCodes);
  const risk = await predictPrivilegeRisk(clinicianId, privilegeCodes);

  // Confidence = eligibility * (1 - risk)
  return eligibility.score * (1 - risk.score);
}

/**
 * Task 216.8 — Identify missing logs, case volumes, CME
 */
export async function detectTrainingGaps(
  clinicianId: string,
  privilegeCodes: string[]
): Promise<Array<{ gap: string; severity: 'low' | 'moderate' | 'high' }> > {
  const gaps: Array<{ gap: string; severity: 'low' | 'moderate' | 'high' }> = [];

  // Check for missing procedure volumes
  const procedureVolumes = await prisma.procedureVolume.findMany({
    where: { clinicianId },
  });

  if (procedureVolumes.length === 0) {
    gaps.push({
      gap: 'Missing procedure volume logs',
      severity: 'high',
    });
  }

  // Check for missing CME
  // In production, this would check CME records
  gaps.push({
    gap: 'CME compliance may be incomplete',
    severity: 'moderate',
  });

  return gaps;
}

/**
 * Build complete privilege intelligence
 */
export async function buildPrivilegeIntel(
  clinicianId: string,
  privilegeCodes: string[]
): Promise<PrivilegeIntel> {
  const [eligibility, risk, comparison, confidence, trainingGaps] = await Promise.all([
    checkPrivilegeEligibility(clinicianId, privilegeCodes),
    predictPrivilegeRisk(clinicianId, privilegeCodes),
    comparePrivilegesAcrossHospitals(clinicianId),
    calculatePrivilegeConfidence(clinicianId, privilegeCodes),
    detectTrainingGaps(clinicianId, privilegeCodes),
  ]);

  return {
    eligibility,
    risk,
    comparison,
    confidence,
    trainingGaps,
  };
}

/**
 * Task 216.9 — Predict privilege needs by specialty
 */
export async function forecastPrivilegeLoad(
  specialty: string,
  horizonMonths: number = 6
): Promise<{ needs: Array<{ privilege: string; projectedDemand: number }> }> {
  // In production, this would analyze historical patterns
  return { needs: [] };
}

/**
 * Task 216.10 — Anchor privilege intel snapshot
 */
export async function anchorPrivilegeIntel(clinicianId: string, intel: PrivilegeIntel): Promise<void> {
  await prisma.privilegeIntel.upsert({
    where: { clinicianId },
    create: {
      clinicianId,
      intel,
      updatedAt: new Date(),
    },
    update: {
      intel,
      updatedAt: new Date(),
    },
  });

  anchorEvent('privilegeIntelAnchored', {
    clinicianId,
    intelHash: JSON.stringify(intel),
    confidence: intel.confidence,
    timestamp: new Date().toISOString(),
  });
}

