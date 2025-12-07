/**
 * B224A-REP-001: ClinicianReputation Model
 *
 * Represents a clinician's reputation scores across multiple dimensions.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ClinicianReputationData {
  clinicianId: string;
  overallScore: number;
  qualityScore: number;
  credentialScore: number;
  enrollmentScore: number;
  peerReviewsScore: number;
}

export interface ClinicianReputationUpdate {
  overallScore?: number;
  qualityScore?: number;
  credentialScore?: number;
  enrollmentScore?: number;
  peerReviewsScore?: number;
}

/**
 * Get or create reputation record for a clinician
 */
export async function getOrCreateReputation(
  clinicianId: string
): Promise<ClinicianReputationData> {
  const existing = await prisma.clinicianReputation.findUnique({
    where: { clinicianId },
  });

  if (existing) {
    return {
      clinicianId: existing.clinicianId,
      overallScore: existing.overallScore,
      qualityScore: existing.qualityScore,
      credentialScore: existing.credentialScore,
      enrollmentScore: existing.enrollmentScore,
      peerReviewsScore: existing.peerReviewsScore,
    };
  }

  const created = await prisma.clinicianReputation.create({
    data: {
      clinicianId,
      overallScore: 0,
      qualityScore: 0,
      credentialScore: 0,
      enrollmentScore: 0,
      peerReviewsScore: 0,
    },
  });

  return {
    clinicianId: created.clinicianId,
    overallScore: created.overallScore,
    qualityScore: created.qualityScore,
    credentialScore: created.credentialScore,
    enrollmentScore: created.enrollmentScore,
    peerReviewsScore: created.peerReviewsScore,
  };
}

/**
 * Update reputation scores for a clinician
 */
export async function updateReputation(
  clinicianId: string,
  update: ClinicianReputationUpdate
): Promise<ClinicianReputationData> {
  const updated = await prisma.clinicianReputation.upsert({
    where: { clinicianId },
    update: {
      ...update,
      updatedAt: new Date(),
    },
    create: {
      clinicianId,
      overallScore: update.overallScore ?? 0,
      qualityScore: update.qualityScore ?? 0,
      credentialScore: update.credentialScore ?? 0,
      enrollmentScore: update.enrollmentScore ?? 0,
      peerReviewsScore: update.peerReviewsScore ?? 0,
    },
  });

  return {
    clinicianId: updated.clinicianId,
    overallScore: updated.overallScore,
    qualityScore: updated.qualityScore,
    credentialScore: updated.credentialScore,
    enrollmentScore: updated.enrollmentScore,
    peerReviewsScore: updated.peerReviewsScore,
  };
}

/**
 * Get reputation for a clinician
 */
export async function getReputation(
  clinicianId: string
): Promise<ClinicianReputationData | null> {
  const reputation = await prisma.clinicianReputation.findUnique({
    where: { clinicianId },
  });

  if (!reputation) {
    return null;
  }

  return {
    clinicianId: reputation.clinicianId,
    overallScore: reputation.overallScore,
    qualityScore: reputation.qualityScore,
    credentialScore: reputation.credentialScore,
    enrollmentScore: reputation.enrollmentScore,
    peerReviewsScore: reputation.peerReviewsScore,
  };
}

/**
 * Get multiple reputations by clinician IDs
 */
export async function getReputations(
  clinicianIds: string[]
): Promise<Map<string, ClinicianReputationData>> {
  const reputations = await prisma.clinicianReputation.findMany({
    where: {
      clinicianId: { in: clinicianIds },
    },
  });

  const map = new Map<string, ClinicianReputationData>();
  for (const rep of reputations) {
    map.set(rep.clinicianId, {
      clinicianId: rep.clinicianId,
      overallScore: rep.overallScore,
      qualityScore: rep.qualityScore,
      credentialScore: rep.credentialScore,
      enrollmentScore: rep.enrollmentScore,
      peerReviewsScore: rep.peerReviewsScore,
    });
  }

  return map;
}

