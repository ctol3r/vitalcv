import { PrismaClient } from '@prisma/client';
import { globalMappingEngine } from './mapping-engine';
import { credentialWrapper } from './credential-wrapper';
import { proofGenerator } from './proof-generator';
import { regulatorAlignment } from './regulator-alignment';
import { translationChecker } from './translation-checker';
import { anomalyDetection } from './anomaly-detection';
import { migrationScoring } from './migration-scoring';
import { anchorCrossBorder } from './anchor';

const prisma = new PrismaClient();

export async function getCrossBorderBridge(clinicianId: string) {
  const existing = await prisma.crossBorderBridge.findUnique({
    where: { clinicianId },
  });

  if (existing) {
    return { id: existing.id, mappings: existing.mappings };
  }

  const created = await prisma.crossBorderBridge.create({
    data: {
      clinicianId,
      mappings: {},
    },
  });

  return { id: created.id, mappings: created.mappings };
}

export async function mapGlobalCredential(credentialId: string, sourceCountry: string, targetCountry: string) {
  return globalMappingEngine(credentialId, sourceCountry, targetCountry);
}

export async function wrapCredentialForRegion(credentialId: string, region: string) {
  return credentialWrapper(credentialId, region);
}

export async function generateCrossBorderProof(clinicianId: string, targetCountry: string) {
  return proofGenerator(clinicianId, targetCountry);
}

export async function alignWithRegulator(clinicianId: string, regulator: string) {
  return regulatorAlignment(clinicianId, regulator);
}

export async function checkTranslation(clinicianId: string, sourceCountry: string, targetCountry: string) {
  return translationChecker(clinicianId, sourceCountry, targetCountry);
}

export async function detectAnomalies(clinicianId: string) {
  return anomalyDetection(clinicianId);
}

export async function scoreMigrationReadiness(clinicianId: string, targetCountry: string) {
  return migrationScoring(clinicianId, targetCountry);
}

export async function anchorCrossBorderSnapshot(clinicianId: string) {
  const bridge = await prisma.crossBorderBridge.findUnique({
    where: { clinicianId },
  });

  if (!bridge) {
    throw new Error(`Cross-border bridge for clinician ${clinicianId} not found`);
  }

  return anchorCrossBorder(bridge);
}

export {
  globalMappingEngine,
  credentialWrapper,
  proofGenerator,
  regulatorAlignment,
  translationChecker,
  anomalyDetection,
  migrationScoring,
  anchorCrossBorder,
};








