import { createHash } from 'crypto';

import {
  PrismaClient,
  type MobilityPassport as MobilityPassportModel,
  type Prisma,
} from '@prisma/client';

import type { PassportAnomaly } from '../../../../services/mobility/anomalyDetector';
import { detectPassportAnomalies } from '../../../../services/mobility/anomalyDetector';
import type { CompactEligibilityV2Result } from '../../../../services/mobility/compactEligibilityV2';
import { runCompactEligibilityEngineV2 } from '../../../../services/mobility/compactEligibilityV2';
import type { ReciprocityPathway } from '../../../../services/mobility/globalReciprocity';
import { buildGlobalReciprocityMap } from '../../../../services/mobility/globalReciprocity';
import type { MobilityPassportPdf } from '../../../../services/mobility/passportPdf';
import { generateMobilityPassportPdf } from '../../../../services/mobility/passportPdf';
import type { MobilityScoreBreakdown } from '../../../../services/mobility/mobilityScore';
import { calculateMobilityScore } from '../../../../services/mobility/mobilityScore';
import type { WaiverEligibilityResult } from '../../../../services/mobility/waiverEligibility';
import { evaluateWaiverEligibility } from '../../../../services/mobility/waiverEligibility';
import { anchorMobilitySnapshot } from '../audit/anchor';

const prisma = new PrismaClient();
const STALE_MINUTES = 360;

export interface MobilityPassportSnapshot {
  passportId: string;
  clinicianId: string;
  updatedAt: string;
  generatedAt: string;
  statesEligible: string[];
  countries: string[];
  mobilityScore: MobilityScoreBreakdown;
  compacts: CompactEligibilityV2Result[];
  reciprocityPaths: ReciprocityPathway[];
  waiverEligibility: WaiverEligibilityResult;
  anomalies: PassportAnomaly[];
  metrics: MobilityPassportMetrics;
  pdf: MobilityPassportPdf;
  anchor: AnchorSummary | null;
  snapshotHash: string;
}

export interface MobilityPassportOptions {
  refresh?: boolean;
  prisma?: PrismaClient;
}

export interface MobilityPassportMetrics {
  licenseBreadth: number;
  compactCount: number;
  reciprocityReady: number;
}

export interface AnchorSummary {
  id: string;
  txHash: string;
  merkleRoot: string;
  network: string;
  timestamp: string;
}

interface StoredPassportPayload {
  engineVersion: string;
  compacts: CompactEligibilityV2Result[];
  mobilityScore: MobilityScoreBreakdown;
  reciprocityPaths: ReciprocityPathway[];
  waiverEligibility: WaiverEligibilityResult;
  anomalies: PassportAnomaly[];
  metrics: MobilityPassportMetrics;
  generatedAt: string;
  snapshotHash: string;
  anchor?: AnchorSummary | null;
}

export async function getMobilityPassportSnapshot(
  clinicianId: string,
  options: MobilityPassportOptions = {},
): Promise<MobilityPassportSnapshot> {
  const client = options.prisma ?? prisma;
  const existing = await client.mobilityPassport.findUnique({
    where: { clinicianId },
  });

  const needsRefresh =
    options.refresh ||
    !existing ||
    (existing.updatedAt ? isStale(existing.updatedAt) : true) ||
    !isStoredPayload(existing);

  if (needsRefresh) {
    return recomputeMobilityPassport(client, clinicianId);
  }

  return hydrateSnapshot(existing);
}

