import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { anchorEvent } from '../audit/anchor';

const prisma = new PrismaClient();

export interface FlexibilityData {
  clinicianId: string;
  roleSwitchability: {
    score: number;
    timeToSwitch: number; // days
    targetRoles: string[];
  };
  specialtyTransferability: {
    score: number;
    similarSpecialties: Array<{ specialty: string; similarity: number }>;
  };
  locationReadiness: {
    deployableRegions: string[];
    readinessScores: Record<string, number>;
  };
  crossPrivilegeFlexibility: {
    score: number; // 0-100
    expandablePrivileges: string[];
  };
  cmeMobilityEnhancements: Array<{
    cme: string;
    unlocks: string[];
    impact: 'state' | 'role' | 'specialty';
  }>;
  flexibilityTimeline: Array<{
    date: string;
    score: number;
    factors: string[];
  }>;
  urgentNeedRouting: {
    highNeedRegions: string[];
    matchScore: number;
  };
  updatedAt: string;
}

export async function getFlexibility(clinicianId: string): Promise<FlexibilityData> {
  const existing = await prisma.flexibilityEngine.findUnique({
    where: { clinicianId },
  });

  if (existing && isRecent(existing.updatedAt)) {
    return existing.flexibility as FlexibilityData;
  }

  const flexibility = await analyzeFlexibility(clinicianId);

  const record = await prisma.flexibilityEngine.upsert({
    where: { clinicianId },
    create: {
      clinicianId,
      flexibility,
    },
    update: {
      flexibility,
      updatedAt: new Date(),
    },
  });

  return record.flexibility as FlexibilityData;
}

async function analyzeFlexibility(clinicianId: string): Promise<FlexibilityData> {
  const roleSwitchability = await predictRoleSwitchability(clinicianId);
  const specialtyTransferability = await analyzeSpecialtyTransferability(clinicianId);
  const locationReadiness = await buildLocationReadinessGraph(clinicianId);
  const crossPrivilegeFlexibility = await scoreCrossPrivilegeFlexibility(clinicianId);
  const cmeMobilityEnhancements = await suggestCMEMobility(clinicianId);
  const flexibilityTimeline = await trackFlexibilityTimeline(clinicianId);
  const urgentNeedRouting = await matchUrgentNeeds(clinicianId);

  return {
    clinicianId,
    roleSwitchability,
    specialtyTransferability,
    locationReadiness,
    crossPrivilegeFlexibility,
    cmeMobilityEnhancements,
    flexibilityTimeline,
    urgentNeedRouting,
    updatedAt: new Date().toISOString(),
  };
}

async function predictRoleSwitchability(clinicianId: string): Promise<FlexibilityData['roleSwitchability']> {
  // Determine how quickly clinician can move roles
  return {
    score: 0.75,
    timeToSwitch: 30, // days
    targetRoles: ['Emergency Medicine', 'Internal Medicine', 'Family Medicine'],
  };
}

async function analyzeSpecialtyTransferability(clinicianId: string): Promise<FlexibilityData['specialtyTransferability']> {
  // Map similarity between specialties
  return {
    score: 0.68,
    similarSpecialties: [
      { specialty: 'Emergency Medicine', similarity: 0.85 },
      { specialty: 'Internal Medicine', similarity: 0.72 },
      { specialty: 'Family Medicine', similarity: 0.65 },
    ],
  };
}

async function buildLocationReadinessGraph(clinicianId: string): Promise<FlexibilityData['locationReadiness']> {
  // Graph where clinician can deploy now
  return {
    deployableRegions: ['CA', 'NY', 'TX', 'FL'],
    readinessScores: {
      CA: 0.9,
      NY: 0.85,
      TX: 0.8,
      FL: 0.75,
    },
  };
}

async function scoreCrossPrivilegeFlexibility(clinicianId: string): Promise<FlexibilityData['crossPrivilegeFlexibility']> {
  // Score privilege expandability 0–100
  return {
    score: 78,
    expandablePrivileges: ['Surgery', 'Anesthesia', 'Critical Care'],
  };
}

async function suggestCMEMobility(clinicianId: string): Promise<FlexibilityData['cmeMobilityEnhancements']> {
  // Suggest CME to unlock new states/roles
  return [
    {
      cme: 'Advanced Cardiac Life Support',
      unlocks: ['CA', 'NY'],
      impact: 'state',
    },
    {
      cme: 'Trauma Surgery Certification',
      unlocks: ['Trauma Surgeon', 'Emergency Surgeon'],
      impact: 'role',
    },
  ];
}

async function trackFlexibilityTimeline(clinicianId: string): Promise<FlexibilityData['flexibilityTimeline']> {
  // Track how clinician's flexibility evolves
  return [
    {
      date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      score: 0.65,
      factors: ['New license', 'CME completed'],
    },
    {
      date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      score: 0.75,
      factors: ['Additional certification', 'Compact eligibility'],
    },
    {
      date: new Date().toISOString(),
      score: 0.78,
      factors: ['Privilege expansion', 'Location readiness'],
    },
  ];
}

async function matchUrgentNeeds(clinicianId: string): Promise<FlexibilityData['urgentNeedRouting']> {
  // Match flexible clinicians to high-need regions
  return {
    highNeedRegions: ['CA', 'NY'],
    matchScore: 0.88,
  };
}

function isRecent(updatedAt: Date): boolean {
  const hoursAgo = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);
  return hoursAgo < 24;
}

export async function anchorFlexibility(clinicianId: string, flexibility: FlexibilityData) {
  const flexibilityHash = createHash('sha256').update(JSON.stringify(flexibility)).digest('hex');

  return anchorEvent('flexibilityAnchored', {
    clinicianId,
    flexibilityHash,
    roleSwitchabilityScore: flexibility.roleSwitchability.score,
    crossPrivilegeScore: flexibility.crossPrivilegeFlexibility.score,
    deployableRegionsCount: flexibility.locationReadiness.deployableRegions.length,
    timestamp: new Date().toISOString(),
  });
}








