import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

export interface IdentitySource {
  sourceId: string;
  sourceType: 'NPPES' | 'STATE_BOARD' | 'NPDB' | 'GLOBAL_REGULATOR';
  data: Record<string, unknown>;
  confidence: number;
  timestamp: string;
}

export interface IngestedIdentity {
  clinicianId: string;
  sources: IdentitySource[];
  fused: Record<string, unknown>;
  confidence: number;
}

/**
 * Ingest identity data from multiple sources (NPPES, state boards, NPDB, global regulators)
 */
export async function ingestIdentitySources(
  clinicianId: string,
  options: { prisma?: PrismaClient } = {},
): Promise<IngestedIdentity> {
  const prisma = options.prisma ?? new PrismaClient();

  const sources: IdentitySource[] = [];

  // Ingest NPPES data
  const nppesData = await ingestNPPES(clinicianId, prisma);
  if (nppesData) {
    sources.push(nppesData);
  }

  // Ingest state board data
  const stateBoardData = await ingestStateBoards(clinicianId, prisma);
  sources.push(...stateBoardData);

  // Ingest NPDB data
  const npdbData = await ingestNPDB(clinicianId, prisma);
  if (npdbData) {
    sources.push(npdbData);
  }

  // Ingest global regulators (AHPRA, GMC, NMC)
  const globalRegulatorData = await ingestGlobalRegulators(clinicianId, prisma);
  sources.push(...globalRegulatorData);

  // Compute fused identity
  const fused = computeFusedIdentity(sources);
  const confidence = computeConfidence(sources);

  return {
    clinicianId,
    sources,
    fused,
    confidence,
  };
}

async function ingestNPPES(
  clinicianId: string,
  prisma: PrismaClient,
): Promise<IdentitySource | null> {
  // Check if we have NPI validation data
  const npiValidation = await prisma.nPIValidation.findFirst({
    where: { clinicianId },
    orderBy: { updatedAt: 'desc' },
  });

  if (!npiValidation) {
    return null;
  }

  const crossRefs = (npiValidation.crossRefs as Record<string, unknown>) ?? {};
  const nppesData = crossRefs.nppes as Record<string, unknown> | undefined;

  if (!nppesData) {
    return null;
  }

  return {
    sourceId: `nppes_${npiValidation.npi}`,
    sourceType: 'NPPES',
    data: {
      npi: npiValidation.npi,
      ...nppesData,
    },
    confidence: 0.95,
    timestamp: npiValidation.updatedAt.toISOString(),
  };
}

async function ingestStateBoards(
  clinicianId: string,
  prisma: PrismaClient,
): Promise<IdentitySource[]> {
  const licenses = await prisma.stateLicenseVerification.findMany({
    where: { clinicianId },
    orderBy: { updatedAt: 'desc' },
  });

  return licenses.map((license) => ({
    sourceId: license.id,
    sourceType: 'STATE_BOARD' as const,
    data: {
      state: license.state,
      licenseNumber: license.licenseNumber,
      status: license.status,
      issueDate: license.issueDate?.toISOString(),
      expiryDate: license.expiryDate?.toISOString(),
      metadata: license.metadata,
    },
    confidence: 0.9,
    timestamp: license.updatedAt?.toISOString() ?? license.verifiedAt?.toISOString() ?? new Date().toISOString(),
  }));
}

async function ingestNPDB(
  clinicianId: string,
  prisma: PrismaClient,
): Promise<IdentitySource | null> {
  // Check for NPDB-related drift events or risk events
  const npdbEvents = await prisma.driftEvent.findMany({
    where: {
      clinicianId,
      driftType: 'NPDB_FLAG',
    },
    orderBy: { detectedAt: 'desc' },
    take: 1,
  });

  if (!npdbEvents.length) {
    return null;
  }

  const event = npdbEvents[0];
  const metadata = (event.metadata as Record<string, unknown>) ?? {};

  return {
    sourceId: event.id,
    sourceType: 'NPDB',
    data: {
      ...metadata,
      severity: event.severity,
      detectedAt: event.detectedAt.toISOString(),
    },
    confidence: event.severity === 'CRITICAL' ? 0.98 : 0.85,
    timestamp: event.detectedAt.toISOString(),
  };
}

async function ingestGlobalRegulators(
  clinicianId: string,
  prisma: PrismaClient,
): Promise<IdentitySource[]> {
  const globalLicenses = await prisma.globalLicense.findMany({
    where: { clinicianId },
    orderBy: { updatedAt: 'desc' },
  });

  const regulatorMap: Record<string, 'AHPRA' | 'GMC' | 'NMC'> = {
    AHPRA: 'AHPRA',
    'Australian Health Practitioner Regulation Agency': 'AHPRA',
    GMC: 'GMC',
    'General Medical Council': 'GMC',
    NMC: 'NMC',
    'Nursing and Midwifery Council': 'NMC',
  };

  return globalLicenses
    .filter((license) => {
      const authority = license.authority?.toUpperCase() ?? '';
      return Object.keys(regulatorMap).some((key) => authority.includes(key));
    })
    .map((license) => {
      const authority = license.authority?.toUpperCase() ?? '';
      let regulatorType: 'AHPRA' | 'GMC' | 'NMC' = 'AHPRA';
      for (const [key, value] of Object.entries(regulatorMap)) {
        if (authority.includes(key)) {
          regulatorType = value;
          break;
        }
      }

      return {
        sourceId: license.id,
        sourceType: 'GLOBAL_REGULATOR' as const,
        data: {
          country: license.country,
          authority: license.authority,
          licenseNumber: license.licenseNumber,
          status: license.status,
          expiresAt: license.expiresAt?.toISOString(),
          equivalencyLevel: license.equivalencyLevel,
        },
        confidence: 0.88,
        timestamp: license.updatedAt.toISOString(),
      };
    });
}

function computeFusedIdentity(sources: IdentitySource[]): Record<string, unknown> {
  if (!sources.length) {
    return {};
  }

  const fused: Record<string, unknown> = {};
  const fieldWeights: Record<string, number> = {};

  for (const source of sources) {
    for (const [key, value] of Object.entries(source.data)) {
      if (value === null || value === undefined) continue;

      const weight = source.confidence;
      const currentWeight = fieldWeights[key] ?? 0;

      if (weight > currentWeight) {
        fused[key] = value;
        fieldWeights[key] = weight;
      }
    }
  }

  return fused;
}

function computeConfidence(sources: IdentitySource[]): number {
  if (!sources.length) {
    return 0;
  }

  // Weighted average confidence, with higher weight for more sources
  const totalConfidence = sources.reduce((sum, s) => sum + s.confidence, 0);
  const baseConfidence = totalConfidence / sources.length;

  // Boost confidence if multiple sources agree
  const sourceCountBoost = Math.min(sources.length * 0.05, 0.15);
  return Math.min(baseConfidence + sourceCountBoost, 1.0);
}