async function recomputeMobilityPassport(
  client: PrismaClient,
  clinicianId: string,
): Promise<MobilityPassportSnapshot> {
  const compactResult = await runCompactEligibilityEngineV2(clinicianId, { prisma: client });
  const licenses = compactResult.profile.licenses ?? [];
  const activeStates = dedupeStates(
    licenses.filter((license) => license.status === 'active').map((license) => license.state),
  );

  const [globalLicenses, foreignCredentials, compactRecords] = await Promise.all([
    client.globalLicense.findMany({ where: { clinicianId } }),
    client.foreignCredential.findMany({ where: { clinicianId } }),
    client.compactEligibility.findMany({ where: { clinicianId } }),
  ]);

  const reciprocityPaths = buildGlobalReciprocityMap({
    foreignCredentials,
    globalLicenses,
  });

  const mobilityScore = calculateMobilityScore({
    licenseCount: activeStates.length,
    compactEligibleCount: compactResult.compacts.filter((entry) => entry.status === 'eligible').length,
    reciprocityReadyCount: reciprocityPaths.filter((path) => path.status !== 'research').length,
  });

  const waiverEligibility = evaluateWaiverEligibility({
    licenseStates: activeStates,
    compacts: compactResult.compacts,
  });

  const statesEligible = dedupeStates([
    ...activeStates,
    ...compactResult.compacts.flatMap((entry) => entry.authorizedStates),
    ...waiverEligibility.programs.filter((program) => program.eligible).map((program) => program.state),
  ]);

  const countries = dedupeStates(
    reciprocityPaths
      .filter((path) => path.status !== 'research')
      .map((path) => path.origin),
  );

  const anomalies = detectPassportAnomalies({
    statesEligible,
    compactResults: compactResult.compacts,
    compactRecords: compactRecords.map((record) => ({
      compact: record.compact,
      eligible: record.eligible,
    })),
  });

  const metrics: MobilityPassportMetrics = {
    licenseBreadth: activeStates.length,
    compactCount: compactResult.compacts.filter((entry) => entry.status === 'eligible').length,
    reciprocityReady: reciprocityPaths.filter((path) => path.status === 'ready').length,
  };

  const snapshotHash = hashSnapshot({
    clinicianId,
    statesEligible,
    countries,
    compacts: compactResult.compacts,
    mobilityScore,
    reciprocityPaths,
    waiverEligibility,
    metrics,
  });

  let storedPayload: StoredPassportPayload = {
    engineVersion: compactResult.engineVersion,
    compacts: compactResult.compacts,
    mobilityScore,
    reciprocityPaths,
    waiverEligibility,
    anomalies,
    metrics,
    generatedAt: new Date().toISOString(),
    snapshotHash,
    anchor: null,
  };

  const record = await client.mobilityPassport.upsert({
    where: { clinicianId },
    update: {
      statesEligible,
      countries,
      compactStatus: storedPayload as Prisma.JsonValue,
    },
    create: {
      clinicianId,
      statesEligible,
      countries,
      compactStatus: storedPayload as Prisma.JsonValue,
    },
  });

  const anchorRecord = anchorMobilitySnapshot({
    clinicianId,
    passportId: record.id,
    mobilityScore: mobilityScore.total,
    statesEligible,
    compacts: compactResult.compacts.map((entry) => ({
      compact: entry.compact,
      status: entry.status,
      coverage: entry.authorizedStates.length,
    })),
    countries,
    snapshotHash,
  });

  if (anchorRecord) {
    storedPayload = {
      ...storedPayload,
      anchor: {
        id: anchorRecord.id,
        txHash: anchorRecord.txHash,
        merkleRoot: anchorRecord.merkleRoot,
        network: anchorRecord.network,
        timestamp: anchorRecord.payload.timestamp,
      },
    };

    await client.mobilityPassport.update({
      where: { id: record.id },
      data: { compactStatus: storedPayload as Prisma.JsonValue },
    });
  }

  const pdf = generateMobilityPassportPdf({
    clinicianId,
    statesEligible,
    countries,
    mobilityScore,
    compacts: compactResult.compacts,
    reciprocityPaths,
    waiverEligibility,
  });

  return buildSnapshotResponse(record, storedPayload, pdf);
}

function hydrateSnapshot(record: MobilityPassportModel & { compactStatus: Prisma.JsonValue }): MobilityPassportSnapshot {
  const payload = record.compactStatus as StoredPassportPayload;
  const pdf = generateMobilityPassportPdf({
    clinicianId: record.clinicianId,
    statesEligible: record.statesEligible ?? [],
    countries: record.countries ?? [],
    mobilityScore: payload.mobilityScore,
    compacts: payload.compacts,
    reciprocityPaths: payload.reciprocityPaths,
    waiverEligibility: payload.waiverEligibility,
  });
  return buildSnapshotResponse(record, payload, pdf);
}

function buildSnapshotResponse(
  record: MobilityPassportModel,
  payload: StoredPassportPayload,
  pdf: MobilityPassportPdf,
): MobilityPassportSnapshot {
  return {
    passportId: record.id,
    clinicianId: record.clinicianId,
    updatedAt: record.updatedAt.toISOString(),
    generatedAt: payload.generatedAt ?? record.updatedAt.toISOString(),
    statesEligible: record.statesEligible ?? [],
    countries: record.countries ?? [],
    mobilityScore: payload.mobilityScore,
    compacts: payload.compacts,
    reciprocityPaths: payload.reciprocityPaths,
    waiverEligibility: payload.waiverEligibility,
    anomalies: payload.anomalies,
    metrics: payload.metrics,
    pdf,
    anchor: payload.anchor ?? null,
    snapshotHash: payload.snapshotHash,
  };
}

function isStoredPayload(record: MobilityPassportModel | null): record is MobilityPassportModel & {
  compactStatus: StoredPassportPayload;
} {
  if (!record) return false;
  const payload = record.compactStatus as StoredPassportPayload | undefined;
  return (
    !!payload &&
    Array.isArray(payload.compacts) &&
    !!payload.mobilityScore &&
    !!payload.reciprocityPaths &&
    !!payload.waiverEligibility
  );
}

function isStale(updatedAt: Date): boolean {
  const ageMinutes = (Date.now() - updatedAt.getTime()) / 60000;
  return ageMinutes >= STALE_MINUTES;
}

function dedupeStates(states: Array<string | null | undefined>): string[] {
  const set = new Set<string>();
  states
    .map((state) => (state ?? '').toUpperCase())
    .filter(Boolean)
    .forEach((state) => set.add(state));
  return Array.from(set);
}

function hashSnapshot(input: {
  clinicianId: string;
  statesEligible: string[];
  countries: string[];
  compacts: CompactEligibilityV2Result[];
  mobilityScore: MobilityScoreBreakdown;
  reciprocityPaths: ReciprocityPathway[];
  waiverEligibility: WaiverEligibilityResult;
  metrics: MobilityPassportMetrics;
}): string {
  const canonical = JSON.stringify({
    clinicianId: input.clinicianId,
    statesEligible: [...input.statesEligible].sort(),
    countries: [...input.countries].sort(),
    compacts: input.compacts.map((entry) => ({
      compact: entry.compact,
      status: entry.status,
      coverage: entry.authorizedStates.length,
    })),
    score: input.mobilityScore.total,
    reciprocity: input.reciprocityPaths.map((path) => ({
      id: path.id,
      status: path.status,
    })),
    waiverStatus: input.waiverEligibility.status,
    metrics: input.metrics,
  });
  return createHash('sha256').update(canonical).digest('hex');
}









